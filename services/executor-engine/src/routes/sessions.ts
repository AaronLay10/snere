import { Router } from 'express';
import { z } from 'zod';
import { SessionManager } from '../sessions/SessionManager';

const CreateSessionSchema = z.object({
  roomId: z.string(),
  teamName: z.string(),
  players: z.number().min(1).max(12),
  timeLimitMs: z.number().min(1_000).max(3_600_000)
});

export const sessionsRouter = (sessions: SessionManager) => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      success: true,
      data: sessions.list()
    });
  });

  router.post('/', (req, res) => {
    const parseResult = CreateSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SESSION', message: parseResult.error.message }
      });
    }

    const session = sessions.create(parseResult.data);
    res.status(201).json({ success: true, data: session });
  });

  router.post('/:sessionId/start', (req, res) => {
    const session = sessions.start(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' }
      });
    }
    res.json({ success: true, data: session });
  });

  router.post('/:sessionId/end', (req, res) => {
    const state = (req.body?.state as string) ?? 'completed';
    const session = sessions.end(req.params.sessionId, state as any);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' }
      });
    }
    res.json({ success: true, data: session });
  });

  return router;
};
