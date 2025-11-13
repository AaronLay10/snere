import { EventEmitter } from 'events';
import { logger } from '../logger';
import { SceneRuntime, CutsceneAction } from '../types';

export declare interface CutsceneExecutor {
  on(event: 'action-executed', listener: (sceneId: string, action: CutsceneAction, index: number) => void): this;
  on(event: 'action-waiting', listener: (sceneId: string, action: CutsceneAction, index: number, delayMs: number) => void): this;
  on(event: 'cutscene-complete', listener: (sceneId: string) => void): this;
  on(event: 'cutscene-error', listener: (sceneId: string, error: Error) => void): this;
}

interface ScheduledAction {
  sceneId: string;
  action: CutsceneAction;
  index: number;
  timeoutId: NodeJS.Timeout;
}

/**
 * CutsceneExecutor handles absolute-timed sequences of actions
 *
 * When a cutscene is started, all actions are scheduled based on their
 * absolute delayMs timing. Actions execute independently and can overlap.
 */
export class CutsceneExecutor extends EventEmitter {
  private readonly runningCutscenes = new Map<string, ScheduledAction[]>();
  private readonly activeLoops = new Map<string, NodeJS.Timeout>();

  /**
   * Start executing a cutscene or scene
   */
  public start(scene: SceneRuntime): void {
    if (scene.type !== 'cutscene' && scene.type !== 'scene') {
      logger.error({ sceneId: scene.id, type: scene.type }, 'Cannot execute: not a cutscene or scene');
      return;
    }

    if (!scene.sequence || scene.sequence.length === 0) {
      logger.warn({ sceneId: scene.id }, 'Cutscene has no actions to execute');
      this.emit('cutscene-complete', scene.id);
      return;
    }

    if (this.runningCutscenes.has(scene.id)) {
      logger.warn({ sceneId: scene.id }, 'Cutscene is already running');
      return;
    }

    const startTime = Date.now();
    const scheduledActions: ScheduledAction[] = [];

    logger.info(
      { sceneId: scene.id, actionCount: scene.sequence.length, name: scene.name },
      'Starting cutscene execution'
    );

    // Schedule all actions based on absolute timing
    scene.sequence.forEach((action, index) => {
      const timeoutId = setTimeout(() => {
        // Check if this is a stopLoop action
        if (action.action === 'loop.stop') {
          this.handleStopLoopAction(action);
        } else {
          // Execute normal action
          this.executeAction(scene.id, action, index);

          // Check if this action should loop
          const execution = (action as any).execution;
          if (execution && execution.mode === 'loop') {
            this.startLoop(action, scene.id);
          }
        }

        // Remove from scheduled list
        const scheduled = this.runningCutscenes.get(scene.id);
        if (scheduled) {
          const filtered = scheduled.filter(s => s.index !== index);
          if (filtered.length === 0) {
            // All actions completed
            this.runningCutscenes.delete(scene.id);
            this.emit('cutscene-complete', scene.id);
            const duration = Date.now() - startTime;
            logger.info(
              { sceneId: scene.id, durationMs: duration, name: scene.name },
              'Cutscene execution completed'
            );
          } else {
            this.runningCutscenes.set(scene.id, filtered);
          }
        }
      }, action.delayMs);

      scheduledActions.push({
        sceneId: scene.id,
        action,
        index,
        timeoutId
      });

      logger.debug(
        {
          sceneId: scene.id,
          actionIndex: index,
          delayMs: action.delayMs,
          action: action.action,
          target: action.target
        },
        'Scheduled cutscene action'
      );
    });

    this.runningCutscenes.set(scene.id, scheduledActions);
  }

  /**
   * Stop a running cutscene
   */
  public stop(sceneId: string): void {
    const scheduled = this.runningCutscenes.get(sceneId);
    if (!scheduled) {
      logger.debug({ sceneId }, 'No running cutscene to stop');
      return;
    }

    // Cancel all scheduled actions
    scheduled.forEach(({ timeoutId, index }) => {
      clearTimeout(timeoutId);
      logger.debug({ sceneId, actionIndex: index }, 'Cancelled cutscene action');
    });

    this.runningCutscenes.delete(sceneId);
    logger.info({ sceneId }, 'Cutscene execution stopped');
  }

  /**
   * Pause a running cutscene (not yet implemented - complex with absolute timing)
   */
  public pause(sceneId: string): void {
    // TODO: Implement pause/resume with timing adjustments
    logger.warn({ sceneId }, 'Pause not yet implemented for cutscenes');
  }

  /**
   * Resume a paused cutscene (not yet implemented)
   */
  public resume(sceneId: string): void {
    // TODO: Implement pause/resume with timing adjustments
    logger.warn({ sceneId }, 'Resume not yet implemented for cutscenes');
  }

  /**
   * Check if a cutscene is currently running
   */
  public isRunning(sceneId: string): boolean {
    return this.runningCutscenes.has(sceneId);
  }

  /**
   * Get the number of remaining actions for a cutscene
   */
  public getRemainingActionCount(sceneId: string): number {
    const scheduled = this.runningCutscenes.get(sceneId);
    return scheduled?.length ?? 0;
  }

  /**
   * Stop all running cutscenes
   */
  public stopAll(): void {
    const sceneIds = Array.from(this.runningCutscenes.keys());
    sceneIds.forEach((sceneId) => this.stop(sceneId));
    logger.info({ count: sceneIds.length }, 'Stopped all running cutscenes');
  }

  /**
   * Execute a single action
   * This emits an event that will be handled by the effects controller
   * If the action has timing_config.delayAfterMs, waits before marking as complete
   */
  private executeAction(sceneId: string, action: CutsceneAction, index: number): void {
    try {
      logger.info(
        {
          sceneId,
          actionIndex: index,
          action: action.action,
          target: action.target,
          duration: action.duration,
          delayAfterMs: (action as any).timing_config?.delayAfterMs
        },
        'Executing cutscene action'
      );

      // Emit event for the action
      // The SceneOrchestratorService will listen to this and send commands to devices
      this.emit('action-executed', sceneId, action, index);

      // Check if there's a delay after execution
      const timingConfig = (action as any).timing_config;
      if (timingConfig && timingConfig.delayAfterMs && timingConfig.delayAfterMs > 0) {
        logger.debug(
          {
            sceneId,
            actionIndex: index,
            delayAfterMs: timingConfig.delayAfterMs
          },
          'Waiting after action execution'
        );

        // Emit a waiting event so the frontend can show progress
        this.emit('action-waiting', sceneId, action, index, timingConfig.delayAfterMs);
      }
    } catch (error) {
      logger.error(
        {
          sceneId,
          actionIndex: index,
          action: action.action,
          error
        },
        'Error executing cutscene action'
      );
      this.emit('cutscene-error', sceneId, error as Error);
    }
  }

  /**
   * Start a loop that repeats an action at intervals
   */
  private startLoop(action: CutsceneAction, sceneId: string): void {
    const execution = (action as any).execution;
    if (!execution || !execution.loopId || !execution.interval) {
      logger.warn({ action }, 'Invalid loop execution config');
      return;
    }

    const { loopId, interval } = execution;

    // Stop existing loop with same ID
    if (this.activeLoops.has(loopId)) {
      logger.warn({ loopId }, 'Loop already active, stopping previous instance');
      this.stopLoop(loopId);
    }

    logger.info({ loopId, interval, action: action.action }, 'Starting loop');

    // Execute immediately first time
    this.emit('action-executed', sceneId, action, -1);

    // Then set up interval
    const intervalHandle = setInterval(() => {
      logger.debug({ loopId, action: action.action }, 'Executing loop iteration');
      this.emit('action-executed', sceneId, action, -1);
    }, interval);

    this.activeLoops.set(loopId, intervalHandle);
  }

  /**
   * Stop a running loop by ID
   */
  private stopLoop(loopId: string): void {
    const intervalHandle = this.activeLoops.get(loopId);

    if (intervalHandle) {
      clearInterval(intervalHandle);
      this.activeLoops.delete(loopId);
      logger.info({ loopId }, 'Loop stopped');
    } else {
      logger.warn({ loopId }, 'Attempted to stop non-existent loop');
    }
  }

  /**
   * Handle loop.stop action
   */
  private handleStopLoopAction(action: CutsceneAction): void {
    const loopId = (action as any).loopId;
    if (loopId) {
      this.stopLoop(loopId);
    } else {
      logger.warn({ action }, 'stopLoop action missing loopId');
    }
  }

  /**
   * Cleanup all active loops (called on scene end or reset)
   */
  public cleanupLoops(): void {
    logger.info({ activeLoopCount: this.activeLoops.size }, 'Cleaning up active loops');

    for (const [loopId, handle] of this.activeLoops.entries()) {
      clearInterval(handle);
      logger.debug({ loopId }, 'Loop cleaned up');
    }

    this.activeLoops.clear();
  }
}
