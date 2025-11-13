import { EventEmitter } from 'events';
import { logger } from '../logger';
import {
  SceneConfig,
  SceneRuntime,
  SceneState,
  SceneType,
  PuzzleConfig,
  PuzzleRuntime
} from '../types';

export declare interface SceneRegistry {
  on(event: 'scene-updated', listener: (scene: SceneRuntime) => void): this;
  on(event: 'scene-started', listener: (scene: SceneRuntime) => void): this;
  on(event: 'scene-completed', listener: (scene: SceneRuntime) => void): this;
}

/**
 * SceneRegistry manages both Puzzles and Cutscenes
 * Replaces PuzzleRegistry with enhanced theatrical control
 */
export class SceneRegistry extends EventEmitter {
  private readonly scenes = new Map<string, SceneRuntime>();

  /**
   * Register a new scene (puzzle or cutscene)
   */
  public register(config: SceneConfig): SceneRuntime {
    const scene: SceneRuntime = {
      ...config,
      prerequisites: config.prerequisites ?? [],
      blocks: config.blocks ?? [],
      devices: config.devices ?? [],
      state: 'inactive',
      attempts: 0,
      lastUpdated: Date.now()
    };

    this.scenes.set(config.id, scene);
    logger.info(
      { sceneId: config.id, type: config.type },
      `Registered ${config.type}: ${config.name}`
    );
    return scene;
  }

  /**
   * Register multiple scenes at once
   */
  public registerMany(configs: SceneConfig[]): void {
    configs.forEach((config) => this.register(config));
  }

  /**
   * Replace the current registry with a new set of scenes
   */
  public replaceAll(configs: SceneConfig[]): void {
    this.scenes.clear();
    this.registerMany(configs);
    logger.info({ count: this.scenes.size }, 'Scene registry replaced');
  }

  /**
   * Get all scenes
   */
  public list(): SceneRuntime[] {
    return Array.from(this.scenes.values());
  }

  /**
   * Get scenes by type
   */
  public listByType(type: SceneType): SceneRuntime[] {
    return this.list().filter((scene) => scene.type === type);
  }

  /**
   * Get scenes by room
   */
  public listByRoom(roomId: string): SceneRuntime[] {
    return this.list().filter((scene) => scene.roomId === roomId);
  }

  /**
   * Get a specific scene
   */
  public get(id: string): SceneRuntime | undefined {
    return this.scenes.get(id);
  }

  /**
   * Set scene state
   */
  public setState(sceneId: string, state: SceneState): SceneRuntime | undefined {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      logger.warn({ sceneId }, 'Cannot set state: scene not found');
      return undefined;
    }

    const previousState = scene.state;
    scene.state = state;
    scene.lastUpdated = Date.now();

    // Track timing
    if (state === 'active' && previousState !== 'active') {
      scene.timeStarted = Date.now();
      this.emit('scene-started', scene);
      logger.info(
        { sceneId, type: scene.type, name: scene.name },
        `Scene started: ${scene.name}`
      );
    }

    if (
      (state === 'solved' || state === 'overridden' || state === 'failed' || state === 'timeout') &&
      previousState === 'active'
    ) {
      scene.timeCompleted = Date.now();
      this.emit('scene-completed', scene);
      logger.info(
        { sceneId, type: scene.type, state, name: scene.name },
        `Scene completed: ${scene.name} (${state})`
      );
    }

    this.scenes.set(sceneId, scene);
    this.emit('scene-updated', scene);
    return scene;
  }

  /**
   * Record an attempt (for puzzles)
   */
  public recordAttempt(sceneId: string): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;

    scene.attempts += 1;
    scene.lastUpdated = Date.now();
    this.scenes.set(sceneId, scene);
    this.emit('scene-updated', scene);
  }

  /**
   * Reset a scene to its initial state
   */
  public reset(sceneId: string): SceneRuntime | undefined {
    const scene = this.scenes.get(sceneId);
    if (!scene) return undefined;

    scene.state = 'inactive';
    scene.attempts = 0;
    scene.timeStarted = undefined;
    scene.timeCompleted = undefined;
    scene.currentActionIndex = undefined;
    scene.lastUpdated = Date.now();

    this.scenes.set(sceneId, scene);
    this.emit('scene-updated', scene);
    logger.info({ sceneId, name: scene.name }, 'Scene reset');
    return scene;
  }

  /**
   * Get all scenes that are currently available to activate
   * (prerequisites met, not blocked, not already solved)
   */
  public getAvailableScenes(roomId: string): SceneRuntime[] {
    const roomScenes = this.listByRoom(roomId);
    const activeScenes = roomScenes.filter((s) => s.state === 'active');
    const solvedSceneIds = new Set(
      roomScenes.filter((s) => s.state === 'solved' || s.state === 'overridden').map((s) => s.id)
    );

    return roomScenes.filter((scene) => {
      // Skip if already solved or active
      if (
        scene.state === 'solved' ||
        scene.state === 'overridden' ||
        scene.state === 'active'
      ) {
        return false;
      }

      // Check if prerequisites are met
      const prereqsMet = scene.prerequisites?.every((prereqId) =>
        solvedSceneIds.has(prereqId)
      ) ?? true;

      if (!prereqsMet) return false;

      // Check if blocked by any active scene
      const isBlocked = activeScenes.some((activeScene) =>
        activeScene.blocks?.includes(scene.id)
      );

      return !isBlocked;
    });
  }

  /**
   * Check if a scene can be activated
   */
  public canActivate(sceneId: string): { canActivate: boolean; reason?: string } {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      return { canActivate: false, reason: 'Scene not found' };
    }

    if (scene.state === 'active') {
      return { canActivate: false, reason: 'Scene is already active' };
    }

    if (scene.state === 'solved' || scene.state === 'overridden') {
      return { canActivate: false, reason: 'Scene is already completed' };
    }

    // Check prerequisites
    const roomScenes = this.listByRoom(scene.roomId);
    const solvedSceneIds = new Set(
      roomScenes.filter((s) => s.state === 'solved' || s.state === 'overridden').map((s) => s.id)
    );

    const prereqsMet = scene.prerequisites?.every((prereqId) =>
      solvedSceneIds.has(prereqId)
    ) ?? true;

    if (!prereqsMet) {
      const missingPrereqs = scene.prerequisites?.filter(
        (prereqId) => !solvedSceneIds.has(prereqId)
      );
      return {
        canActivate: false,
        reason: `Prerequisites not met: ${missingPrereqs?.join(', ')}`
      };
    }

    // Check if blocked
    const activeScenes = roomScenes.filter((s) => s.state === 'active');
    const blockingScene = activeScenes.find((activeScene) =>
      activeScene.blocks?.includes(scene.id)
    );

    if (blockingScene) {
      return {
        canActivate: false,
        reason: `Blocked by active scene: ${blockingScene.name} (${blockingScene.id})`
      };
    }

    return { canActivate: true };
  }

  /**
   * Update current action index for cutscenes
   */
  public setCurrentActionIndex(sceneId: string, index: number): void {
    const scene = this.scenes.get(sceneId);
    if (!scene || scene.type !== 'cutscene') return;

    scene.currentActionIndex = index;
    scene.lastUpdated = Date.now();
    this.scenes.set(sceneId, scene);
    this.emit('scene-updated', scene);
  }

  // ============================================================================
  // Legacy PuzzleRegistry compatibility methods
  // ============================================================================

  /**
   * @deprecated Use register() with SceneConfig instead
   */
  public registerPuzzle(config: PuzzleConfig): PuzzleRuntime {
    const sceneConfig: SceneConfig = {
      ...config,
      type: 'puzzle',
      devices: []
    };
    const scene = this.register(sceneConfig);
    return scene as unknown as PuzzleRuntime;
  }
}
