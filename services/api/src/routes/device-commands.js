/**
 * Device Command Routes
 * Handles MQTT command publishing to devices for testing and control
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/database');
const mqttClient = require('../config/mqtt');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { requireCapability } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

/**
 * POST /api/sentient/devices/:id/test
 * Send a test command to a device
 */
router.post('/:id/test', authenticate, requireCapability('manage_devices'), auditLog, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, parameters, confirm_safety } = req.body;

    // Validate device exists and get controller info
    const deviceResult = await db.query(
      `SELECT d.*, r.name as room_name, r.client_id,
              c.mqtt_namespace, c.mqtt_room_id, c.mqtt_puzzle_id, c.mqtt_device_id,
              c.controller_id as controller_str_id,
              cl.mqtt_namespace as client_namespace
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       LEFT JOIN controllers c ON d.controller_id = c.id
       LEFT JOIN clients cl ON r.client_id = cl.id
       WHERE d.id = $1`,
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceResult.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && device.client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Safety check for emergency-stop-required devices
    if (device.emergency_stop_required && !confirm_safety) {
      return res.status(400).json({
        success: false,
        message: 'This device requires emergency stop confirmation. Please confirm safety procedures.',
        requires_confirmation: true
      });
    }

    // Use the action parameter as the command name
    // The device_command_name is a legacy field that only stores ONE command
    // We now support multiple commands via capabilities, so use the action directly
    const commandName = action;

    // Build MQTT topic in Teensy-compatible format:
    // Per SYSTEM_ARCHITECTURE.md and actual firmware behavior:
    // [client]/[room]/commands/[controller]/[device]/[specific_command]
    // Example: paragon/clockwork/commands/boiler_room_subpanel/tv_lift/powerTV_on
    // This matches the pattern used for status and sensors where message type comes third

    // Try to get MQTT metadata from controller, then device config, then fallback to defaults
    const deviceConfig = device.config || {};
    const mqttNamespace = device.mqtt_namespace || deviceConfig.mqtt_namespace || device.client_namespace || 'paragon';
    const mqttRoomId = device.mqtt_room_id || deviceConfig.mqtt_room_id || device.room_name || 'Unknown';
    const mqttPuzzleId = device.mqtt_puzzle_id || deviceConfig.mqtt_puzzle_id || 'Unknown';
    const mqttDeviceId = device.device_id;  // Use the device's actual device_id field

    // Topic structure: namespace/room/commands/controller/device/command
    const topic = `${mqttNamespace}/${mqttRoomId}/commands/${mqttPuzzleId}/${mqttDeviceId}/${commandName}`;

    // Build command payload - Teensy expects simple format
    const payload = {
      value: parameters.value || (action === 'turn_on' ? 'on' : action === 'turn_off' ? 'off' : 'on'),
      ...parameters
    };

    // Publish command via MQTT
    await mqttClient.publishCommand(topic, payload);

    logger.info(`Test command sent to device ${device.device_id}: ${commandName}`, {
      user: req.user.email,
      device_id: device.device_id,
      action,
      command: commandName,
      topic
    });

    res.json({
      success: true,
      message: `Command "${commandName}" sent to ${device.friendly_name || device.device_id}`,
      topic,
      payload,
      original_action: action,
      mapped_command: commandName
    });

  } catch (error) {
    logger.error('Device test command error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test command',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/controllers/:id/test-action
 * Send a test action to a controller
 */
router.post('/:controller_id/test-action', authenticate, requireCapability('manage_devices'), auditLog, async (req, res) => {
  try {
    const { controller_id } = req.params;
    const { action_id, parameters, confirm_safety } = req.body;

    // Validate controller exists
    const controllerResult = await db.query(
      `SELECT c.*, r.name as room_name, r.client_id
       FROM controllers c
       INNER JOIN rooms r ON c.room_id = r.id
       WHERE c.id = $1`,
      [controller_id]
    );

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    const controller = controllerResult.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && controller.client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find action in capability manifest
    const manifest = controller.capability_manifest;
    if (!manifest || !manifest.actions) {
      return res.status(400).json({
        success: false,
        message: 'Controller has no registered actions'
      });
    }

    const action = manifest.actions.find(a => a.action_id === action_id);
    if (!action) {
      return res.status(404).json({
        success: false,
        message: `Action "${action_id}" not found in controller manifest`
      });
    }

    // Safety check for safety-critical actions
    if (action.safety_critical && !confirm_safety) {
      return res.status(400).json({
        success: false,
        message: 'This action is safety-critical and requires confirmation.',
        requires_confirmation: true,
        action: {
          action_id: action.action_id,
          friendly_name: action.friendly_name,
          description: action.description,
          safety_critical: true
        }
      });
    }

    // Validate parameters
    if (action.parameters) {
      for (const param of action.parameters) {
        if (param.required && parameters[param.name] === undefined) {
          return res.status(400).json({
            success: false,
            message: `Required parameter "${param.name}" is missing`
          });
        }

        // Validate min/max for numeric parameters
        if (parameters[param.name] !== undefined && param.type === 'number') {
          const value = parseFloat(parameters[param.name]);
          if (param.min !== undefined && value < param.min) {
            return res.status(400).json({
              success: false,
              message: `Parameter "${param.name}" must be >= ${param.min}`
            });
          }
          if (param.max !== undefined && value > param.max) {
            return res.status(400).json({
              success: false,
              message: `Parameter "${param.name}" must be <= ${param.max}`
            });
          }
        }
      }
    }

    // Build MQTT topic
    const topic = action.mqtt_topic || controller.mqtt_base_topic;
    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine MQTT topic for action'
      });
    }

    // Build command payload
    const payload = {
      action_id: action_id,
      parameters: parameters || {},
      timestamp: new Date().toISOString(),
      user_id: req.user.id,
      user_email: req.user.email
    };

    // Publish command via MQTT
    await mqttClient.publishCommand(topic, payload);

    logger.info(`Test action sent to controller ${controller.controller_id}: ${action_id}`, {
      user: req.user.email,
      controller_id: controller.controller_id,
      action_id,
      topic
    });

    res.json({
      success: true,
      message: `Action "${action.friendly_name}" executed`,
      topic,
      payload,
      estimated_duration_ms: action.duration_ms
    });

  } catch (error) {
    logger.error('Controller test action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute action',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/devices/:id/command/raw
 * Send a raw MQTT command to a device (admin only)
 */
router.post('/:id/command/raw', authenticate, requireCapability('admin'), auditLog, async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, payload, qos } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'MQTT topic is required'
      });
    }

    // Validate device exists (for audit logging)
    const deviceResult = await db.query(
      'SELECT device_id, friendly_name FROM devices WHERE id = $1',
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const device = deviceResult.rows[0];

    // Publish raw command
    await mqttClient.publishCommand(topic, payload, { qos: qos || 1 });

    logger.warn(`Raw MQTT command sent by admin ${req.user.email}`, {
      user: req.user.email,
      device_id: device.device_id,
      topic,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload)
    });

    res.json({
      success: true,
      message: 'Raw command published',
      topic,
      device: {
        id: device.device_id,
        name: device.friendly_name
      }
    });

  } catch (error) {
    logger.error('Raw command error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send raw command',
      error: error.message
    });
  }
});

module.exports = router;
