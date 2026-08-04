import { db } from './db';
import http from 'http';
import https from 'https';

const PODCAST_SERVICE_URL = process.env.PODCAST_SERVICE_URL || 'http://host.docker.internal:8765';

export interface GeneratePodcastOptions {
  questionIds?: string[];
  topicId?: string;
  topicName?: string;
  tone?: string;
  length?: string;
  language?: string;
}

export interface QuestionRow {
  id: string;
  global_id: number;
  num: number;
  topic: string;
  question: string;
  answer: string;
}

/**
 * Fetch questions from SQLite DB and format a combined prompt for Open-NotebookLM.
 */
export function buildPodcastText(questionIds?: string[], topicName?: string): { text: string; topic: string } {
  let questions: QuestionRow[] = [];

  if (questionIds && questionIds.length > 0) {
    const placeholders = questionIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders}) ORDER BY num ASC`);
    questions = stmt.all(...questionIds) as QuestionRow[];
  } else if (topicName) {
    const stmt = db.prepare(`SELECT * FROM questions WHERE topic = ? ORDER BY num ASC LIMIT 10`);
    questions = stmt.all(topicName) as QuestionRow[];
  }

  if (questions.length === 0) {
    throw new Error('No questions found for podcast generation.');
  }

  const topic = topicName || questions[0].topic || 'Java & Spring Interview Prep';

  let text = `Topic: ${topic}\n\nHere are the interview questions and detailed answers to discuss in the audio podcast recap:\n\n`;

  questions.forEach((q, idx) => {
    text += `Question #${idx + 1} (${q.topic}): ${q.question}\n`;
    text += `Answer: ${q.answer}\n\n`;
  });

  return { text, topic };
}

/**
 * Trigger job on Open-NotebookLM microservice.
 */
export async function startPodcastJob(options: GeneratePodcastOptions): Promise<any> {
  const { text, topic } = buildPodcastText(options.questionIds, options.topicName);

  const payload = JSON.stringify({
    text: text,
    question: `Audio recap of interview questions for topic: ${topic}`,
    tone: options.tone || 'Fun',
    length: options.length || 'Medium (3-5 min)',
    language: options.language || 'Russian',
  });

  const url = `${PODCAST_SERVICE_URL}/api/v1/jobs`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Open-NotebookLM service error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Fetch status of a job from Open-NotebookLM microservice.
 */
export async function fetchJobStatus(jobId: string): Promise<any> {
  const url = `${PODCAST_SERVICE_URL}/api/v1/jobs/${jobId}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch job status (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Stream MP3 audio from Open-NotebookLM microservice to response.
 */
export async function streamAudioFile(jobId: string): Promise<Response> {
  const url = `${PODCAST_SERVICE_URL}/api/v1/jobs/${jobId}/audio`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch audio for job ${jobId}`);
  }

  return response;
}
