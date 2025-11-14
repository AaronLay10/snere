export interface Config {
  SERVICE_NAME: string;
  SERVICE_PORT: number;
  MQTT_URL: string;
  MQTT_USERNAME?: string;
  MQTT_PASSWORD?: string;
  MQTT_CLIENT_ID: string;
  MQTT_TOPIC_FILTER: string;
  CORS_ORIGIN: string;
}

export function loadConfig(): Config {
  return {
    SERVICE_NAME: process.env.SERVICE_NAME || 'effects-controller',
    SERVICE_PORT: parseInt(process.env.SERVICE_PORT || '3005', 10),
    MQTT_URL: process.env.MQTT_URL || 'mqtt://localhost:1883',
    MQTT_USERNAME: process.env.MQTT_USERNAME,
    MQTT_PASSWORD: process.env.MQTT_PASSWORD,
    MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'effects-controller',
    MQTT_TOPIC_FILTER: process.env.MQTT_TOPIC_FILTER || 'paragon/#',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
  };
}
