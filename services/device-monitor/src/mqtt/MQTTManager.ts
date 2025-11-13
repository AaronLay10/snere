import EventEmitter from 'events';
import { connect, IClientOptions, MqttClient } from 'mqtt';
import { logger } from '../logger';
import type { IncomingMessage } from '../devices/types';

export interface MQTTConfig {
  url: string;
  username?: string;
  password?: string;
  clientId?: string;
  topicFilter: string;
}

export declare interface MQTTManager {
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: (error?: Error) => void): this;
  on(event: 'message', listener: (message: IncomingMessage) => void): this;
}

export class MQTTManager extends EventEmitter {
  private client?: MqttClient;

  constructor(private readonly config: MQTTConfig) {
    super();
  }

  public async start(): Promise<void> {
    if (this.client) {
      return;
    }

    const options: IClientOptions = {
      clientId: this.config.clientId ?? `device-monitor-${Math.random().toString(16).slice(2)}`,
      username: this.config.username,
      password: this.config.password,
      reconnectPeriod: 5_000,
      keepalive: 60
    };

    logger.info({ url: this.config.url, topicFilter: this.config.topicFilter }, 'Connecting to MQTT broker');

    this.client = connect(this.config.url, options);

    this.client.on('connect', () => {
      logger.info('MQTT connection established');
      this.client?.subscribe(this.config.topicFilter, { qos: 1 }, (error) => {
        if (error) {
          logger.error({ err: error }, 'Failed to subscribe to topic filter');
          return;
        }
        logger.info({ topicFilter: this.config.topicFilter }, 'Subscribed to topic filter');
      });
      this.emit('connected');
    });

    this.client.on('reconnect', () => {
      logger.warn('Reconnecting to MQTT broker');
    });

    this.client.on('error', (error) => {
      logger.error({ err: error }, 'MQTT client error');
      this.emit('disconnected', error);
    });

    this.client.on('close', () => {
      logger.warn('MQTT connection closed');
      this.emit('disconnected');
    });

    this.client.on('message', (topic, payload) => {
      const message: IncomingMessage = {
        topic,
        payload,
        receivedAt: Date.now()
      };
      this.emit('message', message);
    });
  }

  public publish(topic: string, payload: string | Buffer, qos: 0 | 1 | 2 = 1): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('MQTT client not connected'));
      }

      this.client.publish(topic, payload, { qos }, (error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

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
