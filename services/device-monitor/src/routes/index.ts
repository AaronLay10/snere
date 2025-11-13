import { Router } from 'express';
import type { DeviceRegistry } from '../devices/DeviceRegistry';
import type { MQTTManager } from '../mqtt/MQTTManager';
import type { DeviceStateManager } from '../state/DeviceStateManager';
import { TopicBuilder } from '../mqtt/topics';
import { healthRouter } from './health';
import { devicesRouter } from './devices';

export const buildRoutes = (services: {
  registry: DeviceRegistry;
  mqtt: MQTTManager;
  topicBuilder: TopicBuilder;
  startedAt: number;
  stateManager?: DeviceStateManager;
}) => {
  const router = Router();
  router.use('/health', healthRouter(services));
  router.use('/devices', devicesRouter(services));
  return router;
};
