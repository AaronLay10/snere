import { PuzzleRegistry } from '../puzzles/PuzzleRegistry';
import { SessionManager } from '../sessions/SessionManager';
import { TimerManager } from '../timing/TimerManager';
import { DeviceMonitorClient } from '../clients/DeviceMonitorClient';
import { EffectsControllerClient } from '../clients/EffectsControllerClient';
import { SceneState, DeviceEvent } from '../types';
import { logger } from '../logger';

export class PuzzleEngineService {
  constructor(
    private readonly puzzles: PuzzleRegistry,
    private readonly sessions: SessionManager,
    private readonly timers: TimerManager,
    private readonly deviceMonitor?: DeviceMonitorClient,
    private readonly effectsController?: EffectsControllerClient
  ) {}

  public startPuzzle(puzzleId: string): void {
    const puzzle = this.puzzles.setState(puzzleId, 'active');
    if (!puzzle) return;

    logger.info({ puzzleId }, 'Puzzle activated');
    if (puzzle.timeLimitMs) {
      this.timers.startTimer(`puzzle-${puzzleId}`, puzzle.timeLimitMs);
    }
  }

  public completePuzzle(puzzleId: string, state: SceneState = 'solved'): void {
    const puzzle = this.puzzles.setState(puzzleId, state);
    if (!puzzle) return;
    this.timers.stopTimer(`puzzle-${puzzleId}`);
    logger.info({ puzzleId, state }, 'Puzzle completed');
  }

  public async handleDeviceEvent(event: DeviceEvent): Promise<void> {
    logger.debug({ event }, 'Received device event');
    const puzzle = this.puzzles.get(event.puzzleId);
    if (!puzzle) {
      logger.warn({ event }, 'Device event for unknown puzzle');
      return;
    }

    if (event.type === 'puzzle.start') {
      this.startPuzzle(puzzle.id);
      return;
    }

    if (event.type === 'puzzle.solve') {
      this.completePuzzle(puzzle.id, 'solved');
      if (this.effectsController && Array.isArray(puzzle.outputs)) {
        for (const sequence of puzzle.outputs) {
          await this.effectsController.triggerSequence(sequence, {
            puzzleId: puzzle.id,
            roomId: puzzle.roomId
          });
        }
      }
      return;
    }

    if (event.type === 'device.command') {
      if (this.deviceMonitor) {
        await this.deviceMonitor.sendCommand(event.deviceId, event.payload);
      }
      return;
    }
  }
}
