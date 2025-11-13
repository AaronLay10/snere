import { EventEmitter } from 'events';
import { logger } from '../logger';
import { PuzzleState, SceneRuntime, ConditionGroup } from '../types';
import { ConditionEvaluator } from './ConditionEvaluator';
import { ActionExecutor, ActionExecutionContext } from './ActionExecutor';
import { PuzzleWatcher } from './PuzzleWatcher';

/**
 * Puzzle state tracking
 * In escape room terminology: States are the major stages of a puzzle (State 1, State 2, etc.)
 */
interface StateTracker {
  state: PuzzleState;
  index: number;
  startedAt: number;
  completedAt?: number;
  isActive: boolean;
}

/**
 * PuzzleStateManager manages multi-state puzzle progression
 *
 * Terminology (Escape Room Industry Standard):
 * - State: Major stage of a puzzle (e.g., State 1, State 2, State 3)
 * - Step: Sub-stages within a state (e.g., "Boiler Valve Setup", "Gate Valve Calibration")
 *
 * Key features:
 * - Optional multi-state support (single state by default)
 * - State win condition evaluation
 * - State-specific sensor watch activation
 * - State transition actions
 * - Time limits per state
 * - Step-based sub-state machines (future enhancement)
 *
 * Events emitted:
 * - 'state:started' - { sceneId, state, index }
 * - 'state:completed' - { sceneId, state, index, timeSpentMs }
 * - 'state:timeout' - { sceneId, state, index }
 * - 'puzzle:completed' - { sceneId, totalStates, totalTimeMs }
 */
export class PuzzleStateManager extends EventEmitter {
  private readonly stateTrackers = new Map<string, StateTracker[]>();
  private readonly currentStateIndex = new Map<string, number>();
  private readonly stateTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly actionExecutor: ActionExecutor,
    private readonly puzzleWatcher: PuzzleWatcher
  ) {
    super();
  }

  /**
   * Initialize states for a puzzle
   * If no states are defined in metadata, creates a single default state from win conditions
   */
  public initializePuzzle(puzzle: SceneRuntime): void {
    if (puzzle.type !== 'puzzle') {
      logger.warn({ sceneId: puzzle.id }, 'Cannot initialize states: not a puzzle');
      return;
    }

    const metadata = puzzle.metadata || {};
    const states = metadata.states as PuzzleState[] | undefined;

    // If states are defined, use them
    if (states && states.length > 0) {
      this.initializeStates(puzzle.id, states);
      return;
    }

    // Otherwise, create a single default state from win conditions
    const winConditions = metadata.winConditions as ConditionGroup | undefined;
    if (winConditions) {
      const defaultState: PuzzleState = {
        id: 'default',
        name: 'Main Puzzle',
        description: 'Default single-state puzzle',
        winConditions
      };

      this.initializeStates(puzzle.id, [defaultState]);
      logger.debug({ sceneId: puzzle.id }, 'Created default single-state puzzle');
    } else {
      logger.warn(
        { sceneId: puzzle.id },
        'Puzzle has no states or win conditions defined'
      );
    }
  }

  /**
   * Initialize state trackers
   */
  private initializeStates(sceneId: string, states: PuzzleState[]): void {
    const trackers: StateTracker[] = states.map((state, index) => ({
      state,
      index,
      startedAt: 0,
      isActive: false
    }));

    this.stateTrackers.set(sceneId, trackers);
    this.currentStateIndex.set(sceneId, -1); // Not started yet

    logger.info(
      { sceneId, stateCount: states.length },
      'Initialized puzzle states'
    );
  }

  /**
   * Start the first state of a puzzle
   */
  public startPuzzle(puzzle: SceneRuntime): void {
    if (!this.stateTrackers.has(puzzle.id)) {
      logger.warn({ sceneId: puzzle.id }, 'Puzzle not initialized');
      return;
    }

    this.advanceToState(puzzle, 0);
  }

  /**
   * Advance to a specific state
   */
  private advanceToState(puzzle: SceneRuntime, stateIndex: number): void {
    const states = this.stateTrackers.get(puzzle.id);
    if (!states || stateIndex >= states.length) {
      logger.error(
        { sceneId: puzzle.id, stateIndex, totalStates: states?.length },
        'Invalid state index'
      );
      return;
    }

    // Deactivate current state if any
    const currentIndex = this.currentStateIndex.get(puzzle.id);
    if (currentIndex !== undefined && currentIndex >= 0 && currentIndex < states.length) {
      const currentState = states[currentIndex];
      currentState.isActive = false;
      currentState.completedAt = Date.now();

      // Stop state timer
      this.stopStateTimer(puzzle.id);
    }

    // Activate new state
    const newState = states[stateIndex];
    newState.isActive = true;
    newState.startedAt = Date.now();
    this.currentStateIndex.set(puzzle.id, stateIndex);

    logger.info(
      {
        sceneId: puzzle.id,
        stateIndex,
        stateId: newState.state.id,
        stateName: newState.state.name
      },
      'State started'
    );

    // Emit state started event
    this.emit('state:started', {
      sceneId: puzzle.id,
      state: newState.state,
      index: stateIndex
    });

    // Register state-specific sensor watches
    if (newState.state.sensorWatches) {
      for (const watch of newState.state.sensorWatches) {
        this.puzzleWatcher.registerWatch(watch, newState.state.id);
      }
    }

    // Update puzzle watcher with active state
    this.puzzleWatcher.setActivePhase(newState.state.id);

    // Start state timer if time limit is set
    if (newState.state.timeLimitMs) {
      this.startStateTimer(puzzle, stateIndex, newState.state.timeLimitMs);
    }
  }

  /**
   * Start state timer
   */
  private startStateTimer(puzzle: SceneRuntime, stateIndex: number, timeLimitMs: number): void {
    const timerId = setTimeout(() => {
      const states = this.stateTrackers.get(puzzle.id);
      if (!states) return;

      const stateTracker = states[stateIndex];
      logger.warn(
        {
          sceneId: puzzle.id,
          stateIndex,
          stateId: stateTracker.state.id,
          timeLimitMs
        },
        'State timeout'
      );

      this.emit('state:timeout', {
        sceneId: puzzle.id,
        state: stateTracker.state,
        index: stateIndex
      });
    }, timeLimitMs);

    this.stateTimers.set(puzzle.id, timerId);
  }

  /**
   * Stop state timer
   */
  private stopStateTimer(sceneId: string): void {
    const timerId = this.stateTimers.get(sceneId);
    if (timerId) {
      clearTimeout(timerId);
      this.stateTimers.delete(sceneId);
    }
  }

  /**
   * Check if current state is completed
   */
  public checkStateCompletion(sceneId: string): boolean {
    const states = this.stateTrackers.get(sceneId);
    const stateIndex = this.currentStateIndex.get(sceneId);

    if (!states || stateIndex === undefined || stateIndex < 0 || stateIndex >= states.length) {
      return false;
    }

    const stateTracker = states[stateIndex];
    if (!stateTracker.isActive) {
      return false;
    }

    // Evaluate state win conditions
    const winConditions = stateTracker.state.winConditions;
    if (!winConditions) {
      return false;
    }

    const conditionsMet = this.conditionEvaluator.evaluateConditionGroup(winConditions);

    if (conditionsMet) {
      this.completeState(sceneId, stateIndex);
      return true;
    }

    return false;
  }

  /**
   * Complete the current state
   */
  private completeState(sceneId: string, stateIndex: number): void {
    const states = this.stateTrackers.get(sceneId);
    if (!states) return;

    const stateTracker = states[stateIndex];
    const timeSpentMs = Date.now() - stateTracker.startedAt;

    logger.info(
      {
        sceneId,
        stateIndex,
        stateId: stateTracker.state.id,
        stateName: stateTracker.state.name,
        timeSpentMs
      },
      'State completed'
    );

    // Stop state timer
    this.stopStateTimer(sceneId);

    // Emit state completed event
    this.emit('state:completed', {
      sceneId,
      state: stateTracker.state,
      index: stateIndex,
      timeSpentMs
    });

    // Execute state completion actions
    if (stateTracker.state.onComplete) {
      const context: ActionExecutionContext = {
        sceneId,
        roomId: '', // Will be filled in by orchestrator
        triggeredBy: `state:${stateTracker.state.id}`
      };

      this.actionExecutor.executeActionGroup(stateTracker.state.onComplete, context);
    }

    // Check if this is the last state
    if (stateIndex === states.length - 1) {
      // Puzzle completed
      const totalTimeMs = states.reduce((total, s) => {
        if (s.completedAt && s.startedAt) {
          return total + (s.completedAt - s.startedAt);
        }
        return total;
      }, 0);

      logger.info(
        {
          sceneId,
          totalStates: states.length,
          totalTimeMs
        },
        'Puzzle completed - all states done'
      );

      this.emit('puzzle:completed', {
        sceneId,
        totalStates: states.length,
        totalTimeMs
      });
    } else {
      // Advance to next state
      const puzzle = { id: sceneId, roomId: '' } as SceneRuntime; // Minimal puzzle object
      this.advanceToState(puzzle, stateIndex + 1);
    }
  }

  /**
   * Get current state for a puzzle
   */
  public getCurrentState(sceneId: string): PuzzleState | undefined {
    const states = this.stateTrackers.get(sceneId);
    const stateIndex = this.currentStateIndex.get(sceneId);

    if (!states || stateIndex === undefined || stateIndex < 0 || stateIndex >= states.length) {
      return undefined;
    }

    return states[stateIndex].state;
  }

  /**
   * Get state progress info
   */
  public getStateProgress(sceneId: string): {
    currentState: number;
    totalStates: number;
    stateName: string;
    timeSpentMs: number;
  } | undefined {
    const states = this.stateTrackers.get(sceneId);
    const stateIndex = this.currentStateIndex.get(sceneId);

    if (!states || stateIndex === undefined || stateIndex < 0) {
      return undefined;
    }

    const stateTracker = states[stateIndex];
    const timeSpentMs = stateTracker.isActive ? Date.now() - stateTracker.startedAt : 0;

    return {
      currentState: stateIndex + 1,
      totalStates: states.length,
      stateName: stateTracker.state.name,
      timeSpentMs
    };
  }

  /**
   * Reset puzzle states
   */
  public resetPuzzle(sceneId: string): void {
    const states = this.stateTrackers.get(sceneId);
    if (!states) return;

    // Stop any running timer
    this.stopStateTimer(sceneId);

    // Reset all state trackers
    for (const stateTracker of states) {
      stateTracker.isActive = false;
      stateTracker.startedAt = 0;
      stateTracker.completedAt = undefined;
    }

    this.currentStateIndex.set(sceneId, -1);

    logger.info({ sceneId }, 'Puzzle states reset');
  }

  /**
   * Clear puzzle from manager
   */
  public clearPuzzle(sceneId: string): void {
    this.stopStateTimer(sceneId);
    this.stateTrackers.delete(sceneId);
    this.currentStateIndex.delete(sceneId);

    logger.debug({ sceneId }, 'Puzzle cleared from state manager');
  }

  /**
   * Get statistics
   */
  public getStats(): {
    totalPuzzles: number;
    activePuzzles: number;
  } {
    let activeCount = 0;

    for (const [sceneId, stateIndex] of this.currentStateIndex.entries()) {
      if (stateIndex >= 0) {
        activeCount++;
      }
    }

    return {
      totalPuzzles: this.stateTrackers.size,
      activePuzzles: activeCount
    };
  }
}
