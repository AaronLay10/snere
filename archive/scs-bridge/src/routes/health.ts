import { Router, Request, Response } from 'express';

export function createHealthRouter(getHealthStatus: () => any): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const status = getHealthStatus();
    const httpStatus = status.healthy ? 200 : 503;
    res.status(httpStatus).json(status);
  });

  router.get('/ready', (_req: Request, res: Response) => {
    const status = getHealthStatus();
    const ready = status.mqtt?.connected && status.osc?.connected;
    res.status(ready ? 200 : 503).json({ ready, ...status });
  });

  return router;
}
