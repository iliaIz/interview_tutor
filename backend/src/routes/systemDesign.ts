import { Router, Request, Response } from 'express';
import { resolveScenarioManifest, resolveCanonicalId } from '../services/scenarioResolver';
import { evaluateSystemDesign } from '../services/systemDesignEvaluator';
import { SystemDesignCatalog } from '../services/SystemDesignCatalog';
import { SystemDesignProbeGateway } from '../services/SystemDesignProbeGateway';

export { resolveScenarioManifest, resolveCanonicalId };
export const systemDesignRouter = Router();

// GET /api/system-design/scenarios
systemDesignRouter.get('/scenarios', (req: Request, res: Response) => {
  try {
    const { category, search, level } = req.query;
    const scenarios = SystemDesignCatalog.listScenarios({
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
      level: typeof level === 'string' ? level : undefined
    });
    res.json(scenarios);
  } catch (err: any) {
    console.error('Error fetching system design scenarios:', err);
    res.status(500).json({ error: 'Failed to fetch scenarios', message: err.message });
  }
});

// GET /api/system-design/scenarios/:id
systemDesignRouter.get('/scenarios/:id', (req: Request, res: Response) => {
  try {
    const scenarioId = String(req.params.id);
    const scenario = SystemDesignCatalog.getScenarioById(scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found', requestedId: scenarioId });
    }
    res.json(scenario);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch scenario details', message: err.message });
  }
});

// POST /api/system-design/probe (Universal Multi-Mode AI Tutor Probing)
systemDesignRouter.post('/probe', async (req: Request, res: Response) => {
  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45_000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    try {
      const result = await SystemDesignProbeGateway.probe(req.body, abortController.signal);
      res.json(result);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('System design probe error:', err);
    res.status(500).json({ error: 'AI probe failed', message: err.message });
  }
});

// POST /api/system-design/evaluate
systemDesignRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'default_user';
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45_000);
    req.on('close', () => {
      clearTimeout(timeoutId);
      abortController.abort();
    });

    try {
      const evaluation = await evaluateSystemDesign(req.body, userId, abortController.signal);
      res.json(evaluation);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('System design eval error:', err);
    res.status(500).json({ error: 'Evaluation failed', message: err.message });
  }
});

// GET /api/system-design/submissions/:scenarioId
systemDesignRouter.get('/submissions/:scenarioId', (req: Request, res: Response) => {
  try {
    const scenarioId = String(req.params.scenarioId);
    const userId = (req as any).user?.id || 'default_user';
    const submission = SystemDesignCatalog.getSubmission(scenarioId, userId);
    res.json({ submission });
  } catch (err: any) {
    console.error('Fetch submission error:', err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// GET /api/system-design/ledger/:scenarioId
systemDesignRouter.get('/ledger/:scenarioId', (req: Request, res: Response) => {
  try {
    const scenarioId = String(req.params.scenarioId);
    const userId = (req as any).user?.id || 'default_user';
    const progress = SystemDesignCatalog.getLedgerProgress(scenarioId, userId);
    res.json({ progress });
  } catch (err: any) {
    console.error('Fetch ledger error:', err);
    res.status(500).json({ error: 'Failed to fetch ledger progress' });
  }
});
