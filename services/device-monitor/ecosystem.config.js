module.exports = {
  apps: [{
    name: 'sentient-device-monitor',
    script: './dist/index.js',
    cwd: '/opt/sentient/services/device-monitor',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      TZ: 'America/Phoenix',
      SERVICE_NAME: 'device-monitor',
      SERVICE_PORT: 3003,
      MQTT_URL: 'mqtt://localhost:1883',
      MQTT_TOPIC_FILTER: '#',
      MQTT_CLIENT_ID: 'device-monitor',
      DEVICE_HEARTBEAT_TIMEOUT_MS: 30000,
      HEALTH_SWEEP_INTERVAL_MS: 10000,
      PUZZLE_ENGINE_URL: 'http://localhost:3004',
      API_BASE_URL: 'http://localhost:3000',
      SERVICE_AUTH_TOKEN: '7b533ca8477fa1593a14723dd67dc746f222da78dde6e4402e7f3915a79d4a56'
    }
  }]
};
