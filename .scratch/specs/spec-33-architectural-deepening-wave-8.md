# Spec 33: Architectural Deepening Wave 8 — Company Prep Studio, Audio Pill, Voice Lobby & Practice Catalog Decoupling

## 1. Intent & Workload Envelope
- **Context & Glossary**: Aligned with [GLOSSARY.md](../../GLOSSARY.md), [docs/adr/0001-sota-2026-design-patterns-practice.md](../../docs/adr/0001-sota-2026-design-patterns-practice.md), and [docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md](../../docs/architecture/specs/AUTO_VAD_LIVE_AUDIO_SPECIFICATION.md).
- **Operating Envelope**:
  - UI State Transitions: <16ms (60 FPS rendering) across Company Prep Studio tab navigation, audio popover toggles, lobby mode switches, and practice catalog filtering.
  - Cognitive Bounding SLA: All new files $\le 350$ lines, all modified files $\le 400$ lines (Rule 8 strictly enforced).
  - Test Seams: Pure React hooks and headless state machines with zero-JSX unit testability.

---

## 2. Explicit Non-Goals (Blast-Radius Protection)
The implementation agent is **strictly forbidden from modifying**:
1. `backend/src/services/live/` (Gemini Live audio streaming router and DownstreamClientPipe are sealed).
2. `frontend/src/audio/NativeLiveVoiceEngine.ts` and `frontend/src/audio/LiveVoiceStateMachine.ts` (Auto-VAD and Dual-Sided Handshake remain immutable).
3. `backend/src/prompts/` (Prompt invariant and anti-sycophancy directives remain untouched).
4. Database schemas and SQLite migration files (All database structures are frozen).

---

## 3. Pre-Agreed Verification Seams

| Subsystem | Primary Seam Path | Dependency Scope | Verification Target |
| :--- | :--- | :--- | :--- |
| **Company Prep Studio Session** | `frontend/src/components/companies/hooks/useCompanyStudioSession.ts` | Pure in-process React hook | Profile fetching, CRI readiness calculation, localStorage stage persistence, polymorphic Copilot context synchronization |
| **Global Audio Control Pill** | `frontend/src/components/voice/audio_pill/useGlobalAudioPill.ts` | HTML5 Audio & config hook | Voice preview audio playback, popover outside-click/Escape listeners, grade/turnMode shortcuts |
| **Voice Lobby Presentation** | `frontend/src/components/voice/lobby/VoiceLobbyHero.tsx` & `VoiceLobbyModeSwitches.tsx` | Pure UI presentation | Hero avatar/mode badges, language toggle (RU/EN), deep dive, turbo-prefetch toggle |
| **Practice Catalog Filter Engine** | `frontend/src/components/practice/hooks/usePracticeCatalogFilter.ts` | Pure filter hook & catalog state | Multi-axis category/archetype/status filtering, search query matching, challenge selection fallback |

---

## 4. Formal Wire & Domain Contracts

### 4.1. Issue 01: Company Prep Studio Session & Header Decoupling
```typescript
// frontend/src/components/companies/hooks/useCompanyStudioSession.ts
export interface UseCompanyStudioSessionReturn {
  profile: CompanyProfile | null;
  readinessIndex: number;
  handleLaunchStage: (stage: CompanyPipelineStage) => void;
  handleNavigateToTask: (taskId: string, explicitArena?: TargetArena) => void;
  fetchProfiles: () => Promise<void>;
  fetchReadiness: () => Promise<void>;
}
```
- `CompanyPrepStudio.tsx`: Collapses from 365 lines to $\le 140$ lines.
- `useCompanyStudioSession.ts`: Owns backend fetching, local storage persistence, and Copilot context syncing ($\le 180$ lines).
- `CompanyPrepStudioHeader.tsx`: Owns brand banner and sub-tab navigation buttons ($\le 90$ lines).

### 4.2. Issue 02: Global Audio Control Pill & Quick-Switch Drawer Decoupling
```typescript
// frontend/src/components/voice/audio_pill/useGlobalAudioPill.ts
export interface UseGlobalAudioPillReturn {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  isAdvancedOpen: boolean;
  setIsAdvancedOpen: (val: boolean) => void;
  previewingVoice: GeminiVoiceName | null;
  playVoicePreview: (voice: GeminiVoiceName) => Promise<void>;
  turnMode: TurnMode;
  voice: GeminiVoiceName;
  targetGrade: TargetGrade;
  popoverRef: React.RefObject<HTMLDivElement>;
  getGradeShort: (g: TargetGrade) => string;
}
```
- `GlobalAudioControlPill.tsx`: Collapses from 378 lines to $\le 130$ lines.
- `useGlobalAudioPill.ts`: Owns audio preview playback and popover event listeners ($\le 120$ lines).
- `GlobalAudioDrawerContent.tsx`: Owns popover options, turn mode toggles, and voice selectors ($\le 150$ lines).

### 4.3. Issue 03: Voice Lobby Hero & Mode Switches Decoupling
```typescript
// frontend/src/components/voice/lobby/VoiceLobbyHero.tsx
export interface VoiceLobbyHeroProps {
  persona: string;
  strategy: string;
  isBatchMode: boolean;
  totalQuestions: number;
  targetGrade?: string;
  turnMode?: string;
  voice?: string;
}
```
- `VoiceLobbyView.tsx`: Collapses from 354 lines to $\le 140$ lines.
- `VoiceLobbyHero.tsx`: Owns avatar, persona badges, turn mode pill, and strategy description ($\le 90$ lines).
- `VoiceLobbyModeSwitches.tsx`: Owns RU/EN language toggle and Deep-Dive toggle ($\le 90$ lines).

### 4.4. Issue 04: Practice Catalog Filter Engine
```typescript
// frontend/src/components/practice/hooks/usePracticeCatalogFilter.ts
export interface UsePracticeCatalogFilterReturn {
  challenges: CodingChallenge[];
  filteredChallenges: CodingChallenge[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: ChallengeCategory;
  setSelectedCategory: (cat: ChallengeCategory) => void;
  selectedArchetype: string;
  setSelectedArchetype: (arch: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  collapsedGrades: Record<string, boolean>;
  toggleGrade: (gradeId: string) => void;
  fetchChallenges: () => Promise<void>;
}
```
- `PracticeCatalog.tsx`: Collapses from 364 lines to $\le 150$ lines.
- `usePracticeCatalogFilter.ts`: Pure headless filter and search engine ($\le 160$ lines).

---

## 5. Hoare-Logic Behavioral Contracts ({P} C {Q})

### 5.1. Company Prep Studio Navigation
- **Pre-Conditions {P}**: User selects stage $S$ or runbook task $T$ with target arena $A$.
- **Algorithm C**: `resolveStageTarget` or `resolveRunbookTaskTarget` calculates destination entity ID and arena type, and dispatches `launchArenaTask`.
- **Post-Conditions {Q}**: Target arena opens with pre-hydrated entity context; Copilot state synchronizes.

### 5.2. Audio Voice Preview Playback
- **Pre-Conditions {P}**: User clicks play preview for voice $V$. No preview currently playing.
- **Algorithm C**: Fetch `/api/interview/greeting`, decode Base64 WAV, play via audio element, clear previewing state on `onended` or `onerror`.
- **Post-Conditions {Q}**: Sound plays to completion without blocking UI event loop.
