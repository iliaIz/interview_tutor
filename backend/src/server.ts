import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import topicsRouter from './routes/topics';
import evalRouter from './routes/eval';
import podcastRouter from './routes/podcast';
import profilesRouter from './routes/profiles';
import { seedQuestionsFromJSON, recoverOrphanedJobs, seedDefaultProfiles } from './services/db';
import { setupLiveWebSocketProxy } from './services/geminiLiveProxy';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

import { checkSystemHealth } from './services/health';

// API Routes
app.use('/api/topics', topicsRouter);
app.use('/api/eval', evalRouter);
app.use('/api/podcast', podcastRouter);
app.use('/api/profiles', profilesRouter);

app.get('/api/health', async (req, res) => {
  const health = await checkSystemHealth();
  const statusCode = health.status === 'unreachable' ? 503 : 200;
  res.status(statusCode).json(health);
});

// Create HTTP server
const server = http.createServer(app);

// Setup Gemini Live WebSocket Proxy
setupLiveWebSocketProxy(server);

// Seed DB, recover orphaned jobs, seed profiles and start server
seedQuestionsFromJSON();
recoverOrphanedJobs();
seedDefaultProfiles();

server.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint at ws://localhost:${PORT}/ws/live`);
});
