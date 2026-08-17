# Architectural Guidelines & Invariants for InterviewPrep AI

## 1. LiteLLM Proxy Invariant (No Direct Provider Calls / No Hardcoded Keys)
- All LLM, Live Audio WebSocket, and TTS interactions MUST route strictly through `LiteLLM_Proxy` (`D:\projects\LiteLLM_Proxy`) running in Docker:
  - HTTP REST endpoints: `${LITELLM_PROXY_URL}` (`http://host.docker.internal:4000/v1` or `http://localhost:4000/v1`).
  - Live Multimodal WebSocket endpoint: `ws://host.docker.internal:4000/ws/live?model=${GEMINI_LIVE_MODEL}&token=${LITELLM_API_KEY}`.
- NEVER hardcode Google API keys (`AQ.*`) or internal upstream model names (`gemini-2.5-flash-native-audio-latest`, etc.) in the application code.
- Always use environment variables:
  - `GEMINI_TEXT_MODEL` (e.g. `gemini-smart`)
  - `GEMINI_LIVE_MODEL` (e.g. `gemini-live` / `gemini-tts-live-v3`)
  - `GEMINI_TTS_MODEL` (e.g. `gemini-tts-v3`)
  - `LITELLM_API_KEY` (virtual key for proxy authorization)
- Dynamic model mapping, API key pool failover, and protocol adaptations are handled centrally by `LiteLLM_Proxy` (`D:\projects\LiteLLM_Proxy\gateway\main.py`).

## 2. Gemini Live Realtime Audio Architecture
- Protocol: Bi-directional WebSocket (`/ws/live`).
- Model setup: Client sends virtual alias in `setupMessage`. `LiteLLM Gateway` dynamically rewrites `setup.model` to the real upstream model configured in LiteLLM DB.
- Initiation: Upon receiving `setupComplete`, the backend triggers an initial user turn so the AI interviewer proactively greets the candidate and speaks the question aloud.
- Function Calling: When the user finishes the answer, the AI interviewer invokes `submit_interview_evaluation(score, isPassed, positivePoints, missingPoints, spokenFeedback)`. The backend saves the structured result into the SQLite database (`question_evaluations`) and returns a tool response.
- Audio Playout: 24kHz Int16/Float32 mono PCM streamed as chunks. Web Audio API playback must handle browser autoplay policies via user gesture (`onClick`) and queue pending samples.
- Safety Fallback: A 6.5-second timeout fallback ensures that if Gemini Live experiences network lag, the client automatically requests `/api/eval` so the user is never stuck.

## 3. UI/UX Standard & Aesthetic Principles
- Target Audience: Soft luxury pastel aesthetics (`#FFF0F5`, lavender, rose, gentle mesh glow auras).
- Audio Session: 3-Stage flow (Lobby -> Active Session -> Verdict with 1-click retry).
- Health Monitoring: `/api/health` validates liveness AND checks the presence of all 3 required models (`GEMINI_TEXT_MODEL`, `GEMINI_LIVE_MODEL`, `GEMINI_TTS_MODEL`) in the LiteLLM registry.
