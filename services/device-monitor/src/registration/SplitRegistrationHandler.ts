import { logger } from '../logger';
import { Pool } from 'pg';

/**
 * Interface for controller registration message
 * Published to sentient/system/register/controller
 */
export interface ControllerRegistrationMessage {
  controller_id: string;
  room_id: string;
  friendly_name?: string;
  hardware_type?: string;
  mcu_model?: string;
  clock_speed_mhz?: number;
  firmware_version?: string;
  sketch_name?: string;
  digital_pins_total?: number;
  analog_pins_total?: number;
  heartbeat_interval_ms?: number;
  controller_type?: string;
  device_count?: number;  // Number of devices to expect
  mqtt_namespace?: string;
  mqtt_room_id?: string;
  mqtt_controller_id?: string;  // Maps to mqtt_puzzle_id in database
  mqtt_device_id?: string;
}

/**
 * Interface for device registration message
 * Published to sentient/system/register/device (one message per device)
 */
export interface DeviceRegistrationMessage {
  controller_id: string;
  device_index: number;
  device_id: string;
  friendly_name: string;
  device_type: string;
  device_category?: string;
  device_command_name?: string;  // Primary command name from capability manifest (legacy)
  pin?: number | string;
  pin_type?: string;
  properties?: Record<string, any>;
  mqtt_topics?: Array<{           // NEW: All topics from capability manifest
    topic: string;
    topic_type: 'command' | 'sensor' | 'state' | 'event';
  }>;
}

interface PendingRegistration {
  controller: ControllerRegistrationMessage;
  devices: Map<number, DeviceRegistrationMessage>;
  expectedDeviceCount: number;
  createdAt: number;
  timeout?: NodeJS.Timeout;
}

export interface SplitRegistrationOptions {
  registrationTimeoutMs?: number;  // How long to wait for all devices (default 10s)
  databaseUrl: string;  // Direct database connection (required)
  wsServer?: any;  // WebSocket server for real-time updates (optional)
}

/**
 * Handles split controller registration messages.
 * Controllers send:
 * 1. Controller metadata to sentient/system/register/controller
 * 2. Each device individually to sentient/system/register/device
 *
 * This handler accumulates all messages and creates the full registration
 * once all devices are received.
 */
export class SplitRegistrationHandler {
  private readonly registrationTimeoutMs: number;
  private readonly dbPool: Pool;
  private readonly wsServer?: any;
  private pendingRegistrations = new Map<string, PendingRegistration>();

  constructor(options: SplitRegistrationOptions) {
    this.registrationTimeoutMs = options.registrationTimeoutMs || 10000;
    this.wsServer = options.wsServer;

    // Initialize database pool (required)
    this.dbPool = new Pool({
      connectionString: options.databaseUrl,
      max: 5  // Small pool for registration operations
    });
    logger.info('SplitRegistrationHandler initialized with database pool');
  }

  /**
   * Handle controller registration message
   */
  public async handleControllerMessage(message: ControllerRegistrationMessage): Promise<void> {
    const { controller_id, room_id, device_count } = message;

    logger.info(
      { controller_id, room_id, device_count },
      'Received controller registration message'
    );

    // Check if we already have a pending registration
    if (this.pendingRegistrations.has(controller_id)) {
      logger.warn(
        { controller_id },
        'Controller already has pending registration, overwriting'
      );
      this.cleanupPendingRegistration(controller_id);
    }

    // Create pending registration
    const pending: PendingRegistration = {
      controller: message,
      devices: new Map(),
      expectedDeviceCount: device_count || 0,
      createdAt: Date.now()
    };

    // Set timeout to finalize registration if we don't get all devices
    pending.timeout = setTimeout(() => {
      logger.warn(
        {
          controller_id,
          expected: pending.expectedDeviceCount,
          received: pending.devices.size
        },
        'Registration timeout - finalizing with partial device list'
      );
      this.finalizeRegistration(controller_id).catch((error) => {
        logger.error({ error: error.message, controller_id }, 'Failed to finalize registration on timeout');
      });
    }, this.registrationTimeoutMs);

    this.pendingRegistrations.set(controller_id, pending);

    // If device_count is 0, finalize immediately
    if (device_count === 0) {
      logger.info({ controller_id }, 'Controller has no devices, finalizing immediately');
      await this.finalizeRegistration(controller_id);
    }
  }

  /**
   * Handle device registration message
   */
  public async handleDeviceMessage(message: DeviceRegistrationMessage): Promise<void> {
    const { controller_id, device_index, device_id } = message;

    logger.info(
      { controller_id, device_index, device_id },
      'Received device registration message'
    );

    const pending = this.pendingRegistrations.get(controller_id);
    if (!pending) {
      logger.warn(
        { controller_id, device_id },
        'Device registration received before controller registration - ignoring'
      );
      return;
    }

    // Guard: Ignore pseudo "controller" devices. Controllers are not devices.
    const loweredId = (device_id || '').toLowerCase();
    const loweredType = (message.device_type || '').toLowerCase();
    const pseudoIds = new Set(['controller', 'controller_device', 'controller_board', 'controller_main']);
    if (pseudoIds.has(loweredId) || loweredType === 'controller' || loweredType === 'microcontroller') {
      logger.warn({ controller_id, device_id }, 'Ignoring pseudo-device registration for controller');
      
      // Decrement expected device count so we don't wait for this filtered device
      pending.expectedDeviceCount = Math.max(0, pending.expectedDeviceCount - 1);
      
      logger.info(
        { controller_id, adjusted_expected: pending.expectedDeviceCount },
        'Adjusted expected device count after filtering pseudo-device'
      );
      
      // Check if we've now received all real devices
      if (pending.devices.size >= pending.expectedDeviceCount && pending.expectedDeviceCount > 0) {
        logger.info(
          { controller_id, device_count: pending.devices.size },
          'All devices received after filtering, finalizing registration'
        );
        
        // Cancel timeout to prevent race condition
        if (pending.timeout) {
          clearTimeout(pending.timeout);
          pending.timeout = undefined;
        }
        
        try {
          await this.finalizeRegistration(controller_id);
        } catch (error: any) {
          logger.error(
            { error: error.message, stack: error.stack, controller_id },
            'Failed to finalize registration after filtering pseudo-device'
          );
          throw error;
        }
      }
      
      return;
    }

    // Add device to pending registration
    pending.devices.set(device_index, message);

    logger.info(
      {
        controller_id,
        device_count: pending.devices.size,
        expected: pending.expectedDeviceCount
      },
      'Device added to pending registration'
    );

    // Check if we've received all devices
    if (pending.devices.size >= pending.expectedDeviceCount) {
      logger.info(
        { controller_id, device_count: pending.devices.size },
        'All devices received, finalizing registration'
      );
      await this.finalizeRegistration(controller_id);
    }
  }

  /**
   * Finalize registration by creating controller and devices in database
   */
  private async finalizeRegistration(controller_id: string): Promise<void> {
    const pending = this.pendingRegistrations.get(controller_id);
    if (!pending) {
      logger.warn({ controller_id }, 'No pending registration found');
      return;
    }

    try {
      // Create controller
      const controller = await this.createController(pending.controller);
      logger.info(
        { controller_id, db_id: controller.id },
        'Controller created in database'
      );

      // Look up room UUID for device creation
      const room_uuid = await this.getRoomUUID(pending.controller.room_id);
      if (!room_uuid) {
        throw new Error(`Room not found: ${pending.controller.room_id}`);
      }

      // Create devices with MQTT metadata from controller
      const devices = Array.from(pending.devices.values());
      logger.info(
        { controller_id, device_count: devices.length },
        'About to create devices in database'
      );
      
      for (const device of devices) {
        logger.info(
          { controller_id, device_id: device.device_id },
          'Creating device in database'
        );
        await this.createDevice(
          controller.id,
          room_uuid,  // Use UUID instead of slug
          device,
          pending.controller  // Pass controller for MQTT metadata
        );
        logger.info(
          { controller_id, device_id: device.device_id },
          'Device created successfully'
        );
      }

      logger.info(
        {
          controller_id,
          controller_db_id: controller.id,
          device_count: devices.length
        },
        'Registration complete'
      );
    } catch (error: any) {
      logger.error(
        { error: error.message, controller_id },
        'Failed to finalize registration'
      );
      throw error;
    } finally {
      // Clean up pending registration
      this.cleanupPendingRegistration(controller_id);
    }
  }

  /**
   * Look up room UUID by identifier or mqtt_topic_base ending
   * Per SYSTEM_ARCHITECTURE: firmware uses last segment of mqtt_topic_base for room
   */
  private async getRoomUUID(room_identifier: string): Promise<string | null> {
    try {
      logger.info({ 
        room_identifier, 
        pool_total: this.dbPool.totalCount,
        pool_idle: this.dbPool.idleCount,
        pool_waiting: this.dbPool.waitingCount 
      }, 'Looking up room UUID');
      
      const query = `
        SELECT id FROM rooms
        WHERE slug = $1
           OR mqtt_topic_base LIKE '%/' || $1
        LIMIT 1
      `;
      const result = await this.dbPool.query(query, [room_identifier]);

      logger.info({ 
        room_identifier, 
        rows_found: result.rows.length,
        first_row: result.rows[0] 
      }, 'Room query result');

      if (result.rows.length === 0) {
        logger.warn({ room_identifier }, 'Room not found by slug or mqtt_topic_base');
        return null;
      }

      return result.rows[0].id;
    } catch (error: any) {
      logger.error({ 
        error: error.message, 
        error_stack: error.stack,
        error_code: error.code,
        error_details: JSON.stringify(error),
        room_identifier 
      }, 'Failed to lookup room UUID');
      return null;
    }
  }

  /**
   * Create controller in database using direct SQL
   */
  private async createController(message: ControllerRegistrationMessage): Promise<any> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized - cannot create controller');
    }

    // Look up room UUID by slug
    const room_uuid = await this.getRoomUUID(message.room_id);
    if (!room_uuid) {
      throw new Error(`Room not found: ${message.room_id}`);
    }

    try {
      // Check if controller already exists
      const existingQuery = `
        SELECT id, controller_id, firmware_version
        FROM controllers
        WHERE controller_id = $1 AND room_id = $2
        LIMIT 1
      `;
      const existingResult = await this.dbPool.query(existingQuery, [message.controller_id, room_uuid]);

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        logger.info(
          { controller_id: message.controller_id, db_id: existing.id },
          'Controller already exists, updating'
        );

        // Update existing controller
        const updateQuery = `
          UPDATE controllers
          SET firmware_version = $1,
              heartbeat_interval_ms = $2,
              mqtt_namespace = $3,
              mqtt_room_id = $4,
              mqtt_puzzle_id = $5,
              mqtt_device_id = $6,
              last_heartbeat = NOW(),
              status = 'active',
              updated_at = NOW()
          WHERE id = $7
          RETURNING id, controller_id, room_id
        `;
        const updateResult = await this.dbPool.query(updateQuery, [
          message.firmware_version,
          message.heartbeat_interval_ms || 5000,
          message.mqtt_namespace || 'paragon',
          message.mqtt_room_id,
          message.mqtt_controller_id,  // firmware sends mqtt_controller_id, we store as mqtt_puzzle_id
          message.mqtt_device_id,
          existing.id
        ]);

        return updateResult.rows[0];
      }

      // Get room_slug_old for legacy column constraint
      const roomSlugQuery = `SELECT slug_old FROM rooms WHERE id = $1`;
      const roomSlugResult = await this.dbPool.query(roomSlugQuery, [room_uuid]);
      const room_slug_old = roomSlugResult.rows[0]?.slug_old || message.room_id;

      // Create new controller
      const insertQuery = `
        INSERT INTO controllers (
          room_id,
          room_slug_old,
          controller_id,
          friendly_name,
          hardware_type,
          mcu_model,
          clock_speed_mhz,
          firmware_version,
          sketch_name,
          digital_pins_total,
          analog_pins_total,
          heartbeat_interval_ms,
          controller_type,
          mqtt_namespace,
          mqtt_room_id,
          mqtt_puzzle_id,
          mqtt_device_id,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
        RETURNING id, controller_id, room_id
      `;

      const values = [
        room_uuid,
        room_slug_old,
        message.controller_id,
        message.friendly_name || message.controller_id,
        message.hardware_type || 'Teensy 4.1',
        message.mcu_model || 'ARM Cortex-M7',
        message.clock_speed_mhz || 600,
        message.firmware_version,
        message.sketch_name,
        message.digital_pins_total || 55,
        message.analog_pins_total || 18,
        message.heartbeat_interval_ms || 5000,
        message.controller_type || 'microcontroller',
        message.mqtt_namespace || 'paragon',
        message.mqtt_room_id,
        message.mqtt_controller_id,  // firmware sends mqtt_controller_id, we store as mqtt_puzzle_id
        message.mqtt_device_id,
        'active'
      ];

      const result = await this.dbPool.query(insertQuery, values);
      return result.rows[0];
    } catch (error: any) {
      logger.error(
        { error: error.message, controller_id: message.controller_id },
        'Failed to create controller via SQL'
      );
      throw error;
    }
  }

  /**
   * Create device in database using direct SQL
   */
  private async createDevice(
    controller_db_id: string,
    room_id: string,
    message: DeviceRegistrationMessage,
    controller?: ControllerRegistrationMessage
  ): Promise<void> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized - cannot create device');
    }

    return await this.createDeviceDirectSQL(controller_db_id, room_id, message, controller);
  }

  /**
   * Create device using direct SQL
   */
  private async createDeviceDirectSQL(
    controller_db_id: string,
    room_id: string,
    message: DeviceRegistrationMessage,
    controller?: ControllerRegistrationMessage
  ): Promise<void> {
    if (!this.dbPool) {
      throw new Error('Database pool not initialized');
    }

    // Build config with MQTT metadata from controller
    const config: any = {
      pin: message.pin,
      pin_type: message.pin_type,
      properties: message.properties
    };

    // Add MQTT metadata if controller info is available
    if (controller) {
      config.mqtt_namespace = (controller as any).mqtt_namespace || 'paragon';
      config.mqtt_room_id = (controller as any).mqtt_room_id;
      config.mqtt_puzzle_id = (controller as any).mqtt_puzzle_id;
      config.mqtt_device_id = (controller as any).mqtt_device_id;
    }

    const capabilities = {
      pin: message.pin,
      pin_type: message.pin_type,
      properties: message.properties
    };

    const mqttTopic = `sentient/paragon/clockwork/${message.device_id}`;  // Construct MQTT topic (legacy format)

    try {
      // Guard again at SQL boundary to be safe
      const loweredId = (message.device_id || '').toLowerCase();
      const loweredType = (message.device_type || '').toLowerCase();
      const pseudoIds = new Set(['controller', 'controller_device', 'controller_board', 'controller_main']);
      if (pseudoIds.has(loweredId) || loweredType === 'controller' || loweredType === 'microcontroller') {
        logger.warn({ controller_db_id, device_id: message.device_id }, 'Skipped SQL insert for pseudo-device');
        return;
      }
      // Get room_slug_old for legacy column constraint
      const roomSlugQuery = `SELECT slug_old FROM rooms WHERE id = $1`;
      const roomSlugResult = await this.dbPool.query(roomSlugQuery, [room_id]);
      const room_slug_old = roomSlugResult.rows[0]?.slug_old || 'unknown';

      const query = `
        INSERT INTO devices (
          room_id,
          room_slug_old,
          device_id,
          friendly_name,
          device_type,
          device_category,
          device_command_name,
          mqtt_topic,
          controller_id,
          capabilities,
          config,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (room_id, device_id)
        DO UPDATE SET
          room_slug_old = EXCLUDED.room_slug_old,
          friendly_name = EXCLUDED.friendly_name,
          device_type = EXCLUDED.device_type,
          device_category = EXCLUDED.device_category,
          device_command_name = EXCLUDED.device_command_name,
          mqtt_topic = EXCLUDED.mqtt_topic,
          controller_id = EXCLUDED.controller_id,
          capabilities = EXCLUDED.capabilities,
          config = EXCLUDED.config,
          updated_at = NOW()
        RETURNING id
      `;

      // Auto-map device_type to appropriate device_category
      let deviceCategory = message.device_category || 'puzzle';
      if (message.device_type === 'video_player' && !message.device_category) {
        deviceCategory = 'media_playback';
      }

      const values = [
        room_id,
        room_slug_old,
        message.device_id,
        message.friendly_name,
        message.device_type,
        deviceCategory,
        message.device_command_name || null,  // Command name from capability manifest
        mqttTopic,
        controller_db_id,
        JSON.stringify(capabilities),
        JSON.stringify(config),  // Store MQTT metadata in config
        'active'
      ];

      const result = await this.dbPool.query(query, values);
      const device_db_id = result.rows[0]?.id;

      logger.info(
        {
          device_id: message.device_id,
          controller_id: message.controller_id,
          db_id: device_db_id
        },
        'Device created via direct SQL'
      );

      // Populate device_commands table if device has a primary command
      if (message.device_command_name && device_db_id) {
        await this.createDeviceCommand(device_db_id, message.device_id, message.device_command_name, controller);
      }

      // Populate device_commands from mqtt_topics array (NEW - supports multiple commands)
      if (message.mqtt_topics && device_db_id) {
        await this.createDeviceCommandsFromTopics(device_db_id, message.device_id, message.mqtt_topics, controller);
      }
    } catch (error: any) {
      logger.error(
        { error: error.message, device_id: message.device_id },
        'Failed to create device via SQL'
      );
      throw error;
    }
  }

  /**
   * Create device command entry in device_commands table
   */
  private async createDeviceCommand(
    device_db_id: string,
    device_id: string,
    command_name: string,
    controller?: ControllerRegistrationMessage
  ): Promise<void> {
    try {
      // Build MQTT topic suffix for this command
      // Format: commands/[specific_command]
      const mqtt_topic_suffix = `commands/${command_name}`;

      // Create friendly name from command_name (e.g., fireLEDs_on -> "Fire LEDs On")
      const friendly_name = command_name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const query = `
        INSERT INTO device_commands (
          device_id,
          command_name,
          specific_command,
          friendly_name,
          mqtt_topic_suffix,
          command_type,
          enabled,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (device_id, specific_command)
        DO UPDATE SET
          command_name = EXCLUDED.command_name,
          friendly_name = EXCLUDED.friendly_name,
          mqtt_topic_suffix = EXCLUDED.mqtt_topic_suffix,
          updated_at = NOW()
        RETURNING id
      `;

      const values = [
        device_db_id,              // device_id (UUID FK)
        command_name,              // command_name (scene-friendly name)
        command_name,              // specific_command (firmware command name - same for now)
        friendly_name,             // friendly_name (human-readable)
        mqtt_topic_suffix,         // mqtt_topic_suffix (commands/[command])
        'command',                 // command_type
        true                       // enabled
      ];

      const result = await this.dbPool.query(query, values);

      logger.info(
        {
          device_id,
          command_name,
          command_db_id: result.rows[0]?.id
        },
        'Device command created'
      );
    } catch (error: any) {
      logger.error(
        { error: error.message, device_id, command_name },
        'Failed to create device command'
      );
      // Don't throw - device was created successfully, command is optional
    }
  }

  /**
   * Create device commands from mqtt_topics array (supports multiple commands per device)
   */
  private async createDeviceCommandsFromTopics(
    device_db_id: string,
    device_id: string,
    mqtt_topics: Array<{ topic: string; topic_type: string }>,
    controller?: ControllerRegistrationMessage
  ): Promise<void> {
    // Extract all command topics (format: "commands/[specific_command]")
    const commandTopics = mqtt_topics.filter(t => t.topic_type === 'command' && t.topic.startsWith('commands/'));

    logger.info(
      {
        device_id,
        command_count: commandTopics.length,
        commands: commandTopics.map(t => t.topic)
      },
      'Creating device commands from topics'
    );

    for (const topicDef of commandTopics) {
      // Extract command name from topic (e.g., "commands/moveTVLift_Up" -> "moveTVLift_Up")
      const commandName = topicDef.topic.replace('commands/', '');

      try {
        // Create friendly name
        const friendly_name = commandName
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const query = `
          INSERT INTO device_commands (
            device_id,
            command_name,
            specific_command,
            friendly_name,
            mqtt_topic_suffix,
            command_type,
            enabled,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (device_id, specific_command)
          DO UPDATE SET
            command_name = EXCLUDED.command_name,
            friendly_name = EXCLUDED.friendly_name,
            mqtt_topic_suffix = EXCLUDED.mqtt_topic_suffix,
            updated_at = NOW()
          RETURNING id
        `;

        const values = [
          device_db_id,              // device_id (UUID FK)
          commandName,               // command_name (scene-friendly name)
          commandName,               // specific_command (firmware command name)
          friendly_name,             // friendly_name (human-readable)
          topicDef.topic,            // mqtt_topic_suffix (commands/[command])
          'command',                 // command_type
          true                       // enabled
        ];

        const result = await this.dbPool.query(query, values);

        logger.info(
          {
            device_id,
            command_name: commandName,
            command_db_id: result.rows[0]?.id
          },
          'Device command created from topic'
        );
      } catch (error: any) {
        logger.error(
          { error: error.message, device_id, command_name: commandName },
          'Failed to create device command from topic'
        );
        // Continue with next command
      }
    }
  }

  /**
   * Clean up pending registration
   */
  private cleanupPendingRegistration(controller_id: string): void {
    const pending = this.pendingRegistrations.get(controller_id);
    if (pending?.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingRegistrations.delete(controller_id);
  }

  /**
   * Parse controller registration message
   */
  public static parseControllerMessage(payload: string | Buffer): ControllerRegistrationMessage | null {
    try {
      const data = typeof payload === 'string' ? payload : payload.toString();
      const parsed = JSON.parse(data);

      if (!parsed.controller_id || !parsed.room_id) {
        logger.warn({ parsed }, 'Invalid controller registration: missing required fields');
        return null;
      }

      return parsed as ControllerRegistrationMessage;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to parse controller registration message');
      return null;
    }
  }

  /**
   * Parse device registration message
   */
  public static parseDeviceMessage(payload: string | Buffer): DeviceRegistrationMessage | null {
    try {
      const data = typeof payload === 'string' ? payload : payload.toString();
      const parsed = JSON.parse(data);

      if (!parsed.controller_id || parsed.device_index === undefined || !parsed.device_id) {
        logger.warn({ parsed }, 'Invalid device registration: missing required fields');
        return null;
      }

      return parsed as DeviceRegistrationMessage;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to parse device registration message');
      return null;
    }
  }
}
