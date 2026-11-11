/**
 * whiteboard.ts
 * Express router handling Whiteboard Companion ZIP export and state endpoints.
 */

import { Router } from 'express';
import { buildWhiteboardZipPackage } from '../services/whiteboardScaffoldGenerator';

const router = Router();

// GET /api/whiteboard/export-zip - Download standalone Whiteboard project for IntelliJ IDEA
router.get('/export-zip', (req, res) => {
  try {
    const initialCode = typeof req.query.code === 'string' ? req.query.code : undefined;
    const zipBuffer = buildWhiteboardZipPackage(initialCode);
    const filename = 'tutor-whiteboard.zip';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error generating whiteboard project ZIP:', err);
    res.status(500).json({ error: err.message || 'Failed to generate whiteboard zip' });
  }
});

export default router;
