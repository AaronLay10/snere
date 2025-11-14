/**
 * MQTT Type Definitions
 */

// MQTT topic structure: client/room/category/controller/device/command
export interface MqttTopic {
  client_id: string;
  room_id: string;
  category: 'commands' | 'sensors' | 'status' | 'events';
  controller_id: string;
  device_id: string;
  item: string;
}

// MQTT command payload
export interface MqttCommandPayload {
  command: string;
  device_id: string;
  timestamp: number;
  request_id: string;
  params?: Record<string, any>;
}

// MQTT sensor data
export interface MqttSensorPayload {
  device_id: string;
  sensor_type: string;
  value: any;
  timestamp: number;
  unit?: string;
}

// MQTT status payload
export interface MqttStatusPayload {
  device_id: string;
  status: 'online' | 'offline' | 'error' | 'busy';
  timestamp: number;
  details?: Record<string, any>;
}

// MQTT event payload
export interface MqttEventPayload {
  event_type: string;
  device_id: string;
  timestamp: number;
  data: Record<string, any>;
}

// MQTT client configuration
export interface MqttClientConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
}

// MQTT publish options
export interface MqttPublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
  dup?: boolean;
}
