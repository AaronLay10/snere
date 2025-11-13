import { Router } from 'express';
import { z } from 'zod';
import { PuzzleRegistry } from '../puzzles/PuzzleRegistry';
import { PuzzleEngineService } from '../services/PuzzleEngineService';

const UpdateStateSchema = z.object({
  state: z.enum(['inactive', 'waiting', 'active', 'solved', 'failed', 'timeout', 'error']).optional()
});

export const puzzlesRouter = (registry: PuzzleRegistry, engine: PuzzleEngineService) => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      success: true,
      data: registry.list()
    });
  });

  router.get('/:puzzleId', (req, res) => {
    const puzzle = registry.get(req.params.puzzleId);
    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: { code: 'PUZZLE_NOT_FOUND', message: 'Puzzle not found' }
      });
    }
    res.json({ success: true, data: puzzle });
  });

  router.post('/:puzzleId/start', (req, res) => {
    engine.startPuzzle(req.params.puzzleId);
    res.json({ success: true });
  });

  router.post('/:puzzleId/complete', (req, res) => {
    engine.completePuzzle(req.params.puzzleId, 'solved');
    res.json({ success: true });
  });

  router.patch('/:puzzleId', (req, res) => {
    const parseResult = UpdateStateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    const puzzle = registry.get(req.params.puzzleId);
    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: { code: 'PUZZLE_NOT_FOUND', message: 'Puzzle not found' }
      });
    }

    if (parseResult.data.state) {
      engine.completePuzzle(puzzle.id, parseResult.data.state);
    }
    res.json({ success: true, data: registry.get(puzzle.id) });
  });

  return router;
};
