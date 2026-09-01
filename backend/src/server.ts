import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import topicsRouter from './routes/topics';
import evalRouter from './routes/eval';
import podcastRouter from './routes/podcast';
import profilesRouter from './routes/profiles';
import sttRouter from './routes/stt';
import tutorRouter from './routes/tutor';
import memoryRouter from './routes/memory';
import interviewTurnRouter from './routes/interviewTurn';
import practiceRouter from './routes/practice';
import { systemDesignRouter } from './routes/systemDesign';
import { triageRouter } from './routes/triage';
import { roadmapsRouter } from './routes/roadmaps';
import { seedQuestionsFromJSON, recoverOrphanedJobs, seedDefaultProfiles, seedCodingChallenges, seedNextGenCatalogs } from './services/db';
import { setupLiveWebSocketProxy } from './services/geminiLiveProxy';
import { envConfig } from './config/env';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '50mb' }));

import { checkSystemHealth } from './services/health';

// API Routes
app.use('/api/topics', topicsRouter);
app.use('/api/eval', evalRouter);
app.use('/api/podcast', podcastRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/stt', sttRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/interview', interviewTurnRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/system-design', systemDesignRouter);
app.use('/api/triage', triageRouter);
app.use('/api/roadmaps', roadmapsRouter);


// Safety alias route for direct question queries
app.get('/api/questions/:topicId', (req, res) => {
  const { topicId } = req.params;
  res.redirect(307, `/api/topics/${topicId}/questions`);
});

app.get('/api/health', async (req, res) => {
  const health = await checkSystemHealth();
  const statusCode = health.status === 'unreachable' ? 503 : 200;
  res.status(statusCode).json(health);
});

// Dynamic Model Discovery Configuration Endpoint for Frontend
app.get('/api/config', (req, res) => {
  res.json({
    models: {
      defaultLiveModel: envConfig.models.live,
      defaultLivePreviewModel: envConfig.models.livePreview,
      defaultTtsModel: envConfig.models.tts,
      defaultTextModel: envConfig.models.text,
      defaultFastModel: envConfig.models.fast,
      defaultEmbeddingModel: envConfig.models.embedding,
      supportedLiveModels: envConfig.models.supportedLiveModels
    }
  });
});

// Create HTTP server
const server = http.createServer(app);

// Setup Gemini Live WebSocket Proxy
setupLiveWebSocketProxy(server);

// Seed DB, recover orphaned jobs, seed profiles, coding challenges, and Next-Gen catalogs
seedQuestionsFromJSON();
recoverOrphanedJobs();
seedDefaultProfiles();
seedCodingChallenges();
seedNextGenCatalogs();


server.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint at ws://localhost:${PORT}/ws/live`);
});
