import asyncio
import json
import sys
import time
import requests
from livekit import rtc

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

async def main():
    print("🚀 === SOTA 2026 LiveKit WebRTC + Gemini Live E2E Integration Test ===")
    
    # Step 1: Login
    backend_url = "http://localhost:8091"
    login_url = f"{backend_url}/api/auth/login"
    print(f"1. Authenticating via {login_url}...")
    
    login_res = requests.post(login_url, json={
        "inviteCode": "SPRING-VIP-OWNER-2026",
        "name": "E2E Tester"
    })
    
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.status_code} {login_res.text}")
        sys.exit(1)
        
    auth_token = login_res.json()["token"]
    print("✅ Authenticated successfully as Master User")

    # Step 2: Request Voice Token
    token_url = f"{backend_url}/api/voice/livekit-token"
    print(f"2. Requesting LiveKit WebRTC room token from {token_url}...")
    
    token_payload = {
        "topic": "Spring Concurrency & JVM",
        "questionText": "What is the difference between synchronized and ReentrantLock?",
        "voiceName": "Kore",
        "sessionType": "interview",
        "userGender": "female",
        "strategy": "socratic_tutoring"
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
    room_name = data["roomName"]
    identity = data["participantIdentity"]
    
    print(f"✅ Voice Token acquired for room: {room_name}")
    print(f"   Identity: {identity}")
    print(f"   LiveKit Server: {livekit_url}")

    # Step 3: Connect to LiveKit Room
    print("3. Connecting candidate client to WebRTC LiveKit Room...")
    room = rtc.Room()
    
    events_received = {
        "agent_joined": False,
        "track_subscribed": False,
        "audio_frames_received": 0,
        "transcript_chunks": []
    }
    
    audio_frame_event = asyncio.Event()

    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        print(f"👤 Remote Participant joined room: {participant.identity}")
        events_received["agent_joined"] = True

    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.RemoteTrack, publication, participant: rtc.RemoteParticipant):
        print(f"🎵 Track subscribed: {track.kind} (sid: {track.sid}) from {participant.identity}")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            events_received["track_subscribed"] = True
            
            async def read_audio():
                stream = rtc.AudioStream(track, sample_rate=24000, num_channels=1)
                async for frame_event in stream:
                    events_received["audio_frames_received"] += 1
                    if events_received["audio_frames_received"] == 1:
                        print(f"🔊 First AI audio frame received! ({frame_event.frame.sample_rate}Hz, samples: {frame_event.frame.samples_per_channel})")
                    if events_received["audio_frames_received"] >= 10:
                        audio_frame_event.set()
                        break
            asyncio.create_task(read_audio())

    @room.on("data_received")
    def on_data_received(dp: rtc.DataPacket):
        try:
            payload = json.loads(dp.data.decode("utf-8"))
            p_type = payload.get("type")
            if p_type == "transcript":
                text = payload.get("text", "")
                events_received["transcript_chunks"].append(text)
                print(f"💬 Live AI Transcript: \"{text}\"")
            elif p_type == "turnComplete":
                print("🏁 AI Turn Complete signal received")
            elif p_type == "interrupted":
                print("⚡ Barge-in interruption signal received")
        except Exception as e:
            print(f"Data parse error: {e}")

    start_time = time.time()
    await room.connect(livekit_url, livekit_token)
    print("✅ Connected to LiveKit room successfully!")

    # Check if agent already in room
    for p in room.remote_participants.values():
        print(f"👤 Existing participant in room: {p.identity}")
        events_received["agent_joined"] = True
        for pub in p.track_publications.values():
            if pub.track:
                on_track_subscribed(pub.track, pub, p)

    # Wait up to 15 seconds for AI greeting audio frames
    print("⏳ Waiting for Gemini Live to deliver audio via LiteLLM Proxy...")
    try:
        await asyncio.wait_for(audio_frame_event.wait(), timeout=15.0)
    except asyncio.TimeoutError:
        print(f"⚠️ Timed out waiting for 10 audio frames. Frames received so far: {events_received['audio_frames_received']}")
    
    elapsed = time.time() - start_time
    print(f"\n📊 === E2E Diagnostic Summary ({elapsed:.2f}s) ===")
    print(f"  - Agent Joined Room: {events_received['agent_joined']}")
    print(f"  - Track Subscribed: {events_received['track_subscribed']}")
    print(f"  - Audio Frames Received: {events_received['audio_frames_received']}")
    total_transcript = "".join(events_received["transcript_chunks"])
    print(f"  - Total Transcript Chunks: {len(events_received['transcript_chunks'])}")
    if total_transcript:
        print(f"  - Full Transcript: \"{total_transcript[:150]}...\"")
    
    await room.disconnect()
    print("🔌 Disconnected cleanly from WebRTC room.")
    
    if events_received["track_subscribed"] and (events_received["audio_frames_received"] > 0 or len(events_received["transcript_chunks"]) > 0):
        print("\n🎉 === SUCCESS: LiveKit WebRTC Audio Pipeline is 100% OPERATIONAL! ===")
        sys.exit(0)
    else:
        print("\n❌ Pipeline did not complete all stages.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
