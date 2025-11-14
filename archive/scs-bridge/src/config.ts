export interface Config {
  SERVICE_NAME: string;
  SERVICE_PORT: number;
  MQTT_URL: string;
  MQTT_USERNAME?: string;
  MQTT_PASSWORD?: string;
  MQTT_CLIENT_ID: string;
  MQTT_TOPIC_FILTER: string;
  SCS_HOST: string;
  SCS_HOST_BACKUP?: string;
  SCS_PORT: number;
  CORS_ORIGIN: string;
}

export function loadConfig(): Config {
  return {
    SERVICE_NAME: process.env.SERVICE_NAME || 'scs-bridge',
    SERVICE_PORT: parseInt(process.env.SERVICE_PORT || '3006', 10),
    MQTT_URL: process.env.MQTT_URL || 'mqtt://localhost:1883',
    MQTT_USERNAME: process.env.MQTT_USERNAME,
    MQTT_PASSWORD: process.env.MQTT_PASSWORD,
    MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'scs-bridge',
    MQTT_TOPIC_FILTER: process.env.MQTT_TOPIC_FILTER || 'paragon/+/Audio/commands/#',
    SCS_HOST: process.env.SCS_HOST || '192.168.20.114',
    SCS_HOST_BACKUP: process.env.SCS_HOST_BACKUP,
    SCS_PORT: parseInt(process.env.SCS_PORT || '5000', 10),
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
  };
}
