// ============================================================================
// Scene Types (Puzzles + Cutscenes)
// ============================================================================

/**
 * Scene types for theatrical orchestration
 * - puzzle: Interactive, player-driven challenge
 * - cutscene: Scripted, time-based sequence of effects
 * - scene: Timeline-based sequence (UI-friendly type, treated as cutscene)
 */
export type SceneType = 'puzzle' | 'cutscene' | 'scene';

/**
 * Scene states for director control
 * - inactive: Not started yet
 * - waiting: Prerequisites not met
 * - active: Currently running
 * - solved: Completed successfully
 * - overridden: Director manually marked as complete
 * - reset: Reset to initial state
 * - powered_off: Room powered off
 * - failed: Failed or timeout
 * - error: System error occurred
 */
export type SceneState =
  | 'inactive'
  | 'waiting'
  | 'active'
  | 'solved'
  | 'overridden'
  | 'reset'
  | 'powered_off'
  | 'failed'
  | 'timeout'
  | 'error';

/**
 * Individual action within a cutscene sequence
 */
export interface CutsceneAction {
  /** Absolute delay in milliseconds from cutscene start */
  delayMs: number;

  /** Action type (e.g., "video.play", "fog.blast", "audio.fadeIn", "lights.off") */
  action: string;

  /** Target device ID or group identifier */
  target: string;

  /** Duration for timed actions (optional) */
  duration?: number;

  /** Additional parameters for the action */
  params?: Record<string, unknown>;
}

/**
 * Safety check requirement
 */
export interface SafetyCheck {
  /** Check identifier (e.g., "door_closed", "players_clear") */
  id: string;

  /** Human-readable description */
  description: string;

  /** Device or sensor to verify */
  deviceId?: string;

  /** Expected state/value */
  expectedValue?: unknown;
}

/**
 * Base configuration for a Scene (Puzzle or Cutscene)
 */
export interface SceneConfig {
  /** Unique scene identifier */
  id: string;

  /** Scene type */
  type: SceneType;

  /** Human-readable name */
  name: string;

  /** Room this scene belongs to */
  roomId: string;

  /** Description for operators/directors */
  description?: string;

  // --- Dependencies ---
  /** Scene IDs that must be solved before this can activate */
  prerequisites?: string[];

  /** Scene IDs that cannot run while this is active */
  blocks?: string[];

  // --- Devices ---
  /** Device IDs involved in this scene */
  devices: string[];

  // --- Puzzle-specific ---
  /** Time limit for puzzle completion (puzzles only) */
  timeLimitMs?: number;

  /** Effect sequences to trigger on solve (puzzles only) */
  outputs?: string[];

  // --- Cutscene-specific ---
  /** Absolute-timed sequence of actions (cutscenes only) */
  sequence?: CutsceneAction[];

  /** Timeline of actions (alias for sequence, UI-friendly name) */
  timeline?: CutsceneAction[];

  /** Estimated total duration (cutscenes only) */
  estimatedDurationMs?: number;

  // --- Safety ---
  /** Safety checks required before starting */
  safetyChecks?: SafetyCheck[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Runtime state of a Scene
 */
export interface SceneRuntime extends SceneConfig {
  /** Current state */
  state: SceneState;

  /** Number of attempts (puzzles) or runs (cutscenes) */
  attempts: number;

  /** Last state update timestamp */
  lastUpdated: number;

  /** Start timestamp */
  timeStarted?: number;

  /** Completion timestamp */
  timeCompleted?: number;

  /** Current running action index (cutscenes only) */
  currentActionIndex?: number;

  /** Session this scene belongs to */
  sessionId?: string;
}

// ============================================================================
// Legacy Puzzle Types (for backward compatibility)
// ============================================================================

/** @deprecated Use SceneConfig with type='puzzle' instead */
export interface PuzzleConfig {
  id: string;
  name: string;
  roomId: string;
  description?: string;
  timeLimitMs?: number;
  prerequisites?: string[];
  outputs?: string[];
  metadata?: Record<string, unknown>;
}

/** @deprecated Use SceneRuntime instead */
export interface PuzzleRuntime extends PuzzleConfig {
  state: SceneState;
  attempts: number;
  lastUpdated: number;
  timeStarted?: number;
  timeCompleted?: number;
}

export interface SessionConfig {
  id: string;
  roomId: string;
  teamName: string;
  players: number;
  timeLimitMs: number;
}

export type SessionState = 'lobby' | 'active' | 'paused' | 'completed' | 'failed' | 'aborted';

export interface PuzzleProgress {
  puzzleId: string;
  state: SceneState;
  timeSpentMs: number;
  attempts: number;
}

export interface SessionRuntime extends SessionConfig {
  state: SessionState;
  startedAt?: number;
  endedAt?: number;
  puzzleIds: string[];
  puzzles: Record<string, PuzzleProgress>;
  score: number;
}

export interface DeviceEvent {
  roomId: string;
  puzzleId: string;
  deviceId: string;
  type: string;
  payload?: unknown;
  receivedAt: number;
}

// ============================================================================
// Director Control Types
// ============================================================================

/**
 * Director control actions
 */
export type DirectorAction =
  | 'reset'      // Reset scene to initial state
  | 'override'   // Mark as solved/complete
  | 'skip'       // Skip to next scene
  | 'start'      // Manually start a scene
  | 'stop'       // Stop a running scene
  | 'pause'      // Pause a scene
  | 'resume';    // Resume a paused scene

/**
 * Director control command
 */
export interface DirectorCommand {
  action: DirectorAction;
  sceneId?: string;
  roomId?: string;
  reason?: string;
  timestamp: number;
}

/**
 * Room power state
 */
export type RoomPowerState = 'on' | 'off' | 'emergency_off';

/**
 * Room control command
 */
export interface RoomControlCommand {
  roomId: string;
  action: 'power_on' | 'power_off' | 'emergency_stop' | 'reset_all' | 'jump_to';
  targetSceneId?: string; // For jump_to action
  timestamp: number;
}

/**
 * Timeline node for visualization
 */
export interface TimelineNode {
  sceneId: string;
  type: SceneType;
  name: string;
  state: SceneState;
  prerequisites: string[];
  blocks: string[];
  position?: { x: number; y: number }; // For flowchart layout
}

/**
 * Full room timeline/flowchart
 */
export interface RoomTimeline {
  roomId: string;
  nodes: TimelineNode[];
  currentSceneId?: string;
  nextAvailableScenes: string[];
}

/**
 * Scene progress for session tracking
 */
export interface SceneProgress {
  sceneId: string;
  type: SceneType;
  state: SceneState;
  timeSpentMs: number;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
}

// ============================================================================
// Enhanced Puzzle System Types
// ============================================================================

/**
 * Condition group for puzzle logic
 * Supports AND/OR logic for multiple conditions
 */
export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: PuzzleCondition[];
}

/**
 * Individual puzzle condition
 */
export interface PuzzleCondition {
  deviceId: string;
  sensorName: string;
  field: string; // e.g., "lux", "color_temp", "position"
  operator: ConditionOperator;
  value: unknown; // Expected value(s)
  tolerance?: number; // For numeric comparisons
}

/**
 * Condition operators
 */
export type ConditionOperator =
  | '==' | '!=' | '>' | '<' | '>=' | '<='
  | 'between' | 'in' | 'all' | 'any';

/**
 * Conditional action triggered by sensor conditions
 */
export interface ConditionalAction {
  /** Action type (e.g., 'mqtt.publish', 'audio.play', 'scene.complete') */
  type: string;

  /** Target device ID or resource */
  target: string;

  /** Action payload/parameters */
  payload?: Record<string, unknown>;

  /** Optional delay before executing (milliseconds) */
  delayMs?: number;
}

/**
 * Group of actions with optional delay
 */
export interface ActionGroup {
  actions: ConditionalAction[];
  delayMs?: number; // Optional delay before executing entire group
}

/**
 * Sensor watch - continuously monitors conditions and triggers actions
 * Key feature: Can monitor sensors from ANY device in the room, not just puzzle devices
 */
export interface SensorWatch {
  /** Unique watch identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description for operators */
  description?: string;

  /** Conditions to monitor */
  conditions: ConditionGroup;

  /** Actions to execute when conditions are met */
  onTrigger: ActionGroup;

  /** Minimum time between triggers in milliseconds (prevents spam) */
  cooldownMs?: number;

  /** Maximum number of times this watch can trigger */
  maxTriggers?: number;

  /** Only trigger once, then disable */
  triggerOnce?: boolean;

  /** Only active during specific puzzle phases */
  activeDuringPhases?: string[];
}

/**
 * Fail condition - defines when puzzle fails
 */
export interface FailCondition {
  /** Unique fail condition identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description?: string;

  /** Conditions that indicate failure */
  conditions: ConditionGroup;

  /** Actions to execute on failure */
  onFail: ActionGroup;
}

/**
 * Puzzle State - multi-stage puzzle support (e.g., State 1, State 2, State 3)
 * In escape room terminology: A puzzle can have multiple states that must be completed in sequence
 */
export interface PuzzleState {
  /** Unique state identifier */
  id: string;

  /** Human-readable name (e.g., "State 1 - Initial Calibration") */
  name: string;

  /** Description */
  description?: string;

  /** Steps within this state (optional sub-states) */
  steps?: PuzzleStep[];

  /** Win conditions for this state (if no steps defined) */
  winConditions?: ConditionGroup;

  /** Actions when state is completed */
  onComplete?: ActionGroup;

  /** Time limit for this state (optional) */
  timeLimitMs?: number;

  /** Sensor watches active during this state */
  sensorWatches?: SensorWatch[];
}

/**
 * Puzzle Step - sub-states within a puzzle state
 * In escape room terminology: Steps are the individual stages within a state
 * Example: State 1 might have Step 1 "Boiler Valve Setup" and Step 2 "Gate Valve Calibration"
 */
export interface PuzzleStep {
  /** Unique step identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description?: string;

  /** Sensor watches active only during this step */
  sensorWatches: SensorWatch[];

  /** Actions when entering this step */
  onEnter?: ActionGroup;

  /** Actions when exiting this step */
  onExit?: ActionGroup;

  /** Transitions to other steps or completion */
  transitions: StepTransition[];
}

/**
 * Step Transition - defines how to move between steps
 */
export interface StepTransition {
  /** Unique transition identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Conditions that trigger this transition */
  conditions: ConditionGroup;

  /** Target step ID, or special values */
  targetStepId: string | 'COMPLETE_STATE' | 'PREVIOUS_STEP';

  /** Actions to execute on transition */
  actions?: ActionGroup;
}

// Legacy type alias for backward compatibility
/** @deprecated Use PuzzleState instead (renamed for escape room industry terminology) */
export type PuzzlePhase = PuzzleState;

// Note: There was a naming conflict where "PuzzleState" was previously aliased to "SceneState" (deprecated).
// The new PuzzleState interface represents multi-state puzzle configurations (escape room terminology).
// For legacy code that needs the old PuzzleState (which meant SceneState), just use SceneState directly.
