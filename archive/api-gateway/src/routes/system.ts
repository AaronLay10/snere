import { Router } from 'express';
import type { ServiceRegistry } from '../registry/ServiceRegistry';

export const systemRouter = (registry: ServiceRegistry) => {
  const router = Router();

  router.get('/services', (_req, res) => {
    res.json({
      success: true,
      data: registry.list()
    });
  });

  return router;
};
