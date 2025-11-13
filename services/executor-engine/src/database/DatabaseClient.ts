import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../logger';
import { SceneConfig, SceneRuntime, SceneState, RoomPowerState } from '../types';

/**
 * DatabaseClient handles all database operations for the Scene Orchestrator
 */
export class DatabaseClient {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    this.pool.on('error', (err) => {
      logger.error({ error: err }, 'Unexpected database pool error');
    });
  }

  /**
   * Initialize database schema
   */
  public async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Check if scenes table already exists
      const result = await client.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scenes'"
      );

      const tableExists = parseInt(result.rows[0].count) > 0;

      if (tableExists) {
        logger.info('Database schema already initialized');
        return;
      }

      logger.warn('Database schema not found - run /scripts/init-database.sh to initialize');
      // For now, just continue - tables should be initialized manually
    } catch (error) {
      logger.error({ error }, 'Failed to check database schema');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // Scene Configuration
  // ============================================================================

  /**
   * Insert or update a scene configuration
   */
  public async upsertScene(scene: SceneConfig): Promise<void> {
    const query = `
      INSERT INTO scenes (id, scene_type, name, room_id, description, config)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        scene_type = EXCLUDED.scene_type,
        name = EXCLUDED.name,
        room_id = EXCLUDED.room_id,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        updated_at = NOW()
    `;

    await this.pool.query(query, [
      scene.id,
      scene.type,
      scene.name,
      scene.roomId,
      scene.description || null,
      JSON.stringify(scene)
    ]);

    logger.debug({ sceneId: scene.id }, 'Scene configuration upserted');
  }

  /**
   * Insert or update multiple scenes
   */
  public async upsertScenes(scenes: SceneConfig[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const scene of scenes) {
        await client.query(
          `INSERT INTO scenes (id, scene_type, name, room_id, description, config)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             scene_type = EXCLUDED.scene_type,
             name = EXCLUDED.name,
             room_id = EXCLUDED.room_id,
             description = EXCLUDED.description,
             config = EXCLUDED.config,
             updated_at = NOW()`,
          [
            scene.id,
            scene.type,
            scene.name,
            scene.roomId,
            scene.description || null,
            JSON.stringify(scene)
          ]
        );
      }

      await client.query('COMMIT');
      logger.info({ count: scenes.length }, 'Scenes batch upserted');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Failed to upsert scenes batch');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a scene configuration by ID
   */
  public async getScene(sceneId: string): Promise<SceneConfig | null> {
    const result = await this.pool.query<{ config: SceneConfig }>(
      'SELECT config FROM scenes WHERE id = $1',
      [sceneId]
    );

    return result.rows[0]?.config || null;
  }

  /**
   * Get all scenes for a room
   */
  public async getScenesByRoom(roomId: string): Promise<SceneConfig[]> {
    const result = await this.pool.query<{ config: SceneConfig }>(
      'SELECT config FROM scenes WHERE room_id = $1 ORDER BY created_at',
      [roomId]
    );

    return result.rows.map((row) => row.config);
  }

  /**
   * Get all scenes
   */
  public async getAllScenes(): Promise<SceneConfig[]> {
    const result = await this.pool.query<{ config: SceneConfig }>(
      'SELECT config FROM scenes ORDER BY room_id, created_at'
    );

    return result.rows.map((row) => row.config);
  }

  /**
   * Delete a scene
   */
  public async deleteScene(sceneId: string): Promise<void> {
    await this.pool.query('DELETE FROM scenes WHERE id = $1', [sceneId]);
    logger.info({ sceneId }, 'Scene deleted');
  }

  // ============================================================================
  // Runtime State
  // ============================================================================

  /**
   * Get or create runtime state for a scene
   */
  public async getOrCreateRuntimeState(
    sceneId: string,
    sessionId?: string
  ): Promise<{
    state: SceneState;
    startedAt?: number;
    completedAt?: number;
    attempts: number;
    currentActionIndex?: number;
  }> {
    const result = await this.pool.query(
      `INSERT INTO scene_runtime_state (scene_id, session_id, state, last_updated)
       VALUES ($1, $2, 'inactive', $3)
       ON CONFLICT (scene_id) DO UPDATE SET
         session_id = EXCLUDED.session_id
       RETURNING state, started_at, completed_at, attempts, current_action_index`,
      [sceneId, sessionId || null, Date.now()]
    );

    const row = result.rows[0];
    return {
      state: row.state as SceneState,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      attempts: row.attempts,
      currentActionIndex: row.current_action_index || undefined
    };
  }

  /**
   * Update scene runtime state
   */
  public async updateRuntimeState(
    sceneId: string,
    updates: {
      state?: SceneState;
      startedAt?: number;
      completedAt?: number;
      attempts?: number;
      currentActionIndex?: number;
      sessionId?: string;
    }
  ): Promise<void> {
    const fields: string[] = ['last_updated = $2'];
    const values: unknown[] = [sceneId, Date.now()];
    let paramIndex = 3;

    if (updates.state !== undefined) {
      fields.push(`state = $${paramIndex++}`);
      values.push(updates.state);
    }
    if (updates.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.attempts !== undefined) {
      fields.push(`attempts = $${paramIndex++}`);
      values.push(updates.attempts);
    }
    if (updates.currentActionIndex !== undefined) {
      fields.push(`current_action_index = $${paramIndex++}`);
      values.push(updates.currentActionIndex);
    }
    if (updates.sessionId !== undefined) {
      fields.push(`session_id = $${paramIndex++}`);
      values.push(updates.sessionId);
    }

    const query = `
      UPDATE scene_runtime_state
      SET ${fields.join(', ')}
      WHERE scene_id = $1
    `;

    await this.pool.query(query, values);
  }

  /**
   * Reset scene runtime state
   */
  public async resetRuntimeState(sceneId: string): Promise<void> {
    await this.pool.query(
      `UPDATE scene_runtime_state
       SET state = 'inactive',
           started_at = NULL,
           completed_at = NULL,
           attempts = 0,
           current_action_index = NULL,
           last_updated = $2
       WHERE scene_id = $1`,
      [sceneId, Date.now()]
    );
  }

  // ============================================================================
  // Room State
  // ============================================================================

  /**
   * Get room power state
   */
  public async getRoomPowerState(roomId: string): Promise<RoomPowerState> {
    const result = await this.pool.query<{ power_state: RoomPowerState }>(
      'SELECT power_state FROM room_state WHERE room_id = $1',
      [roomId]
    );

    return result.rows[0]?.power_state || 'on';
  }

  /**
   * Set room power state
   */
  public async setRoomPowerState(
    roomId: string,
    powerState: RoomPowerState
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO room_state (room_id, power_state, last_updated)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id) DO UPDATE SET
         power_state = EXCLUDED.power_state,
         last_updated = EXCLUDED.last_updated`,
      [roomId, powerState, Date.now()]
    );

    logger.info({ roomId, powerState }, 'Room power state updated');
  }

  /**
   * Set room session
   */
  public async setRoomSession(roomId: string, sessionId: string | null): Promise<void> {
    await this.pool.query(
      `INSERT INTO room_state (room_id, current_session_id, last_updated)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id) DO UPDATE SET
         current_session_id = EXCLUDED.current_session_id,
         last_updated = EXCLUDED.last_updated`,
      [roomId, sessionId, Date.now()]
    );
  }

  // ============================================================================
  // Director Commands Log
  // ============================================================================

  /**
   * Log a director command
   */
  public async logDirectorCommand(command: {
    command: string;
    sceneId?: string;
    roomId?: string;
    sessionId?: string;
    payload?: unknown;
    reason?: string;
    executedBy?: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO director_commands
       (command, scene_id, room_id, session_id, payload, reason, executed_by, executed_at, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        command.command,
        command.sceneId || null,
        command.roomId || null,
        command.sessionId || null,
        command.payload ? JSON.stringify(command.payload) : null,
        command.reason || null,
        command.executedBy || 'system',
        Date.now(),
        command.success,
        command.errorMessage || null
      ]
    );
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Get device information for MQTT command routing
   * 
   * Actual schema: devices → controllers → rooms → clients
   * Controllers table uses controller_id (VARCHAR) not name
   */
  public async getDeviceInfo(deviceNameOrId: string): Promise<{
    controllerId: string;
    deviceCommandName: string;
    clientId: string;
    roomId: string;
  } | null> {
    const result = await this.pool.query<{
      controller_id: string;
      device_command_name: string;
      client_id: string;
      room_id: string;
    }>(
      `SELECT 
        c.controller_id,
        d.device_command_name,
        cl.client_id as client_id,
        r.room_id as room_id
      FROM devices d
      JOIN controllers c ON d.controller_id = c.id
      JOIN rooms r ON c.room_id = r.id
      JOIN clients cl ON r.client_id = cl.id
      WHERE d.device_id = $1 OR d.friendly_name = $1 OR d.id::text = $1
      LIMIT 1`,
      [deviceNameOrId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      controllerId: row.controller_id,
      deviceCommandName: row.device_command_name,
      clientId: row.client_id,
      roomId: row.room_id
    };
  }

  /**
   * Get device + command mapping using new device_commands table
   * Returns identifiers needed to construct authoritative MQTT topic:
     * [client]/[room]/commands/[controller]/[device]/[specific_command]
   *
   * Success criteria:
   * - device exists and is linked to a controller and room
   * - command mapping exists in device_commands (by command_name or specific_command)
   *
   * Note: If no mapping exists, return null (caller should not publish)
   */
  public async getDeviceCommandRouting(
    deviceNameOrId: string,
    commandName: string
  ): Promise<{
    client: string;
    room: string;
    controller: string;
    device: string;
    specificCommand: string;
  } | null> {
    try {
      const result = await this.pool.query<{
        client_slug: string;
        mqtt_topic_base: string;
        controller_id: string;
        device_id: string;
        specific_command: string;
      }>(
        `SELECT 
           cl.slug AS client_slug,
           r.mqtt_topic_base,
           c.controller_id,
           d.device_id,
           dc.specific_command
         FROM devices d
         JOIN controllers c ON d.controller_id = c.id
         JOIN rooms r ON d.room_id = r.id
         JOIN clients cl ON r.client_id = cl.id
         JOIN device_commands dc ON dc.device_id = d.id
         WHERE (d.device_id = $1 OR d.friendly_name = $1 OR d.id::text = $1)
           AND (dc.command_name = $2 OR dc.specific_command = $2)
         LIMIT 1`,
        [deviceNameOrId, commandName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      // Extract room namespace from mqtt_topic_base (e.g., "sentient/paragon/clockwork" -> "clockwork")
      const topicParts = row.mqtt_topic_base.split('/');
      const roomNamespace = topicParts[topicParts.length - 1] || row.client_slug;
      
      return {
        client: row.client_slug,
        room: roomNamespace,
        controller: row.controller_id,
        device: row.device_id,
        specificCommand: row.specific_command
      };
    } catch (error) {
      logger.error({ error, deviceNameOrId, commandName }, 'Failed to query device command routing');
      return null;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }

  /**
   * Close database connection pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}
