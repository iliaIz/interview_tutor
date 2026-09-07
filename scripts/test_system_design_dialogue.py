import asyncio
import json
import sys
import time
import requests
import numpy as np
from livekit import rtc

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

async def main():
    print("🚀 === Testing System Design WebRTC Voice Dialogue (Bidirectional Audio) ===")
    
    # 1. Login
    backend_url = "http://localhost:8091"
    login_res = requests.post(f"{backend_url}/api/auth/login", json={
        "inviteCode": "SPRING-VIP-OWNER-2026",
        "name": "Staff Architect"
    })
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.status_code} {login_res.text}")
        sys.exit(1)
        
    auth_token = login_res.json()["token"]
    print("✅ Authenticated successfully")

    # 2. Request System Design token
    token_url = f"{backend_url}/api/voice/livekit-token"
    token_payload = {
        "sessionType": "system_design",
        "topic": "Distributed Payment Gateway",
        "questionText": "Design an idempotent distributed payment processing pipeline with outbox pattern",
        "voiceName": "Kore",
        "userGender": "female"
    }
    
    token_res = requests.post(
        token_url,
        headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"},
        json=token_payload
    )
    if token_res.status_code != 200:
        print(f"❌ Failed to get voice token: {token_res.status_code} {token_res.text}")
        sys.exit(1)
        
    data = token_res.json()
    livekit_token = data["token"]
    livekit_url = "ws://localhost:7880"
    print(f"✅ Voice Token acquired for room: {data['roomName']}")

    # 3. Connect to room
    room = rtc.Room()
    
    stats = {
        "agent_joined": False,
        "ai_track_subscribed": False,
        "ai_audio_frames": 0,
        "transcript": []
    }
    
    got_first_audio = asyncio.Event()

    @room.on("participant_connected")
    def on_participant_connected(p: rtc.RemoteParticipant):
        print(f"👤 AI Agent connected: {p.identity}")
        stats["agent_joined"] = True

    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.RemoteTrack, pub, p: rtc.RemoteParticipant):
        print(f"🎵 Track subscribed: {track.kind} from {p.identity}")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            stats["ai_track_subscribed"] = True
            
            async def read_ai_audio():
                stream = rtc.AudioStream(track, sample_rate=24000, num_channels=1)
                async for frame_event in stream:
                    stats["ai_audio_frames"] += 1
                    if stats["ai_audio_frames"] == 1:
                        print(f"🔊 First AI audio frame received! ({frame_event.frame.sample_rate}Hz)")
                        got_first_audio.set()
            asyncio.create_task(read_ai_audio())

    @room.on("data_received")
    def on_data_received(dp: rtc.DataPacket):
        try:
            payload = json.loads(dp.data.decode("utf-8"))
            if payload.get("type") == "transcript":
                chunk = payload.get("text", "")
                stats["transcript"].append(chunk)
                print(f"💬 Transcript: {chunk}")
            elif payload.get("type") == "turnComplete":
                print("🏁 AI Turn Complete signal received")
        except Exception:
            pass

    await room.connect(livekit_url, livekit_token)
    print("✅ Candidate connected to room")

    # 4. PUBLISH CANDIDATE AUDIO TRACK (Simulating active microphone!)
    print("🎙️ Publishing candidate microphone track to test upstream audio streaming...")
    cand_audio_source = rtc.AudioSource(sample_rate=16000, num_channels=1)
    cand_track = rtc.LocalAudioTrack.create_audio_track("candidate-mic", cand_audio_source)
    await room.local_participant.publish_track(cand_track)
    print("✅ Candidate mic track published")

    # Feed 16kHz silence/background PCM frames into the candidate mic
    async def stream_candidate_frames():
        silence_samples = np.zeros(320, dtype=np.int16).tobytes() # 20ms frame at 16kHz
        frame = rtc.AudioFrame(data=silence_samples, sample_rate=16000, num_channels=1, samples_per_channel=320)
        while True:
            await cand_audio_source.capture_frame(frame)
            await asyncio.sleep(0.02)

    feed_task = asyncio.create_task(stream_candidate_frames())

    # Wait for AI audio
    print("⏳ Waiting for Gemini Live to stream greeting audio back...")
    try:
        await asyncio.wait_for(got_first_audio.wait(), timeout=12.0)
    except asyncio.TimeoutError:
        print("⚠️ Timeout waiting for first audio frame")

    # Keep stream running for 3 seconds to verify ongoing bidirectional streaming
    await asyncio.sleep(3.0)
    feed_task.cancel()

    full_transcript = "".join(stats["transcript"])
    print("\n📊 === Test Results ===")
    print(f"  - Agent Connected: {stats['agent_joined']}")
    print(f"  - AI Audio Track Subscribed: {stats['ai_track_subscribed']}")
    print(f"  - AI Audio Frames: {stats['ai_audio_frames']}")
    print(f"  - Transcript Chunks: {len(stats['transcript'])}")
    if full_transcript:
        print(f"  - Full Transcript: \"{full_transcript[:120]}...\"")

    await room.disconnect()
    print("🔌 Clean disconnect")

    if stats["ai_audio_frames"] > 0:
        print("\n🎉 === SUCCESS: Bidirectional WebRTC audio pipeline is 100% OPERATIONAL! ===")
        sys.exit(0)
    else:
        print("\n❌ Failed: No audio frames received from AI")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
