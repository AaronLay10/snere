import { logger } from '../logger';
import axios from 'axios';

export interface RegistrationMessage {
  controller_id: string;
  room_id: string;
  hardware_type?: string;
  hardware_version?: string;
  mcu_model?: string;
  clock_speed_mhz?: number;
  ip_address?: string;
  mac_address?: string;
  mqtt_client_id?: string;
  mqtt_base_topic?: string;
  firmware_version?: string;
  sketch_name?: string;
  digital_pins_total?: number;
  analog_pins_total?: number;
  pwm_pins_total?: number;
  i2c_buses?: number;
  spi_buses?: number;
  serial_ports?: number;
  flash_size_kb?: number;
  ram_size_kb?: number;
  heartbeat_interval_ms?: number;
  friendly_name?: string;
  description?: string;
  physical_location?: string;
  // Raspberry Pi specific
  controller_type?: 'microcontroller' | 'power_controller' | 'hybrid';
  relay_count?: number;
  relay_config?: Array<{
    relay: number;
    gpioPin: number;
    deviceId?: string;
    controllerId?: string;
    name: string;
    normallyOpen?: boolean;
    activeHigh?: boolean;
  }>;
  controls_devices?: string[];
  // Capability manifest
  capability_manifest?: CapabilityManifest;
}

export interface CapabilityManifest {
  devices?: Array<{
    device_id: string;
    device_type: string;
    friendly_name: string;
    pin?: number | string;
    pin_type?: string;
    properties?: Record<string, any>;
  }>;
  mqtt_topics_publish?: Array<{
    topic: string;
    message_type: string;
    publish_interval_ms?: number;
    schema?: Record<string, string>;
  }>;
  mqtt_topics_subscribe?: Array<{
    topic: string;
    message_type?: string;
    description?: string;
    parameters?: Array<{
      name: string;
      type: string;
      required?: boolean;
      min?: number;
      max?: number;
      default?: any;
      description?: string;
    }>;
    safety_critical?: boolean;
    example?: Record<string, any>;
  }>;
  actions?: Array<{
    action_id: string;
    friendly_name: string;
    description?: string;
    parameters?: Array<{
      name: string;
      type: string;
      required?: boolean;
      min?: number;
      max?: number;
      default?: any;
      description?: string;
    }>;
    mqtt_topic?: string;
    duration_ms?: number;
    can_interrupt?: boolean;
    safety_critical?: boolean;
  }>;
}

export interface ControllerRegistrationOptions {
  apiBaseUrl: string;
  serviceToken?: string;
}

/**
 * Handles automatic controller registration from MQTT messages.
 * Teensy and Raspberry Pi controllers can self-register by publishing
 * to sentient/system/register with their hardware capabilities.
 */
export class ControllerRegistration {
  private readonly apiBaseUrl: string;
  private readonly serviceToken?: string;

  constructor(options: ControllerRegistrationOptions) {
    this.apiBaseUrl = options.apiBaseUrl;
    this.serviceToken = options.serviceToken;
  }

  /**
   * Get axios headers with service authentication
   */
  private getHeaders() {
    const headers: any = {
      'Content-Type': 'application/json'
    };
    if (this.serviceToken) {
      headers['X-Service-Token'] = this.serviceToken;
    }
    return headers;
  }

  /**
   * Handle a registration message from a controller.
   * This will either create a new controller or update an existing one.
   */
  public async handleRegistration(message: RegistrationMessage): Promise<void> {
    const { controller_id, room_id } = message;

    logger.info(
      { controller_id, room_id },
      'Received controller registration message'
    );

    try {
      // Check if controller already exists
      const existingController = await this.findController(controller_id, room_id);

      if (existingController) {
        // Update existing controller with new hardware info
        await this.updateController(existingController.id, message);
        logger.info(
          { controller_id, room_id, id: existingController.id },
          'Updated existing controller from registration'
        );
      } else {
        // Create new controller
        const newController = await this.createController(message);
        logger.info(
          { controller_id, room_id, id: newController.id },
          'Created new controller from registration'
        );
      }

      // Send acknowledgment back to controller (optional)
      // This could be implemented to confirm successful registration
    } catch (error: any) {
      logger.error(
        { 
          error: error.message, 
          controller_id, 
          room_id,
          response: error.response?.data,
          status: error.response?.status
        },
        'Failed to handle controller registration'
      );
      throw error;
    }
  }

  /**
   * Find an existing controller by controller_id and room_id
   */
  private async findController(
    controllerId: string,
    roomId: string
  ): Promise<any | null> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/sentient/controllers`,
        {
          params: {
            controller_id: controllerId,
            room_id: roomId
          },
          headers: this.getHeaders()
        }
      );

      if (response.data?.controllers?.length > 0) {
        return response.data.controllers[0];
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new controller from registration message
   */
  private async createController(message: RegistrationMessage): Promise<any> {
    // Send snake_case directly to API
    const controllerData = {
      room_id: message.room_id,
      controller_id: message.controller_id,
      friendly_name: message.friendly_name,
      description: message.description,
      hardware_type: message.hardware_type || 'Unknown',
      hardware_version: message.hardware_version,
      mcu_model: message.mcu_model,
      clock_speed_mhz: message.clock_speed_mhz,
      ip_address: message.ip_address,
      mac_address: message.mac_address,
      mqtt_client_id: message.mqtt_client_id || message.controller_id,
      mqtt_base_topic: message.mqtt_base_topic,
      firmware_version: message.firmware_version,
      sketch_name: message.sketch_name,
      physical_location: message.physical_location,
      digital_pins_total: message.digital_pins_total,
      analog_pins_total: message.analog_pins_total,
      pwm_pins_total: message.pwm_pins_total,
      i2c_buses: message.i2c_buses,
      spi_buses: message.spi_buses,
      serial_ports: message.serial_ports,
      flash_size_kb: message.flash_size_kb,
      ram_size_kb: message.ram_size_kb,
      heartbeat_interval_ms: message.heartbeat_interval_ms || 5000,
      // Raspberry Pi relay control fields
      controller_type: message.controller_type || 'microcontroller',
      relay_count: message.relay_count || 0,
      relay_config: message.relay_config,
      controls_devices: message.controls_devices,
      // Capability manifest
      capability_manifest: message.capability_manifest,
      // Set status to inactive until operator configures it
      status: 'inactive'
    };

    const response = await axios.post(
      `${this.apiBaseUrl}/api/sentient/controllers`,
      controllerData,
      { headers: this.getHeaders() }
    );

    return response.data.controller;
  }

  /**
   * Update an existing controller with new hardware info from registration
   */
  private async updateController(
    controllerId: string,
    message: RegistrationMessage
  ): Promise<any> {
    // Only update hardware-reported fields, not operational config
    const updateData = {
      hardware_version: message.hardware_version,
      ip_address: message.ip_address,
      mac_address: message.mac_address,
      firmware_version: message.firmware_version,
      heartbeat_interval_ms: message.heartbeat_interval_ms,
      // Update last_heartbeat to mark as online
      last_heartbeat: new Date().toISOString()
    };

    const response = await axios.put(
      `${this.apiBaseUrl}/api/sentient/controllers/${controllerId}`,
      updateData,
      { headers: this.getHeaders() }
    );

    return response.data.controller;
  }

  /**
   * Parse a registration message from MQTT payload
   */
  public static parseMessage(payload: string | Buffer): RegistrationMessage | null {
    try {
      const data = typeof payload === 'string' ? payload : payload.toString();
      const parsed = JSON.parse(data);

      // Validate required fields
      if (!parsed.controller_id || !parsed.room_id) {
        logger.warn(
          { parsed },
          'Invalid registration message: missing controller_id or room_id'
        );
        return null;
      }

      return parsed as RegistrationMessage;
    } catch (error: any) {
      logger.error(
        { error: error.message },
        'Failed to parse registration message'
      );
      return null;
    }
  }
}
