import { Router } from 'express';
import axios from 'axios';
import createError from 'http-errors';
import { logger } from '../logger';

export function puzzlesRouter(puzzleEngineUrl?: string): Router {
  const router = Router();

  if (!puzzleEngineUrl) {
    router.use((_req, _res, next) => {
      next(createError(503, 'Puzzle Engine not configured'));
    });
    return router;
  }

  // GET /puzzles - List all puzzles
  router.get('/', async (_req, res, next) => {
    try {
      const response = await axios.get(`${puzzleEngineUrl}/puzzles`, {
        timeout: 5000
      });
      res.json(response.data);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to fetch puzzles from Puzzle Engine');
      next(createError(502, 'Failed to fetch puzzles'));
    }
  });

  // GET /puzzles/:id - Get specific puzzle
  router.get('/:id', async (req, res, next) => {
    try {
      const response = await axios.get(`${puzzleEngineUrl}/puzzles/${req.params.id}`, {
        timeout: 5000
      });
      res.json(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        next(createError(404, `Puzzle ${req.params.id} not found`));
      } else {
        logger.error({ err: error, puzzleId: req.params.id }, 'Failed to fetch puzzle');
        next(createError(502, 'Failed to fetch puzzle'));
      }
    }
  });

  // POST /puzzles/:id/events - Forward puzzle event
  router.post('/:id/events', async (req, res, next) => {
    try {
      const response = await axios.post(
        `${puzzleEngineUrl}/puzzles/${req.params.id}/events`,
        req.body,
        { timeout: 5000 }
      );
      res.json(response.data);
    } catch (error: any) {
      logger.error({ err: error, puzzleId: req.params.id }, 'Failed to send puzzle event');
      next(createError(502, 'Failed to send puzzle event'));
    }
  });

  // POST /puzzles/:id/reset - Reset puzzle
  router.post('/:id/reset', async (req, res, next) => {
    try {
      const response = await axios.post(
        `${puzzleEngineUrl}/puzzles/${req.params.id}/reset`,
        req.body,
        { timeout: 5000 }
      );
      res.json(response.data);
    } catch (error: any) {
      logger.error({ err: error, puzzleId: req.params.id }, 'Failed to reset puzzle');
      next(createError(502, 'Failed to reset puzzle'));
    }
  });

  return router;
}
