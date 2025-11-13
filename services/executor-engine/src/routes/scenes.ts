import { Router } from 'express';
import { z } from 'zod';
import { SceneRegistry } from '../scenes/SceneRegistry';
import { SceneOrchestratorService } from '../services/SceneOrchestratorService';
import { logger } from '../logger';

// Validation schemas
const StartSceneSchema = z.object({
  skipSafety: z.boolean().optional()
});

const CompleteSceneSchema = z.object({
  state: z.enum(['solved', 'failed', 'timeout', 'error', 'overridden']).optional()
});

const TestStepSchema = z.object({
  stepId: z.string(),
  action: z.string(),
  target: z.string().optional(),
  duration: z.number().optional(),
  parameters: z.record(z.unknown()).optional()
});

/**
 * Scene routes - Basic scene operations
 */
export const scenesRouter = (
  registry: SceneRegistry,
  orchestrator: SceneOrchestratorService
) => {
  const router = Router();

  // Get all scenes
  router.get('/', (req, res) => {
    const { roomId, type } = req.query;

    let scenes = registry.list();

    if (roomId && typeof roomId === 'string') {
      scenes = scenes.filter((s) => s.roomId === roomId);
    }

    if (type && (type === 'puzzle' || type === 'cutscene')) {
      scenes = scenes.filter((s) => s.type === type);
    }

    res.json({
      success: true,
      data: scenes
    });
  });

  // Get specific scene
  router.get('/:sceneId', (req, res) => {
    const scene = registry.get(req.params.sceneId);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: { code: 'SCENE_NOT_FOUND', message: 'Scene not found' }
      });
    }
    res.json({ success: true, data: scene });
  });

  // Check if scene can be activated
  router.get('/:sceneId/can-activate', (req, res) => {
    const result = registry.canActivate(req.params.sceneId);
    res.json({
      success: true,
      data: result
    });
  });

  // Start a scene
  router.post('/:sceneId/start', async (req, res) => {
    const parseResult = StartSceneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      const result = await orchestrator.startScene(
        req.params.sceneId,
        parseResult.data.skipSafety || false
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_START', message: result.reason }
        });
      }

      res.json({
        success: true,
        data: registry.get(req.params.sceneId)
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, 'Error starting scene');
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to start scene' }
      });
    }
  });

  // Reset a scene
  router.post('/:sceneId/reset', async (req, res) => {
    try {
      await orchestrator.directorReset(req.params.sceneId);
      const scene = orchestrator.getScene(req.params.sceneId);

      res.json({
        success: true,
        message: 'Scene reset',
        data: scene
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, 'Error resetting scene');
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reset scene' }
      });
    }
  });

  // Complete a scene
  router.post('/:sceneId/complete', async (req, res) => {
    const parseResult = CompleteSceneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      await orchestrator.completeScene(
        req.params.sceneId,
        parseResult.data.state || 'solved'
      );

      res.json({
        success: true,
        data: registry.get(req.params.sceneId)
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, error }, 'Error completing scene');
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to complete scene' }
      });
    }
  });

  // Test a single step
  router.post('/:sceneId/test-step', async (req, res) => {
    const parseResult = TestStepSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: parseResult.error.message }
      });
    }

    try {
      const result = await orchestrator.testStep(
        req.params.sceneId,
        parseResult.data
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ sceneId: req.params.sceneId, stepId: parseResult.data?.stepId, error }, 'Error testing step');
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to test step' }
      });
    }
  });

  return router;
};
