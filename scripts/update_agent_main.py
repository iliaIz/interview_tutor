import os

code = '''import asyncio
import base64
import json
import logging
import os
import sys
import websockets

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)

logger = logging.getLogger("livekit-gemini-agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

LITELLM_WS_URL = os.getenv("LITELLM_WS_URL", "ws://litellm-gateway:4000/ws/live")
LITELLM_MASTER_KEY = os.getenv("LITELLM_MASTER_KEY", "sk-litellm-local-proxy-master-key-12345")
DEFAULT_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-live-v3")

ALLOWED_VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"]

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"Candidate connected: {participant.identity}")

    metadata = {}
    if participant.metadata:
        try:
            metadata = json.loads(participant.metadata)
        except Exception as e:
            logger.warning(f"Could not parse participant metadata: {e}")

    voice_name = metadata.get("voice", "Kore")
    if voice_name not in ALLOWED_VOICES:
        voice_name = "Kore"
    live_model = metadata.get("liveModel", DEFAULT_LIVE_MODEL)
    system_prompt = metadata.get("systemPrompt", "You are an expert AI technical interviewer.")
    greeting_text = metadata.get("greetingText")

    audio_source = rtc.AudioSource(sample_rate=24000, num_channels=1)
    track = rtc.LocalAudioTrack.create_audio_track("ai-voice", audio_source)
    publish_options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    await ctx.room.local_participant.publish_track(track, publish_options)
    logger.info("Published AI audio track to WebRTC room")

    upstream_url = f"{LITELLM_WS_URL}?model={live_model}&token={LITELLM_MASTER_KEY}"
    logger.info(f"Opening WebSocket connection to LiteLLM Gateway: {upstream_url}")

    setup_msg = {
        "setup": {
            "model": f"models/{live_model}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice_name
                        }
                    }
                }
            },
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            }
        }
    }

    try:
        async with websockets.connect(upstream_url, ping_interval=20, ping_timeout=20) as gemini_ws:
            logger.info("Connected to LiteLLM Gateway, sending setup frame...")
            await gemini_ws.send(json.dumps(setup_msg))

            # If an initial greeting was requested, send it as Turn 0 prompt
            if greeting_text:
                logger.info(f"Sending initial greeting prompt: {greeting_text[:80]}...")
                greeting_msg = {
                    "clientContent": {
                        "turns": [
                            {
                                "role": "user",
                                "parts": [{"text": greeting_text}]
                            }
                        ],
                        "turnComplete": True
                    }
                }
                await gemini_ws.send(json.dumps(greeting_msg))

            # Task 1: Stream Gemini audio responses to LiveKit AudioSource
            async def receive_from_gemini():
                try:
                    async for raw_msg in gemini_ws:
                        if isinstance(raw_msg, bytes):
                            text_payload = raw_msg.decode("utf-8")
                        else:
                            text_payload = raw_msg
                        
                        data = json.loads(text_payload)
                        
                        if "serverContent" in data:
                            sc = data["serverContent"]
                            if sc.get("interrupted"):
                                logger.info("⚡ Barge-in: clearing audio queue instantly")
                                audio_source.clear_queue()
                                await ctx.room.local_participant.publish_data(
                                    json.dumps({"type": "interrupted"}).encode("utf-8")
                                )
                            
                            if "modelTurn" in sc and "parts" in sc["modelTurn"]:
                                for part in sc["modelTurn"]["parts"]:
                                    pcm_b64 = part.get("inlineData", {}).get("data")
                                    if pcm_b64:
                                        pcm_bytes = base64.b64decode(pcm_b64)
                                        samples = len(pcm_bytes) // 2
                                        frame = rtc.AudioFrame(
                                            data=pcm_bytes,
                                            sample_rate=24000,
                                            num_channels=1,
                                            samples_per_channel=samples
                                        )
                                        await audio_source.capture_frame(frame)
                                    if "text" in part:
                                        await ctx.room.local_participant.publish_data(
                                            json.dumps({"type": "transcript", "text": part["text"], "role": "ai"}).encode("utf-8")
                                        )
                            
                            if sc.get("turnComplete"):
                                await ctx.room.local_participant.publish_data(
                                    json.dumps({"type": "turnComplete"}).encode("utf-8")
                                )
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error receiving from Gemini: {e}")

            # Task 2: Stream Candidate audio from WebRTC track to Gemini
            async def send_candidate_audio():
                try:
                    audio_queue = asyncio.Queue()

                    def handle_track(t: rtc.Track):
                        if t.kind == rtc.TrackKind.KIND_AUDIO:
                            logger.info(f"Subscribing to candidate audio stream on track {t.sid}")
                            stream = rtc.AudioStream(t, sample_rate=16000, num_channels=1)
                            
                            async def read_stream():
                                async for frame_event in stream:
                                    await audio_queue.put(frame_event.frame)
                            
                            asyncio.create_task(read_stream())

                    for pub in participant.track_publications.values():
                        if pub.track:
                            handle_track(pub.track)

                    @ctx.room.on("track_subscribed")
                    def on_track_sub(t: rtc.Track, p, part):
                        if part.identity == participant.identity:
                            handle_track(t)

                    while True:
                        frame = await audio_queue.get()
                        pcm_bytes = frame.data.tobytes()
                        b64_data = base64.b64encode(pcm_bytes).decode("utf-8")
                        msg = {
                            "realtimeInput": {
                                "mediaChunks": [
                                    {
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": b64_data
                                    }
                                ]
                            }
                        }
                        await gemini_ws.send(json.dumps(msg))
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error streaming candidate audio: {e}")

            # Task 3: Handle client data channel messages (text prompts, forced turns)
            async def handle_client_data():
                try:
                    data_queue = asyncio.Queue()

                    @ctx.room.on("data_received")
                    def on_data(dp: rtc.DataPacket):
                        if dp.participant and dp.participant.identity == participant.identity:
                            try:
                                payload = json.loads(dp.data.decode("utf-8"))
                                data_queue.put_nowait(payload)
                            except Exception as e:
                                logger.warning(f"Failed to parse client data packet: {e}")

                    while True:
                        packet = await data_queue.get()
                        p_type = packet.get("type")
                        if p_type == "text_turn":
                            text = packet.get("text", "")
                            if text:
                                logger.info(f"Forwarding text turn from client: {text[:60]}...")
                                msg = {
                                    "clientContent": {
                                        "turns": [
                                            {
                                                "role": "user",
                                                "parts": [{"text": text}]
                                            }
                                        ],
                                        "turnComplete": True
                                    }
                                }
                                await gemini_ws.send(json.dumps(msg))
                        elif p_type == "barge_in":
                            logger.info("Client requested manual barge-in: clearing audio queue")
                            audio_source.clear_queue()
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error handling client data: {e}")

            # Run all tasks concurrently
            recv_task = asyncio.create_task(receive_from_gemini())
            send_task = asyncio.create_task(send_candidate_audio())
            data_task = asyncio.create_task(handle_client_data())

            await asyncio.gather(recv_task, send_task, data_task)

    except Exception as e:
        logger.error(f"Session error in LiveKit Gemini Agent: {e}")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
'''

target = r"D:\projects\LiteLLM_Proxy\agent\main.py"
with open(target, "w", encoding="utf-8") as f:
    f.write(code)
print(f"Written {len(code)} bytes to {target}")
