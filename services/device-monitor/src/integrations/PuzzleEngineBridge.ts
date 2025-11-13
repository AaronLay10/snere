import { DeviceRegistry, DeviceEventPayload } from '../devices/DeviceRegistry';
import { DeviceRecord } from '../devices/types';
import { logger } from '../logger';

interface PuzzleEngineBridgeOptions {
  baseUrl: string;
  dedupeWindowMs?: number;
}

interface TopicContext {
  namespace?: string;
  roomId?: string;
  puzzleId?: string;
  deviceId?: string;
  category?: string;
  item?: string;
  rawCategory?: string;
  rawItem?: string;
}

interface PuzzleEngineEventPayload {
  roomId: string;
  puzzleId: string;
  deviceId: string;
  type: string;
  payload?: unknown;
  receivedAt: number;
}

export class PuzzleEngineBridge {
  private readonly baseUrl: string;
  private readonly dedupeWindowMs: number;
  private readonly lastStateByPuzzle = new Map<string, string>();
  private readonly lastEventAt = new Map<string, number>();

  constructor(private readonly registry: DeviceRegistry, options: PuzzleEngineBridgeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.dedupeWindowMs = options.dedupeWindowMs ?? 1500;
  }

  public start(): void {
    this.registry.on('device-updated', (payload) => {
      this.handleDeviceUpdate(payload).catch((error) => {
        logger.error({ err: error }, 'PuzzleEngineBridge failed processing device update');
      });
    });
    logger.info({ baseUrl: this.baseUrl }, 'PuzzleEngineBridge initialized');
  }

  private async handleDeviceUpdate({ device, message }: DeviceEventPayload): Promise<void> {
    if (!message) {
      return;
    }

    const context = this.extractContext(message.topic);
    if (!context) {
      return;
    }

    const puzzleSlug =
      this.normalizeSlug(context.roomId, context.puzzleId) ??
      this.normalizeSlug(device.roomId, device.puzzleId);
    if (!puzzleSlug) {
      return;
    }

    const roomSlug =
      this.normalizeSlug(context.roomId) ?? this.normalizeSlug(device.roomId);
    if (!roomSlug) {
      return;
    }

    const parsedPayload = this.safeParse(message.payload);
    const deviceId = this.resolveDeviceId(device, context);
    const receivedAt = message.receivedAt;

    if (context.category === 'status' && context.item === 'state' && parsedPayload) {
      const stateRaw = this.pickString(parsedPayload, ['state', 'status']);
      if (stateRaw) {
        const stateKey = `${puzzleSlug}:state`;
        const normalizedState = stateRaw.trim().toLowerCase();
        const previousState = this.lastStateByPuzzle.get(stateKey);
        if (previousState !== normalizedState) {
          this.lastStateByPuzzle.set(stateKey, normalizedState);
          if (normalizedState === 'waitingpilot') {
            await this.emitPuzzleEvent({
              roomId: roomSlug,
              puzzleId: puzzleSlug,
              deviceId,
              type: 'puzzle.start',
              receivedAt,
              payload: {
                source: 'device-state',
                state: stateRaw,
                topic: message.topic,
                data: parsedPayload
              }
            });
          }

          if (normalizedState === 'boilerstartup' || normalizedState === 'iractive') {
            if (this.shouldThrottle(`${puzzleSlug}:solve`)) {
              return;
            }
            await this.emitPuzzleEvent({
              roomId: roomSlug,
              puzzleId: puzzleSlug,
              deviceId,
              type: 'puzzle.solve',
              receivedAt,
              payload: {
                source: 'device-state',
                state: stateRaw,
                topic: message.topic,
                data: parsedPayload
              }
            });
          }
        }
      }
    }

    if (context.category === 'events') {
      const eventNameRaw = context.rawItem ?? context.item ?? '';
      const normalizedEvent = eventNameRaw.trim().toLowerCase();
      if (normalizedEvent === 'pilotlightdetected') {
        if (this.shouldThrottle(`${puzzleSlug}:solve`)) {
          return;
        }
        await this.emitPuzzleEvent({
          roomId: roomSlug,
          puzzleId: puzzleSlug,
          deviceId,
          type: 'puzzle.solve',
          receivedAt,
          payload: {
            source: 'device-event',
            event: eventNameRaw,
            topic: message.topic,
            data: parsedPayload
          }
        });
      }
    }
  }

  private async emitPuzzleEvent(event: PuzzleEngineEventPayload): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        const body = await response.text().catch(() => undefined);
        logger.error(
          {
            eventType: event.type,
            puzzleId: event.puzzleId,
            status: response.status,
            body
          },
          'PuzzleEngineBridge failed to post event'
        );
      } else {
        logger.debug(
          { eventType: event.type, puzzleId: event.puzzleId, roomId: event.roomId },
          'PuzzleEngineBridge forwarded event'
        );
      }
    } catch (error) {
      logger.error({ err: error, eventType: event.type, puzzleId: event.puzzleId }, 'PuzzleEngineBridge error posting event');
    }
  }

  private extractContext(topic: string): TopicContext | undefined {
    if (!topic || topic.length === 0) {
      return undefined;
    }

    const parts = topic.split('/');
    if (parts.length === 0) {
      return undefined;
    }

    let index = 0;
    const namespace = parts[index]?.toLowerCase();
    if (namespace === 'paragon' || namespace === 'mythraos') {
      index += 1;
    }

    const roomId = parts[index];
    const puzzleId = parts[index + 1];
    const deviceId = parts[index + 2];
    const categoryRaw = parts[index + 3];
    const itemRaw = parts[index + 4];

    return {
      namespace,
      roomId,
      puzzleId,
      deviceId,
      category: categoryRaw ? categoryRaw.toLowerCase() : undefined,
      item: itemRaw ? itemRaw.toLowerCase() : undefined,
      rawCategory: categoryRaw,
      rawItem: itemRaw
    };
  }

  private resolveDeviceId(device: DeviceRecord, context: TopicContext): string {
    if (device.uniqueId && device.uniqueId.trim().length > 0) {
      return device.uniqueId;
    }

    const slugged = this.normalizeSlug(context.roomId, context.puzzleId, context.deviceId);
    if (slugged) {
      return slugged;
    }

    if (device.canonicalId && device.canonicalId.trim().length > 0) {
      return device.canonicalId;
    }

    const fallbackSlug = this.normalizeSlug(device.roomId, device.puzzleId, device.id);
    if (fallbackSlug) {
      return fallbackSlug;
    }

    return device.id;
  }

  private normalizeSlug(...segments: Array<string | undefined>): string | undefined {
    const filtered = segments.filter((segment) => segment && segment.trim().length > 0) as string[];
    if (filtered.length === 0) {
      return undefined;
    }

    const normalized = filtered
      .map((segment) =>
        segment
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
      )
      .join('-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalized.length > 0 ? normalized : undefined;
  }

  private shouldThrottle(key: string): boolean {
    const now = Date.now();
    const last = this.lastEventAt.get(key);
    if (last && now - last < this.dedupeWindowMs) {
      return true;
    }
    this.lastEventAt.set(key, now);
    return false;
  }

  private safeParse(buffer: Buffer): any | undefined {
    if (!buffer || buffer.length === 0) {
      return undefined;
    }

    try {
      return JSON.parse(buffer.toString('utf8'));
    } catch {
      return undefined;
    }
  }

  private pickString(source: any, keys: string[]): string | undefined {
    if (!source || typeof source !== 'object') {
      return undefined;
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }
}

