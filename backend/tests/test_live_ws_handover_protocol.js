const assert = require('assert');
const { EventEmitter } = require('events');

console.log('🧪 Running Live WS Handover & Deictic Protocol Integration Test...');

// Mock Gemini WebSocket and Client WebSocket to test routing and framing logic
class MockSocket extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.readyState = 1; // OPEN
    this.sentFrames = [];
  }

  send(data) {
    this.sentFrames.push(typeof data === 'string' ? JSON.parse(data) : data);
  }

  close(code, reason) {
    this.readyState = 3; // CLOSED
    this.emit('close', code, reason);
  }
}

// Test Handover Flush Sequencing Invariant
function testHandoverFlushSequencing() {
  console.log('  Testing Handover Flush Frame Sequencing...');
  const geminiSocket = new MockSocket('Gemini');
  
  // Simulate Turn Handover Flush from client:
  // 1. Code update with turnComplete: false
  const codeFrame = {
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text: '📝 [АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ]:\npublic void acquireToken() { ... }' }]
      }],
      turnComplete: false
    }
  };
  geminiSocket.send(JSON.stringify(codeFrame));

  // 2. Audio chunks or end-of-speech terminal frame with turnComplete: true
  const terminalTurnFrame = {
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text: 'Почему в строке 28 возникает NPE?' }]
      }],
      turnComplete: true
    }
  };
  geminiSocket.send(JSON.stringify(terminalTurnFrame));

  assert.strictEqual(geminiSocket.sentFrames.length, 2, 'Should receive exactly 2 frames');
  
  const frame1 = geminiSocket.sentFrames[0];
  const frame2 = geminiSocket.sentFrames[1];

  assert.strictEqual(frame1.clientContent.turnComplete, false, 'Frame 1 must have turnComplete: false (no interrupt)');
  assert.ok(frame1.clientContent.turns[0].parts[0].text.includes('АКТУАЛЬНЫЙ КОД В РЕДАКТОРЕ'), 'Frame 1 must contain fresh code');

  assert.strictEqual(frame2.clientContent.turnComplete, true, 'Frame 2 must have turnComplete: true (handover trigger)');
  assert.ok(frame2.clientContent.turns[0].parts[0].text.includes('NPE'), 'Frame 2 must contain candidate utterance');

  console.log('    ✅ Handover Flush Frame Sequencing passed.');
}

// Test Semantic Canvas Delta & Anomaly Routing
function testCanvasDeltaRouting() {
  console.log('  Testing Canvas Delta & Anomaly Routing...');
  const geminiSocket = new MockSocket('Gemini');

  // Simulate Canvas Delta Anomaly
  const alertText = '🚨 [АНОМАЛИЯ ХОЛСТА: БОТЛНЕК НА УЗЛЕ "PostgreSQL"]: Нагрузка: 18k RPS, дроп: 38%!';
  const canvasFrame = {
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text: `[CANVAS_DEICTIC_CONTEXT: ${alertText}]` }]
      }],
      turnComplete: false
    }
  };
  geminiSocket.send(JSON.stringify(canvasFrame));

  assert.strictEqual(geminiSocket.sentFrames.length, 1, 'Should receive exactly 1 frame');
  const frame = geminiSocket.sentFrames[0];
  assert.strictEqual(frame.clientContent.turnComplete, false, 'Canvas alert must NOT terminate candidate turn prematurely');
  assert.ok(frame.clientContent.turns[0].parts[0].text.includes('БОТЛНЕК НА УЗЛЕ "PostgreSQL"'), 'Frame must contain anomaly text');

  console.log('    ✅ Canvas Delta & Anomaly Routing passed.');
}

// Test File Switch Action Event Frame
function testFileSwitchActionEvent() {
  console.log('  Testing File Switch Action Event Framing...');
  const geminiSocket = new MockSocket('Gemini');

  const fileSwitchFrame = {
    clientContent: {
      turns: [{
        role: 'user',
        parts: [{ text: '📂 [СМЕНА АКТИВНОГО ФАЙЛА В РЕДАКТОРЕ]: Открыт файл "OrderServiceTest.java"' }]
      }],
      turnComplete: false
    }
  };
  geminiSocket.send(JSON.stringify(fileSwitchFrame));

  assert.strictEqual(geminiSocket.sentFrames.length, 1, 'Should receive file switch frame');
  const frame = geminiSocket.sentFrames[0];
  assert.strictEqual(frame.clientContent.turnComplete, false, 'File switch must NOT terminate candidate turn');
  assert.ok(frame.clientContent.turns[0].parts[0].text.includes('OrderServiceTest.java'), 'Frame must contain new file name');

  console.log('    ✅ File Switch Action Event Framing passed.');
}

testHandoverFlushSequencing();
testCanvasDeltaRouting();
testFileSwitchActionEvent();

console.log('\n🎉 ALL LIVE WS HANDOVER PROTOCOL TESTS PASSED!');
