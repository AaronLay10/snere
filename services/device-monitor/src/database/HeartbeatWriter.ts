/**
 * Heartbeat Writer
 *
 * Writes controller heartbeat data to the database to maintain
 * the database as the single source of truth for controller status.
 */

import { Pool } from 'pg';
import { logger } from '../logger';
import type { DeviceRecord } from '../devices/types';

export interface HeartbeatWriterOptions {
  databaseUrl: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

export class HeartbeatWriter {
  private dbPool: Pool;
  private heartbeatQueue: Map<string, DeviceRecord> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;

  constructor(options: HeartbeatWriterOptions) {
    this.dbPool = new Pool({ connectionString: options.databaseUrl });
    this.batchSize = options.batchSize || 50;
    this.flushIntervalMs = options.flushIntervalMs || 2000; // Flush every 2 seconds

    logger.info({ flushIntervalMs: this.flushIntervalMs }, 'HeartbeatWriter initialized');
  }

  /**
   * Start the periodic flush interval
   */
  public start(): void {
    if (this.flushInterval) {
      return; // Already started
    }

    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        logger.error({ error: error.message }, 'Failed to flush heartbeat queue');
      });
    }, this.flushIntervalMs);

    logger.info('HeartbeatWriter started');
  }

  /**
   * Stop the periodic flush interval
   */
  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining heartbeats
    this.flush().catch((error) => {
      logger.error({ error: error.message }, 'Failed to flush remaining heartbeats on stop');
    });

    logger.info('HeartbeatWriter stopped');
  }

  /**
   * Queue a device heartbeat for writing to the database
   */
  public queueHeartbeat(device: DeviceRecord): void {
    // Use uniqueId if available, otherwise use canonical ID
    const key = device.uniqueId || device.canonicalId || device.id;
    this.heartbeatQueue.set(key.toLowerCase(), device);

    // If queue is full, flush immediately
    if (this.heartbeatQueue.size >= this.batchSize) {
      this.flush().catch((error) => {
        logger.error({ error: error.message }, 'Failed to flush heartbeat queue on batch size limit');
      });
    }
  }

  /**
   * Flush the heartbeat queue to the database
   */
  private async flush(): Promise<void> {
    if (this.heartbeatQueue.size === 0) {
      return;
    }

    const devices = Array.from(this.heartbeatQueue.values());
    this.heartbeatQueue.clear();

    try {
      await this.writeBatch(devices);
      logger.debug({ count: devices.length }, 'Flushed heartbeats to database');
    } catch (error: any) {
      logger.error({ error: error.message, count: devices.length }, 'Failed to write heartbeat batch');
      // Don't re-queue on error - just log and continue
    }
  }

  /**
   * Write a batch of heartbeats to the database
   */
  private async writeBatch(devices: DeviceRecord[]): Promise<void> {
    const client = await this.dbPool.connect();

    try {
      await client.query('BEGIN');

      for (const device of devices) {
        await this.updateControllerHeartbeat(client, device);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update controller last_heartbeat in the database
   */
  private async updateControllerHeartbeat(client: any, device: DeviceRecord): Promise<void> {
    // Determine controller_id from device metadata
    const controllerId = device.uniqueId || device.metadata?.uniqueId;

    if (!controllerId) {
      // No controller ID available - skip
      return;
    }

    // Update the controllers table with last_heartbeat timestamp
    const updateQuery = `
      UPDATE controllers
      SET
        last_heartbeat = $1,
        status = $2,
        firmware_version = COALESCE($3, firmware_version),
        uptime_seconds = $4,
        updated_at = NOW()
      WHERE controller_id = $5
    `;

    const status = device.status === 'online' ? 'active' : 'offline';
    const uptimeSeconds = device.metadata?.uptime_seconds || null;

    await client.query(updateQuery, [
      new Date(device.lastSeen),
      status,
      device.firmwareVersion,
      uptimeSeconds,
      controllerId
    ]);

    // Optionally insert into device_heartbeats table for historical tracking
    // Only if the controller exists and has devices
    const insertHeartbeatQuery = `
      INSERT INTO device_heartbeats (
        device_id,
        mqtt_topic,
        payload,
        online,
        firmware_version,
        uptime_seconds,
        received_at
      )
      SELECT
        d.id,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      FROM devices d
      JOIN controllers c ON d.controller_id = c.id
      WHERE c.controller_id = $7
      LIMIT 1
      ON CONFLICT DO NOTHING
    `;

    const payload = {
      status: device.status,
      healthScore: device.healthScore,
      errorCount: device.errorCount,
      metadata: device.metadata
    };

    try {
      await client.query(insertHeartbeatQuery, [
        device.rawTopics[0] || 'unknown',
        JSON.stringify(payload),
        device.status === 'online',
        device.firmwareVersion,
        uptimeSeconds,
        new Date(device.lastSeen),
        controllerId
      ]);
    } catch (error: any) {
      // Ignore constraint violations (device might not exist yet)
      if (!error.message.includes('violates foreign key constraint')) {
        logger.warn({ error: error.message, controllerId }, 'Failed to insert heartbeat record');
      }
    }
  }

  /**
   * Close database connections
   */
  public async close(): Promise<void> {
    this.stop();
    await this.dbPool.end();
    logger.info('HeartbeatWriter closed');
  }
}
