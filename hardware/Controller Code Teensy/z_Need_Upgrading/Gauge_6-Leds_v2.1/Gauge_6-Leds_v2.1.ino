/*
 * Gauge_6-Leds v2.0.1
 *
 * Teensy 4.1 Controller for Gauge 6 with LED Systems
 *
 * Hardware:
 * - 1x Stepper motor (Gauge 6) with potentiometer valve sensor
 * - 7x Photoresistor ball valve lever sensors
 * - 219x Ceiling LEDs (WS2811) - Clock face pattern
 * - 7x Individual gauge indicator LEDs (WS2812B) with flicker animation
 *
 * Architecture:
 * - NO state machines (stateless peripheral device)
 * - LISTEN → DETECT → EXECUTE pattern
 * - Separate MQTT topics for each sensor
 * - Individual commands for each LED pattern (not pattern numbers)
 * - EEPROM calibration for gauge position persistence
 * - Option A: Autonomous valve tracking when active (low latency)
 */

#include <SentientMQTT.h>
#include <SentientDeviceRegistry.h>
#include <SentientCapabilityManifest.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>
#include <FastLED.h>
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
const char *device_id = "gauge_6_leds";
const char *device_friendly_name = "Gauge 6 with LED Systems";

// ============================================================================
// HARDWARE PIN DEFINITIONS
// ============================================================================

// Power Indicator LED
const int POWERLED = 13;

// Gauge 6 Stepper Motor
const int gauge_6_dir_pin = 39;
const int gauge_6_step_pin = 40;
const int gauge_6_enable_pin = 41;
const int valve_6_pot_pin = A4;

// Ceiling Clock LEDs (219 WS2811 LEDs)
const int ceiling_data_pin = 7;
const int num_ceiling_leds = 219;

// Individual Gauge Indicator LEDs (WS2812B single pixels)
const int gauge_1_led_pin = 28; // Pin 28
const int gauge_2_led_pin = 29; // Pin 29
const int gauge_3_led_pin = 25; // Pin 25
const int gauge_4_led_pin = 26; // Pin 26
const int gauge_5_led_pin = 27; // Pin 27
const int gauge_6_led_pin = 31; // Pin 31
const int gauge_7_led_pin = 30; // Pin 30

// Ball Valve Lever Photoresistors (7 sensors)
const int lever_1_red_pin = A6;
const int lever_2_blue_pin = A8;
const int lever_3_green_pin = A9;
const int lever_4_white_pin = A5;
const int lever_5_orange_pin = A7;
const int lever_6_yellow_pin = A2;
const int lever_7_purple_pin = A3;

// Photoresistor threshold (> 500 = OPEN, < 500 = CLOSED)
const int photoresistor_threshold = 500;

// ============================================================================
// LED CONFIGURATION
// ============================================================================

// Ceiling LED sections (clock face divided into 9 sections)
const int section_start[9] = {0, 26, 51, 75, 99, 124, 150, 175, 199};
const int section_length[9] = {26, 25, 24, 24, 25, 26, 25, 24, 20};

// LED color definitions (RGB values)
const uint32_t color_gauge_base = 0x886308;
const uint32_t color_clock_blue = 0x0000FF;
const uint32_t color_clock_green = 0x00FF00;
const uint32_t color_clock_red = 0xFF0000;
const uint32_t color_clock_white = 0xFFFFFF;
const uint32_t color_clock_orange = 0xFF8800;
const uint32_t color_clock_purple = 0x8800FF;
const uint32_t color_clock_yellow = 0xFFFF00;

// Flicker colors as uint32_t (for FlickerState struct)
const uint32_t flicker_white = 0xFFFFFF;
const uint32_t flicker_blue = 0x0000FF;
const uint32_t flicker_green = 0x00FF00;
const uint32_t flicker_red = 0xFF0000;
const uint32_t flicker_orange = 0xFF5000; // 255, 80, 0
const uint32_t flicker_purple = 0x800080; // 128, 0, 128
const uint32_t flicker_yellow = 0xFFDD00;

// ============================================================================
// STEPPER MOTOR CONFIGURATION
// ============================================================================

AccelStepper stepper_6(AccelStepper::DRIVER, gauge_6_step_pin, gauge_6_dir_pin);

// Stepper motor parameters
const int max_speed = 1000;
const int acceleration = 500;

// PSI range calibration
const int psi_min = 0;
const int psi_max = 300;

// Gauge 6 calibration (analog potentiometer values)
const int valve_6_zero = 0;
const int valve_6_max = 1023;

// Gauge 6 stepper position range
const int gauge_min_steps = 0;
const int gauge_max_steps = 2400;

// Movement parameters
const int psi_deadband = 1;       // PSI must change by 1+ to trigger movement
const int movement_delay_ms = 75; // Minimum 75ms between movements

// Filter parameters
const float alpha = 0.25; // Exponential moving average filter (0.0 = no filtering, 1.0 = raw value)

// ============================================================================
// LED ARRAYS
// ============================================================================

CRGB ceiling_leds[num_ceiling_leds];
CRGB gauge_leds[7][1]; // 7 individual gauge LEDs (1 pixel each)

// ============================================================================
// HARDWARE STATE (not game logic state)
// ============================================================================

bool gauges_active = false; // Hardware execution flag

// Current valve PSI reading (from potentiometer)
int valve_6_psi = 0;

// Current gauge needle position (from stepper position)
int gauge_6_psi = 0;

// Filtering variables
float filtered_valve_6 = 0.0;

// Movement timing
int previous_target_psi_6 = -1;
unsigned long last_move_time_6 = 0;

// ============================================================================
// PHOTORESISTOR STATE
// ============================================================================

// Current raw values
int lever_1_red_raw = 0;
int lever_2_blue_raw = 0;
int lever_3_green_raw = 0;
int lever_4_white_raw = 0;
int lever_5_orange_raw = 0;
int lever_6_yellow_raw = 0;
int lever_7_purple_raw = 0;

// Current state (true = OPEN, false = CLOSED)
bool lever_1_red_open = false;
bool lever_2_blue_open = false;
bool lever_3_green_open = false;
bool lever_4_white_open = false;
bool lever_5_orange_open = false;
bool lever_6_yellow_open = false;
bool lever_7_purple_open = false;

// ============================================================================
// FLICKER ANIMATION STATE
// ============================================================================

struct FlickerState
{
  bool enabled;
  uint32_t color1;
  uint32_t color2;
  bool use_two_colors;
  unsigned long next_burst_at;
  bool active;
  unsigned long flicker_end;
  bool use_second_color;
};

FlickerState gauge_flicker[7];

// ============================================================================
// EEPROM CONFIGURATION
// ============================================================================

const int eeprom_addr_gauge6 = 0;

// ============================================================================
// CHANGE DETECTION
// ============================================================================

int last_published_valve_6_psi = -1;
int last_published_gauge_6_psi = -1;

bool last_published_lever_1_red_open = false;
bool last_published_lever_2_blue_open = false;
bool last_published_lever_3_green_open = false;
bool last_published_lever_4_white_open = false;
bool last_published_lever_5_orange_open = false;
bool last_published_lever_6_yellow_open = false;
bool last_published_lever_7_purple_open = false;
bool levers_initialized = false; // Track first publish

// Periodic sensor publishing (ensures fresh data even without changes)
unsigned long last_sensor_publish_time = 0;
const unsigned long sensor_publish_interval_ms = 60000; // Publish every 60 seconds

// ============================================================================
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ============================================================================

// Combined Gauge 6 Device (Valve Sensor + Gauge Motor)
// - Receives commands (activateGauges, inactivateGauges)
// - Publishes valve position sensor (Valve_PSI)
// - Publishes gauge needle position (Gauge_PSI)
const char *gauge_6_device_commands[] = {"activateGauges", "inactivateGauges"};
const char *gauge_6_device_sensors[] = {"Valve_PSI", "Gauge_PSI"};

// Ball Valve Lever Sensors (7 photoresistors)
const char *lever_1_red_sensors[] = {"Lever1_Red"};
const char *lever_2_blue_sensors[] = {"Lever2_Blue"};
const char *lever_3_green_sensors[] = {"Lever3_Green"};
const char *lever_4_white_sensors[] = {"Lever4_White"};
const char *lever_5_orange_sensors[] = {"Lever5_Orange"};
const char *lever_6_yellow_sensors[] = {"Lever6_Yellow"};
const char *lever_7_purple_sensors[] = {"Lever7_Purple"};

// Output LED devices
const char *ceiling_leds_commands[] = {"ceilingOff", "ceilingPattern1", "ceilingPattern4", "ceilingPattern7"};
const char *gauge_indicator_leds_commands[] = {"flickerOff", "flickerMode2", "flickerMode5", "flickerMode8", "gaugeLedsOn", "gaugeLedsOff"};

// Output calibration system
const char *calibration_commands[] = {"adjustGaugeZero", "setCurrentAsZero"};

// Create device definitions
// Gauge 6: Bidirectional (commands + sensors)
SentientDeviceDef dev_gauge_6(
    "gauge_6", "Gauge 6 (Valve + Motor)", "gauge_assembly",
    gauge_6_device_commands, 2,
    gauge_6_device_sensors, 2);

SentientDeviceDef dev_lever_1_red(
    "lever_1_red", "Ball Valve Lever 1 (Red)", "photoresistor",
    lever_1_red_sensors, 1, true);

SentientDeviceDef dev_lever_2_blue(
    "lever_2_blue", "Ball Valve Lever 2 (Blue)", "photoresistor",
    lever_2_blue_sensors, 1, true);

SentientDeviceDef dev_lever_3_green(
    "lever_3_green", "Ball Valve Lever 3 (Green)", "photoresistor",
    lever_3_green_sensors, 1, true);

SentientDeviceDef dev_lever_4_white(
    "lever_4_white", "Ball Valve Lever 4 (White)", "photoresistor",
    lever_4_white_sensors, 1, true);

SentientDeviceDef dev_lever_5_orange(
    "lever_5_orange", "Ball Valve Lever 5 (Orange)", "photoresistor",
    lever_5_orange_sensors, 1, true);

SentientDeviceDef dev_lever_6_yellow(
    "lever_6_yellow", "Ball Valve Lever 6 (Yellow)", "photoresistor",
    lever_6_yellow_sensors, 1, true);

SentientDeviceDef dev_lever_7_purple(
    "lever_7_purple", "Ball Valve Lever 7 (Purple)", "photoresistor",
    lever_7_purple_sensors, 1, true);

// Output LED devices
SentientDeviceDef dev_ceiling_leds(
    "ceiling_leds", "Ceiling Clock LEDs (219 WS2811)", "led_strip",
    ceiling_leds_commands, 4);

SentientDeviceDef dev_gauge_indicator_leds(
    "gauge_indicator_leds", "Gauge Indicator LEDs (7 WS2812B)", "led_strip",
    gauge_indicator_leds_commands, 6);

// Calibration system (output only: receives commands)
SentientDeviceDef dev_calibration(
    "calibration", "Gauge Calibration System", "calibration",
    calibration_commands, 2);

// Create the device registry
SentientDeviceRegistry deviceRegistry;

// ============================================================================
// MQTT CONFIGURATION & OBJECTS
// ============================================================================

SentientMQTTConfig build_mqtt_config()
{
  SentientMQTTConfig cfg;
  cfg.brokerIp = mqtt_broker_ip;
  cfg.brokerHost = mqtt_host;
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

// ============================================================================
// FUNCTION PROTOTYPES
// ============================================================================

void handle_mqtt_command(const char *cmd, const JsonDocument &payload, void *ctx);
bool build_heartbeat_payload(JsonDocument &doc, void *ctx);
void build_capability_manifest();

void read_sensors();
void move_gauges();
void check_and_publish_sensor_changes();
void publish_hardware_status();

void save_gauge_position(int gauge_number);
void load_gauge_positions();

void set_ceiling_off();
void set_ceiling_pattern_1();
void set_ceiling_pattern_4();
void set_ceiling_pattern_7();

void set_flicker_off();
void set_flicker_mode_2();
void set_flicker_mode_5();
void set_flicker_mode_8();

void update_gauge_flicker();

// ============================================================================
// SETUP
// ============================================================================

void setup()
{
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("========================================");
  Serial.print("Gauge 6 with LEDs v");
  Serial.println(firmware::VERSION);
  Serial.println(firmware::UNIQUE_ID);
  Serial.println("========================================");

  // Configure stepper motor
  stepper_6.setMaxSpeed(max_speed);
  stepper_6.setAcceleration(acceleration);
  stepper_6.setPinsInverted(false, false, false);

  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH); // Turn on power LED

  pinMode(gauge_6_enable_pin, OUTPUT);
  digitalWrite(gauge_6_enable_pin, HIGH); // Disabled (active LOW)

  // Initialize LEDs
  FastLED.addLeds<WS2811, ceiling_data_pin, RGB>(ceiling_leds, num_ceiling_leds);
  FastLED.addLeds<WS2812B, gauge_1_led_pin, GRB>(gauge_leds[0], 1);
  FastLED.addLeds<WS2812B, gauge_2_led_pin, GRB>(gauge_leds[1], 1);
  FastLED.addLeds<WS2812B, gauge_3_led_pin, GRB>(gauge_leds[2], 1);
  FastLED.addLeds<WS2812B, gauge_4_led_pin, GRB>(gauge_leds[3], 1);
  FastLED.addLeds<WS2812B, gauge_5_led_pin, GRB>(gauge_leds[4], 1);
  FastLED.addLeds<WS2812B, gauge_6_led_pin, GRB>(gauge_leds[5], 1);
  FastLED.addLeds<WS2812B, gauge_7_led_pin, GRB>(gauge_leds[6], 1);

  // Clear all LEDs
  FastLED.clear();
  FastLED.show();

  // Initialize flicker states
  for (int i = 0; i < 7; i++)
  {
    gauge_flicker[i].enabled = false;
    gauge_flicker[i].color1 = 0;
    gauge_flicker[i].color2 = 0;
    gauge_flicker[i].use_two_colors = false;
    gauge_flicker[i].next_burst_at = 0;
    gauge_flicker[i].active = false;
    gauge_flicker[i].flicker_end = 0;
    gauge_flicker[i].use_second_color = false;
  }

  // Load last known positions from EEPROM
  load_gauge_positions();

  // Auto-zero gauge on startup
  Serial.println("[Gauge 6] Auto-zeroing gauge...");
  stepper_6.moveTo(gauge_min_steps);

  // Wait for zero (blocking on startup)
  while (stepper_6.distanceToGo() != 0)
  {
    stepper_6.run();
  }

  Serial.println("[Gauge 6] Gauge zeroed");

  // Save zero position
  save_gauge_position(6);

  // Register all devices (SINGLE SOURCE OF TRUTH!)
  Serial.println("[Gauge 6-Leds] Registering devices...");
  deviceRegistry.addDevice(&dev_gauge_6);
  deviceRegistry.addDevice(&dev_lever_1_red);
  deviceRegistry.addDevice(&dev_lever_2_blue);
  deviceRegistry.addDevice(&dev_lever_3_green);
  deviceRegistry.addDevice(&dev_lever_4_white);
  deviceRegistry.addDevice(&dev_lever_5_orange);
  deviceRegistry.addDevice(&dev_lever_6_yellow);
  deviceRegistry.addDevice(&dev_lever_7_purple);
  deviceRegistry.addDevice(&dev_ceiling_leds);
  deviceRegistry.addDevice(&dev_gauge_indicator_leds);
  deviceRegistry.addDevice(&dev_calibration);
  deviceRegistry.printSummary();

  // Initialize MQTT
  Serial.println("[Gauge 6-Leds] Initializing MQTT...");

  build_capability_manifest();

  mqtt.setHeartbeatBuilder(build_heartbeat_payload);
  mqtt.setCommandCallback(handle_mqtt_command);
  mqtt.begin();

  // Wait for broker connection
  Serial.println("[Gauge 6-Leds] Waiting for broker connection...");
  while (!mqtt.isConnected())
  {
    mqtt.loop();
    delay(100);
  }
  Serial.println("[Gauge 6-Leds] Broker connected!");

  // Register with Sentient system
  Serial.println("[Gauge 6-Leds] Registering with Sentient system...");
  if (manifest.publish_registration(mqtt.get_client(), room_id, controller_id))
  {
    Serial.println("[Gauge 6-Leds] Registration successful!");
  }
  else
  {
    Serial.println("[Gauge 6-Leds] Registration failed - check MQTT connection");
  }

  Serial.println("[Gauge 6-Leds] Initialization complete");
  Serial.println("========================================");
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop()
{
  mqtt.loop();

  read_sensors();
  move_gauges();
  check_and_publish_sensor_changes();
  update_gauge_flicker();

  // Run stepper motors (non-blocking)
  stepper_6.run();
}

// ============================================================================
// SENSOR READING
// ============================================================================

void read_sensors()
{
  // Read valve 6 potentiometer with exponential moving average filter
  int raw_valve_6 = analogRead(valve_6_pot_pin);
  filtered_valve_6 = (alpha * raw_valve_6) + ((1.0 - alpha) * filtered_valve_6);
  valve_6_psi = map((int)filtered_valve_6, valve_6_zero, valve_6_max, psi_min, psi_max);
  valve_6_psi = constrain(valve_6_psi, psi_min, psi_max);

  // Update gauge 6 PSI from stepper position
  gauge_6_psi = map(stepper_6.currentPosition(), gauge_min_steps, gauge_max_steps, psi_min, psi_max);

  // Read photoresistor sensors (raw values)
  lever_1_red_raw = analogRead(lever_1_red_pin);
  lever_2_blue_raw = analogRead(lever_2_blue_pin);
  lever_3_green_raw = analogRead(lever_3_green_pin);
  lever_4_white_raw = analogRead(lever_4_white_pin);
  lever_5_orange_raw = analogRead(lever_5_orange_pin);
  lever_6_yellow_raw = analogRead(lever_6_yellow_pin);
  lever_7_purple_raw = analogRead(lever_7_purple_pin);

  // Convert raw values to OPEN/CLOSED states (> 500 = OPEN, <= 500 = CLOSED)
  lever_1_red_open = (lever_1_red_raw > photoresistor_threshold);
  lever_2_blue_open = (lever_2_blue_raw > photoresistor_threshold);
  lever_3_green_open = (lever_3_green_raw > photoresistor_threshold);
  lever_4_white_open = (lever_4_white_raw > photoresistor_threshold);
  lever_5_orange_open = (lever_5_orange_raw > photoresistor_threshold);
  lever_6_yellow_open = (lever_6_yellow_raw > photoresistor_threshold);
  lever_7_purple_open = (lever_7_purple_raw > photoresistor_threshold);
}

// ============================================================================
// GAUGE MOVEMENT (Option A - Autonomous Tracking)
// ============================================================================

void move_gauges()
{
  if (!gauges_active)
    return;

  unsigned long current_time = millis();

  // Move gauge 6 with deadband and time delay
  if ((abs(valve_6_psi - previous_target_psi_6) >= psi_deadband || previous_target_psi_6 == -1) &&
      (current_time - last_move_time_6 >= movement_delay_ms || previous_target_psi_6 == -1))
  {

    int target_steps = map(valve_6_psi, psi_min, psi_max, gauge_min_steps, gauge_max_steps);
    stepper_6.moveTo(target_steps);

    previous_target_psi_6 = valve_6_psi;
    last_move_time_6 = current_time;
  }
}

// ============================================================================
// SENSOR CHANGE DETECTION AND PUBLISHING
// ============================================================================

void check_and_publish_sensor_changes()
{
  if (!mqtt.isConnected())
    return;

  // Check if periodic publish interval has elapsed
  unsigned long current_time = millis();
  bool force_publish = (current_time - last_sensor_publish_time >= sensor_publish_interval_ms);

  JsonDocument doc;

  // ========================================
  // Gauge 6 - Valve PSI (potentiometer reading)
  // ========================================
  if (valve_6_psi != last_published_valve_6_psi || force_publish)
  {
    doc.clear();
    doc["psi"] = valve_6_psi;
    // mqtt.publishJson("sensors/gauge_6", "Valve_PSI", doc);
    last_published_valve_6_psi = valve_6_psi;
  }

  // ========================================
  // Gauge 6 - Gauge PSI (needle position)
  // ========================================
  if (gauge_6_psi != last_published_gauge_6_psi || force_publish)
  {
    doc.clear();
    doc["psi"] = gauge_6_psi;
    doc["target_psi"] = valve_6_psi;
    mqtt.publishJson("sensors/gauge_6", "Gauge_PSI", doc);
    last_published_gauge_6_psi = gauge_6_psi;
  }

  // Photoresistor sensors (publish OPEN/CLOSED state)
  if (lever_1_red_open != last_published_lever_1_red_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_1_red_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_1_red", doc);
    last_published_lever_1_red_open = lever_1_red_open;
  }

  if (lever_2_blue_open != last_published_lever_2_blue_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_2_blue_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_2_blue", doc);
    last_published_lever_2_blue_open = lever_2_blue_open;
  }

  if (lever_3_green_open != last_published_lever_3_green_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_3_green_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_3_green", doc);
    last_published_lever_3_green_open = lever_3_green_open;
  }

  if (lever_4_white_open != last_published_lever_4_white_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_4_white_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_4_white", doc);
    last_published_lever_4_white_open = lever_4_white_open;
  }

  if (lever_5_orange_open != last_published_lever_5_orange_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_5_orange_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_5_orange", doc);
    last_published_lever_5_orange_open = lever_5_orange_open;
  }

  if (lever_6_yellow_open != last_published_lever_6_yellow_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_6_yellow_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_6_yellow", doc);
    last_published_lever_6_yellow_open = lever_6_yellow_open;
  }

  if (lever_7_purple_open != last_published_lever_7_purple_open || !levers_initialized || force_publish)
  {
    doc.clear();
    doc["state"] = lever_7_purple_open ? "OPEN" : "CLOSED";
    mqtt.publishJson("sensors", "lever_7_purple", doc);
    last_published_lever_7_purple_open = lever_7_purple_open;
  }

  // Mark levers as initialized after first publish
  if (!levers_initialized)
  {
    levers_initialized = true;
  }

  // Update timestamp if we force published
  if (force_publish)
  {
    last_sensor_publish_time = current_time;
  }
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================

void handle_mqtt_command(const char *cmd, const JsonDocument &payload, void *ctx)
{
  Serial.print("[COMMAND] Received: ");
  Serial.println(cmd);

  String command(cmd);

  // =========================================
  // GAUGE ACTIVATION COMMANDS
  // =========================================

  if (command.equalsIgnoreCase("activateGauges") || command.equalsIgnoreCase("activate"))
  {
    digitalWrite(gauge_6_enable_pin, LOW); // Enable stepper (active LOW)
    gauges_active = true;
    Serial.println("[GAUGES] Activated - tracking valve position");
    publish_hardware_status();
  }

  else if (command.equalsIgnoreCase("inactivateGauges") || command.equalsIgnoreCase("inactivate"))
  {
    gauges_active = false;
    stepper_6.moveTo(gauge_min_steps); // Move to zero
    Serial.println("[GAUGES] Inactivated - moving to zero");
    publish_hardware_status();
  }

  // =========================================
  // CALIBRATION COMMANDS
  // =========================================

  else if (command.equalsIgnoreCase("adjustGaugeZero"))
  {
    // REQUIRED: Validate JSON parameters
    if (!payload.containsKey("gauge") || !payload.containsKey("steps"))
    {
      Serial.println("[ERROR] adjustGaugeZero requires 'gauge' and 'steps' parameters");
      Serial.println("[ERROR] Example: {\"gauge\": 6, \"steps\": 10}");
      return;
    }

    int gauge_num = payload["gauge"];
    int steps = payload["steps"]; // Positive = move forward, negative = move back

    if (gauge_num == 6)
    {
      stepper_6.move(steps);
      Serial.print("[CALIBRATION] Adjusting Gauge 6 by ");
      Serial.print(steps);
      Serial.println(" steps");
    }
    else
    {
      Serial.println("[ERROR] Invalid gauge number for this controller (only gauge 6)");
    }
  }

  else if (command.equalsIgnoreCase("setCurrentAsZero"))
  {
    // REQUIRED: Validate JSON parameters
    if (!payload.containsKey("gauge"))
    {
      Serial.println("[ERROR] setCurrentAsZero requires 'gauge' parameter");
      Serial.println("[ERROR] Example: {\"gauge\": 6}");
      return;
    }

    int gauge_num = payload["gauge"];

    if (gauge_num == 6)
    {
      stepper_6.setCurrentPosition(gauge_min_steps);
      save_gauge_position(6);
      Serial.println("[CALIBRATION] Gauge 6 - current position set as zero");
    }
    else
    {
      Serial.println("[ERROR] Invalid gauge number for this controller (only gauge 6)");
    }
  }

  // =========================================
  // CEILING LED PATTERN COMMANDS
  // =========================================

  else if (command.equalsIgnoreCase("ceilingOff"))
  {
    set_ceiling_off();
    Serial.println("[CEILING] All LEDs off");
  }

  else if (command.equalsIgnoreCase("ceilingPattern1"))
  {
    set_ceiling_pattern_1();
    Serial.println("[CEILING] Pattern 1 - Blue section 2, Green section 7");
  }

  else if (command.equalsIgnoreCase("ceilingPattern4"))
  {
    set_ceiling_pattern_4();
    Serial.println("[CEILING] Pattern 4 - Red section 1, White section 5, Orange section 8");
  }

  else if (command.equalsIgnoreCase("ceilingPattern7"))
  {
    set_ceiling_pattern_7();
    Serial.println("[CEILING] Pattern 7 - Multiple sections");
  }

  // =========================================
  // GAUGE INDICATOR LED FLICKER COMMANDS
  // =========================================

  else if (command.equalsIgnoreCase("flickerOff"))
  {
    set_flicker_off();
    Serial.println("[FLICKER] All gauge LEDs off");
  }

  else if (command.equalsIgnoreCase("flickerMode2"))
  {
    set_flicker_mode_2();
    Serial.println("[FLICKER] Mode 2 - Gauge 4 blue flicker, Gauge 6 green flicker");
  }

  else if (command.equalsIgnoreCase("flickerMode5"))
  {
    set_flicker_mode_5();
    Serial.println("[FLICKER] Mode 5 - G1:red G2:orange G3:white G7:orange");
  }

  else if (command.equalsIgnoreCase("flickerMode8"))
  {
    set_flicker_mode_8();
    Serial.println("[FLICKER] Mode 8 - G1:red G2:orange/purple G3:white G4:blue G5:purple G6:orange G7:orange");
  }
  else if (command.equalsIgnoreCase("gaugeLedsOn"))
  {
    // Turn on all gauge LEDs with base color
    for (int i = 0; i < 7; i++)
    {
      gauge_flicker[i].enabled = false; // Disable flicker
      gauge_leds[i][0] = CRGB(color_gauge_base);
    }
    FastLED.show();
    Serial.println("[GAUGE LEDS] All gauge LEDs ON (base color)");
  }
  else if (command.equalsIgnoreCase("gaugeLedsOff"))
  {
    // Turn off all gauge LEDs
    for (int i = 0; i < 7; i++)
    {
      gauge_flicker[i].enabled = false; // Disable flicker
      gauge_leds[i][0] = CRGB::Black;
    }
    FastLED.show();
    Serial.println("[GAUGE LEDS] All gauge LEDs OFF");
  }

  else
  {
    Serial.print("[WARNING] Unknown command: ");
    Serial.println(cmd);
  }
}

// ============================================================================
// CEILING LED PATTERNS
// ============================================================================

void set_ceiling_off()
{
  FastLED.clear();
  FastLED.show();
}

void set_ceiling_pattern_1()
{
  // Blue section 2, Green section 7
  FastLED.clear();
  fill_solid(&ceiling_leds[section_start[2]], section_length[2], CRGB(color_clock_blue));
  fill_solid(&ceiling_leds[section_start[7]], section_length[7], CRGB(color_clock_green));
  FastLED.show();
}

void set_ceiling_pattern_4()
{
  // Red section 1, White section 5, Orange section 8
  FastLED.clear();
  fill_solid(&ceiling_leds[section_start[1]], section_length[1], CRGB(color_clock_red));
  fill_solid(&ceiling_leds[section_start[5]], section_length[5], CRGB(color_clock_white));
  fill_solid(&ceiling_leds[section_start[8]], section_length[8], CRGB(color_clock_orange));
  FastLED.show();
}

void set_ceiling_pattern_7()
{
  // Multiple sections: Purple 1, Blue 2, Yellow 5, Green 7
  FastLED.clear();
  fill_solid(&ceiling_leds[section_start[1]], section_length[1], CRGB(color_clock_purple));
  fill_solid(&ceiling_leds[section_start[2]], section_length[2], CRGB(color_clock_blue));
  fill_solid(&ceiling_leds[section_start[5]], section_length[5], CRGB(color_clock_yellow));
  fill_solid(&ceiling_leds[section_start[7]], section_length[7], CRGB(color_clock_green));
  FastLED.show();
}

// ============================================================================
// GAUGE INDICATOR LED FLICKER MODES
// ============================================================================

void set_flicker_off()
{
  for (int i = 0; i < 7; i++)
  {
    gauge_flicker[i].enabled = false;
    gauge_leds[i][0] = CRGB::Black;
  }
  FastLED.show();
}

void set_flicker_mode_2()
{
  // Gauges 4 & 6 (indices 3 & 5) - Gauge 4 flickers BLUE, Gauge 6 flickers GREEN
  // First, set ALL gauges to base color (solid)
  for (int i = 0; i < 7; i++)
  {
    gauge_flicker[i].enabled = false;
    gauge_leds[i][0] = CRGB(color_gauge_base);
  }

  // Gauge 4 (index 3) flickers between BLUE and base color
  gauge_flicker[3].enabled = true;
  gauge_flicker[3].color1 = flicker_blue;
  gauge_flicker[3].color2 = color_gauge_base;
  gauge_flicker[3].use_two_colors = true;

  // Gauge 6 (index 5) flickers between GREEN and base color
  gauge_flicker[5].enabled = true;
  gauge_flicker[5].color1 = flicker_green;
  gauge_flicker[5].color2 = color_gauge_base;
  gauge_flicker[5].use_two_colors = true;

  FastLED.show();
}

void set_flicker_mode_5()
{
  // Gauges 1, 2, 3, 7 with specific colors
  // First, set ALL gauges to base color (solid)
  for (int i = 0; i < 7; i++)
  {
    gauge_flicker[i].enabled = false;
    gauge_leds[i][0] = CRGB(color_gauge_base);
  }

  // Gauge 1 (index 0) flickers between RED and base color
  gauge_flicker[0].enabled = true;
  gauge_flicker[0].color1 = flicker_red;
  gauge_flicker[0].color2 = color_gauge_base;
  gauge_flicker[0].use_two_colors = true;

  // Gauge 2 (index 1) flickers between ORANGE and base color
  gauge_flicker[1].enabled = true;
  gauge_flicker[1].color1 = flicker_orange;
  gauge_flicker[1].color2 = color_gauge_base;
  gauge_flicker[1].use_two_colors = true;

  // Gauge 3 (index 2) flickers between WHITE and base color
  gauge_flicker[2].enabled = true;
  gauge_flicker[2].color1 = flicker_white;
  gauge_flicker[2].color2 = color_gauge_base;
  gauge_flicker[2].use_two_colors = true;

  // Gauge 7 (index 6) flickers between ORANGE and base color
  gauge_flicker[6].enabled = true;
  gauge_flicker[6].color1 = flicker_orange;
  gauge_flicker[6].color2 = color_gauge_base;
  gauge_flicker[6].use_two_colors = true;

  FastLED.show();
}

void set_flicker_mode_8()
{
  // Each gauge flickers with its specific color
  // First, set ALL gauges to base color (solid)
  for (int i = 0; i < 7; i++)
  {
    gauge_flicker[i].enabled = false;
    gauge_leds[i][0] = CRGB(color_gauge_base);
  }

  // Gauge 1 (index 0) - RED
  gauge_flicker[0].enabled = true;
  gauge_flicker[0].color1 = flicker_red;
  gauge_flicker[0].color2 = color_gauge_base;
  gauge_flicker[0].use_two_colors = true;

  // Gauge 2 (index 1) - Alternates ORANGE and PURPLE (special 3-color mode)
  gauge_flicker[1].enabled = true;
  gauge_flicker[1].color1 = flicker_orange;
  gauge_flicker[1].color2 = flicker_purple;
  gauge_flicker[1].use_two_colors = true;

  // Gauge 3 (index 2) - WHITE
  gauge_flicker[2].enabled = true;
  gauge_flicker[2].color1 = flicker_white;
  gauge_flicker[2].color2 = color_gauge_base;
  gauge_flicker[2].use_two_colors = true;

  // Gauge 4 (index 3) - BLUE
  gauge_flicker[3].enabled = true;
  gauge_flicker[3].color1 = flicker_blue;
  gauge_flicker[3].color2 = color_gauge_base;
  gauge_flicker[3].use_two_colors = true;

  // Gauge 5 (index 4) - PURPLE
  gauge_flicker[4].enabled = true;
  gauge_flicker[4].color1 = flicker_purple;
  gauge_flicker[4].color2 = color_gauge_base;
  gauge_flicker[4].use_two_colors = true;

  // Gauge 6 (index 5) - ORANGE
  gauge_flicker[5].enabled = true;
  gauge_flicker[5].color1 = flicker_orange;
  gauge_flicker[5].color2 = color_gauge_base;
  gauge_flicker[5].use_two_colors = true;

  // Gauge 7 (index 6) - ORANGE
  gauge_flicker[6].enabled = true;
  gauge_flicker[6].color1 = flicker_orange;
  gauge_flicker[6].color2 = color_gauge_base;
  gauge_flicker[6].use_two_colors = true;

  FastLED.show();
}

// ============================================================================
// FLICKER ANIMATION UPDATE
// ============================================================================

void update_gauge_flicker()
{
  unsigned long now = millis();
  bool any_active = false;

  for (int i = 0; i < 7; i++)
  {
    if (!gauge_flicker[i].enabled)
    {
      continue;
    }

    FlickerState &fs = gauge_flicker[i];

    // Start new burst if needed
    if (!fs.active)
    {
      if (now >= fs.next_burst_at)
      {
        fs.active = true;
        fs.flicker_end = now + random(50, 250);
        fs.use_second_color = (fs.use_two_colors && random(2) == 0);
        fs.next_burst_at = now + random(100, 500);
      }
    }

    // Update active flicker
    if (fs.active && now <= fs.flicker_end)
    {
      CRGB color = (fs.use_two_colors && fs.use_second_color) ? CRGB(fs.color2) : CRGB(fs.color1);
      color.nscale8_video(random(256)); // Random brightness
      gauge_leds[i][0] = color;
      any_active = true;
    }
    else if (fs.active && now > fs.flicker_end)
    {
      // End burst
      fs.active = false;
      gauge_leds[i][0] = CRGB::Black;
    }
  }

  if (any_active)
  {
    FastLED.show();
  }
}

// ============================================================================
// EEPROM PERSISTENCE
// ============================================================================

void save_gauge_position(int gauge_number)
{
  if (gauge_number != 6)
  {
    Serial.println("[ERROR] Invalid gauge number for this controller (only gauge 6)");
    return;
  }

  int position = stepper_6.currentPosition();
  EEPROM.put(eeprom_addr_gauge6, position);

  Serial.print("[EEPROM] Saved Gauge 6 position: ");
  Serial.println(position);
}

void load_gauge_positions()
{
  int position6;
  EEPROM.get(eeprom_addr_gauge6, position6);

  // Sanity check (if EEPROM is uninitialized, values might be garbage)
  if (position6 < -5000 || position6 > 5000)
  {
    position6 = 0;
  }

  stepper_6.setCurrentPosition(position6);

  Serial.print("[EEPROM] Loaded Gauge 6 position: ");
  Serial.println(position6);
}

// ============================================================================
// STATUS PUBLISHING
// ============================================================================

void publish_hardware_status()
{
  if (!mqtt.isConnected())
    return;

  JsonDocument doc;
  doc["gauges_active"] = gauges_active;
  doc["gauge_6_position"] = stepper_6.currentPosition();
  doc["valve_6_psi"] = valve_6_psi;
  doc["ts"] = millis();

  mqtt.publishJson("status", "hardware", doc);
}

// ============================================================================
// HEARTBEAT
// ============================================================================

bool build_heartbeat_payload(JsonDocument &doc, void *ctx)
{
  doc["uid"] = firmware::UNIQUE_ID;
  doc["fw"] = firmware::VERSION;
  doc["up"] = millis();
  return true;
}

// ============================================================================
// CAPABILITY MANIFEST
// ============================================================================

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
  // All 12 devices and their topics are defined once in the Device Registry section above.
}
