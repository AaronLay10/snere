import { Router } from 'express';
import { SequenceRegistry } from '../effects/SequenceRegistry.js';
import { SequenceExecutor } from '../effects/SequenceExecutor.js';
import { SequenceContext } from '../types.js';
import { logger } from '../logger.js';

export interface SequenceRouterDeps {
  registry: SequenceRegistry;
  executor: SequenceExecutor;
}

export function sequencesRouter(deps: SequenceRouterDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const sequences = deps.registry.list();
    res.json({
      success: true,
      data: sequences
    });
  });

  router.get('/:id', (req, res) => {
    const sequence = deps.registry.get(req.params.id);
    if (!sequence) {
      return res.status(404).json({
        success: false,
        error: 'Sequence not found'
      });
    }

    res.json({
      success: true,
      data: sequence
    });
  });

  router.post('/:id/trigger', async (req, res) => {
    const sequence = deps.registry.get(req.params.id);
    if (!sequence) {
      return res.status(404).json({
        success: false,
        error: 'Sequence not found'
      });
    }

    const context: SequenceContext = {
      puzzleId: req.body.puzzleId || sequence.puzzleId,
      roomId: req.body.roomId || sequence.roomId,
      sessionId: req.body.sessionId,
      triggeredAt: Date.now()
    };

    try {
      const executionId = await deps.executor.execute(sequence, context);
      logger.info({ sequenceId: sequence.id, executionId }, 'Sequence triggered via API');

      res.json({
        success: true,
        data: {
          executionId,
          sequenceId: sequence.id
        }
      });
    } catch (error) {
      logger.error({ err: error, sequenceId: sequence.id }, 'Failed to execute sequence');
      res.status(500).json({
        success: false,
        error: 'Failed to execute sequence'
      });
    }
  });

  return router;
}
