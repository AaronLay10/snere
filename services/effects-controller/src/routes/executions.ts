import { Router } from 'express';
import { SequenceExecutor } from '../effects/SequenceExecutor.js';

export interface ExecutionRouterDeps {
  executor: SequenceExecutor;
}

export function executionsRouter(deps: ExecutionRouterDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const executions = deps.executor.listExecutions();
    res.json({
      success: true,
      data: executions
    });
  });

  router.get('/active', (_req, res) => {
    const active = deps.executor.getActiveExecutions();
    res.json({
      success: true,
      data: active
    });
  });

  router.get('/:id', (req, res) => {
    const execution = deps.executor.getExecution(req.params.id);
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  });

  return router;
}
