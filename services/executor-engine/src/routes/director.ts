import { Router } from 'express';
import { z } from 'zod';
import { SceneOrchestratorService } from '../services/SceneOrchestratorService';
import { DatabaseClient } from '../database/DatabaseClient';
import { logger } from '../logger';

// Validation schemas
const DirectorCommandSchema = z.object({
  reason: z.string().optional(),
  executedBy: z.string().optional()
});

/**
 * Director control routes - For manual intervention and control
 */
export const directorRouter = (
  orchestrator: SceneOrchestratorService,
  database: DatabaseClient
) => {
  const router = Router();

  // Middleware to log all director commands
  router.use(async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Log the command after response
      if (body && typeof body === 'object' && 'success' in body) {
        const success = (body as { success: boolean }).success;
        database
          .logDirectorCommand({
            command: req.path.split('/')[1] || 'unknown',
            sceneId: req.params.sceneId,
            roomId: req.params.roomId,
            payload: req.body,
            reason: req.body?.reason,
            executedBy: req.body?.executedBy || req.ip,
            success,
            errorMessage: success ? undefined : JSON.stringify(body)
          })
          .catch((err) => logger.error({ err }, 'Failed to log director command'));
      }
      return originalJson(body);
    } as typeof res.json;
    next();
  });

  // ============================================================================
  // Scene-Level Director Controls
  // ============================================================================

  // Reset a scene
  router.post('/scenes/:sceneId/reset', async (req, res) => {
    const parseResult = DirectorCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.directorReset(req.params.sceneId);
      const scene = orchestrator.getScene(req.params.sceneId);

      res.json({
        success: true,
        message: 'Scene reset',
        data: scene
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, '[DIRECTOR] Reset failed');
      res.status(500).json({
        success: false,
        error: { code: 'RESET_FAILED', message: (error as Error).message }
      });
    }
  });

  // Override (mark as solved)
  router.post('/scenes/:sceneId/override', async (req, res) => {
    const parseResult = DirectorCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.directorOverride(req.params.sceneId);
      const scene = orchestrator.getScene(req.params.sceneId);

      res.json({
        success: true,
        message: 'Scene overridden as solved',
        data: scene
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, '[DIRECTOR] Override failed');
      res.status(500).json({
        success: false,
        error: { code: 'OVERRIDE_FAILED', message: (error as Error).message }
      });
    }
  });

  // Skip to next
  router.post('/scenes/:sceneId/skip', async (req, res) => {
    const parseResult = DirectorCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      const scene = orchestrator.getScene(req.params.sceneId);
      if (!scene) {
        return res.status(404).json({
          success: false,
          error: { code: 'SCENE_NOT_FOUND', message: 'Scene not found' }
        });
      }

      const nextSceneIds = await orchestrator.directorSkip(req.params.sceneId);
      const nextScenes = nextSceneIds
        .map((id) => orchestrator.getScene(id))
        .filter((s) => s !== undefined);

      res.json({
        success: true,
        message: 'Scene skipped',
        data: {
          skippedScene: orchestrator.getScene(req.params.sceneId),
          nextAvailableScenes: nextScenes
        }
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, '[DIRECTOR] Skip failed');
      res.status(500).json({
        success: false,
        error: { code: 'SKIP_FAILED', message: (error as Error).message }
      });
    }
  });

  // Stop a running scene
  router.post('/scenes/:sceneId/stop', async (req, res) => {
    const parseResult = DirectorCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.directorStop(req.params.sceneId);
      const scene = orchestrator.getScene(req.params.sceneId);

      res.json({
        success: true,
        message: 'Scene stopped',
        data: scene
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, '[DIRECTOR] Stop failed');
      res.status(500).json({
        success: false,
        error: { code: 'STOP_FAILED', message: (error as Error).message }
      });
    }
  });

  // ============================================================================
  // Room-Level Director Controls
  // ============================================================================

  // Get room status
  router.get('/rooms/:roomId/status', (req, res) => {
    try {
      const roomScenes = orchestrator.getRoomScenes(req.params.roomId);
      const availableScenes = orchestrator.getAvailableScenes(req.params.roomId);
      const powerState = orchestrator.getRoomPowerState(req.params.roomId);

      const activeScenes = roomScenes.filter((s) => s.state === 'active');
      const solvedScenes = roomScenes.filter(
        (s) => s.state === 'solved' || s.state === 'overridden'
      );

      res.json({
        success: true,
        data: {
          roomId: req.params.roomId,
          powerState,
          sceneCount: roomScenes.length,
          activeScenes: activeScenes.length,
          solvedScenes: solvedScenes.length,
          availableScenes: availableScenes.length,
          activeSceneIds: activeScenes.map((s) => s.id),
          availableSceneIds: availableScenes.map((s) => s.id)
        }
      });
    } catch (error) {
      logger.error({ roomId: req.params.roomId, error }, 'Failed to get room status');
      res.status(500).json({
        success: false,
        error: { code: 'STATUS_ERROR', message: (error as Error).message }
      });
    }
  });

  // Room power control
  const PowerControlSchema = z.object({
    state: z.enum(['on', 'off', 'emergency_off']),
    reason: z.string().optional(),
    executedBy: z.string().optional()
  });

  router.post('/rooms/:roomId/power', async (req, res) => {
    const parseResult = PowerControlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.setRoomPower(req.params.roomId, parseResult.data.state);

      res.json({
        success: true,
        message: `Room powered ${parseResult.data.state}`,
        data: {
          roomId: req.params.roomId,
          powerState: parseResult.data.state
        }
      });
    } catch (error) {
      logger.error(
        { roomId: req.params.roomId, state: parseResult.data.state, error },
        '[DIRECTOR] Power control failed'
      );
      res.status(500).json({
        success: false,
        error: { code: 'POWER_CONTROL_FAILED', message: (error as Error).message }
      });
    }
  });

  // Reset entire room
  router.post('/rooms/:roomId/reset', async (req, res) => {
    const parseResult = DirectorCommandSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.resetRoom(req.params.roomId);
      const roomScenes = orchestrator.getRoomScenes(req.params.roomId);

      res.json({
        success: true,
        message: 'Room reset',
        data: {
          roomId: req.params.roomId,
          resetScenes: roomScenes.length
        }
      });
    } catch (error) {
      logger.error({ roomId: req.params.roomId, error }, '[DIRECTOR] Room reset failed');
      res.status(500).json({
        success: false,
        error: { code: 'RESET_FAILED', message: (error as Error).message }
      });
    }
  });

  // Jump to specific scene
  const JumpToSchema = z.object({
    targetSceneId: z.string(),
    reason: z.string().optional(),
    executedBy: z.string().optional()
  });

  router.post('/rooms/:roomId/jump', async (req, res) => {
    const parseResult = JumpToSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      const result = await orchestrator.jumpToScene(
        req.params.roomId,
        parseResult.data.targetSceneId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'JUMP_FAILED', message: result.reason }
        });
      }

      res.json({
        success: true,
        message: 'Jumped to scene',
        data: {
          roomId: req.params.roomId,
          targetScene: orchestrator.getScene(parseResult.data.targetSceneId)
        }
      });
    } catch (error) {
      logger.error(
        { roomId: req.params.roomId, targetSceneId: parseResult.data.targetSceneId, error },
        '[DIRECTOR] Jump failed'
      );
      res.status(500).json({
        success: false,
        error: { code: 'JUMP_FAILED', message: (error as Error).message }
      });
    }
  });

  return router;
};
