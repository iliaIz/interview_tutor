/**
 * ExecutiveReportPresenter.ts
 * Pure domain presenter transforming raw interview evaluation payloads into
 * deterministic executive report view models.
 * SLA: <= 200 lines (Rule 8 compliant).
 */

import { AcousticTelemetryService, AcousticMetrics, SpeechClarityMetrics, HumanizedAcousticProfile } from '../AcousticTelemetryService';
import { FaangScorecardData, InterviewPersonaId } from '../../types/personas';

export interface DialogueTurnDTO {
  role: 'ai' | 'user' | 'system';
  text: string;
}

export interface ExecutiveReportViewModel {
  header: {
    topic: string;
    mode: 'voice' | 'text';
    formattedDate?: string;
  };
  scoreBadge: {
    score: number;
    isPassed: boolean;
    label: string;
  };
  questionText?: string;
  referenceAnswer?: string;
  feedback: string;
  positivePoints: string[];
  missingPoints: string[];
  acousticProfile: {
    metrics: AcousticMetrics;
    humanProfile: HumanizedAcousticProfile;
  } | null;
  rephrasedExample?: string;
  structureType?: string;
  faangScorecard?: FaangScorecardData;
  persona?: InterviewPersonaId;
  transcript: {
    isStructured: boolean;
    dialogueTurns: DialogueTurnDTO[];
    deepgramAnswer?: string;
    rawText?: string;
  } | null;
}

export class ExecutiveReportPresenter {
  /**
   * Constructs typed ExecutiveReportViewModel from raw report payload.
   */
  static createViewModel(report: any): ExecutiveReportViewModel {
    const score = report.score ?? 0;
    const isPassed = Boolean(report.isPassed);

    // 1. Format date
    let formattedDate: string | undefined;
    if (report.createdAt) {
      try {
        formattedDate = new Date(report.createdAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {}
    }

    // 2. Parse Transcript & Nova-3 Prefixes
    let transcriptData: ExecutiveReportViewModel['transcript'] = null;
    const rawTranscript = report.transcript || report.userAnswer;

    if (rawTranscript) {
      let isStructured = false;
      let dialogueTurns: DialogueTurnDTO[] = [];
      let deepgramAnswer: string | undefined;

      try {
        const parsed = JSON.parse(rawTranscript);
        if (Array.isArray(parsed)) {
          isStructured = true;
          dialogueTurns = parsed
            .filter((t) => !t.text?.startsWith('[Deepgram]'))
            .map((t) => ({ role: t.role || 'ai', text: t.text || '' }));

          const deepgramTurn = parsed.find((t) => t.text?.startsWith('[Deepgram]'));
          if (deepgramTurn) {
            deepgramAnswer = deepgramTurn.text.replace('[Deepgram] ', '');
          }
        }
      } catch {
        // Plain text fallback
      }

      transcriptData = {
        isStructured,
        dialogueTurns,
        deepgramAnswer,
        rawText: rawTranscript
      };
    }

    // 3. Acoustic Voice Profile
    let acousticProfile: ExecutiveReportViewModel['acousticProfile'] = null;
    if (report.audioMetrics) {
      const calculatedClarity = report.clarityMetrics || (
        report.transcript
          ? AcousticTelemetryService.analyzeSpeechClarity(report.transcript, report.audioMetrics.grossWpm)
          : undefined
      );
      const humanProfile = AcousticTelemetryService.getHumanizedProfile(report.audioMetrics, calculatedClarity);
      acousticProfile = {
        metrics: report.audioMetrics,
        humanProfile
      };
    }

    return {
      header: {
        topic: report.topic || 'Java & Spring Framework',
        mode: report.mode || 'text',
        formattedDate
      },
      scoreBadge: {
        score,
        isPassed,
        label: isPassed ? 'Отличный ответ • Зачтено 🎉' : 'Хорошая попытка • Зона роста'
      },
      questionText: report.questionText,
      referenceAnswer: report.referenceAnswer,
      feedback: report.feedback || 'Ответ внимательно проанализирован и сохранен в прогресс.',
      positivePoints: report.positivePoints || [],
      missingPoints: report.missingPoints || [],
      acousticProfile,
      rephrasedExample: report.speechCoaching?.rephrasedExample,
      structureType: report.speechCoaching?.structureType,
      faangScorecard: report.faangScorecard || report.speechCoaching?.faangScorecard,
      persona: report.persona,
      transcript: transcriptData
    };
  }
}
