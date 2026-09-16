# Gemini 3.8 Live Extended Thinking WebSocket Protocol Specification: State Machines, Interaction Lifecycles, and Audio Playout Invariants

## Architectural Foundations and Native Audio Protocol Specification
The release of Google's Gemini 3.8 Audio model family marks a fundamental transition in conversational voice systems, shifting away from cascaded pipelines—which sequentially glue together automated speech recognition, text-based large language models, and text-to-speech synthesizers—toward native, full-duplex speech-to-speech architectures. Within this family, `gemini-3.8-live` serves as the high-throughput, low-latency foundation for direct conversational exchanges, whereas `gemini-3.8-live-extended-thinking` embeds an internal reasoning loop directly within the live audio session. This dual-architecture design enables the model to execute complex planning, invoke asynchronous external tools, and generate natural conversational audio fillers concurrently, resolving the longstanding problem of dead air during complex model deliberation.
On benchmark evaluations, `gemini-3.8-live-extended-thinking` achieved an 82.6 overall score on Artificial Analysis' Speech to Speech Quality Index, alongside 68.6% on the $\tau$-Voice benchmark, 35.1% on the Sierra $\tau$-Voice-banking benchmark, and 97.7% on Big Bench Audio. The operational economics reflect this integrated architecture: upstream audio input is billed at $3.00 per million tokens (approximately $0.005 per minute) and audio output at $12.00 per million tokens (approximately $0.018 per minute), with thinking tokens inclusive within the output rate. The model operates across an input context window of 131,072 tokens and an output context window of 65,536 tokens, maintaining automatic mid-conversation code-switching across 97 languages.
The communication transport relies on a persistent bidirectional WebSocket connection established at `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`. The protocol requires JSON-formatted messages, strictly separating upstream client commands (`BidiGenerateContentClientMessage`) from downstream server emissions (`BidiGenerateContentServerMessage`).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BidiGenerateContentClientMessage",
  "type": "object",
  "description": "Top-level frame sent from client to server over the Gemini Live WebSocket connection.",
  "oneOf": [
    { "required": ["setup"], "properties": { "setup": { "$ref": "#/definitions/BidiGenerateContentSetup" } } },
    { "required": ["realtimeInput"], "properties": { "realtimeInput": { "$ref": "#/definitions/BidiGenerateContentRealtimeInput" } } },
    { "required": ["clientContent"], "properties": { "clientContent": { "$ref": "#/definitions/BidiGenerateContentClientContent" } } },
    { "required": ["toolResponse"], "properties": { "toolResponse": { "$ref": "#/definitions/BidiGenerateContentToolResponse" } } }
  ],
  "definitions": {
    "BidiGenerateContentSetup": {
      "type": "object",
      "required": ["model"],
      "properties": {
        "model": { 
          "type": "string", 
          "enum": ["models/gemini-3.8-live-extended-thinking", "models/gemini-3.8-live"] 
        },
        "generationConfig": {
          "type": "object",
          "required": ["responseModalities"],
          "properties": {
            "responseModalities": { 
              "type": "array", 
              "items": { "type": "string", "enum": ["AUDIO", "TEXT"] } 
            },
            "speechConfig": {
              "type": "object",
              "properties": {
                "voiceConfig": {
                  "type": "object",
                  "required": ["prebuiltVoiceConfig"],
                  "properties": {
                    "prebuiltVoiceConfig": {
                      "type": "object",
                      "required": ["voiceName"],
                      "properties": { "voiceName": { "type": "string" } }
                    }
                  }
                }
              }
            },
            "thinkingConfig": {
              "type": "object",
              "properties": {
                "thinkingLevel": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH"] },
                "includeThoughts": { "type": "boolean" }
              }
            },
            "temperature": { "type": "number", "minimum": 0.0, "maximum": 2.0 }
          }
        },
        "systemInstruction": {
          "type": "object",
          "properties": {
            "parts": {
              "type": "array",
              "items": { "type": "object", "required": ["text"], "properties": { "text": { "type": "string" } } }
            }
          }
        },
        "tools": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "functionDeclarations": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["name", "description", "behavior"],
                  "properties": {
                    "name": { "type": "string" },
                    "description": { "type": "string" },
                    "behavior": { "type": "string", "enum": ["NON_BLOCKING"] },
                    "parameters": { "type": "object" }
                  }
                }
              }
            }
          }
        },
        "realtimeInputConfig": {
          "type": "object",
          "properties": {
            "automaticActivityDetection": {
              "type": "object",
              "properties": {
                "disabled": { "type": "boolean" },
                "startOfSpeechSensitivity": { "type": "string", "enum": ["START_SENSITIVITY_LOW", "START_SENSITIVITY_HIGH"] },
                "prefixPaddingMs": { "type": "integer" },
                "endOfSpeechSensitivity": { "type": "string", "enum": ["END_SENSITIVITY_LOW", "END_SENSITIVITY_HIGH"] },
                "silenceDurationMs": { "type": "integer" }
              }
            },
            "activityHandling": {
              "type": "string",
              "enum": ["START_OF_ACTIVITY_INTERRUPTS", "NO_INTERRUPTION"]
            }
          }
        }
      }
    },
    "BidiGenerateContentRealtimeInput": {
      "type": "object",
      "properties": {
        "audio": {
          "type": "object",
          "required": ["data", "mimeType"],
          "properties": {
            "mimeType": { "type": "string", "enum": ["audio/pcm;rate=16000"] },
            "data": { "type": "string", "description": "Base64-encoded raw 16-bit linear PCM audio chunk" }
          }
        }
      }
    },
    "BidiGenerateContentClientContent": {
      "type": "object",
      "properties": {
        "turns": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["role", "parts"],
            "properties": {
              "role": { "type": "string", "enum": ["user", "model"] },
              "parts": { "type": "array", "items": { "type": "object" } }
            }
          }
        },
        "turnComplete": { "type": "boolean" }
      }
    },
    "BidiGenerateContentToolResponse": {
      "type": "object",
      "required": ["functionResponses"],
      "properties": {
        "functionResponses": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "response"],
            "properties": {
              "id": { "type": "string" },
              "response": { "type": "object" }
            }
          }
        }
      }
    }
  }
}

```

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "BidiGenerateContentServerMessage",
  "type": "object",
  "description": "Top-level frame emitted from server to client over the Gemini Live WebSocket connection.",
  "properties": {
    "usageMetadata": { "type": "object" },
    "setupComplete": { "type": "object" },
    "serverContent": { "$ref": "#/definitions/LiveServerContent" },
    "toolCall": { "$ref": "#/definitions/BidiGenerateContentToolCall" },
    "toolCallCancellation": { "$ref": "#/definitions/BidiGenerateContentToolCallCancellation" },
    "goAway": { "type": "object" },
    "sessionResumptionUpdate": { "type": "object" }
  },
  "definitions": {
    "LiveServerContent": {
      "type": "object",
      "properties": {
        "modelTurn": {
          "type": "object",
          "properties": {
            "parts": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": { "type": "string" },
                  "thought": { "type": "boolean" },
                  "thoughtSignature": { "type": "string" },
                  "inlineData": {
                    "type": "object",
                    "required": ["mimeType", "data"],
                    "properties": {
                      "mimeType": { "type": "string", "enum": ["audio/pcm;rate=24000"] },
                      "data": { "type": "string", "description": "Base64-encoded 24kHz linear PCM" }
                    }
                  }
                }
              }
            }
          }
        },
        "turnComplete": { "type": "boolean" },
        "interrupted": { "type": "boolean" },
        "interactionStatus": {
          "type": "string",
          "enum": ["INTERACTION_STATUS_UNSPECIFIED", "IN_PROGRESS", "IDLE"]
        }
      }
    },
    "BidiGenerateContentToolCall": {
      "type": "object",
      "required": ["functionCalls"],
      "properties": {
        "functionCalls": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "name", "args"],
            "properties": {
              "id": { "type": "string" },
              "name": { "type": "string" },
              "args": { "type": "object" }
            }
          }
        }
      }
    },
    "BidiGenerateContentToolCallCancellation": {
      "type": "object",
      "required": ["ids"],
      "properties": {
        "ids": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}

```

### Reasoning Traces and Thought Formatting
When reasoning visibility is activated via `includeThoughts: true` in the setup payload, internal deliberation traces are multiplexed directly into the standard `serverContent.modelTurn.parts` array rather than being isolated into separate WebSocket frames or metadata envelopes. A thought chunk is represented as a text part bearing a boolean discriminator `thought: true` alongside an optional cryptographic `thoughtSignature` string.
Reasoning traces are delivered strictly as textual representations and never encapsulate binary audio payloads. The cryptographic `thoughtSignature` serves to maintain session state and causal verification across multi-turn reasoning and non-blocking tool call sequences, ensuring that the model's intermediate cognitive context remains untampered across subsequent client turns. Client-side speech engines must parse each part in `modelTurn.parts` independently, routing parts where `thought == true` directly to administrative logging or supervisor observation interfaces, while excluding them from the audio decoding pipeline.

```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [
        {
          "thought": true,
          "text": "The candidate suggested a nested loop approach. Evaluating complexity: O(N^2) time, O(1) space. Checking whether to probe for hash map optimization or run execution unit tests...",
          "thoughtSignature": "eW91cl9zaWduYXR1cmVfaGVyZQ=="
        }
      ]
    },
    "interactionStatus": "IN_PROGRESS"
  }
}

```

### Distinction Between Conversational Fillers and Core Audio Responses
Conversational fillers, such as *"Let me examine your code implementation,"* are indistinguishable from core response audio at the physical media layer. Both streams are transmitted as raw 16-bit linear PCM at a 24kHz sampling rate, formatted within the `inlineData` container of a `modelTurn` part. The upstream protocol provides no dedicated payload tag indicating whether an audio packet represents a filler, a progress update, or a final answer.
The architectural demarcation between a conversational filler and a terminal answer is derived entirely through the correlation of `serverContent.turnComplete` and `serverContent.interactionStatus`. When the model streams filler audio, it concludes the speech burst by issuing a frame containing `turnComplete: true` while keeping `interactionStatus: "IN_PROGRESS"`. This indicates to the client gateway that the current audio fragment has terminated, but the overarching model interaction remains active in the background. Conversely, when the model completes its core, final response, it issues a frame with `turnComplete: true` paired with `interactionStatus: "IDLE"`.

| Stream Classification | Audio Encoding Format | `turnComplete` Value | `interactionStatus` Value | Concurrent Structural Indicators |
| --- | --- | --- | --- | --- |
| **Conversational Filler (Preamble)** | 16-bit PCM, 24kHz mono | `true`[cite: 7] | `IN_PROGRESS`[cite: 7] | Immediately followed by `toolCall` or internal thought parts. |
| **Progress Narration Fragment** | 16-bit PCM, 24kHz mono | `true`[cite: 7] | `IN_PROGRESS`[cite: 7] | Delivered between sequential asynchronous tool executions. |
| **Core Terminal Response** | 16-bit PCM, 24kHz mono | `true`[cite: 7] | `IDLE`[cite: 7] | Resolves the initial query; signals end of interaction. |

## Decoupled Turn Lifecycle: `turnComplete` versus `interactionStatus`
The standard Gemini Live interaction lifecycle operates on an atomic turn-taking basis, where `serverContent.turnComplete: true` signals both the cessation of model speech and the full completion of the interaction. Integrating `gemini-3.8-live-extended-thinking` breaks this 1:1 mapping. By incorporating background reasoning and asynchronous tool execution, the model separates the lifecycle of spoken utterances from the lifecycle of the underlying task.

### Lifecycle State Transition Rules
The lifecycle of an Extended Thinking session advances through a sequence of state transformations across the WebSocket transport:

1. **Session Establishment**: The client initiates the TCP and TLS handshake to the WebSocket URI. The client must transmit `BidiGenerateContentClientMessage.setup` containing `BidiGenerateContentSetup` as the initial frame. The server processes this configuration and returns `{ "setupComplete": {} }`, bringing the session into an initial quiescent state where `interactionStatus` is `IDLE`.
2. **Speech Ingestion**: The candidate speaks. The client streams 16kHz linear PCM frames upstream via `realtimeInput`. Upstream server Voice Activity Detection detects the start of speech.
3. **Turn Inception**: Upon server VAD detecting end-of-speech (or upon explicit client submission of `clientContent.turnComplete: true`), generation begins. The server updates its internal state and marks subsequent messages with `interactionStatus: "IN_PROGRESS"`.
4. **Filler Utterance Delivery**: The model decides to run background validation. To mitigate latency perceptions, it streams spoken filler chunks (e.g., *"Let me evaluate that logic..."*).
5. **Filler Utterance Closure**: The model concludes its spoken filler. It emits `serverContent.turnComplete: true`, but explicitly maintains `interactionStatus: "IN_PROGRESS"`.
6. **Asynchronous Tool Invocation**: While keeping `interactionStatus: "IN_PROGRESS"`, the server emits a `BidiGenerateContentToolCall` containing the function name, unique invocation ID, and arguments.
7. **Client Execution and Return**: The client runs the tool locally and returns the result via `BidiGenerateContentToolResponse` referencing the matching call ID. During this entire external round trip, the server considers the interaction `IN_PROGRESS`.
8. **Core Utterance Delivery**: Incorporating tool results and internal thought traces, the model synthesizes the core answer, streaming 24kHz audio chunks to the client.
9. **Interaction Termination**: Upon emitting the final audio frame of the core answer, the server transmits `serverContent.turnComplete: true` accompanied by `interactionStatus: "IDLE"`. This dual signal indicates that generation has ceased and the interaction lifecycle is fully concluded.

### Scenarios Where `turnComplete: true` Coexists with `interactionStatus: IN_PROGRESS`
The protocol emits `turnComplete: true` alongside `interactionStatus: IN_PROGRESS` in three distinct runtime situations:

1. **Acoustic Bridging Prior to Asynchronous Tools**: The candidate presents a problem requiring heavy computation. The model delivers an acoustic bridge to confirm comprehension, marks the bridge speech complete via `turnComplete: true`, and transitions immediately to silent tool execution while remaining `IN_PROGRESS`.
2. **Intermediate Multi-Hop Progress Updates**: When evaluating complex algorithmic pipelines, the model may execute several non-blocking tools sequentially. Between calls, the model issues short audio updates (e.g., *"Test suite one passed, compiling edge cases..."*), concluding each update with `turnComplete: true` while holding `IN_PROGRESS`.
3. **Cognitive Deliberation Pauses**: When the model requires thousands of thinking tokens to analyze complex input, it emits a verbal acknowledgement, terminates the spoken segment with `turnComplete: true`, and proceeds with silent reasoning while maintaining `IN_PROGRESS`.

### Upstream Interruption and Barge-In Semantics
When a candidate speaks or transmits data while `interactionStatus` is `IN_PROGRESS`, the upstream server processes the event according to configured activity handling rules:

#### Automatic Barge-In Handling (`START_OF_ACTIVITY_INTERRUPTS`)
By default, the session configuration operates under `activityHandling: START_OF_ACTIVITY_INTERRUPTS`. If a candidate interrupts while the model is outputting conversational filler audio or executing background thinking:

- **Server VAD Detection**: Upstream VAD flags user speech surpassing the `prefixPaddingMs` duration.
- **Immediate Generation Cutoff**: The server immediately terminates model audio synthesis. It emits a `LiveServerContent` message containing `interrupted: true`, immediately followed by `turnComplete: true`.
- **Tool Invalidation via `toolCallCancellation`**: If a `toolCall` was issued and the client has not yet returned a `toolResponse`, the server dispatches a `BidiGenerateContentToolCallCancellation` message containing the IDs of all invalidated tool invocations. The client must cancel local execution and drop pending responses.
- **Context Replacement**: The reasoning graph and active thoughts are aborted upstream, and the server reallocates processing context to ingest the new candidate speech.

#### Hard Generation Preemption via `clientContent`
If the client application injects a `BidiGenerateContentClientContent` frame containing `turnComplete: true` while the session is `IN_PROGRESS`, the server executes an unconditional generation cancellation. Ongoing synthesis, background reasoning loops, and pending asynchronous tool calls are aborted. The server emits `toolCallCancellation` for any active functions and immediately pivots model attention to the newly injected client turn.

#### Interruption Suppression (`NO_INTERRUPTION`)
If the client explicitly configures `activityHandling: NO_INTERRUPTION`, candidate speech detected during an `IN_PROGRESS` state does not halt the model. The model finishes its reasoning, tool cycles, and spoken synthesis. Client audio packets received over `realtimeInput` are buffered upstream in chronological order and processed only after the model naturally concludes its interaction and emits `interactionStatus: "IDLE"`.

## Session Setup and Thinking Configuration (`BidiGenerateContentSetup`)
Configuring a session for `gemini-3.8-live-extended-thinking` requires precise adherence to parameter rules introduced in Gemini 3.8. Incorrect parameter pairings result in immediate session closure during the setup phase.

```json
{
  "setup": {
    "model": "models/gemini-3.8-live-extended-thinking",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Puck"
          }
        }
      },
      "thinkingConfig": {
        "thinkingLevel": "LOW",
        "includeThoughts": true
      }
    },
    "tools": [
      {
        "functionDeclarations": [
          {
            "name": "runCodeSandbox",
            "description": "Executes candidate algorithm against automated unit tests.",
            "behavior": "NON_BLOCKING",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "code": { "type": "STRING" },
                "timeoutMs": { "type": "INTEGER" }
              },
              "required": ["code"]
            }
          }
        ]
      }
    ],
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
        "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
        "prefixPaddingMs": 200,
        "silenceDurationMs": 800
      },
      "activityHandling": "START_OF_ACTIVITY_INTERRUPTS"
    }
  }
}

```

### Thinking Configuration Parameters and Deprecation Rules
The evolution from Gemini 2.5 to Gemini 3.8 refactored the parameter space governing reasoning depth. The parameter `thinkingBudget`, which previously accepted integer token caps or a `-1` dynamic flag, is deprecated for Gemini 3 models. In Gemini 3.8, reasoning depth is governed by discrete categorical levels under `thinkingLevel` (`LOW`, `MEDIUM`, `HIGH`).
Supplying both `thinkingBudget` and `thinkingLevel` within `thinkingConfig` is illegal and causes the upstream API to reject the connection with a `400 Bad Request` schema failure. Furthermore, while `gemini-3.8-live-extended-thinking` supports `LOW`, `MEDIUM`, and `HIGH`, it does not support `MINIMAL`. Attempting to configure `thinkingLevel: "MINIMAL"` on the Extended Thinking endpoint generates a setup validation error, because the model's parallel reasoning architecture requires a baseline token budget to evaluate background state. Conversely, standard `gemini-3.8-live` does not support `thinkingConfig` or `thinkingLevel` at all, as its interleaved reasoning follows a fixed latency profile; including `thinkingConfig` on the standard model endpoint results in an initialization error.

| Configuration Field | Target Model: `gemini-3.8-live` | Target Model: `gemini-3.8-live-extended-thinking` | Parameter Deprecation Status |
| --- | --- | --- | --- |
| **`thinkingConfig.thinkingLevel`** | Not supported; must be omitted. | Supported: `"LOW"`, `"MEDIUM"`, `"HIGH"`. `"MINIMAL"` is rejected. | Active and standard for Gemini 3.x models. |
| **`thinkingConfig.thinkingBudget`** | Not supported. | Not supported. If combined with `thinkingLevel`, throws HTTP 400. | Deprecated in Gemini 3; retained only for Gemini 2.5. |
| **`thinkingConfig.includeThoughts`** | Not supported. | Supported: `true` or `false` (default). | Active; controls delivery of thought parts. |
| **`tools.functionDeclarations.behavior`** | Supports `"BLOCKING"` and `"NON_BLOCKING"`. | Strictly requires `"NON_BLOCKING"`. `"BLOCKING"` throws a fatal error. | Mandatory enforcement on Extended Thinking. |

## Client-Side State Machine Architecture and Audio Synchronization
In standard Live implementations, client audio synchronization is typically structured around an atomic assumption: once `turnComplete: true` is parsed and the Web Audio playout queue empties, the model is finished speaking, and the client unblocks the user's microphone. In `gemini-3.8-live-extended-thinking`, this assumption causes a critical failure mode: the client unblocks the microphone during the cognitive pause between a conversational filler and the core response. Ambient room noise or tentative candidate speech then triggers an accidental barge-in, cancelling the model's pending answer.

### Decoupled Dual-State Tracking Architecture
To guarantee zero audio collisions and eliminate race conditions, the client runtime must decouple the physical media playout subsystem from the protocol interaction subsystem. These run as two distinct, asynchronous state machines whose outputs converge into a single logical gate controlling microphone access.
The protocol interaction subsystem processes WebSocket frames:

- Upon receiving any frame containing `interactionStatus: "IN_PROGRESS"`, the internal interaction flag transitions to `IN_PROGRESS`.
- Upon receiving a frame containing `interactionStatus: "IDLE"`, the internal interaction flag transitions to `IDLE`.
- Crucially, parsing `turnComplete: true` has no impact on this flag; it merely marks the completion of an individual chunk stream.
The audio playout subsystem operates independently through the Web Audio API:

- The browser maintains an `AudioContext` operating at a fixed 24,000 Hz sample rate matching the model's native output.
- A scheduling pointer, `nextPlayoutTime`, ensures continuous, click-free playback of raw PCM chunks:

$$
\text{nextPlayoutTime} = \max(\text{audioContext.currentTime}, \text{nextPlayoutTime})
$$

- When an audio chunk arrives in `inlineData`, the client converts the 16-bit linear PCM byte buffer into an `AudioBuffer` and schedules it:

```javascript
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start(nextPlayoutTime);
nextPlayoutTime += audioBuffer.duration;
activeSourceNodes.add(source);

source.onended = () => {
  activeSourceNodes.delete(source);
  if (activeSourceNodes.size === 0 && audioContext.currentTime >= nextPlayoutTime) {
    audioPlayoutState = "DRAINED";
    evaluateMicrophoneGate();
  }
};
audioPlayoutState = "PLAYING";

```

### The Synchronization Gate
Microphone access is governed strictly by the conjunction of both subsystem states. The microphone unlocks if and only if both conditions are satisfied simultaneously:

$$
\text{MicrophoneGate} = (\text{interactionStatus} \equiv \text{IDLE}) \land (\text{audioPlayoutState} \equiv \text{DRAINED})
$$
If the model emits a conversational filler, `interactionStatus` remains `IN_PROGRESS`. When the filler finishes playing physically in the candidate's headphones, `audioPlayoutState` transitions to `DRAINED`. However, because `interactionStatus` is still `IN_PROGRESS`, the gate evaluates to `false`, keeping the microphone gated and preventing accidental barge-in.

### Handling the Playout Sequence: Filler Audio -> Thinking Pause -> Core Answer
The client runtime orchestrates the complete response sequence without premature microphone unlocking or silence timeouts:

1. **Filler Audio Ingestion and Playback**: The server streams audio chunks for the filler phrase. The audio subsystem schedules these chunks, transitioning `audioPlayoutState` to `PLAYING`. The candidate microphone remains locked.
2. **Filler Utterance Boundary**: The server emits `turnComplete: true` while maintaining `interactionStatus: IN_PROGRESS`. The client marks receipt of the filler utterance as finished, but the interaction subsystem remains `IN_PROGRESS`.
3. **Playout Drainage During Filler Completion**: The local audio buffer empties, and the final `AudioBufferSourceNode` fires `onended`. The playout subsystem transitions to `DRAINED`. The gate evaluates $(\text{IN\_PROGRESS} \equiv \text{IDLE}) \land (\text{DRAINED} \equiv \text{DRAINED}) \to \text{false}$. The microphone remains locked, and the platform UI displays an active progress indicator (e.g., *"Agent is evaluating response..."*) rather than an idle prompt.
4. **Thinking / Silence Interval**: During background reasoning and tool execution, zero audio packets traverse the WebSocket. Standard client-side voice activity timeouts or silence detection timers must be suspended while `interactionStatus === IN_PROGRESS` to prevent false disconnection.
5. **Core Answer Streaming**: The server begins streaming core response audio frames. The audio engine schedules playback immediately, transitioning `audioPlayoutState` back to `PLAYING`.
6. **Core Answer Utterance Completion**: The server delivers the final audio frame accompanied by `turnComplete: true` and `interactionStatus: IDLE`. The interaction subsystem updates its state to `IDLE`. However, the core answer audio is still actively playing through the user's speakers, meaning `audioPlayoutState` is `PLAYING`. The gate evaluates $(\text{IDLE} \equiv \text{IDLE}) \land (\text{PLAYING} \equiv \text{DRAINED}) \to \text{false}$. The microphone remains locked.
7. **Terminal Drain and Microphone Release**: The final core response audio chunk completes playback, firing the final `onended` event. The playout subsystem transitions to `DRAINED`. The gate evaluates $(\text{IDLE} \equiv \text{IDLE}) \land (\text{DRAINED} \equiv \text{DRAINED}) \to \text{true}$. The client unlocks the candidate microphone, re-enables local VAD capture, and transitions the UI to the listening state.

## State Machine Specification for Extended Thinking Turn Lifecycle
The client runtime finite state machine enforces deterministic coordination across connection, streaming, and tool execution phases.

| Current State | Stimulus / Trigger Event | Guard Condition | Target State | State Entry Actions / Side Effects |
| --- | --- | --- | --- | --- |
| **S0: DISCONNECTED** | WebSocket open event | None | **S1: CONNECTING_SETUP** | Allocate Web Audio context; initialize internal clock; format and transmit `BidiGenerateContentSetup`. |
| **S1: CONNECTING_SETUP** | Receive `setupComplete` frame | Setup payload validated | **S2: READY_IDLE** | Set `interactionStatus = IDLE`; unblock audio input pipeline; initialize VAD listener; UI shows "Ready". |
| **S2: READY_IDLE** | Local VAD detects candidate speech | Mic is active | **S3: INGESTING_USER_INPUT** | Capture 16kHz PCM; stream chunks upstream via `realtimeInput`; UI shows "Candidate Speaking". |
| **S3: INGESTING_USER_INPUT** | Local VAD detects silence / user stops speaking | Speech threshold met | **S4: AWAITING_SERVER_TURN** | Gate microphone; suspend outgoing audio streaming; arm watchdog timer; UI shows "Processing". |
| **S4: AWAITING_SERVER_TURN** | Receive `serverContent` with audio parts | `interactionStatus == IN_PROGRESS`[cite: 7] | **S5: RECEIVING_FILLER_AUDIO** | Push 24kHz PCM chunks to Web Audio scheduler; set `audioPlayoutState = PLAYING`; UI shows "Agent Speaking". |
| **S5: RECEIVING_FILLER_AUDIO** | Receive `turnComplete: true`[cite: 7] | `interactionStatus == IN_PROGRESS`[cite: 7] | **S6: PROCESSING_BACKGROUND** | Mark filler reception complete; maintain mic **LOCKED**; maintain "Agent Deliberating" UI. |
| **S6: PROCESSING_BACKGROUND** | Web Audio buffer queue empties (`onended`) | `interactionStatus == IN_PROGRESS`[cite: 4, 7] | **S6: PROCESSING_BACKGROUND** | Set `audioPlayoutState = DRAINED`; evaluate gate ($\to \text{false}$); mic remains **LOCKED**; silence timer inhibited. |
| **S6: PROCESSING_BACKGROUND** | Receive `toolCall` frame | `functionCalls.length > 0`[cite: 12] | **S7: EXECUTING_TOOL** | Dispatch asynchronous worker task; retain mic **LOCKED**; UI shows "Executing Environment Check". |
| **S7: EXECUTING_TOOL** | Local function execution resolves | Invocation ID active | **S6: PROCESSING_BACKGROUND** | Dispatch `BidiGenerateContentToolResponse` upstream; await model synthesis. |
| **S7: EXECUTING_TOOL** | Receive `toolCallCancellation` frame | Target ID matches | **S6: PROCESSING_BACKGROUND** | Abort local execution thread; drop pending response payload; purge task state. |
| **S6: PROCESSING_BACKGROUND** | Receive `serverContent` with audio parts | Core answer received | **S8: RECEIVING_CORE_AUDIO** | Enqueue 24kHz PCM chunks into playout scheduler; set `audioPlayoutState = PLAYING`; UI shows "Agent Answering". |
| **S8: RECEIVING_CORE_AUDIO** | Receive `turnComplete: true`[cite: 7] | `interactionStatus == IDLE`[cite: 7] | **S9: DRAINING_CORE_AUDIO** | Set `interactionStatus = IDLE`; evaluate gate ($\to \text{false}$ while playing); mic remains **LOCKED**. |
| **S9: DRAINING_CORE_AUDIO** | Web Audio queue finishes draining (`onended`) | `interactionStatus == IDLE`[cite: 7] | **S2: READY_IDLE** | Set `audioPlayoutState = DRAINED`; gate evaluates $\to \text{true}$; **UNLOCK** mic; UI shows "Ready". |
| **ANY_ACTIVE (S4–S9)** | Local VAD detects candidate barge-in / receive `interrupted: true`[cite: 14] | Interruption permitted | **S10: INTERRUPTED_FLUSH** | Synchronously halt all scheduled AudioBufferSourceNodes; purge buffers; reset clock; transition to **S3**. |

## Protocol Sequence Specification: Multi-Step Interaction Execution
The end-to-end execution trace below illustrates a candidate answering an algorithmic problem, prompting conversational filler audio, background reasoning, asynchronous automated code execution, and a final spoken evaluation.

| Sequence Step | Originator | Protocol Frame / Signal | Key Payload Attributes | Interaction Status | Playout Queue State | Microphone Gate State |
| --- | --- | --- | --- | --- | --- | --- |
| **01. Connect** | Client | WebSocket Handshake | Endpoint connection initiated | `UNSPECIFIED` | `DRAINED` | `LOCKED` |
| **02. Configure** | Client | `BidiGenerateContentClientMessage.setup` | `model: gemini-3.8-live-extended-thinking`, `thinkingLevel: "MEDIUM"`, non-blocking tool | `UNSPECIFIED` | `DRAINED` | `LOCKED` |
| **03. Handshake** | Server | `BidiGenerateContentServerMessage.setupComplete` | `{ "setupComplete": {} }`[cite: 7, 14] | `IDLE` | `DRAINED` | **`UNLOCKED`** |
| **04. Audio Stream** | Client | `realtimeInput` (continuous) | Candidate explains algorithm; Base64 PCM 16kHz | `IDLE` | `DRAINED` | `CAPTURING` |
| **05. VAD Commit** | Server | (Internal Speech Detection) | Upstream VAD flags end of candidate speech | `IN_PROGRESS`[cite: 7] | `DRAINED` | `LOCKED` |
| **06. Stream Filler** | Server | `serverContent` (chunks) | Audio: *"Let me test that logic against edge cases..."*[cite: 7] | `IN_PROGRESS`[cite: 7] | `PLAYING`[cite: 19] | `LOCKED` |
| **07. Filler End** | Server | `serverContent` | `{ "turnComplete": true }`[cite: 7] | `IN_PROGRESS`[cite: 7] | `PLAYING` | `LOCKED` |
| **08. Reasoning** | Server | `serverContent` | `parts`: `[{"thought": true, "text": "Validating O(N) runtime..."}]`[cite: 15, 16] | `IN_PROGRESS` | `PLAYING` | `LOCKED` |
| **09. Audio Ends** | Client | Web Audio API `onended` | Filler finishes playing in candidate headset | `IN_PROGRESS`[cite: 4] | `DRAINED` | **`LOCKED`**[cite: 4, 7] |
| **10. Tool Call** | Server | `toolCall` | `functionCalls`: `[{"id": "call_99", "name": "runCodeSandbox", ...}]`[cite: 7, 12] | `IN_PROGRESS`[cite: 7] | `DRAINED` | `LOCKED` |
| **11. Tool Return** | Client | `toolResponse` | `functionResponses`: `[{"id": "call_99", "response": {"status": 200}}]`[cite: 7, 12] | `IN_PROGRESS` | `DRAINED` | `LOCKED` |
| **12. Stream Core** | Server | `serverContent` (chunks) | Audio: *"Your implementation passed all test suites..."*[cite: 7] | `IN_PROGRESS` | `PLAYING`[cite: 19] | `LOCKED` |
| **13. Core End** | Server | `serverContent` | `{ "turnComplete": true, "interactionStatus": "IDLE" }`[cite: 7] | `IDLE`[cite: 7] | `PLAYING`[cite: 14] | `LOCKED` |
| **14. Final Drain** | Client | Web Audio API `onended` | Final audio chunk completes playback | `IDLE` | `DRAINED` | **`UNLOCKED`**[cite: 7] |

## Summary Checklist: Client State Machine Invariants for Zero-Race Audio Playout
Production voice platforms integrating `gemini-3.8-live-extended-thinking` must maintain strict client-side invariants to prevent deadlocks, race conditions, and acoustic collisions:

- [ ] **Dual-Key Microphone Gate Invariant**: The client audio driver must never unlock the candidate microphone based on `serverContent.turnComplete: true` alone. Unlocking requires the simultaneous satisfaction of:

$$
\text{MicState} = \text{UNLOCKED} \iff (\text{interactionStatus} \equiv \text{IDLE}) \land (\text{PlayoutQueueStatus} \equiv \text{DRAINED})
$$

- [ ] **Cognitive Silence Timeout Suppression**: All client-side inactivity timers, silence detection watchdogs, and turn-timeout monitors must be suspended while `interactionStatus === IN_PROGRESS`. The timeout subsystem may only track intervals when the state is `READY_IDLE`.
- [ ] **Reasoning Part Filtering Invariant**: The audio rendering pipeline must inspect every part within `serverContent.modelTurn.parts` and discard any part where `thought === true`. Thought payloads must never be forwarded to audio synthesis buffers or speech decoders.
- [ ] **Mandatory Non-Blocking Tool Enforcement**: Every tool declared in `setup.tools.functionDeclarations` for `gemini-3.8-live-extended-thinking` must specify `"behavior": "NON_BLOCKING"`. The gateway initialization module must reject configurations specifying `"behavior": "BLOCKING"` before sending them to the WebSocket.
- [ ] **Tool Cancellation Invalidation Handling**: Upon receiving a `BidiGenerateContentToolCallCancellation` message, the client must immediately cancel active background tasks via an `AbortController` or cancellation token. The client must ensure that a cancelled `toolResponse` is never sent upstream.
- [ ] **Atomic Audio Buffer Evacuation on Interruption**: When `serverContent.interrupted: true` is received or client-side VAD commits a local barge-in, the client must immediately call `.stop()` and `.disconnect()` on all scheduled `AudioBufferSourceNode` instances, set `nextPlayoutTime = audioContext.currentTime`, and mark `audioPlayoutState = DRAINED`.
- [ ] **Parameter Exclusivity Invariant**: The session setup generator must ensure `thinkingConfig` does not define `thinkingBudget` when targeting Gemini 3.8 models, enforcing `thinkingLevel` (`LOW`, `MEDIUM`, `HIGH`) exclusively to prevent connection rejection.
- [ ] **Strict Handshake Sequencing**: The client WebSocket driver must queue all outgoing candidate audio (`realtimeInput`) and text (`clientContent`) until a valid `{ "setupComplete": {} }` frame has been parsed from the server.
- [ ] **Sample Rate Modality Separation**: The client media engine must resample microphone input to 16,000 Hz linear PCM before streaming upstream, while initializing the downstream playback context at 24,000 Hz linear PCM to prevent pitch distortion and buffer drift.

## Conclusions and Operational Guidelines
The transition to `gemini-3.8-live-extended-thinking` replaces traditional turn-taking with a decoupled lifecycle where conversational speech and background cognitive processing run concurrently. In high-reliability production environments such as technical interview and tutoring platforms, treating `turnComplete: true` as an indicator of an idle session causes premature microphone activation, exposing the system to accidental barge-ins during cognitive pauses.
Implementing a decoupled dual-state synchronization gate eliminates these race conditions by evaluating protocol-level interaction state alongside local Web Audio playout status. Pairing this gate with non-blocking tool declarations, thought part filtering, and coordinated interruption handling ensures a stable, responsive conversational experience. Technical platforms adopting these patterns can take full advantage of native speech-to-speech reasoning while maintaining reliable audio playout integrity.

---

Source: https://gemini.google.com/app/fcad270f1a759097
Exported at: 2026-09-16T15:37:05.596Z