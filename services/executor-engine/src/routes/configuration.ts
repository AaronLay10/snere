import { Router } from 'express';
import { z } from 'zod';
import { ConfigurationLoader } from '../config/ConfigurationLoader';
import { logger } from '../logger';
import { SceneRegistry } from '../scenes/SceneRegistry';

/**
 * Configuration routes - For loading, reloading, and exporting configurations
 */
export const configurationRouter = (configLoader: ConfigurationLoader, registry?: SceneRegistry) => {
  const router = Router();

  // Reload configuration from files
  router.post('/reload', async (req, res) => {
    try {
      logger.info('[CONFIG] Reload requested');
      const result = await configLoader.reload();

      res.json({
        success: result.success,
        message: result.message,
        data: {
          sceneCount: result.sceneCount
        }
      });
    } catch (error) {
      logger.error({ error }, '[CONFIG] Reload failed');
      res.status(500).json({
        success: false,
        error: { code: 'RELOAD_FAILED', message: (error as Error).message }
      });
    }
  });

  // Export current database config to files
  router.post('/export', async (req, res) => {
    try {
      logger.info('[CONFIG] Export requested');
      await configLoader.exportToFiles();

      res.json({
        success: true,
        message: 'Configuration exported to files'
      });
    } catch (error) {
      logger.error({ error }, '[CONFIG] Export failed');
      res.status(500).json({
        success: false,
        error: { code: 'EXPORT_FAILED', message: (error as Error).message }
      });
    }
  });

  // Reload runtime registry from JSON files without restarting the service
  router.post('/reload-runtime', async (req, res) => {
    try {
      if (!registry) {
        return res.status(500).json({
          success: false,
          error: { code: 'NO_REGISTRY', message: 'Scene registry not available for reload' }
        });
      }

      logger.info('[CONFIG] Runtime reload requested');
      const roomConfigs = await configLoader.loadAllRooms();
      let totalScenes = 0;
      const allScenes: any[] = [];

      for (const [roomId, scenes] of roomConfigs.entries()) {
        totalScenes += scenes.length;
        allScenes.push(...scenes);
        logger.info({ roomId, sceneCount: scenes.length }, 'Room scenes prepared for runtime reload');
      }

      registry.replaceAll(allScenes);

      return res.json({
        success: true,
        message: `Runtime reloaded with ${totalScenes} scenes`,
        data: { sceneCount: totalScenes }
      });
    } catch (error) {
      logger.error({ error }, '[CONFIG] Runtime reload failed');
      return res.status(500).json({
        success: false,
        error: { code: 'RUNTIME_RELOAD_FAILED', message: (error as Error).message }
      });
    }
  });

  // Load specific room configuration
  router.post('/rooms/:roomId/load', async (req, res) => {
    try {
      logger.info({ roomId: req.params.roomId }, '[CONFIG] Room load requested');
      const scenes = await configLoader.loadRoom(req.params.roomId);

      res.json({
        success: true,
        message: `Loaded ${scenes.length} scenes for room ${req.params.roomId}`,
        data: {
          roomId: req.params.roomId,
          sceneCount: scenes.length
        }
      });
    } catch (error) {
      logger.error({ roomId: req.params.roomId, error }, '[CONFIG] Room load failed');
      res.status(500).json({
        success: false,
        error: { code: 'LOAD_FAILED', message: (error as Error).message }
      });
    }
  });

  return router;
};
