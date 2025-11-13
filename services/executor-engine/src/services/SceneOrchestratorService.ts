import { SceneRegistry } from '../scenes/SceneRegistry';
import { CutsceneExecutor } from '../scenes/CutsceneExecutor';
import { SafetyVerifier } from '../scenes/SafetyVerifier';
import { SessionManager } from '../sessions/SessionManager';
import { TimerManager } from '../timing/TimerManager';
import { DeviceMonitorClient } from '../clients/DeviceMonitorClient';
import { EffectsControllerClient } from '../clients/EffectsControllerClient';
import { MQTTClientManager, SensorMessage } from '../mqtt/MQTTClient';
import { DatabaseClient } from '../database/DatabaseClient';
import { logger } from '../logger';
import {
  DeviceEvent,
  SceneState,
  SceneRuntime,
  DirectorAction,
  CutsceneAction,
  RoomPowerState,
  SensorWatch,
  FailCondition,
  ActionGroup,
  ConditionalAction
} from '../types';
import { ConditionEvaluator } from '../puzzles/ConditionEvaluator';
import { PuzzleWatcher } from '../puzzles/PuzzleWatcher';
import { ActionExecutor, ActionExecutionContext } from '../puzzles/ActionExecutor';
import { PuzzleStateManager } from '../puzzles/PuzzleStateManager';
import { TimelineExecutor } from '../puzzles/TimelineExecutor';

/**
 * SceneOrchestratorService - The Broadway Director
 *
 * Orchestrates both Puzzles and Cutscenes with theatrical precision.
 * Provides director-level controls for manual intervention and room management.
 */
export class SceneOrchestratorService {
  private readonly roomPowerStates = new Map<string, RoomPowerState>();

  // Puzzle system components
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly actionExecutor: ActionExecutor;
  private readonly puzzleWatcher: PuzzleWatcher;
  private readonly stateManager: PuzzleStateManager;
  private readonly timelineExecutor: TimelineExecutor;

  constructor(
    private readonly scenes: SceneRegistry,
    private readonly cutsceneExecutor: CutsceneExecutor,
    private readonly safetyVerifier: SafetyVerifier,
    private readonly sessions: SessionManager,
    private readonly timers: TimerManager,
    private readonly deviceMonitor?: DeviceMonitorClient,
    private readonly effectsController?: EffectsControllerClient,
    private readonly mqttClient?: MQTTClientManager,
    private readonly database?: DatabaseClient
  ) {
    // Initialize puzzle system components
    this.conditionEvaluator = new ConditionEvaluator();
    this.actionExecutor = new ActionExecutor();
    this.puzzleWatcher = new PuzzleWatcher(this.conditionEvaluator);
    this.stateManager = new PuzzleStateManager(
      this.conditionEvaluator,
      this.actionExecutor,
      this.puzzleWatcher
    );
    this.timelineExecutor = new TimelineExecutor(
      this.conditionEvaluator,
      this.actionExecutor
    );

    // Listen to cutscene events
    this.cutsceneExecutor.on('action-executed', this.handleCutsceneAction.bind(this));
    this.cutsceneExecutor.on('action-waiting', this.handleCutsceneActionWaiting.bind(this));
    this.cutsceneExecutor.on('cutscene-complete', this.handleCutsceneComplete.bind(this));
    this.cutsceneExecutor.on('cutscene-error', this.handleCutsceneError.bind(this));

    // Listen to puzzle system events
    this.puzzleWatcher.on('watch:triggered', this.handleWatchTriggered.bind(this));
    this.puzzleWatcher.on('watch:disabled', this.handleWatchDisabled.bind(this));
    this.actionExecutor.on('action:execute', this.handleConditionalAction.bind(this));
    this.actionExecutor.on('action:error', this.handleActionError.bind(this));
    this.stateManager.on('state:started', this.handleStateStarted.bind(this));
    this.stateManager.on('state:completed', this.handleStateCompleted.bind(this));
    this.stateManager.on('state:timeout', this.handleStateTimeout.bind(this));
    this.stateManager.on('puzzle:completed', this.handlePuzzleCompleted.bind(this));

    // Listen to timeline executor events
    this.timelineExecutor.on('timeline-block-started', this.handleTimelineBlockStarted.bind(this));
    this.timelineExecutor.on('timeline-block-active', this.handleTimelineBlockActive.bind(this));
    this.timelineExecutor.on('timeline-block-completed', this.handleTimelineBlockCompleted.bind(this));
    this.timelineExecutor.on('timeline-completed', this.handleTimelineCompleted.bind(this));
    this.timelineExecutor.on('timeline-error', this.handleTimelineError.bind(this));
    this.timelineExecutor.on('timeline-solve', this.handleTimelineSolve.bind(this));
    this.timelineExecutor.on('timeline-fail', this.handleTimelineFail.bind(this));
    this.timelineExecutor.on('timeline-reset', this.handleTimelineReset.bind(this));
  }

  // ============================================================================
  // Scene Activation & Completion
  // ============================================================================

  /**
   * Start a scene (puzzle or cutscene)
   */
  public async startScene(sceneId: string, skipSafety = false): Promise<{
    success: boolean;
    reason?: string;
  }> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { success: false, reason: 'Scene not found' };
    }

    // Check if room is powered on
    const powerState = this.roomPowerStates.get(scene.roomId) ?? 'on';
    if (powerState !== 'on') {
      return {
        success: false,
        reason: `Room is powered ${powerState}`
      };
    }

    // Check if scene can be activated
    const canActivate = this.scenes.canActivate(sceneId);
    if (!canActivate.canActivate) {
      return { success: false, reason: canActivate.reason };
    }

    // Run safety checks
    if (!skipSafety) {
      const safetyResult = await this.safetyVerifier.verify(scene);
      if (!safetyResult.passed) {
        const failureDetails = safetyResult.failedChecks
          .map((f) => `${f.check.id}: ${f.reason}`)
          .join(', ');

        logger.error(
          { sceneId, failedChecks: failureDetails },
          'Cannot start scene: safety checks failed'
        );

        return {
          success: false,
          reason: `Safety checks failed: ${failureDetails}`
        };
      }
    }

    // Activate the scene
    this.scenes.setState(sceneId, 'active');

    if (scene.type === 'puzzle') {
      // Check if puzzle has new timeline-based config
      const metadata = scene.metadata || {};
      const hasTimeline = metadata.timeline && Array.isArray(metadata.timeline) && (metadata.timeline as any[]).length > 0;

      if (hasTimeline) {
        // Use new TimelineExecutor for timeline-based puzzles
        logger.info({ sceneId, name: scene.name }, 'Starting puzzle with timeline executor');
        await this.timelineExecutor.startTimeline(scene);
      } else {
        // Use legacy puzzle system
        this.initializePuzzle(scene);

        // Start timer for puzzles
        if (scene.timeLimitMs) {
          this.timers.startTimer(`scene-${sceneId}`, scene.timeLimitMs);
        }

        // Execute onStart actions
        await this.executePuzzleActions(scene, 'onStart');
      }

      logger.info({ sceneId, name: scene.name }, 'Puzzle activated');
    } else if (scene.type === 'cutscene' || scene.type === 'scene') {
      // Execute cutscene/scene sequence
      this.cutsceneExecutor.start(scene);
      logger.info({ sceneId, name: scene.name, type: scene.type }, 'Cutscene/scene started');
    }

    return { success: true };
  }

  /**
   * Complete a scene
   */
  public async completeScene(
    sceneId: string,
    state: SceneState = 'solved'
  ): Promise<void> {
    const scene = this.scenes.setState(sceneId, state);
    if (!scene) return;

    this.timers.stopTimer(`scene-${sceneId}`);

    // Stop cutscene/scene if running
    if (scene.type === 'cutscene' || scene.type === 'scene') {
      this.cutsceneExecutor.stop(sceneId);
      this.cutsceneExecutor.cleanupLoops();
    }

    // Handle puzzle completion
    if (scene.type === 'puzzle') {
      // Stop timeline executor if running
      this.timelineExecutor.stopTimeline(sceneId);

      // Execute onSolve actions if solved
      if (state === 'solved' || state === 'overridden') {
        await this.executePuzzleActions(scene, 'onSolve');
      }

      // Cleanup puzzle system
      this.cleanupPuzzle(sceneId);

      // Trigger output effects (legacy support)
      if (this.effectsController && scene.outputs) {
        for (const sequence of scene.outputs) {
          await this.effectsController.triggerSequence(sequence, {
            sceneId: scene.id,
            roomId: scene.roomId
          });
        }
      }
    }

    logger.info({ sceneId, state, name: scene.name }, 'Scene completed');
  }

  /**
   * Test a single step by executing its action immediately
   */
  public async testStep(sceneId: string, stepData: {
    stepId: string;
    action: string;
    target?: string;
    duration?: number;
    parameters?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error('Scene not found');
    }

    // Create a temporary CutsceneAction from the step data
    const testAction: CutsceneAction = {
      action: stepData.action,
      target: stepData.target || "",
      duration: stepData.duration || 0,
      delayMs: 0,
      params: stepData.parameters || {}
    };

    logger.info(
      {
        sceneId,
        stepId: stepData.stepId,
        action: stepData.action,
        target: stepData.target
      },
      'Testing scene step'
    );

    // Execute the action directly using the same logic as cutscene actions
    try {
      if (this.effectsController) {
        await this.effectsController.triggerSequence(testAction.action, {
          sceneId,
          roomId: scene.roomId,
          target: testAction.target,
          duration: testAction.duration,
          params: testAction.params
        });
      } else if (this.mqttClient) {
        await this.publishDeviceCommand(scene.roomId, testAction);
      } else {
        return {
          success: false,
          message: 'No effects controller or MQTT client available'
        };
      }

      return {
        success: true,
        message: `Step tested successfully: ${stepData.action}`
      };
    } catch (error) {
      logger.error(
        {
          sceneId,
          stepId: stepData.stepId,
          error
        },
        'Error testing step'
      );
      throw error;
    }
  }

  // ============================================================================
  // Director Controls
  // ============================================================================

  /**
   * Director control: Reset a scene
   */
  public async directorReset(sceneId: string): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      logger.warn({ sceneId }, 'Cannot reset: scene not found');
      return;
    }

    // Stop if running
    if (scene.state === 'active') {
      this.timers.stopTimer(`scene-${sceneId}`);
      if (scene.type === 'cutscene' || scene.type === 'scene') {
        this.cutsceneExecutor.stop(sceneId);
        this.cutsceneExecutor.cleanupLoops();
      }
    }

    // Handle puzzle reset
    if (scene.type === 'puzzle') {
      // Execute onReset actions
      await this.executePuzzleActions(scene, 'onReset');

      // Cleanup puzzle system
      this.cleanupPuzzle(sceneId);
    }

    this.scenes.reset(sceneId);
    logger.info({ sceneId, name: scene.name }, '[DIRECTOR] Scene reset');
  }

  /**
   * Director control: Override/mark as solved
   */
  public async directorOverride(sceneId: string): Promise<void> {
    await this.completeScene(sceneId, 'overridden');
    logger.info({ sceneId }, '[DIRECTOR] Scene overridden as solved');
  }

  /**
   * Director control: Skip to next available scenes
   */
  public async directorSkip(sceneId: string): Promise<string[]> {
    await this.directorOverride(sceneId);
    const scene = this.scenes.get(sceneId);
    if (!scene) return [];

    const available = this.scenes.getAvailableScenes(scene.roomId);
    const availableIds = available.map((s) => s.id);

    logger.info(
      { sceneId, nextScenes: availableIds },
      '[DIRECTOR] Skipped scene, next available scenes'
    );

    return availableIds;
  }

  /**
   * Director control: Stop a running scene
   */
  public async directorStop(sceneId: string): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene || scene.state !== 'active') {
      logger.warn({ sceneId }, 'Cannot stop: scene not active');
      return;
    }

    this.timers.stopTimer(`scene-${sceneId}`);
    if (scene.type === 'cutscene') {
      this.cutsceneExecutor.stop(sceneId);
    }

    this.scenes.setState(sceneId, 'inactive');
    logger.info({ sceneId, name: scene.name }, '[DIRECTOR] Scene stopped');
  }

  /**
   * Director control: Send a direct device command
   * Uses authoritative device_commands routing and refuses to publish if mapping is missing.
   */
  public async directorDeviceCommand(
    roomId: string,
    deviceIdOrName: string,
    commandName: string,
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; reason?: string }> {
    // Guard rails: require DB + MQTT clients
    if (!this.database) {
      logger.error({ device: deviceIdOrName, command: commandName }, '[DIRECTOR] Database unavailable; refusing to publish device command');
      return { success: false, reason: 'Database unavailable' };
    }
    if (!this.mqttClient) {
      logger.error({ device: deviceIdOrName, command: commandName }, '[DIRECTOR] MQTT client unavailable; refusing to publish device command');
      return { success: false, reason: 'MQTT unavailable' };
    }

    // Reuse existing publish path by constructing a CutsceneAction-like object
    const action = {
      action: commandName,
      target: deviceIdOrName,
      params: params || {}
    } as CutsceneAction;

    // Attempt publish (will internally look up routing and log appropriately)
    await this.publishDeviceCommand(roomId, action);

    // Verify routing existed by re-querying once; if not, signal failure
    const routing = await this.database.getDeviceCommandRouting(deviceIdOrName, commandName);
    if (!routing) {
      return { success: false, reason: 'No device_commands mapping found' };
    }

    return { success: true };
  }

  // ============================================================================
  // Room Controls
  // ============================================================================

  /**
   * Power on/off entire room
   */
  public async setRoomPower(roomId: string, state: RoomPowerState): Promise<void> {
    this.roomPowerStates.set(roomId, state);

    if (state === 'off' || state === 'emergency_off') {
      // Stop all active scenes in the room
      const roomScenes = this.scenes.listByRoom(roomId);
      const activeScenes = roomScenes.filter((s) => s.state === 'active');

      for (const scene of activeScenes) {
        await this.directorStop(scene.id);
        this.scenes.setState(scene.id, 'powered_off');
      }

      logger.warn(
        { roomId, stoppedScenes: activeScenes.length },
        `[DIRECTOR] Room powered ${state}`
      );
    } else {
      // Power on - reset all powered_off scenes to inactive
      const roomScenes = this.scenes.listByRoom(roomId);
      const poweredOffScenes = roomScenes.filter((s) => s.state === 'powered_off');

      for (const scene of poweredOffScenes) {
        this.scenes.setState(scene.id, 'inactive');
      }

      logger.info({ roomId }, '[DIRECTOR] Room powered on');
    }
  }

  /**
   * Reset entire room
   */
  public async resetRoom(roomId: string): Promise<void> {
    const roomScenes = this.scenes.listByRoom(roomId);

    for (const scene of roomScenes) {
      await this.directorReset(scene.id);
    }

    logger.info({ roomId, sceneCount: roomScenes.length }, '[DIRECTOR] Room reset');
  }

  /**
   * Jump to a specific scene in the room
   */
  public async jumpToScene(roomId: string, targetSceneId: string): Promise<{
    success: boolean;
    reason?: string;
  }> {
    const targetScene = this.scenes.get(targetSceneId);
    if (!targetScene || targetScene.roomId !== roomId) {
      return { success: false, reason: 'Scene not found in this room' };
    }

    // Stop all active scenes
    const activeScenes = this.scenes
      .listByRoom(roomId)
      .filter((s) => s.state === 'active');

    for (const scene of activeScenes) {
      await this.directorStop(scene.id);
    }

    // Mark all prerequisites as overridden
    if (targetScene.prerequisites) {
      for (const prereqId of targetScene.prerequisites) {
        const prereq = this.scenes.get(prereqId);
        if (prereq && prereq.state !== 'solved' && prereq.state !== 'overridden') {
          await this.directorOverride(prereqId);
        }
      }
    }

    // Start the target scene
    const result = await this.startScene(targetSceneId, true); // Skip safety checks for director jump

    logger.info(
      { roomId, targetSceneId, success: result.success },
      '[DIRECTOR] Jumped to scene'
    );

    return result;
  }

  // ============================================================================
  // Device Event Handling (for puzzles)
  // ============================================================================

  public async handleDeviceEvent(event: DeviceEvent): Promise<void> {
    logger.debug({ event }, 'Received device event');
    const scene = this.scenes.get(event.puzzleId);
    if (!scene) {
      logger.warn({ event }, 'Device event for unknown scene');
      return;
    }

    if (event.type === 'puzzle.start') {
      await this.startScene(scene.id);
      return;
    }

    if (event.type === 'puzzle.solve') {
      await this.completeScene(scene.id, 'solved');
      return;
    }

    if (event.type === 'device.command') {
      if (this.deviceMonitor) {
        await this.deviceMonitor.sendCommand(event.deviceId, event.payload);
      }
      return;
    }
  }

  // ============================================================================
  // Cutscene Handling
  // ============================================================================

  private async handleCutsceneAction(
    sceneId: string,
    action: CutsceneAction,
    index: number
  ): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;

    // Update current action index
    this.scenes.setCurrentActionIndex(sceneId, index);

    // Send action to effects controller, or publish MQTT directly if no effects controller
    try {
      if (this.effectsController) {
        await this.effectsController.triggerSequence(action.action, {
          sceneId,
          roomId: scene.roomId,
          target: action.target,
          duration: action.duration,
          params: action.params
        });
      } else if (this.mqttClient) {
        // Publish MQTT command directly
        await this.publishDeviceCommand(scene.roomId, action);
      } else {
        logger.warn(
          { sceneId, actionIndex: index, action: action.action },
          'No effects controller or MQTT client available to execute action'
        );
      }
    } catch (error) {
      logger.error(
        { sceneId, actionIndex: index, action: action.action, error },
        'Error executing cutscene action'
      );
    }
  }

  private async handleCutsceneActionWaiting(
    sceneId: string,
    action: CutsceneAction,
    index: number,
    delayMs: number
  ): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;

    logger.info(
      {
        sceneId,
        actionIndex: index,
        action: action.action,
        delayMs
      },
      'Step waiting after execution (will be broadcast via WebSocket)'
    );

    // The waiting event is already broadcast via WebSocket in index.ts
    // This handler is just for logging and potential future orchestration logic
  }

  /**
   * Publish a device command via MQTT
   * Authoritative path:
   * - Look up device + command mapping from database (device_commands)
     * - Build topic: [client]/[room]/commands/[controller]/[device]/[specific_command]
   * - If mapping missing, DO NOT publish (prevents topic drift)
   */
  private async publishDeviceCommand(roomId: string, action: CutsceneAction): Promise<void> {
    if (!this.mqttClient) return;

    // Query device from database to get controller and command info
    if (this.database) {
      try {
        const routing = await this.database.getDeviceCommandRouting(action.target, action.action);

        if (routing) {
            const topic = `${routing.client}/${routing.room}/commands/${routing.controller}/${routing.device}/${routing.specificCommand}`;
          const payload = {
            params: action.params || {},
            timestamp: Date.now()
          };

          logger.info(
            {
              topic,
              payload,
              device: action.target,
              controllerId: routing.controller,
              command: routing.specificCommand
            },
            'Publishing device command via MQTT'
          );

          await this.mqttClient.publish(topic, payload);
          return;
        }

        // If routing is missing, don't publish. Log clear error for operator.
        logger.error(
          { device: action.target, command: action.action },
          'No device_commands mapping found; refusing to publish to prevent topic drift'
        );
        return;
      } catch (error) {
        logger.error(
          { device: action.target, error },
          'Error querying device info from database'
        );
      }
    }

    // If no database client, we cannot safely route commands
    logger.error(
      { device: action.target, command: action.action },
      'Database unavailable; refusing to publish device command'
    );
  }

  private async handleCutsceneComplete(sceneId: string): Promise<void> {
    await this.completeScene(sceneId, 'solved');
  }

  private handleCutsceneError(sceneId: string, error: Error): void {
    logger.error({ sceneId, error }, 'Cutscene execution error');
    this.scenes.setState(sceneId, 'error');
  }

  // ============================================================================
  // Puzzle System Integration
  // ============================================================================

  /**
   * Initialize puzzle when it starts
   */
  private initializePuzzle(puzzle: SceneRuntime): void {
    const metadata = puzzle.metadata || {};

    // Initialize state manager (handles multi-state or single-state puzzles)
    this.stateManager.initializePuzzle(puzzle);
    this.stateManager.startPuzzle(puzzle);

    // Register global sensor watches (not state-specific)
    const sensorWatches = metadata.sensorWatches as SensorWatch[] | undefined;
    if (sensorWatches) {
      for (const watch of sensorWatches) {
        this.puzzleWatcher.registerWatch(watch);
      }
    }

    // Start monitoring
    this.puzzleWatcher.startMonitoring();

    logger.info(
      {
        sceneId: puzzle.id,
        hasPhases: !!metadata.phases,
        watchCount: sensorWatches?.length || 0
      },
      'Puzzle system initialized'
    );
  }

  /**
   * Cleanup puzzle resources
   */
  private cleanupPuzzle(sceneId: string): void {
    this.puzzleWatcher.stopMonitoring();
    this.puzzleWatcher.clear();
    this.stateManager.clearPuzzle(sceneId);
    this.actionExecutor.cancelAll();

    logger.debug({ sceneId }, 'Puzzle system cleaned up');
  }

  /**
   * Execute puzzle actions based on event type
   */
  private async executePuzzleActions(
    puzzle: SceneRuntime,
    eventType: 'onStart' | 'onSolve' | 'onFail' | 'onReset'
  ): Promise<void> {
    const metadata = puzzle.metadata || {};
    const actions = metadata[eventType] as ActionGroup | undefined;

    if (!actions) {
      return;
    }

    const context: ActionExecutionContext = {
      sceneId: puzzle.id,
      roomId: puzzle.roomId,
      triggeredBy: eventType
    };

    this.actionExecutor.executeActionGroup(actions, context);

    logger.info(
      {
        sceneId: puzzle.id,
        eventType,
        actionCount: actions.actions.length
      },
      'Executing puzzle actions'
    );
  }

  /**
   * Handle sensor updates from MQTT
   * This should be called by the main entry point when sensor messages arrive
   */
  public handleSensorUpdate(message: SensorMessage): void {
    // Update condition evaluator cache
    this.conditionEvaluator.updateSensorData(message);

    // Check puzzle completion for all active puzzles
    const activeScenes = Array.from(this.scenes['scenes'].values()).filter(
      (s) => s.state === 'active' && s.type === 'puzzle'
    );

    for (const scene of activeScenes) {
      this.checkPuzzleCompletion(scene.id);
    }
  }

  /**
   * Check if a puzzle is completed
   */
  private checkPuzzleCompletion(sceneId: string): void {
    const scene = this.scenes.get(sceneId);
    if (!scene || scene.type !== 'puzzle' || scene.state !== 'active') {
      return;
    }

    // Check if current state is completed (works for single-state and multi-state puzzles)
    const stateCompleted = this.stateManager.checkStateCompletion(sceneId);

    // If this was the last state, handlePuzzleCompleted event will be triggered
    // and will call completeScene()
  }

  /**
   * Puzzle event handlers
   */

  private handleWatchTriggered(data: {
    watchId: string;
    watch: SensorWatch;
    actions: ConditionalAction[];
    delayMs: number;
  }): void {
    logger.info(
      {
        watchId: data.watchId,
        watchName: data.watch.name,
        actionCount: data.actions.length
      },
      'Sensor watch triggered'
    );

    // Actions will be executed via ActionExecutor which emits 'action:execute' events
  }

  private handleWatchDisabled(data: { watchId: string; reason: string }): void {
    logger.debug(data, 'Sensor watch disabled');
  }

  private async handleConditionalAction(event: {
    action: ConditionalAction;
    context: ActionExecutionContext;
  }): Promise<void> {
    const { action, context } = event;

    logger.info(
      {
        actionType: action.type,
        target: action.target,
        sceneId: context.sceneId
      },
      'Executing conditional action'
    );

    // Handle different action types
    switch (action.type) {
      case 'mqtt.publish':
        // Publish MQTT command using existing publishDeviceCommand
        await this.publishDeviceCommand(context.roomId, {
          action: action.target, // command name
          target: action.target, // device ID
          params: action.payload || {},
          delayMs: 0
        });
        break;

      case 'scene.complete':
        // Complete the scene
        await this.completeScene(context.sceneId, 'solved');
        break;

      case 'scene.fail':
        // Fail the scene
        await this.completeScene(context.sceneId, 'failed');
        break;

      case 'puzzle.phase.advance':
        // Phase advancement is handled automatically by PuzzlePhaseManager
        break;

      default:
        logger.warn(
          { actionType: action.type, sceneId: context.sceneId },
          'Unknown conditional action type'
        );
    }
  }

  private handleActionError(data: {
    action: ConditionalAction;
    context: ActionExecutionContext;
    error: Error;
  }): void {
    logger.error(
      {
        actionType: data.action.type,
        target: data.action.target,
        sceneId: data.context.sceneId,
        error: data.error
      },
      'Error executing conditional action'
    );
  }

  private handleStateStarted(data: {
    sceneId: string;
    state: any;
    index: number;
  }): void {
    logger.info(
      {
        sceneId: data.sceneId,
        stateIndex: data.index,
        stateName: data.state.name
      },
      'Puzzle state started'
    );
  }

  private handleStateCompleted(data: {
    sceneId: string;
    state: any;
    index: number;
    timeSpentMs: number;
  }): void {
    logger.info(
      {
        sceneId: data.sceneId,
        stateIndex: data.index,
        stateName: data.state.name,
        timeSpentMs: data.timeSpentMs
      },
      'Puzzle state completed'
    );
  }

  private handleStateTimeout(data: {
    sceneId: string;
    state: any;
    index: number;
  }): void {
    logger.warn(
      {
        sceneId: data.sceneId,
        stateIndex: data.index,
        stateName: data.state.name
      },
      'Puzzle state timeout'
    );

    // Execute onFail actions
    const scene = this.scenes.get(data.sceneId);
    if (scene) {
      this.executePuzzleActions(scene, 'onFail');
    }
  }

  private async handlePuzzleCompleted(data: {
    sceneId: string;
    totalPhases: number;
    totalTimeMs: number;
  }): Promise<void> {
    logger.info(
      {
        sceneId: data.sceneId,
        totalPhases: data.totalPhases,
        totalTimeMs: data.totalTimeMs
      },
      'Puzzle completed - all phases done'
    );

    // Complete the scene
    await this.completeScene(data.sceneId, 'solved');
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get all scenes in a room
   */
  public getRoomScenes(roomId: string): SceneRuntime[] {
    return this.scenes.listByRoom(roomId);
  }

  /**
   * Get available scenes (can be activated now)
   */
  public getAvailableScenes(roomId: string): SceneRuntime[] {
    return this.scenes.getAvailableScenes(roomId);
  }

  /**
   * Get current room power state
   */
  public getRoomPowerState(roomId: string): RoomPowerState {
    return this.roomPowerStates.get(roomId) ?? 'on';
  }

  /**
   * Get a specific scene
   */
  public getScene(sceneId: string): SceneRuntime | undefined {
    return this.scenes.get(sceneId);
  }

  // ============================================================================
  // Timeline Event Handlers (emits WebSocket events in index.ts)
  // ============================================================================

  private handleTimelineBlockStarted(data: { sceneId: string; block: any; index: number }): void {
    logger.debug(
      {
        sceneId: data.sceneId,
        blockId: data.block.id,
        blockType: data.block.type,
        blockName: data.block.name,
        index: data.index
      },
      'Timeline block started'
    );
    // Event will be forwarded to WebSocket in index.ts
  }

  private handleTimelineBlockActive(data: {
    sceneId: string;
    blockId: string;
    blockType: string;
    blockName: string;
    conditions?: any;
    sensorData?: Record<string, any>;
  }): void {
    logger.debug(
      {
        sceneId: data.sceneId,
        blockId: data.blockId,
        blockType: data.blockType,
        sensorDataKeys: data.sensorData ? Object.keys(data.sensorData) : []
      },
      'Timeline block active (watch conditions)'
    );
    // Event will be forwarded to WebSocket in index.ts
  }

  private handleTimelineBlockCompleted(data: {
    sceneId: string;
    blockId: string;
    timeSpentMs: number;
  }): void {
    logger.debug(
      {
        sceneId: data.sceneId,
        blockId: data.blockId,
        timeSpentMs: data.timeSpentMs
      },
      'Timeline block completed'
    );
    // Event will be forwarded to WebSocket in index.ts
  }

  private handleTimelineCompleted(data: {
    sceneId: string;
    totalBlocks: number;
    totalTimeMs: number;
  }): void {
    logger.info(
      {
        sceneId: data.sceneId,
        totalBlocks: data.totalBlocks,
        totalTimeMs: data.totalTimeMs
      },
      'Timeline execution completed'
    );
    // Event will be forwarded to WebSocket in index.ts
  }

  private handleTimelineError(data: { sceneId: string; blockId: string; error: any }): void {
    logger.error(
      {
        sceneId: data.sceneId,
        blockId: data.blockId,
        error: data.error
      },
      'Timeline execution error'
    );
    // Event will be forwarded to WebSocket in index.ts
  }

  private async handleTimelineSolve(data: { sceneId: string }): Promise<void> {
    logger.info({ sceneId: data.sceneId }, 'Timeline solve block executed - marking puzzle as solved');
    await this.completeScene(data.sceneId, 'solved');
  }

  private async handleTimelineFail(data: { sceneId: string }): Promise<void> {
    logger.warn({ sceneId: data.sceneId }, 'Timeline fail block executed - marking puzzle as failed');
    await this.completeScene(data.sceneId, 'failed');
  }

  private async handleTimelineReset(data: { sceneId: string }): Promise<void> {
    logger.info({ sceneId: data.sceneId }, 'Timeline reset block executed - resetting puzzle');
    await this.directorReset(data.sceneId);
  }

  /**
   * Get TimelineExecutor for external event forwarding
   */
  public getTimelineExecutor(): TimelineExecutor {
    return this.timelineExecutor;
  }
}
