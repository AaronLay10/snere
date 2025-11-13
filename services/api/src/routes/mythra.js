/**
 * Mythra Sentient Engine - Mythra (Game Master) Interface Routes
 * Operational control for game masters during live sessions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireInterface } = require('../middleware/rbac');
const { createAuditLog } = require('../middleware/audit');

/**
 * All Mythra routes require game_master or admin role
 */
router.use(authenticate);
router.use(requireInterface('mythra'));

/**
 * GET /api/mythra/rooms
 * List rooms available to this game master
 */
router.get('/rooms', async (req, res) => {
  try {
    const query = `
      SELECT r.id, r.name, r.slug, r.status, r.capacity, r.duration,
             c.name as client_name
      FROM rooms r
      INNER JOIN clients c ON r.client_id = c.id
      WHERE r.client_id = $1 AND r.status = 'active'
      ORDER BY r.name ASC
    `;

    const result = await db.query(query, [req.user.client_id]);

    res.json({
      success: true,
      rooms: result.rows
    });
  } catch (error) {
    console.error('Mythra list rooms error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve rooms'
    });
  }
});

/**
 * GET /api/mythra/rooms/:id/status
 * Get real-time room status
 */
router.get('/rooms/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Get room details
    const roomResult = await db.query(
      `SELECT r.*, c.name as client_name
       FROM rooms r
       INNER JOIN clients c ON r.client_id = c.id
       WHERE r.id = $1 AND r.client_id = $2`,
      [id, req.user.client_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found'
      });
    }

    const room = roomResult.rows[0];

    // Get current scenes
    const scenesResult = await db.query(
      `SELECT id, scene_id, name, type, sequence, config
       FROM scenes
       WHERE room_id = $1
       ORDER BY sequence ASC`,
      [id]
    );

    // Get device status
    const devicesResult = await db.query(
      `SELECT id, device_id, friendly_name, device_category, emergency_stop_required
       FROM devices
       WHERE room_id = $1`,
      [id]
    );

    // Get active session (if any)
    const sessionResult = await db.query(
      `SELECT id, status, started_at, current_scene_id
       FROM game_sessions
       WHERE room_id = $1 AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
      [id]
    );

    res.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        clientName: room.client_name
      },
      scenes: scenesResult.rows,
      devices: devicesResult.rows,
      session: sessionResult.rows[0] || null
    });
  } catch (error) {
    console.error('Mythra room status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve room status'
    });
  }
});

/**
 * POST /api/mythra/emergency-stop
 * Trigger emergency stop for a room
 */
router.post('/emergency-stop', async (req, res) => {
  try {
    const { roomId, reason } = req.body;

    if (!roomId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Room ID is required'
      });
    }

    // Verify room access
    const roomResult = await db.query(
      'SELECT id, name FROM rooms WHERE id = $1 AND client_id = $2',
      [roomId, req.user.client_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found'
      });
    }

    // Log emergency stop event
    await db.query(
      `INSERT INTO emergency_stop_events (
        room_id, triggered_by_user_id, trigger_method, reason, inspection_required
      ) VALUES ($1, $2, $3, $4, $5)`,
      [roomId, req.user.id, 'manual_game_master', reason || 'Emergency stop triggered by game master', true]
    );

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      client_id: req.user.client_id,
      actionType: 'emergency_stop',
      resourceType: 'rooms',
      resourceId: roomId,
      description: 'Emergency stop triggered',
      metadata: { reason: reason || 'Emergency stop', interface: 'mythra' }
    });

    // TODO: Publish MQTT command to emergency stop all devices
    // This would integrate with the MQTT broker to send emergency stop commands

    res.json({
      success: true,
      message: 'Emergency stop activated',
      room: roomResult.rows[0]
    });
  } catch (error) {
    console.error('Emergency stop error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to trigger emergency stop'
    });
  }
});

/**
 * POST /api/mythra/reset-room
 * Reset room to initial state
 */
router.post('/reset-room', async (req, res) => {
  try {
    const { roomId, reason } = req.body;

    if (!roomId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Room ID is required'
      });
    }

    // Verify room access
    const roomResult = await db.query(
      'SELECT id, name FROM rooms WHERE id = $1 AND client_id = $2',
      [roomId, req.user.client_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found'
      });
    }

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      client_id: req.user.client_id,
      actionType: 'reset',
      resourceType: 'rooms',
      resourceId: roomId,
      description: 'Room reset initiated',
      metadata: { reason: reason || 'Room reset', interface: 'mythra' }
    });

    // TODO: Implement room reset logic
    // This would reset all devices, puzzles, and scenes to initial state

    res.json({
      success: true,
      message: 'Room reset initiated',
      room: roomResult.rows[0]
    });
  } catch (error) {
    console.error('Reset room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset room'
    });
  }
});

/**
 * POST /api/mythra/hint
 * Send hint to players
 */
router.post('/hint', async (req, res) => {
  try {
    const { roomId, hintText, sceneId } = req.body;

    if (!roomId || !hintText) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Room ID and hint text are required'
      });
    }

    // Verify room access
    const roomResult = await db.query(
      'SELECT id FROM rooms WHERE id = $1 AND client_id = $2',
      [roomId, req.user.client_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found'
      });
    }

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      client_id: req.user.client_id,
      actionType: 'hint_sent',
      resourceType: 'rooms',
      resourceId: roomId,
      description: 'Hint sent to players',
      metadata: {
        hintText: hintText,
        sceneId: sceneId,
        interface: 'mythra'
      }
    });

    // TODO: Implement hint delivery mechanism
    // Could be MQTT message, display on screen, audio, etc.

    res.json({
      success: true,
      message: 'Hint sent successfully'
    });
  } catch (error) {
    console.error('Send hint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send hint'
    });
  }
});

module.exports = router;
