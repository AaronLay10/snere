import mqtt, { MqttClient } from 'mqtt';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface MQTTPublisherConfig {
  url: string;
  username?: string;
  password?: string;
  clientId: string;
}

export class MQTTPublisher extends EventEmitter {
  private client?: MqttClient;
  private connected = false;

  constructor(private readonly config: MQTTPublisherConfig) {
    super();
  }

  public async start(): Promise<void> {
    const options: mqtt.IClientOptions = {
      clientId: this.config.clientId,
      clean: true,
      reconnectPeriod: 5000
    };

    if (this.config.username) {
      options.username = this.config.username;
    }
    if (this.config.password) {
      options.password = this.config.password;
    }

    this.client = mqtt.connect(this.config.url, options);

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('Effects Controller MQTT client connected');
      this.emit('connected');
    });

    this.client.on('error', (error) => {
      logger.error({ err: error }, 'MQTT client error');
      this.emit('error', error);
    });

    this.client.on('close', () => {
      this.connected = false;
      logger.warn('MQTT client disconnected');
      this.emit('disconnected');
    });
  }

  public async stop(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.connected = false;
          resolve();
        });
      });
    }
  }

  public async publishCommand(topic: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client!.publish(
        topic,
        JSON.stringify(payload),
        { qos: 2, retain: false },
        (error) => {
          if (error) {
            logger.error({ err: error, topic }, 'Failed to publish command');
            reject(error);
          } else {
            logger.debug({ topic, payload }, 'Published command');
            resolve();
          }
        }
      );
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
