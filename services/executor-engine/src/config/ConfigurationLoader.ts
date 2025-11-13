import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { SceneConfig } from '../types';
import { DatabaseClient } from '../database/DatabaseClient';

interface RoomConfigFile {
  roomId: string;
  roomName: string;
  scenes: SceneConfig[];
}

/**
 * ConfigurationLoader loads scene configurations from JSON files
 * and syncs them to the database
 */
export class ConfigurationLoader {
  constructor(
    private readonly configPath: string,
    private readonly database: DatabaseClient
  ) {}

  /**
   * Load all room configurations from disk
   */
  public async loadAllRooms(): Promise<Map<string, SceneConfig[]>> {
    const roomsPath = path.join(this.configPath, 'rooms');
    const roomConfigs = new Map<string, SceneConfig[]>();

    try {
      const entries = await fs.readdir(roomsPath, { withFileTypes: true });
      const roomDirs = entries.filter((e) => e.isDirectory());

      logger.info({ roomCount: roomDirs.length }, 'Loading room configurations');

      for (const roomDir of roomDirs) {
        const roomId = roomDir.name;
        try {
          const scenes = await this.loadRoom(roomId);
          roomConfigs.set(roomId, scenes);
          logger.info({ roomId, sceneCount: scenes.length }, 'Room configuration loaded');
        } catch (error) {
          logger.error({ roomId, error }, 'Failed to load room configuration');
        }
      }

      return roomConfigs;
    } catch (error) {
      logger.error({ error }, 'Failed to read rooms directory');
      throw error;
    }
  }

  /**
   * Load a specific room's configuration from scenes/ directory
   */
  public async loadRoom(roomId: string): Promise<SceneConfig[]> {
    const scenesDir = path.join(this.configPath, 'rooms', roomId, 'scenes');

    try {
      // Check if scenes directory exists
      const fsSync = require('fs');
      if (!fsSync.existsSync(scenesDir)) {
        logger.warn({ roomId }, 'Scenes directory not found, falling back to scenes.json');
        return await this.loadRoomLegacy(roomId);
      }

      // Read all JSON files from scenes directory
      const entries = await fs.readdir(scenesDir);
      const sceneFiles = entries.filter(f => f.endsWith('.json'));

      if (sceneFiles.length === 0) {
        logger.warn({ roomId }, 'No scene files found in scenes directory');
        return [];
      }

      const scenes: SceneConfig[] = [];

      for (const sceneFile of sceneFiles) {
        try {
          const sceneFilePath = path.join(scenesDir, sceneFile);
          const fileContent = await fs.readFile(sceneFilePath, 'utf-8');
          const scene = JSON.parse(fileContent) as SceneConfig;

          // Validate scene
          if (!scene.id || !scene.type) {
            logger.warn({ sceneFile, roomId }, 'Invalid scene file structure, skipping');
            continue;
          }

          // For cutscenes/scenes, sequence or timeline is required; for puzzles, devices are required
          if ((scene.type === 'cutscene' || scene.type === 'scene') && !scene.sequence && !scene.timeline) {
            logger.warn({ sceneFile, roomId }, 'Cutscene/scene missing sequence or timeline, skipping');
            continue;
          }

          // Normalize: if timeline exists but sequence doesn't, copy timeline to sequence
          if ((scene.type === 'cutscene' || scene.type === 'scene') && scene.timeline && !scene.sequence) {
            scene.sequence = scene.timeline;
          }

          if (scene.type === 'puzzle' && (!scene.devices || scene.devices.length === 0)) {
            logger.warn({ sceneFile, roomId }, 'Puzzle missing devices, skipping');
            continue;
          }

          if (this.validateScene(scene)) {
            scenes.push(scene);
          }
        } catch (error) {
          logger.error({ sceneFile, roomId, error }, 'Failed to load scene file');
        }
      }

      logger.info(
        { roomId, sceneCount: scenes.length, sceneFiles: sceneFiles.length },
        'Room scenes loaded from directory'
      );

      return scenes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn({ roomId }, 'Scenes directory not found');
        return [];
      }
      throw error;
    }
  }

  /**
   * Legacy method: Load from scenes.json file (fallback)
   */
  private async loadRoomLegacy(roomId: string): Promise<SceneConfig[]> {
    const configFilePath = path.join(this.configPath, 'rooms', roomId, 'scenes.json');

    try {
      const fileContent = await fs.readFile(configFilePath, 'utf-8');
      const config = JSON.parse(fileContent) as RoomConfigFile;

      // Validate structure
      if (!config.roomId || !config.scenes) {
        throw new Error('Invalid configuration file structure');
      }

      if (config.roomId !== roomId) {
        logger.warn(
          { fileRoomId: config.roomId, dirRoomId: roomId },
          'Room ID mismatch between file and directory'
        );
      }

      // Validate each scene
      const validScenes = config.scenes.filter((scene) => this.validateScene(scene));

      logger.info(
        { roomId, totalScenes: config.scenes.length, validScenes: validScenes.length },
        'Room scenes loaded from legacy scenes.json'
      );

      return validScenes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.warn({ roomId }, 'Legacy scenes.json file not found');
        return [];
      }
      throw error;
    }
  }

  /**
   * Load configurations and sync to database
   */
  public async loadAndSync(): Promise<void> {
    logger.info('Starting configuration load and sync');

    const roomConfigs = await this.loadAllRooms();
    let totalScenes = 0;

    for (const [roomId, scenes] of roomConfigs.entries()) {
      try {
        await this.database.upsertScenes(scenes);
        totalScenes += scenes.length;
        logger.info({ roomId, sceneCount: scenes.length }, 'Room synced to database');
      } catch (error) {
        logger.error({ roomId, error }, 'Failed to sync room to database');
      }
    }

    logger.info({ totalScenes, roomCount: roomConfigs.size }, 'Configuration sync complete');
  }

  /**
   * Watch for configuration file changes (future enhancement)
   */
  public async watch(): Promise<void> {
    // TODO: Implement file watching for hot-reload
    logger.info('Configuration file watching not yet implemented');
  }

  /**
   * Validate a scene configuration
   */
  private validateScene(scene: SceneConfig): boolean {
    const errors: string[] = [];

    // Required fields
    if (!scene.id) errors.push('Missing id');
    if (!scene.type) errors.push('Missing type');
    if (!scene.name) errors.push('Missing name');
    if (!scene.roomId) errors.push('Missing roomId');

    // Devices array: required for puzzles, optional for cutscenes/scenes (can be empty)
    if (scene.type === 'puzzle' && (!scene.devices || !Array.isArray(scene.devices) || scene.devices.length === 0)) {
      errors.push('Puzzles require a non-empty devices array');
    } else if (!scene.devices || !Array.isArray(scene.devices)) {
      // For cutscenes/scenes, devices array must exist but can be empty
      errors.push('Missing or invalid devices array');
    }

    // Type-specific validation
    if (scene.type === 'puzzle') {
      // Puzzles should have outputs (optional but recommended)
      if (!scene.outputs || scene.outputs.length === 0) {
        logger.debug({ sceneId: scene.id }, 'Puzzle has no output effects');
      }
    } else if (scene.type === 'cutscene' || scene.type === 'scene') {
      // Cutscenes/scenes must have sequences (or timeline which was normalized to sequence)
      if (!scene.sequence || scene.sequence.length === 0) {
        errors.push('Cutscene/scene missing sequence');
      } else {
        // Validate sequence actions
        for (let i = 0; i < scene.sequence.length; i++) {
          const action = scene.sequence[i];
          if (action.delayMs === undefined) {
            errors.push(`Sequence action ${i} missing delayMs`);
          }
          if (!action.action) {
            errors.push(`Sequence action ${i} missing action`);
          }
          if (!action.target) {
            errors.push(`Sequence action ${i} missing target`);
          }
        }
      }

      if (!scene.estimatedDurationMs) {
        logger.debug({ sceneId: scene.id }, 'Cutscene/scene missing estimatedDurationMs');
      }
    } else {
      errors.push(`Invalid scene type: ${scene.type}`);
    }

    // Prerequisites validation
    if (scene.prerequisites && !Array.isArray(scene.prerequisites)) {
      errors.push('Prerequisites must be an array');
    }

    // Blocks validation
    if (scene.blocks && !Array.isArray(scene.blocks)) {
      errors.push('Blocks must be an array');
    }

    // Safety checks validation
    if (scene.safetyChecks) {
      if (!Array.isArray(scene.safetyChecks)) {
        errors.push('Safety checks must be an array');
      } else {
        for (let i = 0; i < scene.safetyChecks.length; i++) {
          const check = scene.safetyChecks[i];
          if (!check.id) {
            errors.push(`Safety check ${i} missing id`);
          }
          if (!check.description) {
            errors.push(`Safety check ${i} missing description`);
          }
        }
      }
    }

    if (errors.length > 0) {
      logger.error({ sceneId: scene.id, errors }, 'Scene validation failed');
      return false;
    }

    return true;
  }

  /**
   * Export current database configuration to JSON files
   */
  public async exportToFiles(): Promise<void> {
    logger.info('Exporting database configurations to files');

    const allScenes = await this.database.getAllScenes();
    const scenesByRoom = new Map<string, SceneConfig[]>();

    // Group scenes by room
    for (const scene of allScenes) {
      const roomScenes = scenesByRoom.get(scene.roomId) || [];
      roomScenes.push(scene);
      scenesByRoom.set(scene.roomId, roomScenes);
    }

    // Write each room's config file
    for (const [roomId, scenes] of scenesByRoom.entries()) {
      const roomConfigFile: RoomConfigFile = {
        roomId,
        roomName: roomId, // TODO: Get actual room name from somewhere
        scenes
      };

      const outputPath = path.join(this.configPath, 'rooms', roomId, 'scenes.json');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(roomConfigFile, null, 2), 'utf-8');

      logger.info({ roomId, sceneCount: scenes.length, path: outputPath }, 'Room exported');
    }

    logger.info({ roomCount: scenesByRoom.size }, 'Export complete');
  }

  /**
   * Reload configuration (for dashboard "Reload Configuration" button)
   */
  public async reload(): Promise<{ success: boolean; message: string; sceneCount: number }> {
    try {
      const roomConfigs = await this.loadAllRooms();
      let totalScenes = 0;

      for (const [roomId, scenes] of roomConfigs.entries()) {
        await this.database.upsertScenes(scenes);
        totalScenes += scenes.length;
      }

      logger.info({ totalScenes }, 'Configuration reloaded successfully');

      return {
        success: true,
        message: `Successfully reloaded ${totalScenes} scenes from ${roomConfigs.size} rooms`,
        sceneCount: totalScenes
      };
    } catch (error) {
      logger.error({ error }, 'Configuration reload failed');
      return {
        success: false,
        message: `Reload failed: ${(error as Error).message}`,
        sceneCount: 0
      };
    }
  }
}
