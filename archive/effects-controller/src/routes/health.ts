import { Router } from 'express';
import { SequenceRegistry } from '../effects/SequenceRegistry.js';
import { SequenceExecutor } from '../effects/SequenceExecutor.js';

export interface HealthRouterDeps {
  registry: SequenceRegistry;
  executor: SequenceExecutor;
  startedAt: number;
}

export function healthRouter(deps: HealthRouterDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const now = Date.now();
    const uptime = now - deps.startedAt;
    const sequences = deps.registry.list();
    const executions = deps.executor.listExecutions();
    const active = deps.executor.getActiveExecutions();

    res.json({
      status: 'ok',
      uptime,
      sequences: {
        total: sequences.length,
        byRoom: sequences.reduce((acc, seq) => {
          acc[seq.roomId] = (acc[seq.roomId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      executions: {
        total: executions.length,
        active: active.length,
        completed: executions.filter((e) => e.status === 'completed').length,
        failed: executions.filter((e) => e.status === 'failed').length
      }
    });
  });

  return router;
}
