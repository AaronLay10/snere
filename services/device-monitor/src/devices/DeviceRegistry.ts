import { EventEmitter } from 'events';
import { logger } from '../logger';
import {
  DeviceCategory,
  DeviceCommand,
  DeviceMetric,
  DeviceRecord,
  DeviceStatus,
  IncomingMessage,
  SensorReading
} from './types';

const DEFAULT_CATEGORY: DeviceCategory = 'other';

const HEALTH_RECOVERY = 5;
const HEALTH_PENALTY_OFFLINE = 75;
const HEALTH_PENALTY_ERROR = 25;

const pickStringValue = (source: any, keys: string[]): string | undefined => {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

export interface DeviceRegistryOptions {
  heartbeatTimeoutMs: number;
}

export interface DeviceEventPayload {
  device: DeviceRecord;
  message?: IncomingMessage;
}

export declare interface DeviceRegistry {
  on(event: 'device-updated', listener: (payload: DeviceEventPayload) => void): this;
  on(event: 'device-offline', listener: (payload: DeviceEventPayload) => void): this;
  on(event: 'device-online', listener: (payload: DeviceEventPayload) => void): this;
}

export class DeviceRegistry extends EventEmitter {
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly messageRateLimit = new Map<string, { count: number; windowStart: number }>();
  private readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
  private readonly MAX_MESSAGES_PER_WINDOW = 50; // Max 50 messages per device per second (allows startup state bursts from multi-device controllers)

  constructor(private readonly options: DeviceRegistryOptions) {
    super();
  }

  public handleMessage(message: IncomingMessage): void {
    const { topic, receivedAt } = message;
    const topicParts = topic.split('/');
    let offset = 0;
    if (topicParts.length >= 4) {
      const namespace = topicParts[0]?.toLowerCase();
      if (namespace === 'paragon' || namespace === 'mythraos') {
        offset = 1;
      }
    }

    const roomId = topicParts[offset];
    const puzzleId = topicParts[offset + 1];
    const deviceId = topicParts[offset + 2];

    // Rate limiting: prevent message floods from misbehaving devices
    const deviceKey = `${roomId}/${puzzleId}/${deviceId}`.toLowerCase();
    const now = Date.now();
    let rateInfo = this.messageRateLimit.get(deviceKey);

    if (!rateInfo || now - rateInfo.windowStart >= this.RATE_LIMIT_WINDOW_MS) {
      // Start new window
      rateInfo = { count: 1, windowStart: now };
      this.messageRateLimit.set(deviceKey, rateInfo);
    } else {
      rateInfo.count++;

      // Drop message if over limit
      if (rateInfo.count > this.MAX_MESSAGES_PER_WINDOW) {
        // Only log warning once per window (at message #11)
        if (rateInfo.count === this.MAX_MESSAGES_PER_WINDOW + 1) {
          console.warn(`[Rate Limit] Device ${deviceKey} exceeded limit (${this.MAX_MESSAGES_PER_WINDOW}/sec) - dropping excess messages`);
        }
        return; // Drop this message
      }
    }

    const canonicalKey = this.buildDeviceKey(roomId, puzzleId, deviceId);
    const canonicalRecord = this.devices.get(canonicalKey);
    const aliasEntry = Array.from(this.devices.entries()).find(([key, recordEntry]) => {
      if (key === canonicalKey) {
        return false;
      }
      const recordCanonical = (recordEntry.canonicalId ?? recordEntry.id).toLowerCase();
      return recordCanonical === canonicalKey;
    });

    let mapKey = canonicalKey;

    const parsed = this.parsePayload(message.payload);
    const metadata = (parsed && typeof parsed === 'object' && parsed.metadata && typeof parsed.metadata === 'object')
      ? (parsed.metadata as Record<string, unknown>)
      : {};

    const uniqueIdValue = pickStringValue(parsed, ['uniqueId', 'uid']) ?? pickStringValue(metadata, ['uniqueId', 'uid']);
    const firmwareVersionValue = pickStringValue(parsed, ['firmwareVersion', 'fw']) ?? pickStringValue(metadata, ['firmwareVersion', 'fw']);
    const displayNameValue = pickStringValue(parsed, ['displayName']) ?? pickStringValue(metadata, ['displayName']);
    const hardwareValue = pickStringValue(parsed, ['hardware', 'hw']) ?? pickStringValue(metadata, ['hardware', 'hw']);
    const roomLabelValue = pickStringValue(parsed, ['room', 'roomLabel']) ?? pickStringValue(metadata, ['roomLabel', 'room']);
    const puzzleLabelValue = pickStringValue(parsed, ['puzzle', 'pz']) ?? pickStringValue(metadata, ['puzzleId', 'puzzle']);
    const puzzleStatusValue = pickStringValue(parsed, ['state', 'puzzleStatus']) ?? pickStringValue(metadata, ['puzzleStatus', 'state']);
    const reportedStatusValue = pickStringValue(parsed, ['status']) ?? pickStringValue(metadata, ['status']);

    const uniqueId = uniqueIdValue ? uniqueIdValue.toLowerCase() : undefined;

    if (uniqueId) {
      mapKey = uniqueId;
      if (mapKey !== canonicalKey && canonicalRecord) {
        this.devices.delete(canonicalKey);
      }
    } else if (aliasEntry) {
      mapKey = aliasEntry[0];
      if (canonicalRecord && mapKey !== canonicalKey) {
        this.devices.delete(canonicalKey);
      }
    }

    const record = this.devices.get(mapKey) ?? this.createRecord(mapKey, { roomId, puzzleId, deviceId, canonicalId: canonicalKey });

    // Parse status from message first to determine if this is an actual heartbeat
    const isOfflineMessage = reportedStatusValue?.toLowerCase() === 'offline';

    // Only update lastSeen and set online if NOT an explicit offline message
    if (!isOfflineMessage) {
      record.lastSeen = receivedAt;
      record.status = 'online';
      record.healthScore = Math.min(100, record.healthScore + HEALTH_RECOVERY);
    }

    record.canonicalId = canonicalKey;
    if (uniqueId) {
      record.uniqueId = uniqueId;
      record.metadata.uniqueId = uniqueId;
    }

    if (roomId) record.roomId = roomId;
    if (puzzleId) record.puzzleId = puzzleId;
    if (!record.rawTopics.includes(topic)) {
      record.rawTopics.push(topic);
    }

    // Detect sensor/metric topics and extract data
    const topicLower = topic.toLowerCase();
    const isSensorTopic = topicLower.includes('/sensors/');
    const isMetricTopic = topicLower.includes('/metrics/');

    if (parsed) {
      // Handle explicit sensors/metrics arrays
      if (Array.isArray(parsed.metrics)) {
        parsed.metrics.forEach((metric: any) => record.metrics.push(this.toMetric(metric, receivedAt)));
      }

      if (Array.isArray(parsed.sensors)) {
        parsed.sensors.forEach((sensor: any) => record.sensors.push(this.toSensor(sensor, receivedAt)));
      }

      // Handle sensor topics with flat JSON payload (e.g., {"lux": 127, "colorTemp": 1500})
      if (isSensorTopic && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const sensorName = topicParts[topicParts.length - 1] || 'unknown';
        Object.entries(parsed).forEach(([key, value]) => {
          if (key !== 'ts' && key !== 'timestamp' && typeof value === 'number') {
            record.sensors.push(this.toSensor({ name: key, value, sensorType: sensorName }, receivedAt));
          }
        });
      }

      // Handle metric topics with flat JSON payload
      if (isMetricTopic && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const metricName = topicParts[topicParts.length - 1] || 'unknown';
        Object.entries(parsed).forEach(([key, value]) => {
          if (key !== 'ts' && key !== 'timestamp' && typeof value === 'number') {
            record.metrics.push(this.toMetric({ name: key, value, unit: metricName }, receivedAt));
          }
        });
      }

      if (Object.keys(metadata).length > 0) {
        record.metadata = { ...record.metadata, ...metadata };
      }

      const applyPuzzleStatus = (value: string | undefined) => {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return;
        }
        const trimmed = value.trim();
        record.puzzleStatus = trimmed;
        record.puzzleStatusUpdatedAt = receivedAt;
        record.metadata.puzzleStatus = trimmed;
        record.metadata.state = trimmed;
      };

      if (puzzleStatusValue) {
        applyPuzzleStatus(puzzleStatusValue);
      }

      if (firmwareVersionValue) {
        record.firmwareVersion = firmwareVersionValue;
        record.metadata.firmwareVersion = firmwareVersionValue;
      }

      if (displayNameValue) {
        record.displayName = displayNameValue;
        record.metadata.displayName = displayNameValue;
      }

      if (hardwareValue) {
        record.metadata.hardware = hardwareValue;
      }

      if (roomLabelValue) {
        record.metadata.roomLabel = roomLabelValue;
      }

      if (puzzleLabelValue) {
        record.metadata.puzzleId = puzzleLabelValue;
      }

      if (reportedStatusValue) {
        const normalized = reportedStatusValue.toLowerCase();
        if (normalized === 'online' || normalized === 'offline' || normalized === 'degraded' || normalized === 'unknown') {
          const previousStatus = record.status;
          record.status = normalized as DeviceStatus;
          record.metadata.status = normalized;

          // Emit specific event when transitioning to offline
          if (normalized === 'offline' && previousStatus !== 'offline') {
            this.devices.set(mapKey, record);
            this.emit('device-offline', { device: record, message });
            return; // Early return - don't emit device-updated
          }
        } else {
          applyPuzzleStatus(reportedStatusValue);
        }
      }
    }

    if (!record.metadata.status) {
      record.metadata.status = record.status;
    }

    this.devices.set(mapKey, record);
    this.emit('device-updated', { device: record, message });
  }

  public markCommandError(command: DeviceCommand): void {
    const key = this.buildDeviceKey(command.roomId, command.puzzleId, command.deviceId);
    const record = this.devices.get(key);
    if (!record) {
      return;
    }

    record.errorCount += 1;
    record.healthScore = Math.max(0, record.healthScore - HEALTH_PENALTY_ERROR);
    this.devices.set(key, record);
    this.emit('device-updated', { device: record });
  }

  public performHealthSweep(now = Date.now()): void {
    for (const [key, record] of this.devices.entries()) {
      const timeSinceLastSeen = now - record.lastSeen;
      if (timeSinceLastSeen > this.options.heartbeatTimeoutMs && record.status !== 'offline') {
        record.status = 'offline';
        record.healthScore = Math.max(0, record.healthScore - HEALTH_PENALTY_OFFLINE);
        this.devices.set(key, record);
        this.emit('device-offline', { device: record });
        logger.warn(
          {
            deviceId: record.id,
            roomId: record.roomId,
            lastSeen: record.lastSeen,
            timeoutMs: this.options.heartbeatTimeoutMs
          },
          'Device marked offline after heartbeat timeout'
        );
      }
    }
  }

  public removeDevice(id: string): boolean {
    const key = id.toLowerCase();
    const direct = this.devices.get(key);
    if (direct) {
      this.devices.delete(key);
      logger.info({ deviceId: key }, 'Device removed from registry');
      return true;
    }

    for (const [mapKey, record] of this.devices.entries()) {
      const canonical = (record.canonicalId ?? record.id).toLowerCase();
      if (canonical === key) {
        this.devices.delete(mapKey);
        logger.info({ deviceId: mapKey }, 'Device removed from registry');
        return true;
      }
    }

    return false;
  }

  public listDevices(): DeviceRecord[] {
    return Array.from(this.devices.values()).map((record) => ({
      ...record,
      id: record.canonicalId ?? record.id,
      metrics: record.metrics.slice(-20),
      sensors: record.sensors.slice(-20)
    }));
  }

  public getDevice(id: string): DeviceRecord | undefined {
    const key = id.toLowerCase();
    const direct = this.devices.get(key);
    if (direct) {
      return direct;
    }
    return Array.from(this.devices.values()).find((record) =>
      (record.canonicalId ?? record.id).toLowerCase() === key
    );
  }

  public toSummary() {
    const devices = this.listDevices();
    const total = devices.length;
    const online = devices.filter((device) => device.status === 'online').length;
    const offline = devices.filter((device) => device.status === 'offline').length;
    const degraded = devices.filter((device) => device.status === 'degraded').length;

    return { total, online, offline, degraded };
  }

  private createRecord(key: string, ids: { roomId?: string; puzzleId?: string; deviceId?: string; canonicalId?: string }): DeviceRecord {
    const now = Date.now();
    const canonicalId = ids.canonicalId ?? this.buildDeviceKey(ids.roomId, ids.puzzleId, ids.deviceId);
    const record: DeviceRecord = {
      id: canonicalId,
      roomId: ids.roomId,
      puzzleId: ids.puzzleId,
      category: DEFAULT_CATEGORY,
      status: 'unknown',
      lastSeen: now,
      firstSeen: now,
      errorCount: 0,
      healthScore: 100,
      metrics: [],
      sensors: [],
      metadata: {},
      rawTopics: [],
      uniqueId: key !== canonicalId ? key : undefined,
      firmwareVersion: undefined,
      canonicalId,
      puzzleStatus: undefined,
      puzzleStatusUpdatedAt: undefined
    };

    this.devices.set(key, record);
    this.emit('device-online', { device: record });
    return record;
  }

  private buildDeviceKey(roomId?: string, puzzleId?: string, deviceId?: string): string {
    if (roomId && puzzleId && deviceId) {
      return `${roomId}/${puzzleId}/${deviceId}`.toLowerCase();
    }

    return [roomId, puzzleId, deviceId].filter(Boolean).join('/').toLowerCase();
  }

  private parsePayload(payload: Buffer): any | undefined {
    const text = payload.toString();
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private toMetric(metric: any, recordedAt: number): DeviceMetric {
    const entry: DeviceMetric = {
      name: String(metric.name ?? metric.id ?? 'metric'),
      value: metric.value ?? metric.data ?? null,
      recordedAt
    };
    if (typeof metric.unit === 'string') {
      entry.unit = metric.unit;
    }
    return entry;
  }

  private toSensor(sensor: any, recordedAt: number) {
    return {
      name: String(sensor.name ?? sensor.id ?? 'sensor'),
      value: sensor.value ?? sensor.reading ?? sensor,
      recordedAt
    };
  }
}
