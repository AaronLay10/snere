/**
 * Device State Manager
 *
 * Manages real-time sensor data and device state storage.
 * Listens to MQTT sensor/state topics and stores data in database.
 * Provides fast cached access to latest device state.
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { logger } from '../logger';
import type { IncomingMessage } from '../devices/types';

export interface SensorData {
  deviceId: string;
  sensorName: string;
  value: any;
  receivedAt: Date;
}

export interface DeviceState {
  deviceId: string;
  state: Record<string, any>;
  updatedAt: Date;
}

export interface DeviceStateManagerOptions {
  databaseUrl: string;
  maxCacheSize?: number;
  cacheExpiryMs?: number;
}

export class DeviceStateManager extends EventEmitter {
  private dbPool: Pool;
  private sensorCache = new Map<string, SensorData[]>();
  private stateCache = new Map<string, DeviceState>();
  private deviceIdCache = new Map<string, string>(); // Cache deviceKey -> device_id mappings
  private readonly maxCacheSize: number;
  private readonly cacheExpiryMs: number;

  constructor(options: DeviceStateManagerOptions) {
    super();

    this.dbPool = new Pool({ connectionString: options.databaseUrl });
    this.maxCacheSize = options.maxCacheSize || 100; // Keep last 100 readings per sensor
    this.cacheExpiryMs = options.cacheExpiryMs || 60000; // Cache expires after 1 minute

    logger.info('DeviceStateManager initialized');
  }

  /**
   * Handle incoming MQTT message - parse and store sensor/state data
   */
  public async handleMessage(message: IncomingMessage): Promise<void> {
    const { topic, payload, receivedAt } = message;
    const topicParts = topic.split('/');

    try {
      // Determine if this is a sensor or state message BEFORE parsing
        // NEW Topic format: namespace/room/category/controller_id/device_id/item
        // Example: paragon/clockwork/sensors/boiler_room_subpanel/teensy41/valve_psi

      let offset = 0;
        if (topicParts.length >= 5) {
        const namespace = topicParts[0]?.toLowerCase();
        if (namespace === 'paragon' || namespace === 'mythraos') {
          offset = 1;
        }
      }

        const messageType = topicParts[offset + 1]?.toLowerCase(); // "sensors", "status", "events"
        const controllerId = topicParts[offset + 2]; // controller_id
        const deviceId = topicParts[offset + 3]; // device_id (controller model)
        const specificTopic = topicParts[offset + 4]; // sensor name or item

      // Only process if this is actually a sensor or state message
      if (!messageType || !specificTopic) {
        return; // Not a sensor/state message
      }

      // Only process messages with "sensors" or "state" in the message type
        if (messageType !== 'sensors' && messageType !== 'status') {
        return; // Not a sensor/state message (could be Commands, status, events, etc.)
      }

      // Check if payload is empty
      const payloadStr = payload.toString();
      if (!payloadStr || payloadStr.trim().length === 0) {
        return; // Empty payload, skip
      }

      // Now parse the JSON payload
      const data = JSON.parse(payloadStr);

      // Build device key for lookup
        const roomId = topicParts[offset]; // "clockwork"
        const topicControllerId = topicParts[offset + 2]; // "boiler_room_subpanel"  
        const deviceKey = `${roomId}/${topicControllerId}/${deviceId}`.toLowerCase();

      if (messageType === 'sensors') {
        await this.handleSensorData(deviceKey, specificTopic, data, receivedAt);
        } else if (messageType === 'status') {
        await this.handleStateData(deviceKey, data, receivedAt);
      }

    } catch (error: any) {
      // Only log errors for topics that should be sensor/state messages
        const msgType = topicParts[1]?.toLowerCase();
        if (msgType === 'sensors' || msgType === 'status') {
        logger.error({ error: error.message, topic }, 'Failed to parse sensor/state message');
      }
      // Silently ignore other messages (Commands, status, events, etc.)
    }
  }

  /**
   * Handle sensor data message
   */
  private async handleSensorData(deviceKey: string, sensorName: string, value: any, receivedAt: number): Promise<void> {
    // Look up the actual device_id from database for proper WebSocket filtering
    const deviceIdCacheKey = `${deviceKey}:${sensorName}`;
    let actualDeviceId = this.deviceIdCache.get(deviceIdCacheKey) || deviceKey; // Use cached or default to deviceKey

    // If not in cache, look it up from database
    if (actualDeviceId === deviceKey) {
      try {
        const [roomName, puzzleName, controllerName] = deviceKey.split('/');
        const dbControllerName = controllerName.replace(/_/g, '-');
        const fullControllerId = `${roomName}-${dbControllerName}`;

        // Find device that matches this controller and sensor name
        // Try to match by sensor name pattern first (e.g., "Lever4_White" -> "lever_4_white")
        const sensorNameLower = sensorName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

        const deviceQuery = `
          SELECT d.device_id
          FROM devices d
          JOIN controllers c ON d.controller_id = c.id
          WHERE c.controller_id = $1
          AND (
            -- Match by device_id containing sensor name pattern
            d.device_id LIKE $2
            -- Or match sensor type devices
            OR (d.device_type IN ('sensor', 'photoresistor', 'potentiometer', 'gauge')
                AND d.capabilities->>'sensors' LIKE $3)
            -- Or match by category
            OR (d.device_category = 'input' AND d.device_type = 'sensor')
          )
          ORDER BY
            CASE
              WHEN d.device_id LIKE $2 THEN 1  -- Prioritize name match
              ELSE 2
            END
          LIMIT 1
        `;

        const result = await this.dbPool.query(deviceQuery, [
          fullControllerId,
          `%${sensorNameLower}%`,
          `%${sensorName}%`
        ]);

        if (result.rows.length > 0) {
          actualDeviceId = result.rows[0].device_id;
          // Cache the result
          this.deviceIdCache.set(deviceIdCacheKey, actualDeviceId);
        }
      } catch (error: any) {
        logger.warn({ error: error.message, deviceKey, sensorName }, 'Failed to lookup device_id for sensor');
      }
    }

    const sensorData: SensorData = {
      deviceId: actualDeviceId, // Use actual device_id for frontend filtering
      sensorName,
      value,
      receivedAt: new Date(receivedAt)
    };

    // Update cache (use deviceKey for sensor readings cache)
    const sensorCacheKey = `${deviceKey}:${sensorName}`;
    let readings = this.sensorCache.get(sensorCacheKey) || [];
    readings.unshift(sensorData);

    // Limit cache size
    if (readings.length > this.maxCacheSize) {
      readings = readings.slice(0, this.maxCacheSize);
    }
    this.sensorCache.set(sensorCacheKey, readings);

    // Store in database (async, don't await)
    this.storeSensorData({ ...sensorData, deviceId: deviceKey }).catch((error) => {
      logger.error({ error: error.message, deviceKey, sensorName }, 'Failed to store sensor data');
    });

    // Emit event for WebSocket broadcasting
    this.emit('sensor-data', sensorData);

    logger.debug({ deviceKey, sensorName, actualDeviceId, value }, 'Sensor data received');
  }

  /**
   * Handle device state message
   */
  private async handleStateData(deviceKey: string, state: Record<string, any>, receivedAt: number): Promise<void> {
    const deviceState: DeviceState = {
      deviceId: deviceKey,
      state,
      updatedAt: new Date(receivedAt)
    };

    // Update cache
    this.stateCache.set(deviceKey, deviceState);

    logger.info({ deviceKey, state, cacheSize: this.stateCache.size }, 'State cached');

    // Store in database (async, don't await)
    this.updateDeviceState(deviceKey, state).catch((error) => {
      logger.error({ error: error.message, deviceKey }, 'Failed to update device state');
    });

    // Parse deviceKey to extract controllerId and deviceId for frontend
    // deviceKey format: "clockwork/power_control_upper_right/lever_boiler_5v"
    const parts = deviceKey.split('/');
    const controllerId = parts.length >= 2 ? parts[1] : undefined;
    const deviceId = parts.length >= 3 ? parts[2] : undefined;

    logger.info({ deviceKey, controllerId, deviceId, state }, 'Broadcasting state-update event');

    // Emit event for WebSocket broadcasting with parsed structure
    this.emit('state-update', {
      controllerId,
      deviceId,
      state,
      timestamp: receivedAt
    });

    logger.debug({ deviceKey, controllerId, deviceId, state }, 'Device state updated');
  }

  /**
   * Store sensor data in database
   */
  private async storeSensorData(data: SensorData): Promise<void> {
    try {
      // First, get the device UUID from our device key
      // The deviceId is in format "room/puzzle/controller"
      const [roomName, puzzleName, controllerName] = data.deviceId.split('/');

      // Convert controller name to match database format
      // MQTT: "Gauge_6_Leds" -> Database: "clockwork-gauge-6-leds"
      const dbControllerName = controllerName.replace(/_/g, '-');
      const fullControllerId = `${roomName}-${dbControllerName}`;

      // Find the device in database by controller_id
      const deviceQuery = `
        SELECT d.id
        FROM devices d
        JOIN controllers c ON d.controller_id = c.id
        WHERE c.controller_id = $1
        LIMIT 1
      `;

      const deviceResult = await this.dbPool.query(deviceQuery, [fullControllerId]);

      if (deviceResult.rows.length === 0) {
        logger.warn({ deviceKey: data.deviceId }, 'Device not found in database for sensor data');
        return;
      }

      const deviceUuid = deviceResult.rows[0].id;

      // Insert sensor data
      const insertQuery = `
        INSERT INTO device_sensor_data (device_id, sensor_name, value, received_at)
        VALUES ($1, $2, $3, $4)
      `;

      await this.dbPool.query(insertQuery, [
        deviceUuid,
        data.sensorName,
        JSON.stringify(data.value),
        data.receivedAt
      ]);

    } catch (error: any) {
      throw new Error(`Database insert failed: ${error.message}`);
    }
  }

  /**
   * Update device state in database
   */
  private async updateDeviceState(deviceKey: string, state: Record<string, any>): Promise<void> {
    try {
      const [roomName, puzzleName, controllerName] = deviceKey.split('/');

      // Convert controller name to match database format
      // MQTT: "Gauge_6_Leds" -> Database: "clockwork-gauge-6-leds"
      const dbControllerName = controllerName.replace(/_/g, '-');
      const fullControllerId = `${roomName}-${dbControllerName}`;

      // Find the device
      const deviceQuery = `
        SELECT d.id
        FROM devices d
        JOIN controllers c ON d.controller_id = c.id
        WHERE c.controller_id = $1
        LIMIT 1
      `;

      const deviceResult = await this.dbPool.query(deviceQuery, [fullControllerId]);

      if (deviceResult.rows.length === 0) {
        logger.warn({ deviceKey }, 'Device not found in database for state update');
        return;
      }

      const deviceUuid = deviceResult.rows[0].id;

      // Update device state
      const updateQuery = `
        UPDATE devices
        SET state = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await this.dbPool.query(updateQuery, [JSON.stringify(state), deviceUuid]);

    } catch (error: any) {
      throw new Error(`Database update failed: ${error.message}`);
    }
  }

  /**
   * Get recent sensor readings for a device
   */
  public async getSensorData(deviceUuid: string, sensorName?: string, limit: number = 100): Promise<SensorData[]> {
    try {
      let query = `
        SELECT sensor_name, value, received_at
        FROM device_sensor_data
        WHERE device_id = $1
      `;

      const params: any[] = [deviceUuid];

      if (sensorName) {
        query += ` AND sensor_name = $2`;
        params.push(sensorName);
      }

      query += ` ORDER BY received_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.dbPool.query(query, params);

      return result.rows.map(row => ({
        deviceId: deviceUuid,
        sensorName: row.sensor_name,
        value: row.value,
        receivedAt: row.received_at
      }));

    } catch (error: any) {
      logger.error({ error: error.message, deviceUuid }, 'Failed to get sensor data');
      return [];
    }
  }

  /**
   * Get current device state
   */
  public async getDeviceState(deviceUuid: string): Promise<DeviceState | null> {
    try {
      const query = `
        SELECT state, updated_at
        FROM devices
        WHERE id = $1
      `;

      const result = await this.dbPool.query(query, [deviceUuid]);

      if (result.rows.length === 0 || !result.rows[0].state) {
        return null;
      }

      return {
        deviceId: deviceUuid,
        state: result.rows[0].state,
        updatedAt: result.rows[0].updated_at
      };

    } catch (error: any) {
      logger.error({ error: error.message, deviceUuid }, 'Failed to get device state');
      return null;
    }
  }

  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    await this.dbPool.end();
    logger.info('DeviceStateManager closed');
  }
}
