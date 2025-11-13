/**
 * Controllers Routes
 * Manages Teensy 4.1 microcontrollers and other hardware controllers
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireCapability } = require('../middleware/rbac');
const { authenticateServiceOrUser } = require('../middleware/serviceAuth');

// Validation schema for controller
const controllerSchema = Joi.object({
  room_id: Joi.string().max(255).required(),  // Changed from .uuid() - rooms.id is VARCHAR(255)
  controller_id: Joi.string().max(100).required(),
  friendly_name: Joi.string().max(255).optional(),
  description: Joi.string().optional(),
  hardware_type: Joi.string().max(100).optional(),
  hardware_version: Joi.string().max(50).optional(),
  mcu_model: Joi.string().max(100).optional(),
  clock_speed_mhz: Joi.number().integer().min(1).optional(),
  ip_address: Joi.string().ip().optional(),
  mac_address: Joi.string().optional(),
  mqtt_client_id: Joi.string().max(100).optional(),
  mqtt_base_topic: Joi.string().max(500).optional(),
  firmware_version: Joi.string().max(50).optional(),
  firmware_upload_date: Joi.date().optional(),
  sketch_name: Joi.string().max(255).optional(),
  sketch_checksum: Joi.string().max(64).optional(),
  physical_location: Joi.string().max(255).optional(),
  mounting_type: Joi.string().max(50).optional(),
  enclosure_type: Joi.string().max(100).optional(),
  digital_pins_total: Joi.number().integer().optional(),
  analog_pins_total: Joi.number().integer().optional(),
  pwm_pins_total: Joi.number().integer().optional(),
  i2c_buses: Joi.number().integer().optional(),
  spi_buses: Joi.number().integer().optional(),
  serial_ports: Joi.number().integer().optional(),
  pin_assignments: Joi.object().optional(),
  power_supply_voltage: Joi.number().optional(),
  power_consumption_watts: Joi.number().optional(),
  backup_power: Joi.boolean().optional(),
  has_watchdog: Joi.boolean().optional(),
  watchdog_timeout_ms: Joi.number().integer().optional(),
  emergency_stop_capable: Joi.boolean().optional(),
  safety_classification: Joi.string().max(50).optional(),
  status: Joi.string().valid('active', 'inactive', 'maintenance', 'error', 'offline').optional(),
  last_boot: Joi.date().optional(),
  uptime_seconds: Joi.number().integer().optional(),
  last_heartbeat: Joi.date().optional(),
  heartbeat_interval_ms: Joi.number().integer().optional(),
  flash_size_kb: Joi.number().integer().optional(),
  ram_size_kb: Joi.number().integer().optional(),
  free_ram_kb: Joi.number().integer().optional(),
  cpu_temperature_celsius: Joi.number().optional(),
  config: Joi.object().optional(),
  // Raspberry Pi relay control fields
  controller_type: Joi.string().valid('microcontroller', 'power_controller', 'hybrid', 'video_manager', 'audio_manager', 'dmx_controller', 'projection_mapper', 'touchscreen_interface', 'game_logic', 'sensor_aggregator').optional(),
  relay_count: Joi.number().integer().min(0).optional(),
  relay_config: Joi.array().items(Joi.object({
    relay: Joi.number().integer().required(),
    gpio_pin: Joi.number().integer().required(),
    device_id: Joi.string().optional(),
    controller_id: Joi.string().optional(),
    name: Joi.string().required(),
    normally_open: Joi.boolean().optional(),
    active_high: Joi.boolean().optional(),
  })).optional(),
  controls_devices: Joi.array().items(Joi.string()).optional(),
  capability_manifest: Joi.object({
    devices: Joi.array().items(Joi.object({
      device_id: Joi.string().required(),
      device_type: Joi.string().required(),
      friendly_name: Joi.string().required(),
      pin: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
      pin_type: Joi.string().optional(),
      properties: Joi.object().optional(),
    })).optional(),
    mqtt_topics_publish: Joi.array().items(Joi.object({
      topic: Joi.string().required(),
      message_type: Joi.string().required(),
      publish_interval_ms: Joi.number().integer().optional(),
      schema: Joi.object().optional(),
    })).optional(),
    mqtt_topics_subscribe: Joi.array().items(Joi.object({
      topic: Joi.string().required(),
      message_type: Joi.string().optional(),
      description: Joi.string().optional(),
      parameters: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        required: Joi.boolean().optional(),
        min: Joi.number().optional(),
        max: Joi.number().optional(),
        default: Joi.any().optional(),
        description: Joi.string().optional(),
      })).optional(),
      safety_critical: Joi.boolean().optional(),
      example: Joi.object().optional(),
    })).optional(),
    actions: Joi.array().items(Joi.object({
      action_id: Joi.string().required(),
      friendly_name: Joi.string().required(),
      description: Joi.string().optional(),
      parameters: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        required: Joi.boolean().optional(),
        min: Joi.number().optional(),
        max: Joi.number().optional(),
        default: Joi.any().optional(),
        description: Joi.string().optional(),
      })).optional(),
      mqtt_topic: Joi.string().optional(),
      duration_ms: Joi.number().integer().optional(),
      can_interrupt: Joi.boolean().optional(),
      safety_critical: Joi.boolean().optional(),
    })).optional(),
  }).optional(),
  // MQTT topic structure fields (for legacy compatibility)
  mqtt_namespace: Joi.string().max(100).optional(),
  mqtt_room_id: Joi.string().max(100).optional(),
  mqtt_puzzle_id: Joi.string().max(100).optional(),
  mqtt_device_id: Joi.string().max(100).optional(),
});

/**
 * GET /api/sentient/controllers
 * Get all controllers (with optional filtering)
 */
router.get('/', authenticateServiceOrUser, requireCapability('read'), async (req, res) => {
  try {
    const { room_id, status, hardware_type, controller_id } = req.query;

    let query = `
      SELECT
        c.id,
        c.room_id,
        c.controller_id,
        c.friendly_name,
        c.description,
        c.hardware_type,
        c.hardware_version,
        c.mcu_model,
        c.clock_speed_mhz,
        c.ip_address,
        c.mac_address,
        c.mqtt_client_id,
        c.mqtt_base_topic,
        c.firmware_version,
        c.firmware_upload_date,
        c.sketch_name,
        c.sketch_checksum,
        c.physical_location,
        c.mounting_type,
        c.enclosure_type,
        c.digital_pins_total,
        c.analog_pins_total,
        c.pwm_pins_total,
        c.i2c_buses,
        c.spi_buses,
        c.serial_ports,
        c.pin_assignments,
        c.power_supply_voltage,
        c.power_consumption_watts,
        c.backup_power,
        c.has_watchdog,
        c.watchdog_timeout_ms,
        c.emergency_stop_capable,
        c.safety_classification,
        c.status,
        c.last_boot,
        c.uptime_seconds,
        c.last_heartbeat,
        c.heartbeat_interval_ms,
        c.flash_size_kb,
        c.ram_size_kb,
        c.free_ram_kb,
        c.cpu_temperature_celsius,
        c.config,
        c.created_at,
        c.updated_at,
        c.created_by,
        c.updated_by,
        r.name as room_name,
        COUNT(d.id) as device_count
      FROM controllers c
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN devices d ON d.controller_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (room_id) {
      // Support both UUID (c.room_id) and room slug (r.slug)
      query += ` AND (c.room_id::text = $${paramIndex} OR r.slug = $${paramIndex})`;
      paramIndex++;
      params.push(room_id);
    }

    if (controller_id) {
      query += ` AND c.controller_id = $${paramIndex++}`;
      params.push(controller_id);
    }

    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (hardware_type) {
      query += ` AND c.hardware_type = $${paramIndex++}`;
      params.push(hardware_type);
    }

    query += ` GROUP BY c.id, r.name ORDER BY c.friendly_name, c.controller_id`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      controllers: result.rows
    });
  } catch (error) {
    console.error('Error fetching controllers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch controllers',
      error: error.message
    });
  }
});

/**
 * GET /api/sentient/controllers/:id
 * Get a single controller by ID
 */
router.get('/:id', authenticateServiceOrUser, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        c.*,
        r.name as room_name,
        COUNT(d.id) as device_count
      FROM controllers c
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN devices d ON d.controller_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, r.name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    // Get devices connected to this controller
    const devicesResult = await db.query(
      `SELECT id, device_id, friendly_name, device_type, device_category, status
       FROM devices
       WHERE controller_id = $1
       ORDER BY friendly_name, device_id`,
      [id]
    );

    const controller = result.rows[0];
    controller.devices = devicesResult.rows;

    res.json({
      success: true,
      controller: controller
    });
  } catch (error) {
    console.error('Error fetching controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch controller',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/controllers
 * Create a new controller
 */
router.post('/', authenticateServiceOrUser, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { error, value } = controllerSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    let {
      room_id,
      controller_id,
      friendly_name,
      description,
      hardware_type,
      hardware_version,
      mcu_model,
      clock_speed_mhz,
      ip_address,
      mac_address,
      mqtt_client_id,
      mqtt_base_topic,
      firmware_version,
      firmware_upload_date,
      sketch_name,
      sketch_checksum,
      physical_location,
      mounting_type,
      enclosure_type,
      digital_pins_total,
      analog_pins_total,
      pwm_pins_total,
      i2c_buses,
      spi_buses,
      serial_ports,
      pin_assignments,
      power_supply_voltage,
      power_consumption_watts,
      backup_power,
      has_watchdog,
      watchdog_timeout_ms,
      emergency_stop_capable,
      safety_classification,
      status,
      last_boot,
      uptime_seconds,
      last_heartbeat,
      heartbeat_interval_ms,
      flash_size_kb,
      ram_size_kb,
      free_ram_kb,
      cpu_temperature_celsius,
      config,
      controller_type,
      relay_count,
      relay_config,
      controls_devices,
      capability_manifest
    } = value;

    // Resolve room_id: if it's a slug, convert to UUID
    const roomLookup = await db.query(
      `SELECT id FROM rooms WHERE id::text = $1 OR slug = $1`,
      [room_id]
    );
    
    if (roomLookup.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Room not found: ${room_id}`
      });
    }
    
    // Use the resolved UUID for database insert
    room_id = roomLookup.rows[0].id;

    const result = await db.query(
      `INSERT INTO controllers (
        room_id,
        controller_id,
        friendly_name,
        description,
        hardware_type,
        hardware_version,
        mcu_model,
        clock_speed_mhz,
        ip_address,
        mac_address,
        mqtt_client_id,
        mqtt_base_topic,
        firmware_version,
        firmware_upload_date,
        sketch_name,
        sketch_checksum,
        physical_location,
        mounting_type,
        enclosure_type,
        digital_pins_total,
        analog_pins_total,
        pwm_pins_total,
        i2c_buses,
        spi_buses,
        serial_ports,
        pin_assignments,
        power_supply_voltage,
        power_consumption_watts,
        backup_power,
        has_watchdog,
        watchdog_timeout_ms,
        emergency_stop_capable,
        safety_classification,
        status,
        last_boot,
        uptime_seconds,
        last_heartbeat,
        heartbeat_interval_ms,
        flash_size_kb,
        ram_size_kb,
        free_ram_kb,
        cpu_temperature_celsius,
        config,
        controller_type,
        relay_count,
        relay_config,
        controls_devices,
        capability_manifest,
        created_by,
        updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, $47, $48, $49, $50
      )
      RETURNING *`,
      [
        room_id,
        controller_id,
        friendly_name || null,
        description || null,
        hardware_type || 'Teensy 4.1',
        hardware_version || null,
        mcu_model || 'ARM Cortex-M7',
        clock_speed_mhz || 600,
        ip_address || null,
        mac_address || null,
        mqtt_client_id || null,
        mqtt_base_topic || null,
        firmware_version || null,
        firmware_upload_date || null,
        sketch_name || null,
        sketch_checksum || null,
        physical_location || null,
        mounting_type || null,
        enclosure_type || null,
        digital_pins_total || 55,
        analog_pins_total || 18,
        pwm_pins_total || 35,
        i2c_buses || 3,
        spi_buses || 3,
        serial_ports || 8,
        pin_assignments || null,
        power_supply_voltage || null,
        power_consumption_watts || null,
        backup_power !== undefined ? backup_power : false,
        has_watchdog !== undefined ? has_watchdog : true,
        watchdog_timeout_ms || 8000,
        emergency_stop_capable !== undefined ? emergency_stop_capable : false,
        safety_classification || null,
        status || 'active',
        last_boot || null,
        uptime_seconds || null,
        last_heartbeat || null,
        heartbeat_interval_ms || 5000,
        flash_size_kb || 8192,
        ram_size_kb || 1024,
        free_ram_kb || null,
        cpu_temperature_celsius || null,
        config || null,
        controller_type || 'microcontroller',
        relay_count || 0,
        relay_config ? JSON.stringify(relay_config) : null,
        controls_devices ? JSON.stringify(controls_devices) : null,
        capability_manifest ? JSON.stringify(capability_manifest) : null,
        req.user.id,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Controller created successfully',
      controller: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating controller:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'A controller with this ID already exists in this room'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create controller',
      error: error.message
    });
  }
});

/**
 * PUT /api/sentient/controllers/:id
 * Update a controller
 */
router.put('/:id', authenticateServiceOrUser, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { id } = req.params;

    const updateSchema = controllerSchema.fork(
      ['roomId', 'controllerId'],
      (schema) => schema.optional()
    );

    const { error, value } = updateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      room_id: 'room_id',
      controller_id: 'controller_id',
      friendly_name: 'friendly_name',
      description: 'description',
      hardware_type: 'hardware_type',
      hardware_version: 'hardware_version',
      mcu_model: 'mcu_model',
      clock_speed_mhz: 'clock_speed_mhz',
      ip_address: 'ip_address',
      mac_address: 'mac_address',
      mqtt_client_id: 'mqtt_client_id',
      mqtt_base_topic: 'mqtt_base_topic',
      firmware_version: 'firmware_version',
      firmware_upload_date: 'firmware_upload_date',
      sketch_name: 'sketch_name',
      sketch_checksum: 'sketch_checksum',
      physical_location: 'physical_location',
      mounting_type: 'mounting_type',
      enclosure_type: 'enclosure_type',
      digital_pins_total: 'digital_pins_total',
      analog_pins_total: 'analog_pins_total',
      pwm_pins_total: 'pwm_pins_total',
      i2c_buses: 'i2c_buses',
      spi_buses: 'spi_buses',
      serial_ports: 'serial_ports',
      pinAssignments: 'pin_assignments',
      powerSupplyVoltage: 'power_supply_voltage',
      powerConsumptionWatts: 'power_consumption_watts',
      backupPower: 'backup_power',
      hasWatchdog: 'has_watchdog',
      watchdogTimeoutMs: 'watchdog_timeout_ms',
      emergencyStopCapable: 'emergency_stop_capable',
      safetyClassification: 'safety_classification',
      status: 'status',
      lastBoot: 'last_boot',
      uptimeSeconds: 'uptime_seconds',
      lastHeartbeat: 'last_heartbeat',
      heartbeatIntervalMs: 'heartbeat_interval_ms',
      flashSizeKb: 'flash_size_kb',
      ramSizeKb: 'ram_size_kb',
      freeRamKb: 'free_ram_kb',
      cpuTemperatureCelsius: 'cpu_temperature_celsius',
      config: 'config',
      controllerType: 'controller_type',
      relayCount: 'relay_count',
      relayConfig: 'relay_config',
      controlsDevices: 'controls_devices',
      capabilityManifest: 'capability_manifest',
    };

    Object.keys(value).forEach((key) => {
      const dbField = fieldMapping[key];
      if (dbField) {
        updates.push(`${dbField} = $${paramIndex++}`);
        // JSON serialize relay_config, controls_devices, and capability_manifest
        if (key === 'relayConfig' || key === 'controlsDevices' || key === 'capabilityManifest') {
          values.push(value[key] ? JSON.stringify(value[key]) : null);
        } else {
          values.push(value[key]);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add updated_by and updated_at
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(req.user.id);
    updates.push(`updated_at = NOW()`);

    // Add ID for WHERE clause
    values.push(id);

    const query = `
      UPDATE controllers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    res.json({
      success: true,
      message: 'Controller updated successfully',
      controller: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update controller',
      error: error.message
    });
  }
});

/**
 * DELETE /api/sentient/controllers/:id
 * Delete a controller
 */
router.delete('/:id', authenticate, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if controller has devices
    const devicesCheck = await db.query(
      'SELECT COUNT(*) as count FROM devices WHERE controller_id = $1',
      [id]
    );

    if (parseInt(devicesCheck.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete controller with assigned devices. Please reassign or delete devices first.',
        deviceCount: parseInt(devicesCheck.rows[0].count)
      });
    }

    const result = await db.query(
      'DELETE FROM controllers WHERE id = $1 RETURNING id, controller_id, friendly_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    res.json({
      success: true,
      message: 'Controller deleted successfully',
      deletedController: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete controller',
      error: error.message
    });
  }
});

/**
 * GET /api/sentient/controllers/:id/devices
 * Get all devices assigned to a controller
 */
router.get('/:id/devices', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM devices WHERE controller_id = $1 ORDER BY friendly_name, device_id`,
      [id]
    );

    res.json({
      success: true,
      devices: result.rows
    });
  } catch (error) {
    console.error('Error fetching controller devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch controller devices',
      error: error.message
    });
  }
});

/**
 * GET /api/sentient/controllers/:id/manifest
 * Get the capability manifest for a controller
 */
router.get('/:id/manifest', authenticateServiceOrUser, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT capability_manifest FROM controllers WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    const manifest = result.rows[0].capability_manifest;

    if (!manifest) {
      return res.status(404).json({
        success: false,
        message: 'No capability manifest available for this controller'
      });
    }

    res.json({
      success: true,
      manifest: manifest
    });
  } catch (error) {
    console.error('Error fetching controller manifest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch controller manifest',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/controllers/:id/validate-command
 * Validate a command against the controller's capability manifest
 */
router.post('/:id/validate-command', authenticateServiceOrUser, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, payload } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    const result = await db.query(
      `SELECT capability_manifest FROM controllers WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    const manifest = result.rows[0].capability_manifest;

    if (!manifest || !manifest.mqtt_topics_subscribe) {
      return res.status(400).json({
        success: false,
        message: 'No capability manifest available for validation'
      });
    }

    // Find the topic definition in the manifest
    const topicDef = manifest.mqtt_topics_subscribe.find(t => t.topic === topic);

    if (!topicDef) {
      return res.status(400).json({
        success: false,
        message: `Topic '${topic}' is not registered in controller manifest`,
        valid: false
      });
    }

    // Validate parameters if provided
    const errors = [];
    if (payload && topicDef.parameters) {
      for (const param of topicDef.parameters) {
        const value = payload[param.name];

        // Check required parameters
        if (param.required && (value === undefined || value === null)) {
          errors.push(`Required parameter '${param.name}' is missing`);
          continue;
        }

        // Validate parameter type and range
        if (value !== undefined && value !== null) {
          if (param.type === 'number') {
            if (typeof value !== 'number') {
              errors.push(`Parameter '${param.name}' must be a number`);
            } else {
              if (param.min !== undefined && value < param.min) {
                errors.push(`Parameter '${param.name}' must be >= ${param.min}`);
              }
              if (param.max !== undefined && value > param.max) {
                errors.push(`Parameter '${param.name}' must be <= ${param.max}`);
              }
            }
          } else if (param.type === 'string' && typeof value !== 'string') {
            errors.push(`Parameter '${param.name}' must be a string`);
          } else if (param.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`Parameter '${param.name}' must be a boolean`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.json({
        success: true,
        valid: false,
        errors: errors,
        topic_definition: topicDef
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Command is valid',
      topic_definition: topicDef,
      safety_critical: topicDef.safety_critical || false
    });
  } catch (error) {
    console.error('Error validating command:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate command',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/controllers/:id/execute-action
 * Execute a registered action on the controller
 */
router.post('/:id/execute-action', authenticateServiceOrUser, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action_id, parameters } = req.body;

    if (!action_id) {
      return res.status(400).json({
        success: false,
        message: 'Action ID is required'
      });
    }

    const result = await db.query(
      `SELECT capability_manifest, mqtt_base_topic, controller_id FROM controllers WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    const controller = result.rows[0];
    const manifest = controller.capability_manifest;

    if (!manifest || !manifest.actions) {
      return res.status(400).json({
        success: false,
        message: 'No actions available for this controller'
      });
    }

    // Find the action definition
    const action = manifest.actions.find(a => a.action_id === action_id);

    if (!action) {
      return res.status(404).json({
        success: false,
        message: `Action '${action_id}' not found in controller manifest`
      });
    }

    // Validate parameters
    const errors = [];
    const params = parameters || {};

    if (action.parameters) {
      for (const paramDef of action.parameters) {
        const value = params[paramDef.name];

        if (paramDef.required && (value === undefined || value === null)) {
          errors.push(`Required parameter '${paramDef.name}' is missing`);
          continue;
        }

        if (value !== undefined && value !== null) {
          if (paramDef.type === 'number') {
            if (typeof value !== 'number') {
              errors.push(`Parameter '${paramDef.name}' must be a number`);
            } else {
              if (paramDef.min !== undefined && value < paramDef.min) {
                errors.push(`Parameter '${paramDef.name}' must be >= ${paramDef.min}`);
              }
              if (paramDef.max !== undefined && value > paramDef.max) {
                errors.push(`Parameter '${paramDef.name}' must be <= ${paramDef.max}`);
              }
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter validation failed',
        errors: errors
      });
    }

    // TODO: Publish MQTT message to execute action
    // For now, just return success with action details
    res.json({
      success: true,
      message: `Action '${action.friendly_name}' queued for execution`,
      action: {
        action_id: action.action_id,
        friendly_name: action.friendly_name,
        mqtt_topic: action.mqtt_topic,
        parameters: params,
        duration_ms: action.duration_ms,
        safety_critical: action.safety_critical || false
      },
      note: 'MQTT execution not yet implemented - action details returned for testing'
    });
  } catch (error) {
    console.error('Error executing action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute action',
      error: error.message
    });
  }
});

/**
 * POST /api/sentient/controllers/:id/register-device
 * Register a device from capability manifest into devices table
 */
router.post('/:id/register-device', authenticateServiceOrUser, requireCapability('manage_devices'), async (req, res) => {
  const { id } = req.params;
  const { device_id, device_type, friendly_name, pin, pin_type, properties } = req.body;
  const userId = req.user?.id;

  try {
    // Get controller details including network info
    const controllerResult = await db.query(
      `SELECT room_id, controller_id, capability_manifest, ip_address, mac_address FROM controllers WHERE id = $1`,
      [id]
    );

    if (controllerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Controller not found'
      });
    }

    const controller = controllerResult.rows[0];

    // Verify device exists in manifest
    const manifest = controller.capability_manifest;
    if (!manifest || !manifest.devices) {
      return res.status(400).json({
        success: false,
        message: 'Controller has no capability manifest or devices'
      });
    }

    const manifestDevice = manifest.devices.find(d => d.device_id === device_id);
    if (!manifestDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device not found in controller manifest'
      });
    }

    // Check if device already exists
    const existingDevice = await db.query(
      `SELECT id FROM devices WHERE device_id = $1 AND room_id = $2`,
      [device_id, controller.room_id]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Device already registered in devices table',
        device_id: existingDevice.rows[0].id
      });
    }

    // Generate MQTT topic based on controller and device
    const mqtt_topic = `sentient/${controller.room_id}/${controller.controller_id}/${device_id}`;

    // Determine device category based on device type
    let device_category = 'sensor'; // default
    const deviceTypeLower = device_type.toLowerCase();
    if (deviceTypeLower.includes('motor') || deviceTypeLower.includes('servo') || deviceTypeLower.includes('stepper')) {
      device_category = 'mechanical_movement';
    } else if (deviceTypeLower.includes('relay') || deviceTypeLower.includes('switch') || deviceTypeLower.includes('valve')) {
      device_category = 'switchable_on_off';
    } else if (deviceTypeLower.includes('pwm') || deviceTypeLower.includes('dimmer') || deviceTypeLower.includes('led')) {
      device_category = 'variable_control';
    } else if (deviceTypeLower.includes('speaker') || deviceTypeLower.includes('audio')) {
      device_category = 'media_playback';
    }

    // Insert device with network info from controller
    const result = await db.query(
      `INSERT INTO devices (
        room_id, device_id, friendly_name, device_type, device_category,
        mqtt_topic, controller_id, ip_address, mac_address, config, status,
        created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        controller.room_id,
        device_id,
        friendly_name || manifestDevice.friendly_name,
        device_type || manifestDevice.device_type,
        device_category,
        mqtt_topic,
        id, // controller UUID
        controller.ip_address, // Inherit IP from controller
        controller.mac_address, // Inherit MAC from controller
        JSON.stringify({
          pin: pin || manifestDevice.pin,
          pin_type: pin_type || manifestDevice.pin_type,
          properties: properties || manifestDevice.properties,
          registered_from_manifest: true,
          manifest_device_id: device_id
        }),
        'active',
        userId,
        userId
      ]
    );

    res.json({
      success: true,
      message: 'Device registered successfully',
      device: result.rows[0]
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device',
      error: error.message
    });
  }
});

module.exports = router;
