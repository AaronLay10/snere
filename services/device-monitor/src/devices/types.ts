export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export type DeviceCategory = 'puzzle' | 'system' | 'lighting' | 'audio' | 'other';

export interface DeviceMetric {
  name: string;
  value: number;
  unit?: string;
  recordedAt: number;
}

export interface SensorReading {
  name: string;
  value: unknown;
  recordedAt: number;
}

export interface DeviceRecord {
  id: string;
  roomId?: string;
  puzzleId?: string;
  category: DeviceCategory;
  status: DeviceStatus;
  lastSeen: number;
  firstSeen: number;
  errorCount: number;
  healthScore: number;
  metrics: DeviceMetric[];
  sensors: SensorReading[];
  metadata: Record<string, unknown>;
  rawTopics: string[];
  uniqueId?: string;
  firmwareVersion?: string;
  canonicalId?: string;
  displayName?: string;
  puzzleStatus?: string;
  puzzleStatusUpdatedAt?: number;
}

export interface IncomingMessage {
  topic: string;
  payload: Buffer;
  receivedAt: number;
}

export interface DeviceCommand {
  deviceId: string;
  command: string;
  payload?: unknown;
  roomId?: string;
  puzzleId?: string;
  category?: string;
}
