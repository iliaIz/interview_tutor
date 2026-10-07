/**
 * wsServerMjsTemplate.ts
 * Self-contained string template for wsServer.mjs to ensure zero filesystem dependency in container.
 */

export const WS_SERVER_MJS_TEMPLATE = `/**
 * wsServer.mjs - Lightweight Zero-Dependency RFC 6455 WebSocket Server for Node.js 20/22
 * Exclusively binds to 127.0.0.1 loopback for the IntelliJ IDE Companion Bridge.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

export function createLoopbackServer(port = 41789) {
  const emitter = new EventEmitter();
  const clients = new Set();

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/probe') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ status: 'ok', service: 'ide-bridge', clientsCount: clients.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin || '';
    const isAllowedOrigin = !origin || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.includes('djelu.site') ||
      origin.includes('sslip.io');

    if (!isAllowedOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + WS_MAGIC_GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      \`Sec-WebSocket-Accept: \${acceptKey}\`
    ];

    socket.write(headers.join('\\r\\n') + '\\r\\n\\r\\n');
    socket.setKeepAlive(true);
    socket.setNoDelay(true);

    const client = {
      id: crypto.randomUUID(),
      socket,
      send(data) {
        if (socket.writable) {
          socket.write(encodeFrame(typeof data === 'string' ? data : JSON.stringify(data)));
        }
      }
    };

    clients.add(client);
    emitter.emit('connection', client);

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const parsed = parseFrame(buffer);
        if (!parsed) break;
        buffer = buffer.subarray(parsed.totalLength);

        if (parsed.opcode === OPCODES.TEXT) {
          emitter.emit('message', parsed.payload.toString('utf8'), client);
        } else if (parsed.opcode === OPCODES.PING) {
          socket.write(encodeFrame(parsed.payload, OPCODES.PONG));
        } else if (parsed.opcode === OPCODES.CLOSE) {
          socket.write(encodeFrame('', OPCODES.CLOSE));
          socket.end();
          break;
        }
      }
    });

    const cleanup = () => {
      if (clients.has(client)) {
        clients.delete(client);
        emitter.emit('disconnect', client);
      }
    };

    socket.on('end', cleanup);
    socket.on('close', cleanup);
    socket.on('error', () => {
      cleanup();
    });
  });

  return {
    listen(callback) {
      server.listen(port, '127.0.0.1', () => {
        if (callback) callback(port);
      });
      return this;
    },
    broadcast(data) {
      const payload = encodeFrame(typeof data === 'string' ? data : JSON.stringify(data));
      for (const client of clients) {
        if (client.socket.writable) {
          client.socket.write(payload);
        }
      }
    },
    close(cb) {
      for (const client of clients) {
        try { client.socket.destroy(); } catch {}
      }
      clients.clear();
      server.close(cb);
    },
    getClientCount() {
      return clients.size;
    },
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter)
  };
}

function parseFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const fin = (firstByte & 0x80) !== 0;
  const opcode = firstByte & 0x0f;
  const isMasked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;

  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  let maskKey = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) return null;

  const rawPayload = buffer.subarray(offset, offset + payloadLength);
  const payload = Buffer.alloc(payloadLength);

  if (isMasked && maskKey) {
    for (let i = 0; i < payloadLength; i++) {
      payload[i] = rawPayload[i] ^ maskKey[i % 4];
    }
  } else {
    rawPayload.copy(payload);
  }

  return {
    fin,
    opcode,
    payload,
    totalLength: offset + payloadLength
  };
}

function encodeFrame(data, opcode = OPCODES.TEXT) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const payloadLength = payload.length;

  let header;
  if (payloadLength < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = payloadLength;
  } else if (payloadLength <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  return Buffer.concat([header, payload]);
}
`;
