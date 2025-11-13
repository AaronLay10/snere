import { EventEmitter } from 'events';
import { logger } from '../logger';
import { PuzzleConfig, PuzzleRuntime, SceneState } from '../types';

export declare interface PuzzleRegistry {
  on(event: 'puzzle-updated', listener: (puzzle: PuzzleRuntime) => void): this;
}

export class PuzzleRegistry extends EventEmitter {
  private readonly puzzles = new Map<string, PuzzleRuntime>();

  public register(config: PuzzleConfig): PuzzleRuntime {
    const puzzle: PuzzleRuntime = {
      ...config,
      prerequisites: config.prerequisites ?? [],
      outputs: config.outputs ?? [],
      metadata: config.metadata ?? {},
      state: 'inactive',
      attempts: 0,
      lastUpdated: Date.now()
    };

    this.puzzles.set(config.id, puzzle);
    logger.info({ puzzleId: config.id }, 'Registered puzzle configuration');
    return puzzle;
  }

  public registerMany(configs: PuzzleConfig[]): void {
    configs.forEach((config) => this.register(config));
  }

  public list(): PuzzleRuntime[] {
    return Array.from(this.puzzles.values());
  }

  public get(id: string): PuzzleRuntime | undefined {
    return this.puzzles.get(id);
  }

  public setState(puzzleId: string, state: SceneState): PuzzleRuntime | undefined {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) return undefined;

    puzzle.state = state;
    puzzle.lastUpdated = Date.now();
    if (state === 'active') {
      puzzle.timeStarted = puzzle.timeStarted ?? Date.now();
    }
    if (state === 'solved' || state === 'failed' || state === 'timeout') {
      puzzle.timeCompleted = Date.now();
    }
    this.puzzles.set(puzzleId, puzzle);
    this.emit('puzzle-updated', puzzle);
    return puzzle;
  }

  public recordAttempt(puzzleId: string): void {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) return;

    puzzle.attempts += 1;
    puzzle.lastUpdated = Date.now();
    this.puzzles.set(puzzleId, puzzle);
    this.emit('puzzle-updated', puzzle);
  }
}
