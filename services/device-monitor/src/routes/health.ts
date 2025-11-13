import { Router } from 'express';
import type { DeviceRegistry } from '../devices/DeviceRegistry';
import type { MQTTManager } from '../mqtt/MQTTManager';
import os from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
const VERSION = packageJson.version;

export const healthRouter = (services: {
  registry: DeviceRegistry;
  mqtt: MQTTManager;
  startedAt: number;
}) => {
  const router = Router();

  router.get('/', (_req, res) => {
    const uptimeMs = Date.now() - services.startedAt;
    res.json({
      status: 'ok',
      service: 'device-monitor',
      version: VERSION,
      uptimeMs,
      uptimeHuman: `${Math.round(uptimeMs / 1000)}s`,
      devices: services.registry.toSummary(),
      system: {
        hostname: os.hostname(),
        loadAverage: os.loadavg(),
        rssBytes: process.memoryUsage().rss
      }
    });
  });

  return router;
};
