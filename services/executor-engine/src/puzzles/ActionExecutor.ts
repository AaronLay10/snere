import { EventEmitter } from 'events';
import { logger } from '../logger';
import { ConditionalAction, ActionGroup } from '../types';

/**
 * Action execution event data
 */
export interface ActionExecutionEvent {
  action: ConditionalAction;
  context: ActionExecutionContext;
}

/**
 * Context for action execution
 */
export interface ActionExecutionContext {
  sceneId: string;
  roomId: string;
  triggeredBy?: string; // e.g., "watch:sensor_watch_id", "puzzle:solved", "phase:phase_id"
}

/**
 * ActionExecutor executes conditional actions triggered by puzzle events
 *
 * Key features:
 * - Handles individual actions and action groups
 * - Supports delayed execution
 * - Emits events for orchestrator to handle
 * - Action types:
 *   - mqtt.publish: Publish MQTT command to device
 *   - scene.complete: Mark scene as solved
 *   - scene.fail: Mark scene as failed
 *   - puzzle.phase.advance: Advance to next puzzle phase
 *   - audio.play: Play audio file
 *   - video.play: Play video file
 *   - Custom action types can be added
 *
 * Events emitted:
 * - 'action:execute' - { action, context }
 * - 'action:error' - { action, context, error }
 * - 'group:complete' - { actionCount, context }
 */
export class ActionExecutor extends EventEmitter {
  private readonly pendingTimeouts = new Map<string, NodeJS.Timeout>();
  private executionCounter = 0;

  /**
   * Execute a single action
   */
  public executeAction(
    action: ConditionalAction,
    context: ActionExecutionContext
  ): void {
    const executionId = `action-${++this.executionCounter}`;

    if (action.delayMs && action.delayMs > 0) {
      // Schedule delayed execution
      logger.debug(
        {
          executionId,
          actionType: action.type,
          target: action.target,
          delayMs: action.delayMs,
          sceneId: context.sceneId
        },
        'Scheduling delayed action'
      );

      const timeoutId = setTimeout(() => {
        this.executeImmediate(action, context);
        this.pendingTimeouts.delete(executionId);
      }, action.delayMs);

      this.pendingTimeouts.set(executionId, timeoutId);
    } else {
      // Execute immediately
      this.executeImmediate(action, context);
    }
  }

  /**
   * Execute a group of actions
   */
  public executeActionGroup(
    group: ActionGroup,
    context: ActionExecutionContext
  ): void {
    const executionId = `group-${++this.executionCounter}`;

    if (group.delayMs && group.delayMs > 0) {
      // Schedule entire group after delay
      logger.debug(
        {
          executionId,
          actionCount: group.actions.length,
          delayMs: group.delayMs,
          sceneId: context.sceneId
        },
        'Scheduling delayed action group'
      );

      const timeoutId = setTimeout(() => {
        this.executeGroupImmediate(group, context);
        this.pendingTimeouts.delete(executionId);
      }, group.delayMs);

      this.pendingTimeouts.set(executionId, timeoutId);
    } else {
      // Execute immediately
      this.executeGroupImmediate(group, context);
    }
  }

  /**
   * Execute an action immediately (internal)
   */
  private executeImmediate(
    action: ConditionalAction,
    context: ActionExecutionContext
  ): void {
    try {
      logger.info(
        {
          actionType: action.type,
          target: action.target,
          sceneId: context.sceneId,
          triggeredBy: context.triggeredBy
        },
        'Executing conditional action'
      );

      // Emit event for orchestrator to handle
      this.emit('action:execute', {
        action,
        context
      } as ActionExecutionEvent);

    } catch (error) {
      logger.error(
        {
          actionType: action.type,
          target: action.target,
          sceneId: context.sceneId,
          error
        },
        'Error executing action'
      );

      this.emit('action:error', {
        action,
        context,
        error
      });
    }
  }

  /**
   * Execute a group of actions immediately (internal)
   */
  private executeGroupImmediate(
    group: ActionGroup,
    context: ActionExecutionContext
  ): void {
    logger.info(
      {
        actionCount: group.actions.length,
        sceneId: context.sceneId,
        triggeredBy: context.triggeredBy
      },
      'Executing action group'
    );

    // Execute all actions in the group
    for (const action of group.actions) {
      this.executeAction(action, context);
    }

    // Emit group completion event
    this.emit('group:complete', {
      actionCount: group.actions.length,
      context
    });
  }

  /**
   * Cancel a specific pending action/group
   */
  public cancelExecution(executionId: string): boolean {
    const timeoutId = this.pendingTimeouts.get(executionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pendingTimeouts.delete(executionId);
      logger.debug({ executionId }, 'Cancelled pending action execution');
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending actions
   */
  public cancelAll(): void {
    const count = this.pendingTimeouts.size;

    for (const [executionId, timeoutId] of this.pendingTimeouts.entries()) {
      clearTimeout(timeoutId);
    }

    this.pendingTimeouts.clear();

    logger.info({ cancelledCount: count }, 'Cancelled all pending actions');
  }

  /**
   * Get count of pending actions
   */
  public getPendingCount(): number {
    return this.pendingTimeouts.size;
  }

  /**
   * Check if there are any pending actions
   */
  public hasPendingActions(): boolean {
    return this.pendingTimeouts.size > 0;
  }

  /**
   * Clear all state (for cleanup)
   */
  public clear(): void {
    this.cancelAll();
    this.executionCounter = 0;
    this.removeAllListeners();
    logger.debug('ActionExecutor cleared');
  }
}
