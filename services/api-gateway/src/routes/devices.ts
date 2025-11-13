import { Router } from 'express';
import createError from 'http-errors';
import type { DeviceMonitorClient } from '../clients/DeviceMonitorClient';

export const devicesRouter = (client?: DeviceMonitorClient) => {
  const router = Router();

  const ensureClient = () => {
    if (!client) {
      throw createError(503, 'Device Monitor not configured');
    }
    return client;
  };

  router.get('/', async (_req, res, next) => {
    try {
      const data = await ensureClient().listDevices();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:deviceId', async (req, res, next) => {
    try {
      const data = await ensureClient().getDevice(req.params.deviceId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });


  router.delete('/:deviceId', async (req, res, next) => {
    try {
      const data = await ensureClient().deleteDevice(req.params.deviceId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:deviceId/command', async (req, res, next) => {
    try {
      const data = await ensureClient().sendCommand(req.params.deviceId, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
