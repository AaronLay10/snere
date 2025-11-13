import { Router } from 'express';
import { z } from 'zod';
import type { DeviceRegistry } from '../devices/DeviceRegistry';
import type { MQTTManager } from '../mqtt/MQTTManager';
import { TopicBuilder } from '../mqtt/topics';
import type { DeviceCommand } from '../devices/types';

const CommandRequestSchema = z.object({
  command: z.string(),
  payload: z.unknown().optional(),
  roomId: z.string().optional(),
  puzzleId: z.string().optional(),
  category: z.string().optional(),
  topicOverride: z.string().optional()
});

export const devicesRouter = (services: {
  registry: DeviceRegistry;
  mqtt: MQTTManager;
  topicBuilder: TopicBuilder;
}) => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      success: true,
      data: services.registry.listDevices()
    });
  });

  router.get('/:deviceId', (req, res) => {
    const device = services.registry.getDevice(req.params.deviceId.toLowerCase());
    if (!device) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' }
      });
    }

    res.json({ success: true, data: device });
  });

  router.post('/:deviceId/command', async (req, res) => {
    const parseResult = CommandRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COMMAND', message: parseResult.error.message }
      });
    }

    const device = services.registry.getDevice(req.params.deviceId.toLowerCase());
    if (!device) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' }
      });
    }

    const command: DeviceCommand = {
      deviceId: device.id.split('/').pop() ?? device.id,
      roomId: parseResult.data.roomId ?? device.roomId,
      puzzleId: parseResult.data.puzzleId ?? device.puzzleId,
      category: parseResult.data.category,
      command: parseResult.data.command,
      payload: parseResult.data.payload
    };

    const topic =
      parseResult.data.topicOverride ?? services.topicBuilder.commandTopic(command);

    try {
      const payloadBuffer =
        typeof command.payload === 'string'
          ? command.payload
          : JSON.stringify({
              command: command.command,
              payload: command.payload ?? null,
              issuedAt: new Date().toISOString()
            });

      await services.mqtt.publish(topic, payloadBuffer, 1);

      return res.json({
        success: true,
        data: { topic, command: command.command }
      });
    } catch (error: any) {
      services.registry.markCommandError(command);
      return res.status(500).json({
        success: false,
        error: { code: 'MQTT_PUBLISH_FAILED', message: error?.message ?? 'Publish failed' }
      });
    }
  });


  router.delete('/:deviceId', (req, res) => {
    const removed = services.registry.removeDevice(req.params.deviceId);
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' }
      });
    }

    res.json({ success: true });
  });

  return router;
};
