import { Router } from 'express';
import { z } from 'zod';
import { EventBus } from '../events/EventBus';

const DeviceEventSchema = z.object({
  roomId: z.string(),
  puzzleId: z.string(),
  deviceId: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
  receivedAt: z.number().optional()
});

export const eventsRouter = (bus: EventBus) => {
  const router = Router();

  router.post('/', (req, res) => {
    const parseResult = DeviceEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT', message: parseResult.error.message }
      });
    }

    const event = {
      ...parseResult.data,
      receivedAt: parseResult.data.receivedAt ?? Date.now()
    };

    bus.emitDeviceEvent(event);
    res.status(202).json({ success: true });
  });

  return router;
};
