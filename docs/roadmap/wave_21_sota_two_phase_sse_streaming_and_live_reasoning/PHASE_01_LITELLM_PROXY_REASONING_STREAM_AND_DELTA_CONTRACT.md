# Phase 1: LiteLLM Proxy Reasoning Delta Stream & Contract Alignment
## SOTA Late-2026 Gemini Thinking Streaming Specification

> **Phase:** 1 of 5  
> **Status:** Draft / Specification  
> **Target Subsystem:** `LiteLLM_Proxy` (`gateway/app/routers/chat.py`)  
> **Dependencies:** None  

---

## 1. Context & Objective

In `LiteLLM_Proxy/gateway/app/routers/chat.py`, when a client requests `stream: true`, the gateway connects to upstream Google Gemini via `generateContentStream` and iterates over SSE chunks.

Currently, lines 292–298 treat all incoming text parts identically:
```python
parts = candidates[0].get("content", {}).get("parts", [])
for p in parts:
    delta_chunk: Dict[str, Any] = {}
    if "text" in p:
        delta_chunk["content"] = p["text"]
        completion_tokens += len(p["text"]) // 4
        accumulated_text += p["text"]
```

However, when `thinkingConfig` is active on models such as `gemini-3.8-flash` or `gemini-2.5-flash`, Google Gemini returns parts where `thought: true` represents internal reasoning. Treating them as `content` merges thoughts with the final JSON, causing syntax errors in the client parser.

---

## 2. Technical Specification

### 2.1. Delta Separation Contract
In `chat.py`, `stream_generator` must distinguish between `thought: true` parts and final `content` parts:

```python
for p in parts:
    delta_chunk: Dict[str, Any] = {}
    if "text" in p:
        text_str = p["text"]
        is_thought = p.get("thought", False)
        if is_thought:
            delta_chunk["reasoning_content"] = text_str
            reasoning_tokens += len(text_str) // 4
        else:
            delta_chunk["content"] = text_str
            completion_tokens += len(text_str) // 4
            accumulated_text += text_str
    elif "functionCall" in p:
        # Tool call handling
        ...
```

### 2.2. Standard OpenAI Reasoning Emittance
Each emitted SSE chunk follows the standard OpenAI / DeepSeek / Gemini Reasoning schema:
```json
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1740000000,"model":"gemini-smart","choices":[{"index":0,"delta":{"reasoning_content":"Analyzing concurrency lock contention..."},"finish_reason":null}]}
```

When thinking concludes and JSON synthesis begins:
```json
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1740000000,"model":"gemini-smart","choices":[{"index":0,"delta":{"content":"{\n  \"title\": \"Пиннинг потоков..."},"finish_reason":null}]}
```

---

## 3. Verification Gate (Gate 1)

1. Test script streaming directly from LiteLLM Proxy with `stream: true` and `thinkingConfig`.
2. Verify that incoming chunks cleanly separate `delta.reasoning_content` from `delta.content`.
3. Assert that `delta.content` contains ONLY valid JSON substrings.
