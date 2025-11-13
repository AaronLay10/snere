import mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface MQTTClientConfig {
  url: string;
  clientId: string;
  username?: string;
  password?: string;
  topicFilter: string;
}

export interface AudioCommand {
  command: string;
  cueId?: string;
  durationMs?: number;
  intensity?: number;
  payload?: Record<string, any>;
}

export class MQTTClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private connected = false;

  constructor(private readonly config: MQTTClientConfig) {
    super();
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
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
        logger.info({ url: this.config.url, clientId: this.config.clientId }, 'SCS Bridge MQTT connected');

        this.client!.subscribe(this.config.topicFilter, (err) => {
          if (err) {
            logger.error({ err, topicFilter: this.config.topicFilter }, 'Failed to subscribe to MQTT topic');
            reject(err);
          } else {
            logger.info({ topicFilter: this.config.topicFilter }, 'Subscribed to MQTT audio commands');
            resolve();
          }
        });
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('error', (error) => {
        logger.error({ err: error }, 'SCS Bridge MQTT error');
        this.emit('error', error);
      });

      this.client.on('offline', () => {
        this.connected = false;
        logger.warn('SCS Bridge MQTT offline');
      });

      this.client.on('reconnect', () => {
        logger.info('SCS Bridge MQTT reconnecting...');
      });
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = JSON.parse(payload.toString());
      logger.debug({ topic, message }, 'Received MQTT audio command');

      // Parse topic: paragon/{Room}/Audio/commands/{action}
      const parts = topic.split('/');
      if (parts.length < 5 || parts[2] !== 'Audio' || parts[3] !== 'commands') {
        logger.warn({ topic }, 'Invalid audio command topic format');
        return;
      }

      const room = parts[1];
      const action = parts[4];

      const audioCommand: AudioCommand = {
        command: action,
        ...message
      };

      this.emit('audioCommand', { room, action, command: audioCommand });
    } catch (error) {
      logger.error({ err: error, topic }, 'Failed to parse MQTT message');
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.connected = false;
          logger.info('SCS Bridge MQTT disconnected');
          resolve();
        });
      });
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
