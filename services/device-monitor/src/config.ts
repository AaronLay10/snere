import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ConfigSchema = z.object({
  SERVICE_NAME: z.string().default('device-monitor'),
  SERVICE_PORT: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(3003),
  MQTT_URL: z.string().default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().optional(),
  MQTT_TOPIC_FILTER: z.string().default('#'),  // Listen to ALL topics (includes paragon/# AND sentient/#)
  DEVICE_HEARTBEAT_TIMEOUT_MS: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(5_000), // 5 seconds - critical for player safety
  HEALTH_SWEEP_INTERVAL_MS: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(2_000), // Check every 2 seconds for offline devices
  PUZZLE_ENGINE_URL: z.string().optional()
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  SERVICE_PORT: number;
  DEVICE_HEARTBEAT_TIMEOUT_MS: number;
  HEALTH_SWEEP_INTERVAL_MS: number;
};

export const loadConfig = (): AppConfig => {
  const parsed = ConfigSchema.parse(process.env);
  return {
    ...parsed,
    SERVICE_PORT: Number(parsed.SERVICE_PORT),
    DEVICE_HEARTBEAT_TIMEOUT_MS: Number(parsed.DEVICE_HEARTBEAT_TIMEOUT_MS),
    HEALTH_SWEEP_INTERVAL_MS: Number(parsed.HEALTH_SWEEP_INTERVAL_MS)
  };
};
