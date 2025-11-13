/**
 * MQTT Client Configuration
 * Singleton MQTT client for publishing commands to devices
 */

const mqtt = require('mqtt');
const logger = require('./logger');

class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connecting = false;
  }

  /**
   * Connect to MQTT broker
   */
  connect() {
    if (this.connected || this.connecting) {
      return this.client;
    }

    this.connecting = true;

    const brokerUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
    const options = {
      clientId: `sentient-api-${Date.now()}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    };

    if (process.env.MQTT_USERNAME) {
      options.username = process.env.MQTT_USERNAME;
      options.password = process.env.MQTT_PASSWORD;
    }

    logger.info(`Connecting to MQTT broker at ${brokerUrl}...`);

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      this.connected = true;
      this.connecting = false;
      logger.info('Connected to MQTT broker');
    });

    this.client.on('disconnect', () => {
      this.connected = false;
      logger.warn('Disconnected from MQTT broker');
    });

    this.client.on('error', (error) => {
      logger.error('MQTT client error:', error);
      this.connecting = false;
    });

    this.client.on('offline', () => {
      this.connected = false;
      logger.warn('MQTT client offline');
    });

    return this.client;
  }

  /**
   * Publish a command to a device
   * @param {string} topic - MQTT topic
   * @param {object|string} payload - Command payload
   * @param {object} options - MQTT publish options
   * @returns {Promise<void>}
   */
  async publishCommand(topic, payload, options = {}) {
    if (!this.client || !this.connected) {
      this.connect();

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MQTT connection timeout'));
        }, 5000);

        if (this.connected) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        this.client.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }

    return new Promise((resolve, reject) => {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

      this.client.publish(topic, payloadStr, { qos: options.qos || 1 }, (error) => {
        if (error) {
          logger.error(`Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          logger.info(`Published command to ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
      this.connecting = false;
      logger.info('Disconnected from MQTT broker');
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const mqttClient = new MQTTClient();

// Connect on module load
if (process.env.NODE_ENV !== 'test') {
  mqttClient.connect();
}

module.exports = mqttClient;
