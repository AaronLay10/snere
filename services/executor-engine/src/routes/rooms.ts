import { Router } from 'express';
import { SceneRegistry } from '../scenes/SceneRegistry';
import { SceneOrchestratorService } from '../services/SceneOrchestratorService';
import { RoomTimeline, TimelineNode } from '../types';
import { logger } from '../logger';

/**
 * Room routes - Room-level queries and timeline visualization
 */
export const roomsRouter = (
  registry: SceneRegistry,
  orchestrator: SceneOrchestratorService
) => {
  const router = Router();

  // Get all rooms
  router.get('/', (_req, res) => {
    const allScenes = registry.list();
    const roomIds = [...new Set(allScenes.map((s) => s.roomId))];

    const rooms = roomIds.map((roomId) => {
      const scenes = orchestrator.getRoomScenes(roomId);
      const available = orchestrator.getAvailableScenes(roomId);
      const active = scenes.filter((s) => s.state === 'active');
      const solved = scenes.filter((s) => s.state === 'solved' || s.state === 'overridden');
      const powerState = orchestrator.getRoomPowerState(roomId);

      return {
        roomId,
        powerState,
        sceneCount: scenes.length,
        puzzleCount: scenes.filter((s) => s.type === 'puzzle').length,
        cutsceneCount: scenes.filter((s) => s.type === 'cutscene').length,
        activeScenes: active.length,
        solvedScenes: solved.length,
        availableScenes: available.length
      };
    });

    res.json({
      success: true,
      data: rooms
    });
  });

  // Get specific room details
  router.get('/:roomId', (req, res) => {
    const scenes = orchestrator.getRoomScenes(req.params.roomId);
    const available = orchestrator.getAvailableScenes(req.params.roomId);
    const powerState = orchestrator.getRoomPowerState(req.params.roomId);

    if (scenes.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'Room not found or has no scenes' }
      });
    }

    const active = scenes.filter((s) => s.state === 'active');
    const solved = scenes.filter((s) => s.state === 'solved' || s.state === 'overridden');

    res.json({
      success: true,
      data: {
        roomId: req.params.roomId,
        powerState,
        scenes: scenes.length,
        puzzles: scenes.filter((s) => s.type === 'puzzle').length,
        cutscenes: scenes.filter((s) => s.type === 'cutscene').length,
        active: active.map((s) => ({ id: s.id, name: s.name, type: s.type })),
        available: available.map((s) => ({ id: s.id, name: s.name, type: s.type })),
        solved: solved.map((s) => ({ id: s.id, name: s.name, type: s.type })),
        allScenes: scenes
      }
    });
  });

  // Get room timeline (flowchart data)
  router.get('/:roomId/timeline', (req, res) => {
    try {
      const scenes = orchestrator.getRoomScenes(req.params.roomId);
      const available = orchestrator.getAvailableScenes(req.params.roomId);
      const active = scenes.find((s) => s.state === 'active');

      // Build timeline nodes
      const nodes: TimelineNode[] = scenes.map((scene) => ({
        sceneId: scene.id,
        type: scene.type,
        name: scene.name,
        state: scene.state,
        prerequisites: scene.prerequisites || [],
        blocks: scene.blocks || []
      }));

      const timeline: RoomTimeline = {
        roomId: req.params.roomId,
        nodes,
        currentSceneId: active?.id,
        nextAvailableScenes: available.map((s) => s.id)
      };

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      logger.error({ roomId: req.params.roomId, error }, 'Failed to get room timeline');
      res.status(500).json({
        success: false,
        error: { code: 'TIMELINE_ERROR', message: (error as Error).message }
      });
    }
  });

  // Get room progress summary
  router.get('/:roomId/progress', (req, res) => {
    const scenes = orchestrator.getRoomScenes(req.params.roomId);

    if (scenes.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' }
      });
    }

    const stateCount = scenes.reduce(
      (acc, scene) => {
        acc[scene.state] = (acc[scene.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalPuzzles = scenes.filter((s) => s.type === 'puzzle').length;
    const solvedPuzzles = scenes.filter(
      (s) => s.type === 'puzzle' && (s.state === 'solved' || s.state === 'overridden')
    ).length;

    const totalCutscenes = scenes.filter((s) => s.type === 'cutscene').length;
    const completedCutscenes = scenes.filter(
      (s) => s.type === 'cutscene' && (s.state === 'solved' || s.state === 'overridden')
    ).length;

    const overallProgress =
      scenes.length > 0
        ? Math.round(
            ((solvedPuzzles + completedCutscenes) / (totalPuzzles + totalCutscenes)) * 100
          )
        : 0;

    res.json({
      success: true,
      data: {
        roomId: req.params.roomId,
        totalScenes: scenes.length,
        totalPuzzles,
        totalCutscenes,
        solvedPuzzles,
        completedCutscenes,
        overallProgress,
        stateBreakdown: stateCount
      }
    });
  });

  // Get available scenes
  router.get('/:roomId/available', (req, res) => {
    const available = orchestrator.getAvailableScenes(req.params.roomId);

    res.json({
      success: true,
      data: {
        roomId: req.params.roomId,
        count: available.length,
        scenes: available.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          description: s.description,
          devices: s.devices
        }))
      }
    });
  });

  return router;
};
