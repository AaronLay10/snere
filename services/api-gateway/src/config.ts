import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ConfigSchema = z.object({
  SERVICE_NAME: z.string().default('api-gateway'),
  SERVICE_PORT: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(3000),
  CORS_ORIGIN: z.string().default('*'),
  SERVICE_REGISTRY_REFRESH_MS: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(15_000),
  DOWNSTREAM_TIMEOUT_MS: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(10_000),
  DEVICE_MONITOR_URL: z.string().optional(),
  PUZZLE_ENGINE_URL: z.string().optional(),
  EFFECTS_CONTROLLER_URL: z.string().optional(),
  ALERT_ENGINE_URL: z.string().optional(),
  MQTT_BROKER_URL: z.string().default('mqtt://mqtt:1883')
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  SERVICE_PORT: number;
  SERVICE_REGISTRY_REFRESH_MS: number;
  DOWNSTREAM_TIMEOUT_MS: number;
};

export const loadConfig = (): AppConfig => {
  const parsed = ConfigSchema.parse(process.env);
  return {
    ...parsed,
    SERVICE_PORT: Number(parsed.SERVICE_PORT),
    SERVICE_REGISTRY_REFRESH_MS: Number(parsed.SERVICE_REGISTRY_REFRESH_MS),
    DOWNSTREAM_TIMEOUT_MS: Number(parsed.DOWNSTREAM_TIMEOUT_MS)
  };
};
