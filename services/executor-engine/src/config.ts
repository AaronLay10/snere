import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ConfigSchema = z.object({
  SERVICE_NAME: z.string().default('scene-orchestrator'),
  SERVICE_PORT: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(3004),
  CORS_ORIGIN: z.string().default('*'),
  TICK_INTERVAL_MS: z
    .string()
    .transform((value) => parseInt(value, 10))
    .or(z.number())
    .default(1000),
  DEVICE_MONITOR_URL: z.string().optional(),
  EFFECTS_CONTROLLER_URL: z.string().optional(),
  DATABASE_URL: z.string().default('postgresql://postgres:password@localhost:5432/paragon'),
  CONFIG_PATH: z.string().default('/opt/paragon/config'),
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPIC_FILTER: z.string().default('paragon/#')
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  SERVICE_PORT: number;
  TICK_INTERVAL_MS: number;
};

export const loadConfig = (): AppConfig => {
  const parsed = ConfigSchema.parse(process.env);
  return {
    ...parsed,
    SERVICE_PORT: Number(parsed.SERVICE_PORT),
    TICK_INTERVAL_MS: Number(parsed.TICK_INTERVAL_MS)
  };
};
