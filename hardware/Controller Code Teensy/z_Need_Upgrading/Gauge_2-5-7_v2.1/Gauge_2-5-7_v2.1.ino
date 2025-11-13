/*
 * Gauge 2-5-7 Controller - v2.0.1
 *
 * Hardware:
 * - 3x Stepper motors (gauges 2, 5, 7)
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
 * - Gauge 2: DIR 3, STEP 2, ENABLE 4, POT A11
 * - Gauge 5: DIR 11, STEP 10, ENABLE 12, POT A12
 * - Gauge 7: DIR 7, STEP 6, ENABLE 8, POT A10
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
const char *device_id = "gauge_2_5_7";
const char *device_friendly_name = "Gauges 2-5-7";

// ============================================================================
// PIN DEFINITIONS (snake_case, const int)
// ============================================================================

// Gauge 2
const int gauge_2_dir_pin = 3;
const int gauge_2_step_pin = 2;
const int gauge_2_enable_pin = 4;
const int valve_2_pot_pin = A11;

// Gauge 5
const int gauge_5_dir_pin = 11;
const int gauge_5_step_pin = 10;
const int gauge_5_enable_pin = 12;
const int valve_5_pot_pin = A12;

// Gauge 7
const int gauge_7_dir_pin = 7;
const int gauge_7_step_pin = 6;
const int gauge_7_enable_pin = 8;
const int valve_7_pot_pin = A10;

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
const int valve_2_zero = 9;
const int valve_2_max = 600;
const int valve_5_zero = 35;
const int valve_5_max = 730;
const int valve_7_zero = 5;
const int valve_7_max = 932;

// Signal filtering
const int num_analog_readings = 3;
const float filter_alpha = 0.25f;
const int psi_deadband = 1;
const unsigned long movement_delay_ms = 75;

// EEPROM addresses for storing last known positions
const int eeprom_addr_gauge2 = 0;
const int eeprom_addr_gauge5 = 4;
const int eeprom_addr_gauge7 = 8;

// ============================================================================
// HARDWARE STATE
// ============================================================================

bool gauges_active = false;

// Current valve PSI readings (from potentiometers)
int valve_2_psi = 0;
int valve_5_psi = 0;
int valve_7_psi = 0;

// Current gauge needle positions (from stepper positions)
int gauge_2_psi = 0;
int gauge_5_psi = 0;
int gauge_7_psi = 0;

// Last published PSI values (for change detection)
int last_published_gauge_2_psi = -1;
int last_published_gauge_5_psi = -1;
int last_published_gauge_7_psi = -1;
int last_published_valve_2_psi = -1;
int last_published_valve_5_psi = -1;
int last_published_valve_7_psi = -1;

// Periodic sensor publishing (ensures fresh data even without changes)
unsigned long last_sensor_publish_time = 0;
const unsigned long sensor_publish_interval_ms = 60000; // Publish every 60 seconds

// Filtered analog values
float filtered_analog_2 = 0.0f;
float filtered_analog_5 = 0.0f;
float filtered_analog_7 = 0.0f;
bool filters_initialized = false;

// Movement tracking
int previous_target_psi_2 = -1;
int previous_target_psi_5 = -1;
int previous_target_psi_7 = -1;
unsigned long last_move_time_2 = 0;
unsigned long last_move_time_5 = 0;
unsigned long last_move_time_7 = 0;

// ============================================================================
// STEPPER MOTORS
// ============================================================================

AccelStepper stepper_2(AccelStepper::DRIVER, gauge_2_step_pin, gauge_2_dir_pin);
AccelStepper stepper_5(AccelStepper::DRIVER, gauge_5_step_pin, gauge_5_dir_pin);
AccelStepper stepper_7(AccelStepper::DRIVER, gauge_7_step_pin, gauge_7_dir_pin);

// ============================================================================
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ============================================================================

// Combined Gauge Devices (Valve Sensor + Gauge Motor)
// - All gauges receive commands (activateGauges, inactivateGauges) - commands apply to all gauges
// - All gauges publish valve position sensor (Valve_PSI)
// - All gauges publish gauge needle position (Gauge_PSI)
const char *gauge_device_commands[] = {"activateGauges", "inactivateGauges"};
const char *gauge_2_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};
const char *gauge_5_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};
const char *gauge_7_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};

// Output calibration system
const char *calibration_commands[] = {"adjustGaugeZero", "setCurrentAsZero"};

// Create device definitions
// All gauges are bidirectional (commands + sensors)
SentientDeviceDef dev_gauge_2(
    "gauge_2", "Gauge 2 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_2_device_sensors, 2);

SentientDeviceDef dev_gauge_5(
    "gauge_5", "Gauge 5 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_5_device_sensors, 2);

SentientDeviceDef dev_gauge_7(
    "gauge_7", "Gauge 7 (Valve + Motor)", "gauge_assembly",
    gauge_device_commands, 2,
    gauge_7_device_sensors, 2);

// Calibration system (output only: receives commands)
SentientDeviceDef dev_calibration(
    "calibration", "Gauge Calibration System", "calibration",
    calibration_commands, 2);

// Create the device registry
SentientDeviceRegistry deviceRegistry;

// ============================================================================
// MQTT CLIENT & MANIFEST
// ============================================================================

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
  case 2:
    position = stepper_2.currentPosition();
    address = eeprom_addr_gauge2;
    break;
  case 5:
    position = stepper_5.currentPosition();
    address = eeprom_addr_gauge5;
    break;
  case 7:
    position = stepper_7.currentPosition();
    address = eeprom_addr_gauge7;
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
  int position2, position5, position7;

  EEPROM.get(eeprom_addr_gauge2, position2);
  EEPROM.get(eeprom_addr_gauge5, position5);
  EEPROM.get(eeprom_addr_gauge7, position7);

  if (position2 < -5000 || position2 > 5000)
    position2 = 0;
  if (position5 < -5000 || position5 > 5000)
    position5 = 0;
  if (position7 < -5000 || position7 > 5000)
    position7 = 0;

  stepper_2.setCurrentPosition(position2);
  stepper_5.setCurrentPosition(position5);
  stepper_7.setCurrentPosition(position7);

  Serial.println("[EEPROM] Loaded last known positions:");
  Serial.print("  Gauge 2: ");
  Serial.println(position2);
  Serial.print("  Gauge 5: ");
  Serial.println(position5);
  Serial.print("  Gauge 7: ");
  Serial.println(position7);
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
  doc["gauge_2_psi"] = gauge_2_psi;
  doc["gauge_5_psi"] = gauge_5_psi;
  doc["gauge_7_psi"] = gauge_7_psi;
  doc["valve_2_psi"] = valve_2_psi;
  doc["valve_5_psi"] = valve_5_psi;
  doc["valve_7_psi"] = valve_7_psi;
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

  if (cmd.equalsIgnoreCase("activateGauges") || cmd.equalsIgnoreCase("activate"))
  {
    digitalWrite(gauge_2_enable_pin, LOW);
    digitalWrite(gauge_5_enable_pin, LOW);
    digitalWrite(gauge_7_enable_pin, LOW);
    gauges_active = true;
    Serial.println("[GAUGES] Activated - tracking valve positions");
    publish_hardware_status();
  }

  else if (cmd.equalsIgnoreCase("inactivateGauges") || cmd.equalsIgnoreCase("inactivate"))
  {
    gauges_active = false;
    stepper_2.moveTo(gauge_min_steps);
    stepper_5.moveTo(gauge_min_steps);
    stepper_7.moveTo(gauge_min_steps);
    previous_target_psi_2 = -1;
    previous_target_psi_5 = -1;
    previous_target_psi_7 = -1;
    filters_initialized = false;
    Serial.println("[GAUGES] Inactivated - moving to zero");
    publish_hardware_status();
  }

  else if (cmd.equalsIgnoreCase("adjustGaugeZero"))
  {
    // REQUIRED: Validate JSON parameters
    if (!payload.containsKey("gauge") || !payload.containsKey("steps"))
    {
      Serial.println("[ERROR] adjustGaugeZero requires 'gauge' and 'steps' parameters");
      Serial.println("[ERROR] Example: {\"gauge\": 2, \"steps\": 10}");
      return;
    }

    int gauge_num = payload["gauge"];
    int steps = payload["steps"];

    switch (gauge_num)
    {
    case 2:
      stepper_2.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 2 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    case 5:
      stepper_5.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 5 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    case 7:
      stepper_7.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 7 by ");
      Serial.print(steps);
      Serial.println(" steps");
      break;
    default:
      Serial.print("[ERROR] Invalid gauge number: ");
      Serial.println(gauge_num);
      Serial.println("[ERROR] Valid gauge numbers: 2, 5, 7");
      return;
    }
  }

  else if (cmd.equalsIgnoreCase("setCurrentAsZero"))
  {
    // REQUIRED: Validate JSON parameter
    if (!payload.containsKey("gauge"))
    {
      Serial.println("[ERROR] setCurrentAsZero requires 'gauge' parameter");
      Serial.println("[ERROR] Example: {\"gauge\": 2}");
      return;
    }

    int gauge_num = payload["gauge"];

    switch (gauge_num)
    {
    case 2:
      stepper_2.setCurrentPosition(gauge_min_steps);
      save_gauge_position(2);
      Serial.println("[CALIBRATION] Gauge 2 - current position set as zero");
      break;
    case 5:
      stepper_5.setCurrentPosition(gauge_min_steps);
      save_gauge_position(5);
      Serial.println("[CALIBRATION] Gauge 5 - current position set as zero");
      break;
    case 7:
      stepper_7.setCurrentPosition(gauge_min_steps);
      save_gauge_position(7);
      Serial.println("[CALIBRATION] Gauge 7 - current position set as zero");
      break;
    default:
      Serial.print("[ERROR] Invalid gauge number: ");
      Serial.println(gauge_num);
      Serial.println("[ERROR] Valid gauge numbers: 2, 5, 7");
      return;
    }

    publish_hardware_status();
  }

  else if (cmd.equalsIgnoreCase("requestStatus"))
  {
    JsonDocument doc;
    doc["uid"] = firmware::UNIQUE_ID;
    doc["fw"] = firmware::VERSION;
    doc["gauges_active"] = gauges_active;
    doc["gauge_2_psi"] = gauge_2_psi;
    doc["gauge_5_psi"] = gauge_5_psi;
    doc["gauge_7_psi"] = gauge_7_psi;
    doc["valve_2_psi"] = valve_2_psi;
    doc["valve_5_psi"] = valve_5_psi;
    doc["valve_7_psi"] = valve_7_psi;
    doc["stepper_2_pos"] = stepper_2.currentPosition();
    doc["stepper_5_pos"] = stepper_5.currentPosition();
    doc["stepper_7_pos"] = stepper_7.currentPosition();
    doc["ts"] = millis();
    mqtt.publishJson("status", "full", doc);
    Serial.println("[STATUS] Full status published");
  }

  else if (cmd.equalsIgnoreCase("reset"))
  {
    gauges_active = false;
    stepper_2.moveTo(gauge_min_steps);
    stepper_5.moveTo(gauge_min_steps);
    stepper_7.moveTo(gauge_min_steps);

    while (stepper_2.distanceToGo() != 0 || stepper_5.distanceToGo() != 0 || stepper_7.distanceToGo() != 0)
    {
      stepper_2.run();
      stepper_5.run();
      stepper_7.run();
    }

    digitalWrite(gauge_2_enable_pin, HIGH);
    digitalWrite(gauge_5_enable_pin, HIGH);
    digitalWrite(gauge_7_enable_pin, HIGH);

    save_gauge_position(2);
    save_gauge_position(5);
    save_gauge_position(7);

    previous_target_psi_2 = -1;
    previous_target_psi_5 = -1;
    previous_target_psi_7 = -1;
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
  int sum2 = 0, sum5 = 0, sum7 = 0;
  for (int i = 0; i < num_analog_readings; i++)
  {
    sum2 += analogRead(valve_2_pot_pin);
    sum5 += analogRead(valve_5_pot_pin);
    sum7 += analogRead(valve_7_pot_pin);
  }

  float raw2 = sum2 / (float)num_analog_readings;
  float raw5 = sum5 / (float)num_analog_readings;
  float raw7 = sum7 / (float)num_analog_readings;

  if (!filters_initialized)
  {
    filtered_analog_2 = raw2;
    filtered_analog_5 = raw5;
    filtered_analog_7 = raw7;
    filters_initialized = true;
  }

  filtered_analog_2 = (filter_alpha * raw2) + ((1.0f - filter_alpha) * filtered_analog_2);
  filtered_analog_5 = (filter_alpha * raw5) + ((1.0f - filter_alpha) * filtered_analog_5);
  filtered_analog_7 = (filter_alpha * raw7) + ((1.0f - filter_alpha) * filtered_analog_7);

  valve_2_psi = map((int)filtered_analog_2, valve_2_zero, valve_2_max, psi_min, psi_max);
  valve_5_psi = map((int)filtered_analog_5, valve_5_zero, valve_5_max, psi_min, psi_max);
  valve_7_psi = map((int)filtered_analog_7, valve_7_zero, valve_7_max, psi_min, psi_max);

  valve_2_psi = constrain(valve_2_psi, psi_min, psi_max);
  valve_5_psi = constrain(valve_5_psi, psi_min, psi_max);
  valve_7_psi = constrain(valve_7_psi, psi_min, psi_max);
}

// ============================================================================
// GAUGE MOVEMENT
// ============================================================================

void move_gauges()
{
  if (!gauges_active)
    return;

  unsigned long current_time = millis();

  if ((abs(valve_2_psi - previous_target_psi_2) >= psi_deadband || previous_target_psi_2 == -1) &&
      (current_time - last_move_time_2 >= movement_delay_ms || previous_target_psi_2 == -1))
  {
    stepper_2.moveTo(map(valve_2_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_2 = valve_2_psi;
    last_move_time_2 = current_time;
  }

  if ((abs(valve_5_psi - previous_target_psi_5) >= psi_deadband || previous_target_psi_5 == -1) &&
      (current_time - last_move_time_5 >= movement_delay_ms || previous_target_psi_5 == -1))
  {
    stepper_5.moveTo(map(valve_5_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_5 = valve_5_psi;
    last_move_time_5 = current_time;
  }

  if ((abs(valve_7_psi - previous_target_psi_7) >= psi_deadband || previous_target_psi_7 == -1) &&
      (current_time - last_move_time_7 >= movement_delay_ms || previous_target_psi_7 == -1))
  {
    stepper_7.moveTo(map(valve_7_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps));
    previous_target_psi_7 = valve_7_psi;
    last_move_time_7 = current_time;
  }

  gauge_2_psi = map(stepper_2.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
  gauge_5_psi = map(stepper_5.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
  gauge_7_psi = map(stepper_7.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);
}

// ============================================================================
// SENSOR PUBLISHING
// ============================================================================

void check_and_publish_sensor_changes()
{
  // Check if periodic publish interval has elapsed
  unsigned long current_time = millis();
  bool force_publish = (current_time - last_sensor_publish_time >= sensor_publish_interval_ms);

  // ========================================
  // Gauge 2 - Valve PSI (potentiometer reading)
  // ========================================
  if (valve_2_psi != last_published_valve_2_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_2_psi;
    mqtt.publishJson("sensors/gauge_2", "Valve_PSI", doc);
    last_published_valve_2_psi = valve_2_psi;
  }

  // ========================================
  // Gauge 2 - Gauge PSI (needle position)
  // ========================================
  if (gauge_2_psi != last_published_gauge_2_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_2_psi;
    doc["target_psi"] = valve_2_psi;
    mqtt.publishJson("sensors/gauge_2", "Gauge_PSI", doc);
    last_published_gauge_2_psi = gauge_2_psi;
  }

  // ========================================
  // Gauge 5 - Valve PSI
  // ========================================
  if (valve_5_psi != last_published_valve_5_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_5_psi;
    mqtt.publishJson("sensors/gauge_5", "Valve_PSI", doc);
    last_published_valve_5_psi = valve_5_psi;
  }

  // ========================================
  // Gauge 5 - Gauge PSI
  // ========================================
  if (gauge_5_psi != last_published_gauge_5_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_5_psi;
    doc["target_psi"] = valve_5_psi;
    mqtt.publishJson("sensors/gauge_5", "Gauge_PSI", doc);
    last_published_gauge_5_psi = gauge_5_psi;
  }

  // ========================================
  // Gauge 7 - Valve PSI
  // ========================================
  if (valve_7_psi != last_published_valve_7_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = valve_7_psi;
    mqtt.publishJson("sensors/gauge_7", "Valve_PSI", doc);
    last_published_valve_7_psi = valve_7_psi;
  }

  // ========================================
  // Gauge 7 - Gauge PSI
  // ========================================
  if (gauge_7_psi != last_published_gauge_7_psi || force_publish)
  {
    JsonDocument doc;
    doc["psi"] = gauge_7_psi;
    doc["target_psi"] = valve_7_psi;
    mqtt.publishJson("sensors/gauge_7", "Gauge_PSI", doc);
    last_published_gauge_7_psi = gauge_7_psi;
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
  pinMode(power_led_pin, OUTPUT);
  digitalWrite(power_led_pin, HIGH);

  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("╔════════════════════════════════════════════════════════════╗");
  Serial.println("║      Sentient Engine - Gauge 2-5-7 Controller             ║");
  Serial.println("╚════════════════════════════════════════════════════════════╝");
  Serial.print("[Gauge 2-5-7] Firmware Version: ");
  Serial.println(firmware::VERSION);
  Serial.print("[Gauge 2-5-7] Unique ID: ");
  Serial.println(firmware::UNIQUE_ID);
  Serial.println();

  pinMode(gauge_2_enable_pin, OUTPUT);
  pinMode(gauge_5_enable_pin, OUTPUT);
  pinMode(gauge_7_enable_pin, OUTPUT);

  digitalWrite(gauge_2_enable_pin, HIGH);
  digitalWrite(gauge_5_enable_pin, HIGH);
  digitalWrite(gauge_7_enable_pin, HIGH);

  stepper_2.setPinsInverted(false, false, false);
  stepper_5.setPinsInverted(true, false, false);
  stepper_7.setPinsInverted(true, false, false);

  stepper_2.setMaxSpeed(stepper_max_speed);
  stepper_2.setAcceleration(stepper_acceleration);
  stepper_5.setMaxSpeed(stepper_max_speed);
  stepper_5.setAcceleration(stepper_acceleration);
  stepper_7.setMaxSpeed(stepper_max_speed);
  stepper_7.setAcceleration(stepper_acceleration);

  load_gauge_positions();

  Serial.println("[Gauge 2-5-7] Auto-zeroing gauges...");
  stepper_2.moveTo(gauge_min_steps);
  stepper_5.moveTo(gauge_min_steps);
  stepper_7.moveTo(gauge_min_steps);

  while (stepper_2.distanceToGo() != 0 || stepper_5.distanceToGo() != 0 || stepper_7.distanceToGo() != 0)
  {
    stepper_2.run();
    stepper_5.run();
    stepper_7.run();
  }

  Serial.println("[Gauge 2-5-7] Gauges zeroed");

  save_gauge_position(2);
  save_gauge_position(5);
  save_gauge_position(7);

  // Register all devices (SINGLE SOURCE OF TRUTH!)
  Serial.println("[Gauge 2-5-7] Registering devices...");
  deviceRegistry.addDevice(&dev_gauge_2);
  deviceRegistry.addDevice(&dev_gauge_5);
  deviceRegistry.addDevice(&dev_gauge_7);
  deviceRegistry.addDevice(&dev_calibration);
  deviceRegistry.printSummary();

  Serial.println("[Gauge 2-5-7] Initializing MQTT...");

  build_capability_manifest();

  mqtt.setHeartbeatBuilder(build_heartbeat_payload);
  mqtt.setCommandCallback(handle_mqtt_command);
  mqtt.begin();

  Serial.println("[Gauge 2-5-7] Waiting for broker connection...");
  while (!mqtt.isConnected())
  {
    mqtt.loop();
    delay(100);
  }
  Serial.println("[Gauge 2-5-7] Broker connected!");

  Serial.println("[Gauge 2-5-7] Registering with Sentient system...");
  if (manifest.publish_registration(mqtt.get_client(), room_id, controller_id))
  {
    Serial.println("[Gauge 2-5-7] Registration successful!");
  }
  else
  {
    Serial.println("[Gauge 2-5-7] Registration failed - check MQTT connection");
  }

  Serial.println("[Gauge 2-5-7] Ready - awaiting Sentient commands");
  Serial.println();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop()
{
  mqtt.loop();
  read_valve_positions();
  check_and_publish_sensor_changes();
  move_gauges();
  stepper_2.run();
  stepper_5.run();
  stepper_7.run();
}
