export interface DeviceRecord {
  id: string;
  canonicalId?: string;
  uniqueId?: string;
  displayName?: string;
  firmwareVersion?: string;
  roomId?: string;
  puzzleId?: string;
  category?: 'puzzle' | 'system' | 'lighting' | 'audio' | 'other';
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  healthScore?: number;
  lastSeen?: number;
  firstSeen?: number;
  errorCount?: number;
  puzzleStatus?: string;
  puzzleStatusUpdatedAt?: number;
  metrics?: Array<{ name: string; value: number; unit?: string; recordedAt: number }>;
  sensors?: Array<{ name: string; value: unknown; recordedAt: number }>;
  metadata?: Record<string, unknown>;
  rawTopics?: string[];
}

export interface DeviceListResponse {
  success: boolean;
  data: DeviceRecord[];
}

export type PuzzleState = 'inactive' | 'waiting' | 'active' | 'solved' | 'failed' | 'timeout' | 'error';

export interface PuzzleRuntime {
  id: string;
  name: string;
  roomId: string;
  description?: string;
  state: PuzzleState;
  timeStarted?: number;
  timeCompleted?: number;
  attempts?: number;
  timeLimitMs?: number;
  prerequisites?: string[];
  outputs?: string[];
  lastUpdated?: number;
  metadata?: Record<string, any>;
}

export interface PuzzleListResponse {
  success: boolean;
  data: PuzzleRuntime[];
}

export interface ServiceEntry {
  id: string;
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  lastCheckedAt: number | null;
  lastHealthyAt: number | null;
}

export interface ServicesResponse {
  success: boolean;
  data: ServiceEntry[];
}
