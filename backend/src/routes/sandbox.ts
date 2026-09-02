import { Router, Request, Response } from 'express';
import { JvmExecutionService } from '../services/sandbox/JvmExecutionService';

export const sandboxRouter = Router();

// POST /api/sandbox/execute - Execute Java 21 code and test suite in isolated in-memory sandbox
sandboxRouter.post('/execute', async (req: Request, res: Response) => {
  try {
    const { challengeId, files, activePhase = 1 } = req.body;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Массив файлов files обязателен и не должен быть пустым' 
      });
    }

    if (files.length > 20) {
      return res.status(400).json({ 
        success: false, 
        error: 'Превышен лимит файлов для песочницы (максимум 20 файлов)' 
      });
    }

    const result = await JvmExecutionService.execute({
      challengeId,
      files,
      activePhase
    });

    res.json(result);
  } catch (err: any) {
    console.error('Sandbox execution API error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Внутренняя ошибка сервиса песочницы'
    });
  }
});
