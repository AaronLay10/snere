import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { PuzzleRegistry } from '../puzzles/PuzzleRegistry';
import { logger } from '../logger';
import {
  PuzzleProgress,
  SceneState,
  SessionConfig,
  SessionRuntime,
  SessionState
} from '../types';

export declare interface SessionManager {
  on(event: 'session-updated', listener: (session: SessionRuntime) => void): this;
}

export class SessionManager extends EventEmitter {
  private readonly sessions = new Map<string, SessionRuntime>();

  constructor(private readonly puzzles: PuzzleRegistry) {
    super();
  }

  public create(config: Omit<SessionConfig, 'id'> & { id?: string }): SessionRuntime {
    const id = config.id ?? uuid();
    const puzzleIds = this.puzzles.list().map((puzzle) => puzzle.id);
    const session: SessionRuntime = {
      id,
      roomId: config.roomId,
      teamName: config.teamName,
      players: config.players,
      timeLimitMs: config.timeLimitMs,
      state: 'lobby',
      puzzleIds,
      puzzles: puzzleIds.reduce<Record<string, PuzzleProgress>>((memo, puzzleId) => {
        memo[puzzleId] = {
          puzzleId,
          state: 'inactive',
          timeSpentMs: 0,
          attempts: 0
        };
        return memo;
      }, {}),
      score: 0
    };

    this.sessions.set(id, session);
    logger.info({ sessionId: id, roomId: session.roomId }, 'Created new session');
    this.emit('session-updated', session);
    return session;
  }

  public start(sessionId: string): SessionRuntime | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.state = 'active';
    session.startedAt = Date.now();
    session.puzzleIds.forEach((puzzleId) => {
      session.puzzles[puzzleId].state = 'waiting';
    });
    this.sessions.set(sessionId, session);
    this.emit('session-updated', session);
    return session;
  }

  public list(): SessionRuntime[] {
    return Array.from(this.sessions.values());
  }

  public get(sessionId: string): SessionRuntime | undefined {
    return this.sessions.get(sessionId);
  }

  public updatePuzzleState(sessionId: string, puzzleId: string, state: SceneState): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const progress = session.puzzles[puzzleId];
    if (!progress) return;

    progress.state = state;
    if (state === 'solved' || state === 'failed' || state === 'timeout') {
      progress.timeSpentMs = Date.now() - (session.startedAt ?? Date.now());
    }
    session.puzzles[puzzleId] = progress;
    this.sessions.set(sessionId, session);
    this.emit('session-updated', session);
  }

  public end(sessionId: string, state: SessionState): SessionRuntime | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.state = state;
    session.endedAt = Date.now();
    this.sessions.set(sessionId, session);
    this.emit('session-updated', session);
    return session;
  }
}
