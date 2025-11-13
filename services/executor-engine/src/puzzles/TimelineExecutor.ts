import { EventEmitter } from 'events';
import { logger } from '../logger';
import { SceneRuntime } from '../types';
import { ConditionEvaluator } from './ConditionEvaluator';
import { ActionExecutor, ActionExecutionContext } from './ActionExecutor';

/**
 * Timeline Block Types (from frontend PuzzleEditor)
 */
export type TimelineBlockType =
  | 'state'
  | 'watch'
  | 'action'
  | 'audio'
  | 'check'
  | 'set_variable'
  | 'solve'
  | 'fail'
  | 'reset';

export interface TimelineCondition {
  deviceId: string;
  sensorName: string;
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'between' | 'in';
  value: any;
  tolerance?: number;
}

export interface TimelineAction {
  type: string;
  target: string;
  payload?: Record<string, any>;
  delayMs?: number;
}

export interface TimelineBlock {
  id: string;
  type: TimelineBlockType;
  name: string;
  description?: string;

  // For 'state' blocks
  childBlocks?: TimelineBlock[];

  // For 'watch' blocks
  watchConditions?: {
    logic: 'AND' | 'OR';
    conditions: TimelineCondition[];
  };

  // For 'action' blocks
  action?: TimelineAction;

  // For 'audio' blocks
  audioCue?: string;
  audioDevice?: string;

  // For 'check' blocks
  checkConditions?: {
    logic: 'AND' | 'OR';
    conditions: TimelineCondition[];
  };
  onTrue?: string;
  onFalse?: string;

  // For 'set_variable' blocks
  variableName?: string;
  variableValue?: any;
  variableSource?: 'static' | 'sensor' | 'calculation';
}

interface BlockExecution {
  blockId: string;
  blockType: TimelineBlockType;
  blockName: string;
  startedAt: number;
  completedAt?: number;
  sensorData?: Record<string, any>;
}

/**
 * TimelineExecutor - Executes puzzle timeline blocks sequentially
 *
 * This executor processes the new timeline block system from PuzzleEditor,
 * executing blocks one by one and emitting WebSocket events for real-time UI updates.
 *
 * Events emitted:
 * - 'timeline-block-started' - { sceneId, block, index }
 * - 'timeline-block-active' - { sceneId, blockId, blockType, conditions, sensorData }
 * - 'timeline-block-completed' - { sceneId, blockId, timeSpentMs }
 * - 'timeline-completed' - { sceneId, totalBlocks, totalTimeMs }
 * - 'timeline-error' - { sceneId, blockId, error }
 */
export class TimelineExecutor extends EventEmitter {
  private readonly activeTimelines = new Map<string, TimelineBlock[]>();
  private readonly currentBlockIndex = new Map<string, number>();
  private readonly blockExecutions = new Map<string, BlockExecution[]>();
  private readonly watchIntervals = new Map<string, NodeJS.Timeout>();
  private readonly puzzleVariables = new Map<string, Map<string, any>>();

  constructor(
    private readonly conditionEvaluator: ConditionEvaluator,
    private readonly actionExecutor: ActionExecutor
  ) {
    super();
  }

  /**
   * Start executing a puzzle's timeline
   */
  public async startTimeline(puzzle: SceneRuntime): Promise<void> {
    if (puzzle.type !== 'puzzle') {
      logger.warn({ sceneId: puzzle.id }, 'Cannot start timeline: not a puzzle');
      return;
    }

    const metadata = puzzle.metadata || {};
    const timeline = metadata.timeline as TimelineBlock[] | undefined;

    if (!timeline || timeline.length === 0) {
      logger.warn({ sceneId: puzzle.id }, 'No timeline blocks defined');
      return;
    }

    logger.info(
      { sceneId: puzzle.id, blockCount: timeline.length },
      'Starting timeline execution'
    );

    // Initialize tracking
    this.activeTimelines.set(puzzle.id, timeline);
    this.currentBlockIndex.set(puzzle.id, 0);
    this.blockExecutions.set(puzzle.id, []);
    this.puzzleVariables.set(puzzle.id, new Map());

    // Start executing from first block
    await this.executeNextBlock(puzzle.id, puzzle.roomId);
  }

  /**
   * Execute the next block in the timeline
   */
  private async executeNextBlock(sceneId: string, roomId: string): Promise<void> {
    const timeline = this.activeTimelines.get(sceneId);
    const currentIndex = this.currentBlockIndex.get(sceneId);

    if (!timeline || currentIndex === undefined) {
      return;
    }

    if (currentIndex >= timeline.length) {
      // Timeline completed
      this.completeTimeline(sceneId);
      return;
    }

    const block = timeline[currentIndex];

    logger.debug(
      { sceneId, blockId: block.id, blockType: block.type, blockName: block.name, index: currentIndex },
      'Executing timeline block'
    );

    // Emit block started event
    this.emit('timeline-block-started', {
      sceneId,
      block: {
        id: block.id,
        type: block.type,
        name: block.name,
        description: block.description
      },
      index: currentIndex
    });

    // Track execution
    const execution: BlockExecution = {
      blockId: block.id,
      blockType: block.type,
      blockName: block.name,
      startedAt: Date.now()
    };
    const executions = this.blockExecutions.get(sceneId) || [];
    executions.push(execution);
    this.blockExecutions.set(sceneId, executions);

    // Execute block based on type
    try {
      await this.executeBlock(sceneId, roomId, block);
    } catch (error) {
      logger.error({ sceneId, blockId: block.id, error }, 'Timeline block execution error');
      this.emit('timeline-error', { sceneId, blockId: block.id, error });
    }
  }

  /**
   * Execute a single block
   */
  private async executeBlock(sceneId: string, roomId: string, block: TimelineBlock): Promise<void> {
    const context: ActionExecutionContext = {
      sceneId,
      roomId,
      triggeredBy: `timeline:${block.id}`
    };

    switch (block.type) {
      case 'state':
        // Execute child blocks sequentially
        if (block.childBlocks && block.childBlocks.length > 0) {
          for (const childBlock of block.childBlocks) {
            await this.executeBlock(sceneId, roomId, childBlock);
          }
        }
        this.completeBlock(sceneId, block.id);
        break;

      case 'watch':
        // Start watching conditions
        await this.executeWatchBlock(sceneId, roomId, block);
        break;

      case 'action':
        // Execute MQTT command
        if (block.action) {
          await this.executeActionBlock(sceneId, roomId, block, block.action);
        }
        this.completeBlock(sceneId, block.id);
        break;

      case 'audio':
        // Execute audio playback command
        if (block.audioDevice && block.audioCue) {
          await this.executeAudioBlock(sceneId, roomId, block);
        }
        this.completeBlock(sceneId, block.id);
        break;

      case 'check':
        // Evaluate conditions and branch
        await this.executeCheckBlock(sceneId, roomId, block);
        break;

      case 'set_variable':
        // Set puzzle variable
        this.executeSetVariableBlock(sceneId, block);
        this.completeBlock(sceneId, block.id);
        break;

      case 'solve':
        // Mark puzzle as solved
        this.emit('timeline-solve', { sceneId });
        this.completeBlock(sceneId, block.id);
        break;

      case 'fail':
        // Mark puzzle as failed
        this.emit('timeline-fail', { sceneId });
        this.completeBlock(sceneId, block.id);
        break;

      case 'reset':
        // Reset puzzle
        this.emit('timeline-reset', { sceneId });
        this.completeBlock(sceneId, block.id);
        break;

      default:
        logger.warn({ sceneId, blockType: block.type }, 'Unknown block type');
        this.completeBlock(sceneId, block.id);
    }
  }

  /**
   * Execute a watch block (wait for conditions to be met)
   */
  private async executeWatchBlock(sceneId: string, roomId: string, block: TimelineBlock): Promise<void> {
    if (!block.watchConditions || block.watchConditions.conditions.length === 0) {
      logger.warn({ sceneId, blockId: block.id }, 'Watch block has no conditions');
      this.completeBlock(sceneId, block.id);
      return;
    }

    // Emit active watch block with current sensor data
    const sensorData = this.gatherSensorData(block.watchConditions.conditions);

    this.emit('timeline-block-active', {
      sceneId,
      blockId: block.id,
      blockType: 'watch',
      blockName: block.name,
      conditions: block.watchConditions,
      sensorData
    });

    // Poll conditions every 200ms
    const intervalId = setInterval(() => {
      const updatedSensorData = this.gatherSensorData(block.watchConditions!.conditions);

      // Emit updated sensor data
      this.emit('timeline-block-active', {
        sceneId,
        blockId: block.id,
        blockType: 'watch',
        blockName: block.name,
        conditions: block.watchConditions,
        sensorData: updatedSensorData
      });

      // Evaluate conditions
      const conditionsMet = this.evaluateConditions(block.watchConditions!);

      if (conditionsMet) {
        // Stop watching
        clearInterval(intervalId);
        this.watchIntervals.delete(`${sceneId}:${block.id}`);

        logger.info(
          { sceneId, blockId: block.id, blockName: block.name },
          'Watch conditions met'
        );

        // Complete this block and move to next
        this.completeBlock(sceneId, block.id);
      }
    }, 200);

    this.watchIntervals.set(`${sceneId}:${block.id}`, intervalId);
  }

  /**
   * Execute an action block
   */
  private async executeActionBlock(
    sceneId: string,
    roomId: string,
    block: TimelineBlock,
    action: TimelineAction
  ): Promise<void> {
    const context: ActionExecutionContext = {
      sceneId,
      roomId,
      triggeredBy: `timeline:${block.id}`
    };

    // Execute action using ActionExecutor
    await this.actionExecutor.executeAction(
      {
        type: 'mqtt.publish',
        target: action.target,
        payload: action.payload || {}
      },
      context
    );

    // Apply delay if specified
    if (action.delayMs && action.delayMs > 0) {
      await this.delay(action.delayMs);
    }
  }

  /**
   * Execute an audio block
   */
  private async executeAudioBlock(sceneId: string, roomId: string, block: TimelineBlock): Promise<void> {
    const context: ActionExecutionContext = {
      sceneId,
      roomId,
      triggeredBy: `timeline:${block.id}`
    };

    const target = `${block.audioDevice}/${block.audioCue}`;
    await this.actionExecutor.executeAction(
      {
        type: 'mqtt.publish',
        target,
        payload: {}
      },
      context
    );
  }

  /**
   * Execute a check block (conditional branching)
   */
  private async executeCheckBlock(sceneId: string, roomId: string, block: TimelineBlock): Promise<void> {
    if (!block.checkConditions) {
      logger.warn({ sceneId, blockId: block.id }, 'Check block has no conditions');
      this.completeBlock(sceneId, block.id);
      return;
    }

    const conditionsMet = this.evaluateConditions(block.checkConditions);

    if (conditionsMet && block.onTrue) {
      // Jump to specified block
      this.jumpToBlock(sceneId, block.onTrue);
    } else if (!conditionsMet && block.onFalse) {
      // Jump to specified block
      this.jumpToBlock(sceneId, block.onFalse);
    } else {
      // Continue to next block
      this.completeBlock(sceneId, block.id);
    }
  }

  /**
   * Execute a set variable block
   */
  private executeSetVariableBlock(sceneId: string, block: TimelineBlock): void {
    if (!block.variableName) {
      logger.warn({ sceneId, blockId: block.id }, 'Set variable block has no variable name');
      return;
    }

    const variables = this.puzzleVariables.get(sceneId) || new Map();
    variables.set(block.variableName, block.variableValue);
    this.puzzleVariables.set(sceneId, variables);

    logger.debug(
      { sceneId, variableName: block.variableName, value: block.variableValue },
      'Puzzle variable set'
    );
  }

  /**
   * Gather current sensor data for conditions
   */
  private gatherSensorData(conditions: TimelineCondition[]): Record<string, any> {
    const sensorData: Record<string, any> = {};

    for (const condition of conditions) {
      const key = condition.sensorName
        ? `${condition.deviceId}.${condition.sensorName}`
        : condition.deviceId;

      const value = this.conditionEvaluator.getSensorValue(
        condition.deviceId,
        condition.sensorName,
        condition.field || 'value'
      );
      sensorData[key] = value;
    }

    return sensorData;
  }

  /**
   * Evaluate condition group
   */
  private evaluateConditions(conditionGroup: { logic: 'AND' | 'OR'; conditions: TimelineCondition[] }): boolean {
    const results = conditionGroup.conditions.map((condition) => {
      const value = this.conditionEvaluator.getSensorValue(
        condition.deviceId,
        condition.sensorName,
        condition.field || 'value'
      );

      if (value === undefined) {
        return false;
      }

      return this.evaluateCondition(condition, value);
    });

    if (conditionGroup.logic === 'AND') {
      return results.every((r) => r === true);
    } else {
      return results.some((r) => r === true);
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: TimelineCondition, actualValue: any): boolean {
    const { operator, value, tolerance } = condition;

    switch (operator) {
      case '==':
        if (tolerance) {
          return Math.abs(actualValue - value) <= tolerance;
        }
        return actualValue == value; // Loose equality for type coercion

      case '!=':
        return actualValue != value;

      case '>':
        return actualValue > value;

      case '<':
        return actualValue < value;

      case '>=':
        return actualValue >= value;

      case '<=':
        return actualValue <= value;

      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return actualValue >= value[0] && actualValue <= value[1];
        }
        return false;

      case 'in':
        if (Array.isArray(value)) {
          return value.includes(actualValue);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Complete a block and move to next
   */
  private completeBlock(sceneId: string, blockId: string): void {
    const executions = this.blockExecutions.get(sceneId) || [];
    const execution = executions.find((e) => e.blockId === blockId && !e.completedAt);

    if (execution) {
      execution.completedAt = Date.now();
      const timeSpentMs = execution.completedAt - execution.startedAt;

      logger.debug({ sceneId, blockId, timeSpentMs }, 'Block completed');

      this.emit('timeline-block-completed', {
        sceneId,
        blockId,
        timeSpentMs
      });
    }

    // Advance to next block
    const currentIndex = this.currentBlockIndex.get(sceneId);
    if (currentIndex !== undefined) {
      this.currentBlockIndex.set(sceneId, currentIndex + 1);

      // Execute next block asynchronously
      const timeline = this.activeTimelines.get(sceneId);
      if (timeline) {
        const puzzle = { id: sceneId, roomId: '' }; // We need roomId from somewhere
        this.executeNextBlock(sceneId, puzzle.roomId);
      }
    }
  }

  /**
   * Jump to a specific block by ID
   */
  private jumpToBlock(sceneId: string, targetBlockId: string): void {
    const timeline = this.activeTimelines.get(sceneId);
    if (!timeline) return;

    const targetIndex = timeline.findIndex((b) => b.id === targetBlockId);
    if (targetIndex === -1) {
      logger.warn({ sceneId, targetBlockId }, 'Jump target block not found');
      return;
    }

    logger.info({ sceneId, targetBlockId, targetIndex }, 'Jumping to block');
    this.currentBlockIndex.set(sceneId, targetIndex);

    // Execute target block
    const puzzle = { id: sceneId, roomId: '' };
    this.executeNextBlock(sceneId, puzzle.roomId);
  }

  /**
   * Complete timeline execution
   */
  private completeTimeline(sceneId: string): void {
    const executions = this.blockExecutions.get(sceneId) || [];
    const totalTimeMs = executions.reduce((total, e) => {
      if (e.completedAt) {
        return total + (e.completedAt - e.startedAt);
      }
      return total;
    }, 0);

    logger.info(
      { sceneId, totalBlocks: executions.length, totalTimeMs },
      'Timeline execution completed'
    );

    this.emit('timeline-completed', {
      sceneId,
      totalBlocks: executions.length,
      totalTimeMs
    });

    this.cleanup(sceneId);
  }

  /**
   * Stop timeline execution
   */
  public stopTimeline(sceneId: string): void {
    // Stop all watch intervals
    for (const [key, intervalId] of this.watchIntervals.entries()) {
      if (key.startsWith(`${sceneId}:`)) {
        clearInterval(intervalId);
        this.watchIntervals.delete(key);
      }
    }

    this.cleanup(sceneId);
    logger.info({ sceneId }, 'Timeline execution stopped');
  }

  /**
   * Cleanup timeline data
   */
  private cleanup(sceneId: string): void {
    this.activeTimelines.delete(sceneId);
    this.currentBlockIndex.delete(sceneId);
    this.blockExecutions.delete(sceneId);
    this.puzzleVariables.delete(sceneId);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current block being executed
   */
  public getCurrentBlock(sceneId: string): TimelineBlock | undefined {
    const timeline = this.activeTimelines.get(sceneId);
    const index = this.currentBlockIndex.get(sceneId);

    if (!timeline || index === undefined || index >= timeline.length) {
      return undefined;
    }

    return timeline[index];
  }
}
