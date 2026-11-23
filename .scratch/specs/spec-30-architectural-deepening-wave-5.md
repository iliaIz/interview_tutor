# Spec 30: Architectural Deepening Wave 5 — Domain Encapsulation, Dead Code Elimination & Seam Hardening

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/adr/0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md), [docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md](../../docs/adr/0003-omnipresent-ai-copilot-and-company-track-enrichment.md), and [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - Frontend Render Latency: Sub-16ms (60-120 FPS virtualization).
  - Pure In-Process Audio DSP: <1ms per 100ms PCM chunk without DOM or CSS dependencies.
  - Backend SQLite Catalog Queries: <5ms response time for paginated challenge listings and draft updates.
  - Cognitive Bounding SLA: All new files $\le 350$ lines, all modified files $\le 400$ lines (Rule 8 compliant).

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/` (Gemini Live audio streaming router and DownstreamClientPipe are sealed).
2. `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts` (Auto-VAD and Dual-Sided Handshake remain immutable).
3. `backend/src/prompts/` (Prompt invariant and anti-sycophancy directives remain untouched).
4. `frontend/src/services/CompanyTrackContextAdapter.ts` and `frontend/src/components/companies/` (Spec 29 deliveries are frozen).
5. `json/coding_challenges.json` and SQLite database schemas (Database migrations must remain additive; table structures are frozen).

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **Bug Challenge Studio** | `frontend/src/hooks/useBugChallengeInspection.ts` & `frontend/src/utils/diff.ts` | Pure in-process Vitest / headless unit | Unified diff string matching, takeaway parsing, AST rule integration |
| **Dead Code Cleanup** | `frontend/src/hooks/useLiveKitAudioSession.ts` | File removal | Zero broken imports across frontend & backend |
| **Acoustic Telemetry** | `frontend/src/services/audio/AcousticDspEngine.ts` & `frontend/src/services/AcousticTelemetryService.ts` | In-process PCM Float32 arrays | RMS dB, SNR dB, 30-pt energy vector downsampling, backward compatibility facade |
| **Practice Catalog** | `backend/src/services/practice/PracticeChallengeCatalog.ts` & `backend/src/routes/practice.ts` | Real SQLite `db` fixture | Challenge listings, user submission resolution, draft saving, Maven packaging |
| **Code Viewer Model** | `frontend/src/hooks/useCodeViewerModel.ts` & `frontend/src/utils/prismLogGrammar.ts` | In-process Prism grammar & selection | Deictic line range calculation, search matches, SRE log syntax tokenization |

---

## 4. Formal Wire & Domain Contracts

### 4.1. Issue 01: Bug Challenge Domain Model & Presentation Slicing
```typescript
// frontend/src/utils/diff.ts
export function generateUnifiedDiff(original: string, fixed: string): string;

// frontend/src/hooks/useBugChallengeInspection.ts
export interface BugChallengeInspection {
  unifiedDiff: string;
  astViolations: string[];
  takeaways: string[];
  isBookmarked: boolean;
  toggleBookmark: () => void;
}
export function useBugChallengeInspection(challenge: BugChallenge): BugChallengeInspection;
```
UI decomposition:
- `BugChallengeHeader.tsx` ($\le 150$ lines): Title, subtopic, difficulty badges, action dock.
- `BugIncidentAccordion.tsx` ($\le 180$ lines): Production incident symptoms, system architecture, business impact.
- `BugSolutionPanel.tsx` ($\le 200$ lines): View mode toggles (`diff` | `fixed` | `test`), unified diff rendering, solution explanation.
- `BugChallengeCard.tsx` ($\le 160$ lines): Root coordinator assembling the subcomponents.

### 4.2. Issue 02: Dead Code Prototype Purge (`useLiveKitAudioSession.ts`)
- Delete `frontend/src/hooks/useLiveKitAudioSession.ts` (550 lines).
- Verify zero orphan imports via `git grep "useLiveKitAudioSession"`.

### 4.3. Issue 03: Acoustic Telemetry DSP Decoupling
```typescript
// frontend/src/services/audio/AcousticDspEngine.ts
export class AcousticDspEngine {
  static computeMetrics(samples: Float32Array, sampleRate: number, wordTimestamps?: Array<{ start: number; end: number }>): AcousticMetrics;
  static resampleEnergyVector(energies: number[], targetPoints?: number): number[];
}

// frontend/src/services/audio/SpeechClarityAnalyzer.ts
export class SpeechClarityAnalyzer {
  static analyze(transcript: string, grossWpm?: number): SpeechClarityMetrics;
}

// frontend/src/services/audio/QuestionFrameworkClassifier.ts
export class QuestionFrameworkClassifier {
  static classify(questionText: string, topic?: string): QuestionStructureFormat;
}

// frontend/src/services/AcousticTelemetryService.ts
// Thin facade delegating to the 3 domain engines, maintaining 100% backward compatibility.
```

### 4.4. Issue 04: Backend Practice Challenge Catalog & Persistence Seam
```typescript
// backend/src/services/practice/PracticeChallengeCatalog.ts
export interface ChallengeFilter {
  category?: string;
  track?: string;
}

export interface PracticeChallengeCatalogItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  track: string;
  badge: string;
  difficulty: string;
  targetStack: string;
  timeLimitMinutes: number;
  shortDescription: string;
  taskCode: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'NOT_STARTED';
  updatedAt: string;
}

export interface IPracticeChallengeCatalog {
  listChallenges(filter: ChallengeFilter, userId: string): PracticeChallengeCatalogItem[];
  getChallengeManifest(challengeIdOrSlug: string, userId: string): any;
  saveDraft(userId: string, draft: { challengeId: string; files: any[]; timeSpentSeconds?: number }): any;
  resetWorkspace(userId: string, challengeId: string): void;
  exportMavenPackage(challengeIdOrSlug: string, userId: string): { filename: string; buffer: Buffer };
}
```

### 4.5. Issue 05: Code Viewer SRE Grammars & Theme Decoupling
```typescript
// frontend/src/themes/velvetObsidianTheme.ts
export const velvetObsidianTheme: PrismTheme;

// frontend/src/utils/prismLogGrammar.ts
export function registerSreLogGrammar(prismInstance: any): void;

// frontend/src/hooks/useCodeViewerModel.ts
export function useCodeViewerModel(props: CodeViewerProps): {
  normalizedLines: string[];
  linesMetadata: LineMetadata[];
  totalMatches: number;
  isLineInFocus: (lineNum: number) => boolean;
  handleGutterClick: (lineNum: number, e: React.MouseEvent) => void;
};
```

---

## 5. Storage & Invariants Contract
- **No SQLite Table Modifications**: All `coding_challenges` and `coding_submissions` schemas remain intact.
- **Strict File Limits (Rule 8)**: Every new file is strictly $\le 350$ lines, every modified file is $\le 400$ lines.
- **Single Responsibility (SRP)**: Mathematical DSP is decoupled from CSS strings; Express routes are decoupled from raw SQL queries.

---

## 6. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 6.1. Practice Catalog Query
- **Pre-Conditions {P}**: User is authenticated (or anonymous fallback ID provided); filter parameters sanitized.
- **Algorithm C**: Execute parameterized SQLite query on `coding_challenges`, left join with `coding_submissions` for the specified `user_id`, map score threshold $\ge 70$ to `COMPLETED`, merge Spring Transaction catalog if applicable.
- **Post-Conditions {Q}**: Returns typed array of `PracticeChallengeCatalogItem` with exact status, zero raw SQL leaked to caller.

### 6.2. Acoustic DSP Computation
- **Pre-Conditions {P}**: Float32Array PCM samples provided ($\ge 0$ length).
- **Algorithm C**: Calculate RMS dBFS clamped against EPSILON, determine 10th percentile noise floor, compute SNR dB, calculate gross/net WPM based on speech segments, resample energy vector to exactly 30 points.
- **Post-Conditions {Q}**: Returns deterministic `AcousticMetrics` with exact values, zero DOM references.
