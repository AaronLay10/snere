import { Server as HttpServer } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { logger } from '../logger';
import type { DeviceRegistry } from '../devices/DeviceRegistry';
import type { DeviceStateManager } from '../state/DeviceStateManager';

export class WebSocketServer {
  private wss: WSServer;
  private clients = new Set<WebSocket>();

  constructor(
    private readonly server: HttpServer,
    private readonly registry: DeviceRegistry,
    private readonly stateManager?: DeviceStateManager
  ) {
    this.wss = new WSServer({ server });
    logger.info('WebSocket server initialized on HTTP server');
    this.setupWebSocketServer();
    this.setupRegistryListeners();
    if (stateManager) {
      this.setupStateManagerListeners();
    }
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logger.info('WebSocket client connected');

      // Send initial device list
      const devices = this.registry.listDevices();
      this.sendToClient(ws, {
        type: 'initial',
        data: devices
      });

      // Send all cached device states to new client
      if (this.stateManager) {
        const cachedStates = (this.stateManager as any).stateCache;
        if (cachedStates && cachedStates instanceof Map) {
          cachedStates.forEach((deviceState: any, deviceKey: string) => {
            // Parse deviceKey to extract controllerId and deviceId
            // deviceKey format: "clockwork/power_control_upper_right/lever_boiler_5v"
            const parts = deviceKey.split('/');
            const controllerId = parts.length >= 2 ? parts[1] : undefined;
            const deviceId = parts.length >= 3 ? parts[2] : undefined;

            if (controllerId && deviceId) {
              this.sendToClient(ws, {
                type: 'state-update',
                data: {
                  controllerId,
                  deviceId,
                  state: deviceState.state,
                  timestamp: deviceState.updatedAt.getTime()
                }
              });
            }
          });
          logger.info({ stateCount: cachedStates.size }, 'Sent cached states to new client');
        }
      }

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ err: error }, 'WebSocket client error');
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket server error');
    });
  }

  private setupRegistryListeners(): void {
    // Use throttling to prevent broadcast storms
    const throttledBroadcasts = new Map<string, number>();
    const THROTTLE_MS = 500; // Only broadcast changes for same device every 500ms

    this.registry.on('device-updated', ({ device }) => {
      const deviceKey = device.id || device.uniqueId || 'unknown';
      const now = Date.now();
      const lastBroadcast = throttledBroadcasts.get(deviceKey) || 0;

      // Only broadcast if enough time has passed since last broadcast for this device
      if (now - lastBroadcast >= THROTTLE_MS) {
        throttledBroadcasts.set(deviceKey, now);
        this.broadcast({
          type: 'device-updated',
          data: device
        });
      }
    });

    this.registry.on('device-online', ({ device }) => {
      // Always broadcast online events immediately (safety-critical)
      this.broadcast({
        type: 'device-online',
        data: device
      });
    });

    this.registry.on('device-offline', ({ device }) => {
      // Always broadcast offline events immediately (safety-critical)
      this.broadcast({
        type: 'device-offline',
        data: device
      });
    });
  }

  private setupStateManagerListeners(): void {
    if (!this.stateManager) return;

    // Broadcast sensor data updates
    this.stateManager.on('sensor-data', (data) => {
      this.broadcast({
        type: 'sensor-data',
        data
      });
    });

    // Broadcast device state updates
    this.stateManager.on('state-update', (data) => {
      this.broadcast({
        type: 'state-update',
        data
      });
    });
  }

  public broadcast(message: any): void {
    const payload = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    });

    if (sent > 0) {
      logger.info({ type: message.type, clients: sent, deviceId: message.data?.id }, 'Broadcast to WebSocket clients');
    }
  }

  private sendToClient(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  public close(): void {
    this.clients.forEach((client) => {
      client.close();
    });
    this.wss.close();
    logger.info('WebSocket server closed');
  }
}
