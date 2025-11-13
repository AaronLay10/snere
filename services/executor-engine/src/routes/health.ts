import { Router } from 'express';
import os from 'os';
import { PuzzleRegistry } from '../puzzles/PuzzleRegistry';
import { SessionManager } from '../sessions/SessionManager';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
const VERSION = packageJson.version;

export const healthRouter = (services: { puzzles: PuzzleRegistry; sessions: SessionManager; startedAt: number }) => {
  const router = Router();

  router.get('/', (_req, res) => {
    const uptimeMs = Date.now() - services.startedAt;
    res.json({
      status: 'ok',
      service: 'scene-executor',
      version: VERSION,
      uptimeMs,
      uptimeHuman: `${Math.round(uptimeMs / 1000)}s`,
      puzzles: services.puzzles.list().map((puzzle) => ({
        id: puzzle.id,
        state: puzzle.state,
        roomId: puzzle.roomId
      })),
      sessions: services.sessions.list().map((session) => ({
        id: session.id,
        state: session.state,
        roomId: session.roomId
      })),
      system: {
        hostname: os.hostname(),
        loadAverage: os.loadavg(),
        rssBytes: process.memoryUsage().rss
      }
    });
  });

  return router;
};
