import { EventEmitter } from 'events';
import { logger } from '../logger';
import { SensorWatch, ConditionalAction } from '../types';
import { ConditionEvaluator } from './ConditionEvaluator';

/**
 * Watch state tracking
 */
interface WatchState {
  watch: SensorWatch;
  triggerCount: number;
  lastTriggeredAt?: number;
  isEnabled: boolean;
  activePhase?: string;
}

/**
 * PuzzleWatcher monitors sensor watches and executes actions when conditions are met
 *
 * Key features:
 * - Continuous condition monitoring using ConditionEvaluator
 * - Cooldown management to prevent spam
 * - Trigger count limits
 * - Phase-aware activation
 * - Event emission for action execution
 *
 * Events emitted:
 * - 'watch:triggered' - { watchId, watch, actions }
 * - 'watch:disabled' - { watchId, reason }
 */
export class PuzzleWatcher extends EventEmitter {
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly watchStates = new Map<string, WatchState>();
  private monitoringInterval?: NodeJS.Timeout;
  private readonly checkIntervalMs: number = 100; // Check conditions every 100ms

  constructor(conditionEvaluator: ConditionEvaluator) {
    super();
    this.conditionEvaluator = conditionEvaluator;
  }

  /**
   * Register a sensor watch for monitoring
   */
  public registerWatch(watch: SensorWatch, activePhase?: string): void {
    // Check if watch should be active in this phase
    if (watch.activeDuringPhases && watch.activeDuringPhases.length > 0) {
      if (!activePhase || !watch.activeDuringPhases.includes(activePhase)) {
        logger.debug(
          { watchId: watch.id, activePhase, requiredPhases: watch.activeDuringPhases },
          'Watch not active in current phase'
        );
        return;
      }
    }

    const state: WatchState = {
      watch,
      triggerCount: 0,
      isEnabled: true,
      activePhase
    };

    this.watchStates.set(watch.id, state);

    logger.info(
      { watchId: watch.id, name: watch.name, phase: activePhase },
      'Sensor watch registered'
    );
  }

  /**
   * Unregister a sensor watch
   */
  public unregisterWatch(watchId: string): void {
    const removed = this.watchStates.delete(watchId);
    if (removed) {
      logger.info({ watchId }, 'Sensor watch unregistered');
    }
  }

  /**
   * Update active phase and re-evaluate watch eligibility
   */
  public setActivePhase(phase: string): void {
    for (const [watchId, state] of this.watchStates.entries()) {
      const watch = state.watch;

      // Check if watch should be active in this phase
      if (watch.activeDuringPhases && watch.activeDuringPhases.length > 0) {
        const shouldBeActive = watch.activeDuringPhases.includes(phase);

        if (shouldBeActive && !state.isEnabled) {
          state.isEnabled = true;
          state.activePhase = phase;
          logger.debug({ watchId, phase }, 'Watch enabled for phase');
        } else if (!shouldBeActive && state.isEnabled) {
          state.isEnabled = false;
          state.activePhase = undefined;
          logger.debug({ watchId, phase }, 'Watch disabled for phase');
        }
      }
    }
  }

  /**
   * Start monitoring all registered watches
   */
  public startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('Monitoring already started');
      return;
    }

    logger.info(
      { watchCount: this.watchStates.size, intervalMs: this.checkIntervalMs },
      'Starting sensor watch monitoring'
    );

    this.monitoringInterval = setInterval(() => {
      this.checkAllWatches();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring all watches
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Stopped sensor watch monitoring');
    }
  }

  /**
   * Check all registered watches
   */
  private checkAllWatches(): void {
    const now = Date.now();

    for (const [watchId, state] of this.watchStates.entries()) {
      // Skip if watch is disabled
      if (!state.isEnabled) {
        continue;
      }

      const watch = state.watch;

      // Check if cooldown period has passed
      if (watch.cooldownMs && state.lastTriggeredAt) {
        const timeSinceLastTrigger = now - state.lastTriggeredAt;
        if (timeSinceLastTrigger < watch.cooldownMs) {
          continue; // Still in cooldown
        }
      }

      // Check if max triggers reached
      if (watch.maxTriggers && state.triggerCount >= watch.maxTriggers) {
        this.disableWatch(watchId, 'max_triggers_reached');
        continue;
      }

      // Evaluate conditions
      const conditionsMet = this.conditionEvaluator.evaluateConditionGroup(watch.conditions);

      if (conditionsMet) {
        this.triggerWatch(watchId, state, now);
      }
    }
  }

  /**
   * Trigger a watch's actions
   */
  private triggerWatch(watchId: string, state: WatchState, now: number): void {
    const watch = state.watch;

    logger.info(
      {
        watchId: watch.id,
        name: watch.name,
        triggerCount: state.triggerCount + 1,
        maxTriggers: watch.maxTriggers
      },
      'Sensor watch triggered'
    );

    // Update state
    state.triggerCount++;
    state.lastTriggeredAt = now;

    // Emit event with actions to execute
    this.emit('watch:triggered', {
      watchId: watch.id,
      watch,
      actions: watch.onTrigger.actions,
      delayMs: watch.onTrigger.delayMs || 0
    });

    // Disable if triggerOnce is set
    if (watch.triggerOnce) {
      this.disableWatch(watchId, 'trigger_once');
    }
  }

  /**
   * Disable a watch
   */
  private disableWatch(watchId: string, reason: string): void {
    const state = this.watchStates.get(watchId);
    if (state && state.isEnabled) {
      state.isEnabled = false;
      logger.info({ watchId, reason }, 'Watch disabled');
      this.emit('watch:disabled', { watchId, reason });
    }
  }

  /**
   * Get watch state for debugging
   */
  public getWatchState(watchId: string): WatchState | undefined {
    return this.watchStates.get(watchId);
  }

  /**
   * Get all active watches
   */
  public getActiveWatches(): Array<{ id: string; name: string; triggerCount: number }> {
    return Array.from(this.watchStates.entries())
      .filter(([_, state]) => state.isEnabled)
      .map(([id, state]) => ({
        id,
        name: state.watch.name,
        triggerCount: state.triggerCount
      }));
  }

  /**
   * Reset all watches (clear trigger counts, re-enable)
   */
  public reset(): void {
    for (const state of this.watchStates.values()) {
      state.triggerCount = 0;
      state.lastTriggeredAt = undefined;
      state.isEnabled = true;
    }

    logger.info({ watchCount: this.watchStates.size }, 'All watches reset');
  }

  /**
   * Clear all watches and stop monitoring
   */
  public clear(): void {
    this.stopMonitoring();
    this.watchStates.clear();
    logger.info('All watches cleared');
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    totalWatches: number;
    activeWatches: number;
    totalTriggers: number;
    isMonitoring: boolean;
  } {
    let totalTriggers = 0;
    let activeCount = 0;

    for (const state of this.watchStates.values()) {
      totalTriggers += state.triggerCount;
      if (state.isEnabled) {
        activeCount++;
      }
    }

    return {
      totalWatches: this.watchStates.size,
      activeWatches: activeCount,
      totalTriggers,
      isMonitoring: this.monitoringInterval !== undefined
    };
  }
}
