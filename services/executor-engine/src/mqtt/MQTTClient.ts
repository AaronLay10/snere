import EventEmitter from 'events';
import { connect, IClientOptions, MqttClient } from 'mqtt';
import { logger } from '../logger';

export interface MQTTConfig {
  url: string;
  username?: string;
  password?: string;
  clientId?: string;
  topicFilter: string;
}

export interface SensorMessage {
  topic: string;
  deviceId: string;
  sensorName: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export declare interface MQTTClientManager {
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: (error?: Error) => void): this;
  on(event: 'sensor-data', listener: (message: SensorMessage) => void): this;
  on(event: 'device-state', listener: (message: SensorMessage) => void): this;
}

/**
 * MQTT Client for Scene Orchestrator
 *
 * Subscribes to sensor data and device state changes to:
 * - Evaluate puzzle win conditions
 * - Trigger automatic scene transitions
 * - Monitor device health for safety checks
 */
export class MQTTClientManager extends EventEmitter {
  private client?: MqttClient;

  constructor(private readonly config: MQTTConfig) {
    super();
  }

  public async start(): Promise<void> {
    if (this.client) {
      logger.warn('MQTT client already started');
      return;
    }

    const options: IClientOptions = {
      clientId: this.config.clientId ?? `scene-orchestrator-${Math.random().toString(16).slice(2)}`,
      username: this.config.username,
      password: this.config.password,
      reconnectPeriod: 5_000,
      keepalive: 60
    };

    logger.info(
      { url: this.config.url, topicFilter: this.config.topicFilter },
      'Connecting to MQTT broker (Scene Orchestrator)'
    );

    this.client = connect(this.config.url, options);

    this.client.on('connect', () => {
      logger.info('Scene Orchestrator MQTT connection established');
      this.client?.subscribe(this.config.topicFilter, { qos: 1 }, (error) => {
        if (error) {
          logger.error({ err: error }, 'Failed to subscribe to topic filter');
          return;
        }
        logger.info({ topicFilter: this.config.topicFilter }, 'Scene Orchestrator subscribed to topic filter');
      });
      this.emit('connected');
    });

    this.client.on('reconnect', () => {
      logger.warn('Reconnecting to MQTT broker (Scene Orchestrator)');
    });

    this.client.on('error', (error) => {
      logger.error({ err: error }, 'Scene Orchestrator MQTT client error');
      this.emit('disconnected', error);
    });

    this.client.on('close', () => {
      logger.warn('Scene Orchestrator MQTT connection closed');
      this.emit('disconnected');
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });
  }

  /**
   * Parse and route MQTT messages
   */
  private handleMessage(topic: string, payload: Buffer): void {
    const topicParts = topic.split('/');

    // Determine message type and offset for namespace
    let offset = 0;
    if (topicParts.length >= 6) {
      const namespace = topicParts[0]?.toLowerCase();
      if (namespace === 'paragon' || namespace === 'mythraos') {
        offset = 1;
      }
    }

    // Topic structure: [namespace]/room/controller/device_type/message_type/specific
    const messageType = topicParts[offset + 3]?.toLowerCase(); // 'sensors' or 'state'
    const specificTopic = topicParts[offset + 4]; // 'ColorSensor', 'Hardware', etc.

    // Only process sensor and state messages
    if (messageType !== 'sensors' && messageType !== 'state') {
      return;
    }

    // Validate payload is not empty
    const payloadStr = payload.toString();
    if (!payloadStr || payloadStr.trim().length === 0) {
      return;
    }

    try {
      const data = JSON.parse(payloadStr);

      // Extract device ID from topic (controller name)
      const controllerName = topicParts[offset + 1]; // e.g., "PilotLight_v2"

      const sensorMessage: SensorMessage = {
        topic,
        deviceId: controllerName,
        sensorName: specificTopic,
        payload: data,
        receivedAt: Date.now()
      };

      // Emit based on message type
      if (messageType === 'sensors') {
        this.emit('sensor-data', sensorMessage);
        logger.debug(
          { deviceId: controllerName, sensorName: specificTopic, data },
          'Sensor data received'
        );
      } else if (messageType === 'state') {
        this.emit('device-state', sensorMessage);
        logger.debug(
          { deviceId: controllerName, stateName: specificTopic, data },
          'Device state received'
        );
      }
    } catch (error) {
      logger.error(
        { topic, error: (error as Error).message },
        'Failed to parse MQTT sensor message'
      );
    }
  }

  /**
   * Publish a command to a device
   */
  public publish(topic: string, payload: string | Buffer | object, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('MQTT client not connected'));
      }

      const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;

      this.client.publish(topic, payloadStr, { qos }, (error) => {
        if (error) {
          logger.error({ topic, error }, 'Failed to publish MQTT message');
          return reject(error);
        }
        logger.debug({ topic }, 'Published MQTT message');
        resolve();
      });
    });
  }

  /**
   * Check if MQTT client is connected
   */
  public isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * Stop MQTT client
   */
  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    logger.info('Stopping Scene Orchestrator MQTT client');

    await new Promise<void>((resolve, reject) => {
      this.client?.end(false, {}, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    this.client = undefined;
  }
}
