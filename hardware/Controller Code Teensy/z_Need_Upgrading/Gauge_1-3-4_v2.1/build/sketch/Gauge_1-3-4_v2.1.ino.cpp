#include <Arduino.h>
#line 1 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
/*
 * Gauge 1-3-4 Controller - v2.0.1
 *
 * Hardware:
 * - 3x Stepper motors (gauges 1, 3, 4)
 * - 3x Analog potentiometers (ball valve position sensors)
 * - AccelStepper library for smooth motion
 *
 * Architecture:
 * - Stateless peripheral device (NO state machine)
 * - When ACTIVE: Gauges autonomously track valve potentiometer positions (low latency)
 * - When INACTIVE: Gauges move to zero position
 * - Separate MQTT topics for each gauge PSI reading
 * - EEPROM position storage for auto-zeroing on startup
 * - Manual calibration commands for fine-tuning zero position
 *
 * Gauge Assignments:
 * - Gauge 1: DIR 7, STEP 6, ENABLE 8, POT A10
 * - Gauge 3: DIR 11, STEP 10, ENABLE 12, POT A12
 * - Gauge 4: DIR 3, STEP 2, ENABLE 4, POT A11
 */

#include <SentientMQTT.h>
#include <SentientDeviceRegistry.h>
#include <SentientCapabilityManifest.h>
#include <AccelStepper.h>
#include <EEPROM.h>
#include "FirmwareMetadata.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

const IPAddress mqtt_broker_ip(192, 168, 20, 3);
const char *mqtt_host = "sentientengine.ai";
const int mqtt_port = 1883;
const char *mqtt_namespace = "paragon";
const char *room_id = "clockwork";
// Single source of truth: controller_id comes from firmware::UNIQUE_ID
const char *controller_id = firmware::UNIQUE_ID;
const char *controller_model = "teensy41";
const char *device_id = "gauge_1_3_4";
const char *device_friendly_name = "Gauges 1-3-4";

// ============================================================================
// PIN DEFINITIONS (snake_case, const int)
// ============================================================================

// Gauge 1
const int gauge_1_dir_pin = 7;
const int gauge_1_step_pin = 6;
const int gauge_1_enable_pin = 8;
const int valve_1_pot_pin = A10;

// Gauge 3
const int gauge_3_dir_pin = 11;
const int gauge_3_step_pin = 10;
const int gauge_3_enable_pin = 12;
const int valve_3_pot_pin = A12;

// Gauge 4
const int gauge_4_dir_pin = 3;
const int gauge_4_step_pin = 2;
const int gauge_4_enable_pin = 4;
const int valve_4_pot_pin = A11;

// Power LED
const int power_led_pin = 13;

// ============================================================================
// GAUGE CONFIGURATION
// ============================================================================

// Stepper settings
const int stepper_max_speed = 700;
const int stepper_acceleration = 350;

// Gauge position range (in steps)
const int gauge_min_steps = 0;
const int gauge_max_steps = 2300;

// PSI range
const int psi_min = 0;
const int psi_max = 125;

// Valve calibration (analog values for 0 and 125 PSI)
const int valve_1_zero = 10;
const int valve_1_max = 750;
const int valve_3_zero = 15;
const int valve_3_max = 896;
const int valve_4_zero = 10;
const int valve_4_max = 960;

// Signal filtering
const int num_analog_readings = 3;
const float filter_alpha = 0.25f;
const int psi_deadband = 1;                 // PSI must change by this amount to trigger movement
const unsigned long movement_delay_ms = 75; // Minimum time between movements

// EEPROM addresses for storing last known positions
const int eeprom_addr_gauge1 = 0;
const int eeprom_addr_gauge3 = 4;
const int eeprom_addr_gauge4 = 8;

// ============================================================================
// HARDWARE STATE (not game state - just tracking hardware status)
// ============================================================================

bool gauges_active = false; // Hardware execution flag (not game logic)

// Current valve PSI readings (from potentiometers)
int valve_1_psi = 0;
int valve_3_psi = 0;
int valve_4_psi = 0;

// Current gauge needle positions (from stepper positions)
int gauge_1_psi = 0;
int gauge_3_psi = 0;
int gauge_4_psi = 0;

// Last published PSI values (for change detection)
int last_published_gauge_1_psi = -1;
int last_published_gauge_3_psi = -1;
int last_published_gauge_4_psi = -1;
int last_published_valve_1_psi = -1;
int last_published_valve_3_psi = -1;
int last_published_valve_4_psi = -1;

// Periodic sensor publishing (ensures fresh data even without changes)
unsigned long last_sensor_publish_time = 0;
const unsigned long sensor_publish_interval_ms = 60000; // Publish every 60 seconds

// Filtered analog values
float filtered_analog_1 = 0.0f;
float filtered_analog_3 = 0.0f;
float filtered_analog_4 = 0.0f;
bool filters_initialized = false;

// Movement tracking (for deadband and delay)
int previous_target_psi_1 = -1;
int previous_target_psi_3 = -1;
int previous_target_psi_4 = -1;
unsigned long last_move_time_1 = 0;
unsigned long last_move_time_3 = 0;
unsigned long last_move_time_4 = 0;

// ============================================================================
// STEPPER MOTORS
// ============================================================================

AccelStepper stepper_1(AccelStepper::DRIVER, gauge_1_step_pin, gauge_1_dir_pin);
AccelStepper stepper_3(AccelStepper::DRIVER, gauge_3_step_pin, gauge_3_dir_pin);
AccelStepper stepper_4(AccelStepper::DRIVER, gauge_4_step_pin, gauge_4_dir_pin);

// ============================================================================
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ============================================================================

// Combined Gauge Devices (Valve Sensor + Gauge Motor)
// - All gauges receive commands (activateGauges, inactivateGauges) - commands apply to all gauges
// - All gauges publish valve position sensor (Valve_PSI)
// - All gauges publish gauge needle position (Gauge_PSI)
const char *gauge_device_commands[] = {"activateGauges", "inactivateGauges"};
const char *gauge_1_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};
const char *gauge_3_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};
const char *gauge_4_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};

// Output calibration system
const char *calibration_commands[] = {"adjustGaugeZero", "setCurrentAsZero"};

// Create device definitions
// All gauges are bidirectional (commands + sensors)
SentientDeviceDef dev_gauge_1(
    "gauge_1", "Gauge 1 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_1_device_sensors, 2);

SentientDeviceDef dev_gauge_3(
    "gauge_3", "Gauge 3 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_3_device_sensors, 2);

SentientDeviceDef dev_gauge_4(
    "gauge_4", "Gauge 4 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_4_device_sensors, 2);

// Calibration system (output only: receives commands)
SentientDeviceDef dev_calibration(
    "calibration", "Gauge Calibration System", "calibration",
    calibration_commands, 2);

// Create the device registry
SentientDeviceRegistry deviceRegistry;

// ============================================================================
// MQTT CLIENT & MANIFEST
// ============================================================================

#line 200 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
SentientMQTTConfig build_mqtt_config();
#line 220 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
bool build_heartbeat_payload(JsonDocument &doc, void *ctx);
#line 228 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void build_capability_manifest();
#line 249 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void save_gauge_position(int gauge_number);
#line 279 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void load_gauge_positions();
#line 312 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
String extract_command_value(const JsonDocument &payload);
#line 329 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void publish_hardware_status();
#line 343 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx);
#line 547 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void read_valve_positions();
#line 591 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void move_gauges();
#line 635 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void check_and_publish_sensor_changes();
#line 721 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void setup();
#line 844 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
void loop();
#line 200 "/opt/sentient/hardware/Controller Code Teensy/Gauge_1-3-4_v2.1/Gauge_1-3-4_v2.1.ino"
SentientMQTTConfig build_mqtt_config()
{
  SentientMQTTConfig cfg;
  cfg.brokerHost = mqtt_host;
  cfg.brokerIp = mqtt_broker_ip;
  cfg.brokerPort = mqtt_port;
  cfg.namespaceId = mqtt_namespace;
  cfg.roomId = room_id;
  cfg.puzzleId = controller_id;
  cfg.deviceId = device_id;
  cfg.displayName = device_friendly_name;
  cfg.useDhcp = true;
  cfg.publishJsonCapacity = 512;
  cfg.heartbeatIntervalMs = 5000;
  return cfg;
}

SentientMQTT mqtt(build_mqtt_config());
SentientCapabilityManifest manifest;

bool build_heartbeat_payload(JsonDocument &doc, void *ctx)
{
  doc["uid"] = firmware::UNIQUE_ID;
  doc["fw"] = firmware::VERSION;
  doc["up"] = millis();
  return true;
}

void build_capability_manifest()
{
  // Controller metadata
  manifest.set_controller_info(
      firmware::UNIQUE_ID,
      device_friendly_name,
      firmware::VERSION,
      room_id,
      controller_id);

  // Auto-generate entire manifest from device registry - ONE LINE!
  deviceRegistry.buildManifest(manifest);

  // That's it! No manual device/topic registration needed!
  // All devices and topics are defined once in the Device Registry section above.
}

// ============================================================================
// EEPROM POSITION STORAGE
// ============================================================================

void save_gauge_position(int gauge_number)
{
  int position = 0;
  int address = 0;

  switch (gauge_number)
  {
  case 1:
    position = stepper_1.currentPosition();
    address = eeprom_addr_gauge1;
    break;
  case 3:
    position = stepper_3.currentPosition();
    address = eeprom_addr_gauge3;
    break;
  case 4:
    position = stepper_4.currentPosition();
    address = eeprom_addr_gauge4;
    break;
  default:
    return;
  }

  EEPROM.put(address, position);
  Serial.print("[EEPROM] Saved Gauge ");
  Serial.print(gauge_number);
  Serial.print(" position: ");
  Serial.println(position);
}

void load_gauge_positions()
{
  int position1, position3, position4;

  EEPROM.get(eeprom_addr_gauge1, position1);
  EEPROM.get(eeprom_addr_gauge3, position3);
  EEPROM.get(eeprom_addr_gauge4, position4);

  // Sanity check (if EEPROM is uninitialized, values might be garbage)
  if (position1 < -5000 || position1 > 5000)
    position1 = 0;
  if (position3 < -5000 || position3 > 5000)
    position3 = 0;
  if (position4 < -5000 || position4 > 5000)
    position4 = 0;

  stepper_1.setCurrentPosition(position1);
  stepper_3.setCurrentPosition(position3);
  stepper_4.setCurrentPosition(position4);

  Serial.println("[EEPROM] Loaded last known positions:");
  Serial.print("  Gauge 1: ");
  Serial.println(position1);
  Serial.print("  Gauge 3: ");
  Serial.println(position3);
  Serial.print("  Gauge 4: ");
  Serial.println(position4);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

String extract_command_value(const JsonDocument &payload)
{
  if (payload.containsKey("state"))
  {
    return String(payload["state"].as<const char *>());
  }
  else if (payload.containsKey("value"))
  {
    return String(payload["value"].as<const char *>());
  }
  else if (payload.is<const char *>())
  {
    return String(payload.as<const char *>());
  }
  return "";
}

void publish_hardware_status()
{
  JsonDocument doc;
  doc["gauges_active"] = gauges_active;
  doc["gauge_1_psi"] = gauge_1_psi;
  doc["gauge_3_psi"] = gauge_3_psi;
  doc["gauge_4_psi"] = gauge_4_psi;
  doc["valve_1_psi"] = valve_1_psi;
  doc["valve_3_psi"] = valve_3_psi;
  doc["valve_4_psi"] = valve_4_psi;
  doc["ts"] = millis();
  mqtt.publishJson("status", "hardware", doc);
}

void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx)
{
  String cmd(command);
  String value = extract_command_value(payload);

  Serial.print("[COMMAND] ");
  Serial.print(cmd);
  Serial.print(" = ");
  Serial.println(value);

  // ========================================
  // Activate Gauges (enable tracking)
  // ========================================
  if (cmd.equalsIgnoreCase("activateGauges") || cmd.equalsIgnoreCase("activate"))
  {
    digitalWrite(gauge_1_enable_pin, LOW);
    digitalWrite(gauge_3_enable_pin, LOW);
    digitalWrite(gauge_4_enable_pin, LOW);
    gauges_active = true;

    Serial.println("[GAUGES] Activated - tracking valve positions");
    publish_hardware_status();
  }

  // ========================================
  // Inactivate Gauges (move to zero)
  // ========================================
  else if (cmd.equalsIgnoreCase("inactivateGauges") || cmd.equalsIgnoreCase("inactivate"))
  {
    gauges_active = false;

    // Move all gauges to zero
    stepper_1.moveTo(gauge_min_steps);
    stepper_3.moveTo(gauge_min_steps);
    stepper_4.moveTo(gauge_min_steps);

    // Reset tracking variables
    previous_target_psi_1 = -1;
    previous_target_psi_3 = -1;
    previous_target_psi_4 = -1;
    filters_initialized = false;

    Serial.println("[GAUGES] Inactivated - moving to zero");
    publish_hardware_status();
  }

  // ========================================
  // Adjust Gauge Zero (fine-tune position)
  // ========================================
  else if (cmd.equalsIgnoreCase("adjustGaugeZero"))
  {
    // REQUIRED: Validate JSON parameters
    if (!payload.containsKey("gauge") || !payload.containsKey("steps"))
    {
      Serial.println("[ERROR] adjustGaugeZero requires 'gauge' and 'steps' parameters");
      Serial.println("[ERROR] Example: {\"gauge\": 1, \"steps\": 10}");
      return;
    }

    int gauge_num = payload["gauge"];
    int steps = payload["steps"]; // Positive = move forward, negative = move back

    switch (gauge_num)
    {
    case 1:
      stepper_1.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 1 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    case 3:
      stepper_3.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 3 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    case 4:
      stepper_4.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 4 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    default:
      Serial.print("[ERROR] Invalid gauge number: ");
      Serial.println(gauge_num);
      Serial.println("[ERROR] Valid gauge numbers: 1, 3, 4");
      return;
    }
  }

  // ========================================
  // Set Current Position as Zero
  // ========================================
  else if (cmd.equalsIgnoreCase("setCurrentAsZero"))
  {
    // REQUIRED: Validate JSON parameter
    if (!payload.containsKey("gauge"))
    {
      Serial.println("[ERROR] setCurrentAsZero requires 'gauge' parameter");
      Serial.println("[ERROR] Example: {\"gauge\": 1}");
      return;
    }

    int gauge_num = payload["gauge"];

    switch (gauge_num)
    {
    case 1:
      stepper_1.setCurrentPosition(gauge_min_steps);
      save_gauge_position(1);
      Serial.println("[CALIBRATION] Gauge 1 - current position set as zero");
      break;
    case 3:
      stepper_3.setCurrentPosition(gauge_min_steps);
      save_gauge_position(3);
      Serial.println("[CALIBRATION] Gauge 3 - current position set as zero");
      break;
    case 4:
      stepper_4.setCurrentPosition(gauge_min_steps);
      save_gauge_position(4);
      Serial.println("[CALIBRATION] Gauge 4 - current position set as zero");
      break;
    default:
      Serial.print("[ERROR] Invalid gauge number: ");
      Serial.println(gauge_num);
      Serial.println("[ERROR] Valid gauge numbers: 1, 3, 4");
      return;
    }

    publish_hardware_status();
  }

  // ========================================
  // Request Status (on-demand full state)
  // ========================================
  else if (cmd.equalsIgnoreCase("requestStatus"))
  {
    JsonDocument doc;
    doc["uid"] = firmware::UNIQUE_ID;
    doc["fw"] = firmware::VERSION;
    doc["gauges_active"] = gauges_active;
    doc["gauge_1_psi"] = gauge_1_psi;
    doc["gauge_3_psi"] = gauge_3_psi;
    doc["gauge_4_psi"] = gauge_4_psi;
    doc["valve_1_psi"] = valve_1_psi;
    doc["valve_3_psi"] = valve_3_psi;
    doc["valve_4_psi"] = valve_4_psi;
    doc["stepper_1_pos"] = stepper_1.currentPosition();
    doc["stepper_3_pos"] = stepper_3.currentPosition();
    doc["stepper_4_pos"] = stepper_4.currentPosition();
    doc["ts"] = millis();
    mqtt.publishJson("status", "full", doc);
    Serial.println("[STATUS] Full status published");
  }

  // ========================================
  // Reset (move to zero, disable)
  // ========================================
  else if (cmd.equalsIgnoreCase("reset"))
  {
    gauges_active = false;

    stepper_1.moveTo(gauge_min_steps);
    stepper_3.moveTo(gauge_min_steps);
    stepper_4.moveTo(gauge_min_steps);

    // Wait for movement to complete
    while (stepper_1.distanceToGo() != 0 || stepper_3.distanceToGo() != 0 || stepper_4.distanceToGo() != 0)
    {
      stepper_1.run();
      stepper_3.run();
      stepper_4.run();
    }

    // Disable motors
    digitalWrite(gauge_1_enable_pin, HIGH);
    digitalWrite(gauge_3_enable_pin, HIGH);
    digitalWrite(gauge_4_enable_pin, HIGH);

    // Save positions
    save_gauge_position(1);
    save_gauge_position(3);
    save_gauge_position(4);

    previous_target_psi_1 = -1;
    previous_target_psi_3 = -1;
    previous_target_psi_4 = -1;
    filters_initialized = false;

    publish_hardware_status();
    Serial.println("[RESET] All gauges at zero, motors disabled");
  }

  else
  {
    Serial.print("[UNKNOWN COMMAND] ");
    Serial.println(cmd);
  }
}

// ============================================================================
// VALVE POSITION READING
// ============================================================================

void read_valve_positions()
{
  // Average readings for noise reduction
  int sum1 = 0, sum3 = 0, sum4 = 0;
  for (int i = 0; i < num_analog_readings; i++)
  {
    sum1 += analogRead(valve_1_pot_pin);
    sum3 += analogRead(valve_3_pot_pin);
    sum4 += analogRead(valve_4_pot_pin);
  }

  float raw1 = sum1 / (float)num_analog_readings;
  float raw3 = sum3 / (float)num_analog_readings;
  float raw4 = sum4 / (float)num_analog_readings;

  // Initialize filters on first run
  if (!filters_initialized)
  {
    filtered_analog_1 = raw1;
    filtered_analog_3 = raw3;
    filtered_analog_4 = raw4;
    filters_initialized = true;
  }

  // Apply exponential moving average filter
  filtered_analog_1 = (filter_alpha * raw1) + ((1.0f - filter_alpha) * filtered_analog_1);
  filtered_analog_3 = (filter_alpha * raw3) + ((1.0f - filter_alpha) * filtered_analog_3);
  filtered_analog_4 = (filter_alpha * raw4) + ((1.0f - filter_alpha) * filtered_analog_4);

  // Convert to PSI
  valve_1_psi = map((int)filtered_analog_1, valve_1_zero, valve_1_max, psi_min, psi_max);
  valve_3_psi = map((int)filtered_analog_3, valve_3_zero, valve_3_max, psi_min, psi_max);
  valve_4_psi = map((int)filtered_analog_4, valve_4_zero, valve_4_max, psi_min, psi_max);

  // Constrain to valid range
  valve_1_psi = constrain(valve_1_psi, psi_min, psi_max);
  valve_3_psi = constrain(valve_3_psi, psi_min, psi_max);
  valve_4_psi = constrain(valve_4_psi, psi_min, psi_max);
}

// ============================================================================
// GAUGE MOVEMENT (AUTONOMOUS TRACKING)
// ============================================================================

void move_gauges()
{
  if (!gauges_active)
    return;

  unsigned long current_time = millis();

  // Move gauge 1 with deadband and time delay
  if ((abs(valve_1_psi - previous_target_psi_1) >= psi_deadband || previous_target_psi_1 == -1) &&
      (current_time - last_move_time_1 >= movement_delay_ms || previous_target_psi_1 == -1))
  {
    stepper_1.moveTo(map(valve_1_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_1 = valve_1_psi;
    last_move_time_1 = current_time;
  }

  // Move gauge 3
  if ((abs(valve_3_psi - previous_target_psi_3) >= psi_deadband || previous_target_psi_3 == -1) &&
      (current_time - last_move_time_3 >= movement_delay_ms || previous_target_psi_3 == -1))
  {
    stepper_3.moveTo(map(valve_3_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_3 = valve_3_psi;
    last_move_time_3 = current_time;
  }

  // Move gauge 4
  if ((abs(valve_4_psi - previous_target_psi_4) >= psi_deadband || previous_target_psi_4 == -1) &&
      (current_time - last_move_time_4 >= movement_delay_ms || previous_target_psi_4 == -1))
  {
    stepper_4.moveTo(map(valve_4_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_4 = valve_4_psi;
    last_move_time_4 = current_time;
  }

  // Update current gauge PSI from stepper positions
  gauge_1_psi = map(stepper_1.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
  gauge_3_psi = map(stepper_3.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
  gauge_4_psi = map(stepper_4.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
}

// ============================================================================
// SENSOR CHANGE DETECTION & PUBLISHING (SEPARATE TOPICS)
// ============================================================================

void check_and_publish_sensor_changes()
{
  // Check if periodic publish interval has elapsed
  unsigned long current_time = millis();
  bool force_publish = (current_time - last_sensor_publish_time >= sensor_publish_interval_ms);

  // ========================================
  // Gauge 1 - Valve PSI (potentiometer reading)
  // ========================================
  if (valve_1_psi != last_published_valve_1_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_1_psi;
    mqtt.publishJson("sensors/gauge_1", "Valve_PSI", doc);
    last_published_valve_1_psi = valve_1_psi;
  }

  // ========================================
  // Gauge 1 - Gauge PSI (needle position)
  // ========================================
  if (gauge_1_psi != last_published_gauge_1_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_1_psi;
    doc["target_psi"] = valve_1_psi;
    mqtt.publishJson("sensors/gauge_1", "Gauge_PSI", doc);
    last_published_gauge_1_psi = gauge_1_psi;
  }

  // ========================================
  // Gauge 3 - Valve PSI
  // ========================================
  if (valve_3_psi != last_published_valve_3_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_3_psi;
    mqtt.publishJson("sensors/gauge_3", "Valve_PSI", doc);
    last_published_valve_3_psi = valve_3_psi;
  }

  // ========================================
  // Gauge 3 - Gauge PSI
  // ========================================
  if (gauge_3_psi != last_published_gauge_3_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_3_psi;
    doc["target_psi"] = valve_3_psi;
    mqtt.publishJson("sensors/gauge_3", "Gauge_PSI", doc);
    last_published_gauge_3_psi = gauge_3_psi;
  }

  // ========================================
  // Gauge 4 - Valve PSI
  // ========================================
  if (valve_4_psi != last_published_valve_4_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_4_psi;
    mqtt.publishJson("sensors/gauge_4", "Valve_PSI", doc);
    last_published_valve_4_psi = valve_4_psi;
  }

  // ========================================
  // Gauge 4 - Gauge PSI
  // ========================================
  if (gauge_4_psi != last_published_gauge_4_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_4_psi;
    doc["target_psi"] = valve_4_psi;
    mqtt.publishJson("sensors/gauge_4", "Gauge_PSI", doc);
    last_published_gauge_4_psi = gauge_4_psi;
  }

  // Update timestamp if we force published
  if (force_publish)
  {
    last_sensor_publish_time = current_time;
  }
}

// ============================================================================
// SETUP
// ============================================================================

void setup()
{
  // Power LED
  pinMode(power_led_pin, OUTPUT);
  digitalWrite(power_led_pin, HIGH);

  // Serial console
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔════════════════════════════════════════════════════════════╗");
  Serial.println("║      Sentient Engine - Gauge 1-3-4 Controller             ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  Serial.print("[Gauge 1-3-4] Firmware Version: ");
  Serial.println(firmware::VERSION);
  Serial.print("[Gauge 1-3-4] Unique ID: ");
  Serial.println(firmware::UNIQUE_ID);
  Serial.println();

  // ========================================
  // Initialize stepper enable pins
  // ========================================
  pinMode(gauge_1_enable_pin, OUTPUT);
  pinMode(gauge_3_enable_pin, OUTPUT);
  pinMode(gauge_4_enable_pin, OUTPUT);

  // Disable all steppers initially
  digitalWrite(gauge_1_enable_pin, HIGH);
  digitalWrite(gauge_3_enable_pin, HIGH);
  digitalWrite(gauge_4_enable_pin, HIGH);

  // ========================================
  // Configure steppers
  // ========================================
  stepper_1.setPinsInverted(true, false, false);
  stepper_3.setPinsInverted(true, false, false);
  stepper_4.setPinsInverted(false, false, false);

  stepper_1.setMaxSpeed(stepper_max_speed);
  stepper_1.setAcceleration(stepper_acceleration);
  stepper_3.setMaxSpeed(stepper_max_speed);
  stepper_3.setAcceleration(stepper_acceleration);
  stepper_4.setMaxSpeed(stepper_max_speed);
  stepper_4.setAcceleration(stepper_acceleration);

  // ========================================
  // Load last known positions from EEPROM
  // ========================================
  load_gauge_positions();

  // ========================================
  // Auto-zero gauges on startup
  // ========================================
  Serial.println("[Gauge 1-3-4] Auto-zeroing gauges...");
  stepper_1.moveTo(gauge_min_steps);
  stepper_3.moveTo(gauge_min_steps);
  stepper_4.moveTo(gauge_min_steps);

  // Wait for zero (blocking on startup)
  while (stepper_1.distanceToGo() != 0 || stepper_3.distanceToGo() != 0 || stepper_4.distanceToGo() != 0)
  {
    stepper_1.run();
    stepper_3.run();
    stepper_4.run();
  }

  Serial.println("[Gauge 1-3-4] Gauges zeroed");

  // Save zero positions
  save_gauge_position(1);
  save_gauge_position(3);
  save_gauge_position(4);

  // ========================================
  // Register Devices
  // ========================================
  Serial.println("[Gauge 1-3-4] Registering devices...");
  deviceRegistry.addDevice(&dev_gauge_1);
  deviceRegistry.addDevice(&dev_gauge_3);
  deviceRegistry.addDevice(&dev_gauge_4);
  deviceRegistry.addDevice(&dev_calibration);
  deviceRegistry.printSummary();

  // ========================================
  // Initialize MQTT
  // ========================================
  Serial.println("[Gauge 1-3-4] Initializing MQTT...");

  build_capability_manifest();

  mqtt.setHeartbeatBuilder(build_heartbeat_payload);
  mqtt.setCommandCallback(handle_mqtt_command);
  mqtt.begin();

  // Wait for broker connection
  Serial.println("[Gauge 1-3-4] Waiting for broker connection...");
  while (!mqtt.isConnected())
  {
    mqtt.loop();
    delay(100);
  }
  Serial.println("[Gauge 1-3-4] Broker connected!");

  // Register with Sentient system
  Serial.println("[Gauge 1-3-4] Registering with Sentient system...");
  if (manifest.publish_registration(mqtt.get_client(), room_id, controller_id))
  {
    Serial.println("[Gauge 1-3-4] Registration successful!");
  }
  else
  {
    Serial.println("[Gauge 1-3-4] Registration failed - check MQTT connection");
  }

  Serial.println("[Gauge 1-3-4] Ready - awaiting Sentient commands");
  Serial.println();
}

// ============================================================================
// MAIN LOOP - Stateless Listen/Detect/Execute Pattern
// ============================================================================

void loop()
{
  // 1. LISTEN - Process MQTT commands from Sentient
  mqtt.loop();

  // 2. DETECT - Read valve positions
  read_valve_positions();
  check_and_publish_sensor_changes();

  // 3. EXECUTE - Move gauges (autonomous tracking when active)
  move_gauges();

  // Always run steppers (non-blocking)
  stepper_1.run();
  stepper_3.run();
  stepper_4.run();
}

