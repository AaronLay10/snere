// ============================================================================
// SECTION 1: INCLUDES AND GLOBAL DECLARATIONS
// ============================================================================

// Library configuration
#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN
#ifndef MQTT_MAX_PACKET_SIZE
#define MQTT_MAX_PACKET_SIZE 512
#endif

// Required libraries
#include <SentientCapabilityManifest.h>
#include <SentientMQTT.h>
#include <SentientDeviceRegistry.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <Adafruit_TCS34725.h>
#include <Wire.h>
#include "FirmwareMetadata.h"

// ──────────────────────────────────────────────────────────────────────────────
// Device Definitions
// ──────────────────────────────────────────────────────────────────────────────
// *** Boiler Fire LED Animation - 6 strips of WS2812B LEDs arranged in two banks of three strips each
// *** Newell Post Power Control - Relay with 1 output pin
// *** Flange LED Strip - Single WS2812B LED strip around the flange, used for status indication
// *** Boiler Monitor Power Control - Relay to control power to the boiler monitor
// *** Color Sensor - TCS34725 for color temperature and lux measurement

// ──────────────────────────────────────────────────────────────────────────────
// Pin Assignments
// ──────────────────────────────────────────────────────────────────────────────
const int power_led_pin = 13;
const int led_pin_a = 2;           // Boiler Bank 1, Strip 1
const int led_pin_b = 3;           // Boiler Bank 1, Strip 2
const int led_pin_c = 4;           // Boiler Bank 1, Strip 3
const int led_pin_d = 5;           // Boiler Bank 2, Strip 1
const int led_pin_e = 6;           // Boiler Bank 2, Strip 2
const int led_pin_f = 7;           // Boiler Bank 2, Strip 3
const int boiler_monitor_pin = 10; // Boiler Monitor Power Relay
const int newell_power_pin = 9;    // Newell Post Power Relay
const int led_flange_pin = 24;     // Flange Status LED Strip

// ──────────────────────────────────────────────────────────────────────────────
// Configuration Constants
// ──────────────────────────────────────────────────────────────────────────────
const int num_leds = 34;
const unsigned long heartbeat_interval_ms = 5000;
const int color_temp_threshold = 50; // Change detection threshold for color sensor
const int lux_threshold = 10;        // Change detection threshold for lux

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Configuration
// ──────────────────────────────────────────────────────────────────────────────
const IPAddress mqtt_broker_ip(192, 168, 20, 3);
const char *mqtt_host = "sentientengine.ai";
const int mqtt_port = 1883;
const char *mqtt_namespace = "paragon";
const char *room_id = "clockwork";
// Single source of truth: controller_id comes from firmware::UNIQUE_ID
const char *controller_id = firmware::UNIQUE_ID;
const char *controller_model = "teensy41";
const char *device_id = "teensy_4_1";
const char *device_friendly_name = "Pilot Light Controller";
static const size_t metadata_json_capacity = 1024;

// ──────────────────────────────────────────────────────────────────────────────
// Hardware State Variables
// ──────────────────────────────────────────────────────────────────────────────
bool fire_leds_active = false;
bool boiler_monitor_on = false;
bool newell_power_on = true;
bool manual_heartbeat_requested = false;

// ──────────────────────────────────────────────────────────────────────────────
// Hardware Objects
// ──────────────────────────────────────────────────────────────────────────────
// LED arrays
CRGB leds_b1s1[num_leds];
CRGB leds_b1s2[num_leds];
CRGB leds_b1s3[num_leds];
CRGB leds_b2s1[num_leds];
CRGB leds_b2s2[num_leds];
CRGB leds_b2s3[num_leds];
CRGB leds_flange[num_leds];
CRGBPalette16 fire_palette;
int heat[num_leds];
int flame[num_leds];

// Sensor hardware
Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_154MS, TCS34725_GAIN_1X);
bool color_sensor_available = false;
uint16_t last_color_temp = 0;
uint16_t last_lux = 0;
unsigned long last_sensor_publish_time = 0;
const unsigned long sensor_publish_interval_ms = 60000; // Publish every 60 seconds regardless of change

// ============================================================================
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ============================================================================

// Define command arrays - Separate commands for on/off actions
const char *fireLEDs_commands[] = {"fireLEDs_on", "fireLEDs_off"};
const char *boilerMonitor_commands[] = {"boilerMonitor_on", "boilerMonitor_off"};
const char *newellPower_commands[] = {"newellPower_on", "newellPower_off"};
const char *flangeLEDs_commands[] = {"flangeLEDs_on", "flangeLEDs_off"};

// Define sensor arrays
const char *colorSensor_sensors[] = {"ColorSensor"};

// Create device definitions
SentientDeviceDef dev_fire_leds(
    "boiler_fire_leds", "Boiler Fire Animation", "led_strip",
    fireLEDs_commands, 2);

SentientDeviceDef dev_boiler_monitor(
    "boiler_monitor_relay", "Boiler Monitor Power", "relay",
    boilerMonitor_commands, 2);

SentientDeviceDef dev_newell_power(
    "newell_power_relay", "Newell Post Power", "relay",
    newellPower_commands, 2);

SentientDeviceDef dev_flange_leds(
    "flange_status_leds", "Flange Status Strip", "led_strip",
    flangeLEDs_commands, 2);

SentientDeviceDef dev_color_sensor(
    "color_sensor", "Color Temperature Sensor", "sensor",
    colorSensor_sensors, 1, true // true = input device
);

// Create the device registry
SentientDeviceRegistry deviceRegistry;

// ──────────────────────────────────────────────────────────────────────────────
// Forward Declarations
// ──────────────────────────────────────────────────────────────────────────────
void build_capability_manifest();
SentientMQTTConfig build_mqtt_config();
bool build_heartbeat_payload(JsonDocument &doc, void *ctx);
void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx);
void fill_fire_frame();
void check_and_publish_sensor_changes();
void publish_hardware_status();
void publish_full_status();
void publish_device_profile();
const char *get_hardware_label();
const char *build_device_identifier();
bool parse_truth(const String &value);
String extract_command_value(const JsonDocument &payload);

// MQTT objects
SentientCapabilityManifest manifest;
SentientMQTT mqtt(build_mqtt_config());

// ============================================================================
// SECTION 2: SETUP FUNCTION
// ============================================================================

void setup()
{
  Serial.begin(115200);
  unsigned long waited = 0;
  while (!Serial && waited < 2000)
  {
    delay(10);
    waited += 10;
  }

  Serial.println(F("=== PilotLight Controller - STATELESS MODE ==="));
  Serial.print(F("Board: "));
  Serial.println(teensyBoardVersion());
  Serial.print(F("USB SN: "));
  Serial.println(teensyUsbSN());
  Serial.print(F("MAC: "));
  Serial.println(teensyMAC());
  Serial.print(F("Firmware: "));
  Serial.println(firmware::VERSION);

  // Initialize GPIO pins
  pinMode(power_led_pin, OUTPUT);
  pinMode(boiler_monitor_pin, OUTPUT);
  pinMode(newell_power_pin, OUTPUT);

  digitalWrite(power_led_pin, HIGH);
  digitalWrite(boiler_monitor_pin, LOW);
  digitalWrite(newell_power_pin, HIGH); // Newell defaults to ON

  // Initialize LED strips
  FastLED.addLeds<WS2812B, led_pin_a, GRB>(leds_b1s1, num_leds);
  FastLED.addLeds<WS2812B, led_pin_b, GRB>(leds_b1s2, num_leds);
  FastLED.addLeds<WS2812B, led_pin_c, GRB>(leds_b1s3, num_leds);
  FastLED.addLeds<WS2812B, led_pin_d, GRB>(leds_b2s1, num_leds);
  FastLED.addLeds<WS2812B, led_pin_e, GRB>(leds_b2s2, num_leds);
  FastLED.addLeds<WS2812B, led_pin_f, GRB>(leds_b2s3, num_leds);
  FastLED.addLeds<WS2812B, led_flange_pin, GRB>(leds_flange, num_leds);
  FastLED.setBrightness(250);

  fire_palette = CRGBPalette16(0x3A79EB, 0x6495ED, 0xFC6000);
  randomSeed(analogRead(A0));

  // Set initial LED state
  FastLED.clear();
  fill_solid(leds_flange, num_leds, CRGB::Green);
  FastLED.show();

  // Try to initialize color sensor
  color_sensor_available = tcs.begin();
  Serial.print(F("Color sensor: "));
  Serial.println(color_sensor_available ? F("found") : F("missing"));

  // Register all devices (SINGLE SOURCE OF TRUTH!)
  Serial.println(F("[PilotLight] Registering devices..."));
  deviceRegistry.addDevice(&dev_fire_leds);
  deviceRegistry.addDevice(&dev_boiler_monitor);
  deviceRegistry.addDevice(&dev_newell_power);
  deviceRegistry.addDevice(&dev_flange_leds);
  deviceRegistry.addDevice(&dev_color_sensor);
  deviceRegistry.printSummary();

  // Build capability manifest
  Serial.println(F("[PilotLight] Building capability manifest..."));
  build_capability_manifest();
  Serial.println(F("[PilotLight] Manifest built successfully"));

  // Initialize MQTT
  Serial.println(F("[PilotLight] Initializing MQTT..."));
  if (!mqtt.begin())
  {
    Serial.println(F("[PilotLight] MQTT initialization failed - continuing without network"));
  }
  else
  {
    Serial.println(F("[PilotLight] MQTT initialization successful"));
    mqtt.setCommandCallback(handle_mqtt_command);
    mqtt.setHeartbeatBuilder(build_heartbeat_payload);

    // Wait for broker connection (max 5 seconds)
    Serial.println(F("[PilotLight] Waiting for broker connection..."));
    unsigned long connection_start = millis();
    while (!mqtt.isConnected() && (millis() - connection_start < 5000))
    {
      mqtt.loop();
      delay(100);
    }

    if (mqtt.isConnected())
    {
      Serial.println(F("[PilotLight] Broker connected!"));

      // Register with Sentient system
      Serial.println(F("[PilotLight] Registering with Sentient system..."));
      if (manifest.publish_registration(mqtt.get_client(), room_id, controller_id))
      {
        Serial.println(F("[PilotLight] Registration successful!"));
      }
      else
      {
        Serial.println(F("[PilotLight] Registration failed - will retry later"));
      }

      // Publish initial status
      publish_device_profile();
      publish_full_status();
    }
    else
    {
      Serial.println(F("[PilotLight] Broker connection timeout - will retry in main loop"));
    }
  }

  Serial.println(F("[PilotLight] Ready - awaiting Sentient commands"));
  Serial.print(F("[PilotLight] Firmware: "));
  Serial.println(firmware::VERSION);
}

// ============================================================================
// SECTION 3: LOOP FUNCTION
// ============================================================================

void loop()
{
  // 1. LISTEN for commands from Sentient
  mqtt.loop();

  // 2. DETECT sensor changes and publish if needed
  check_and_publish_sensor_changes();

  // 3. EXECUTE active hardware operations
  if (fire_leds_active)
  {
    fill_fire_frame(); // Run fire animation
  }

  // Handle manual heartbeat requests
  if (manual_heartbeat_requested)
  {
    if (mqtt.publishHeartbeat())
    {
      manual_heartbeat_requested = false;
    }
  }
}

// ============================================================================
// SECTION 4: COMMANDS AND ASSOCIATED FUNCTIONS
// ============================================================================

void handle_mqtt_command(const char *command, const JsonDocument &payload, void * /*ctx*/)
{
  String value = extract_command_value(payload);
  String cmd = String(command);

  Serial.print(F("[PilotLight] Command: "));
  Serial.print(command);
  Serial.print(F(" = "));
  Serial.println(value);

  // Command 1a: fireLEDs_on - Turn ON fire LED animation
  if (cmd.equalsIgnoreCase("fireLEDs_on"))
  {
    fire_leds_active = true;
    Serial.println(F("[PilotLight] Fire LEDs: ON"));
    publish_hardware_status();
  }

  // Command 1b: fireLEDs_off - Turn OFF fire LED animation
  else if (cmd.equalsIgnoreCase("fireLEDs_off"))
  {
    fire_leds_active = false;

    // Turn all fire LED strips to black
    fill_solid(leds_b1s1, num_leds, CRGB::Black);
    fill_solid(leds_b1s2, num_leds, CRGB::Black);
    fill_solid(leds_b1s3, num_leds, CRGB::Black);
    fill_solid(leds_b2s1, num_leds, CRGB::Black);
    fill_solid(leds_b2s2, num_leds, CRGB::Black);
    fill_solid(leds_b2s3, num_leds, CRGB::Black);
    FastLED.show();

    Serial.println(F("[PilotLight] Fire LEDs: OFF"));
    publish_hardware_status();
  }

  // Command 2a: boilerMonitor_on - Turn ON Boiler Monitor power relay
  else if (cmd.equalsIgnoreCase("boilerMonitor_on"))
  {
    boiler_monitor_on = true;
    digitalWrite(boiler_monitor_pin, HIGH);
    Serial.println(F("[PilotLight] Boiler Monitor: ON"));
    publish_hardware_status();
  }

  // Command 2b: boilerMonitor_off - Turn OFF Boiler Monitor power relay
  else if (cmd.equalsIgnoreCase("boilerMonitor_off"))
  {
    boiler_monitor_on = false;
    digitalWrite(boiler_monitor_pin, LOW);
    Serial.println(F("[PilotLight] Boiler Monitor: OFF"));
    publish_hardware_status();
  }

  // Command 3a: newellPower_on - Turn ON Newell power
  else if (cmd.equalsIgnoreCase("newellPower_on"))
  {
    newell_power_on = true;
    digitalWrite(newell_power_pin, HIGH);
    Serial.println(F("[PilotLight] Newell Power: ON"));
    publish_hardware_status();
  }

  // Command 3b: newellPower_off - Turn OFF Newell power
  else if (cmd.equalsIgnoreCase("newellPower_off"))
  {
    newell_power_on = false;
    digitalWrite(newell_power_pin, LOW);
    Serial.println(F("[PilotLight] Newell Power: OFF"));
    publish_hardware_status();
  }

  // Command 4a: flangeLEDs_on - Turn ON Flange LEDs (green)
  else if (cmd.equalsIgnoreCase("flangeLEDs_on"))
  {
    fill_solid(leds_flange, num_leds, CRGB::Green);
    FastLED.show();
    Serial.println(F("[PilotLight] Flange LEDs: ON (Green)"));
    publish_hardware_status();
  }

  // Command 4b: flangeLEDs_off - Turn OFF Flange LEDs (black)
  else if (cmd.equalsIgnoreCase("flangeLEDs_off"))
  {
    fill_solid(leds_flange, num_leds, CRGB::Black);
    FastLED.show();
    Serial.println(F("[PilotLight] Flange LEDs: OFF (Black)"));
    publish_hardware_status();
  }

  // Command 5: requestStatus - Sentient requesting full status
  else if (cmd.equalsIgnoreCase("requestStatus"))
  {
    Serial.println(F("[PilotLight] Status requested"));
    publish_full_status();
  }

  // Command 6: reset - Reset all hardware to safe state
  else if (cmd.equalsIgnoreCase("reset"))
  {
    Serial.println(F("[PilotLight] RESET command"));
    fire_leds_active = false;
    boiler_monitor_on = false;
    newell_power_on = false;

    // Turn off all LEDs
    fill_solid(leds_b1s1, num_leds, CRGB::Black);
    fill_solid(leds_b1s2, num_leds, CRGB::Black);
    fill_solid(leds_b1s3, num_leds, CRGB::Black);
    fill_solid(leds_b2s1, num_leds, CRGB::Black);
    fill_solid(leds_b2s2, num_leds, CRGB::Black);
    fill_solid(leds_b2s3, num_leds, CRGB::Black);
    fill_solid(leds_flange, num_leds, CRGB::Red); // Red = reset/error state
    FastLED.show();

    // Turn off all relays
    digitalWrite(boiler_monitor_pin, LOW);
    digitalWrite(newell_power_pin, LOW);

    publish_hardware_status();
    Serial.println(F("[PilotLight] Hardware reset complete"));
  }

  // Command 7: heartbeat - Manual heartbeat request
  else if (cmd.equalsIgnoreCase("heartbeat"))
  {
    manual_heartbeat_requested = true;
  }

  // Command 8: warmUpFogMachine - Pass through to external controller
  else if (cmd.equalsIgnoreCase("warmUpFogMachine"))
  {
    Serial.println(F("[PilotLight] Fog machine command (external)"));
    DynamicJsonDocument doc(200);
    doc["action"] = "warmUpFogMachine";
    mqtt.publishEvent("Command", doc);
  }

  // Unknown command
  else
  {
    Serial.print(F("[PilotLight] Unknown command: "));
    Serial.println(command);
  }
}

// Hardware execution function - Fire animation
void fill_fire_frame()
{
  static int boom_index = -1;
  static unsigned long last_debug = 0;

  // Debug output every 5 seconds
  if (millis() - last_debug > 5000)
  {
    Serial.println(F("[PilotLight] Fire animation running..."));
    last_debug = millis();
  }

  // Fire animation logic
  int i = random(0, num_leds);
  heat[i] = qsub8(heat[i], random8(1, 10));
  flame[i] = random(-50, 50);
  if (flame[i] == 0)
  {
    flame[i] = random(1, 50);
  }

  for (int idx = 0; idx < num_leds; idx++)
  {
    heat[idx] = min(255, max(100, heat[idx] + flame[idx]));

    CRGB color = ColorFromPalette(fire_palette, scale8(heat[idx], 240), scale8(heat[idx], 250), LINEARBLEND);
    leds_b1s1[idx] = color;
    leds_b1s2[idx] = color;
    leds_b1s3[idx] = color;
    leds_b2s1[idx] = color;
    leds_b2s2[idx] = color;
    leds_b2s3[idx] = color;

    if (heat[idx] > 250)
    {
      boom_index = idx;
    }

    flame[idx] = (heat[idx] + flame[idx] > 255) ? random(-50, -1)
                 : (heat[idx] < 0)              ? random(1, 50)
                                                : flame[idx];

    if (heat[idx] < 250 && boom_index == idx)
    {
      boom_index = -1;
    }
  }

  FastLED.show();
}

// ============================================================================
// SECTION 5: ALL OTHER FUNCTIONS
// ============================================================================

// ──────────────────────────────────────────────────────────────────────────────
// Capability Manifest Builder
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Configuration Builder
// ──────────────────────────────────────────────────────────────────────────────
SentientMQTTConfig build_mqtt_config()
{
  SentientMQTTConfig cfg{};
  if (mqtt_host && mqtt_host[0] != '\0')
  {
    cfg.brokerHost = mqtt_host;
  }
  cfg.brokerIp = mqtt_broker_ip;
  cfg.brokerPort = mqtt_port;
  cfg.namespaceId = mqtt_namespace;
  cfg.roomId = room_id;
  cfg.puzzleId = controller_id;
  cfg.deviceId = device_id;
  cfg.displayName = device_friendly_name;
  cfg.publishJsonCapacity = 1536; // Increased for large registration messages
  cfg.heartbeatIntervalMs = heartbeat_interval_ms;
  cfg.autoHeartbeat = true;
#if !defined(ESP32)
  cfg.useDhcp = true;
#endif
  return cfg;
}

// ──────────────────────────────────────────────────────────────────────────────
// Heartbeat Builder - Minimal identity only
// ──────────────────────────────────────────────────────────────────────────────
bool build_heartbeat_payload(JsonDocument &doc, void * /*ctx*/)
{
  doc["uid"] = firmware::UNIQUE_ID;
  doc["fw"] = firmware::VERSION;
  doc["up"] = millis();
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sensor Monitoring - Change-based + Periodic publishing
// Publishes when values change OR every 60 seconds to ensure fresh data
// ──────────────────────────────────────────────────────────────────────────────
void check_and_publish_sensor_changes()
{
  // Try to initialize sensor if not available
  if (!color_sensor_available)
  {
    color_sensor_available = tcs.begin();
    if (!color_sensor_available)
    {
      return;
    }
  }

  // Read current sensor values
  uint16_t r, g, b, c;
  tcs.getRawData(&r, &g, &b, &c);
  uint16_t color_temp = tcs.calculateColorTemperature_dn40(r, g, b, c);
  uint16_t lux = tcs.calculateLux(r, g, b);

  // Check if values changed beyond threshold OR if it's been too long since last publish
  unsigned long current_time = millis();
  bool changed = false;
  bool force_publish = (current_time - last_sensor_publish_time >= sensor_publish_interval_ms);

  // Check if either value changed beyond threshold
  if (abs((int)color_temp - (int)last_color_temp) >= color_temp_threshold)
  {
    changed = true;
  }

  if (abs((int)lux - (int)last_lux) >= lux_threshold)
  {
    changed = true;
  }

  // Publish if something changed OR if periodic interval has elapsed
  if (changed || force_publish)
  {
    // Always include BOTH values when publishing (complete sensor state)
    DynamicJsonDocument doc(256);
    doc["color_temp"] = color_temp;
    doc["lux"] = lux;
    doc["ts"] = millis();

    mqtt.publishJson("sensors", "color_sensor", doc);

    // Update last published values
    last_color_temp = color_temp;
    last_lux = lux;
    last_sensor_publish_time = current_time;

    if (force_publish)
    {
      Serial.println(F("[PilotLight] Periodic sensor update - published"));
    }
    else
    {
      Serial.println(F("[PilotLight] Sensor change detected - published"));
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Status Publishing
// ──────────────────────────────────────────────────────────────────────────────
void publish_hardware_status()
{
  DynamicJsonDocument doc(256);
  doc["fireLEDs"] = fire_leds_active;
  doc["monitorPower"] = boiler_monitor_on;
  doc["newellPower"] = newell_power_on;
  doc["ts"] = millis();
  doc["uid"] = firmware::UNIQUE_ID;
  mqtt.publishState("hardware", doc);
}

void publish_full_status()
{
  DynamicJsonDocument doc(metadata_json_capacity);

  // Current sensor readings
  if (color_sensor_available)
  {
    uint16_t r, g, b, c;
    tcs.getRawData(&r, &g, &b, &c);
    doc["color_temp"] = tcs.calculateColorTemperature_dn40(r, g, b, c);
    doc["lux"] = tcs.calculateLux(r, g, b);
  }
  else
  {
    doc["color_temp"] = 0;
    doc["lux"] = 0;
  }

  // Current hardware state
  doc["fireLEDs"] = fire_leds_active;
  doc["monitorPower"] = boiler_monitor_on;
  doc["newellPower"] = newell_power_on;
  doc["uptime"] = millis();
  doc["ts"] = millis();
  doc["uid"] = firmware::UNIQUE_ID;

  mqtt.publishState("full", doc);
  Serial.println(F("[PilotLight] Full status published"));
}

void publish_device_profile()
{
  DynamicJsonDocument doc(256);
  doc["uid"] = firmware::UNIQUE_ID;
  doc["displayName"] = device_friendly_name;
  doc["name"] = device_friendly_name;
  doc["roomLabel"] = room_id;
  doc["puzzleId"] = controller_id;
  doc["hardware"] = get_hardware_label();
  doc["deviceId"] = device_id;
  JsonObject outputs = doc.createNestedObject("outputs");
  outputs["boilerRpi"] = boiler_monitor_pin;
  outputs["boilerMonitor"] = boiler_monitor_pin;
  mqtt.publishEvent("Profile", doc);
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────
const char *build_device_identifier()
{
  static char buffer[32];
  String board = String(teensyBoardVersion());
  board.trim();
  if (board.length() == 0)
  {
    board = "Teensy Controller";
  }
  board.replace("Teensy", "teensy");
  board.replace("Teensy ", "teensy");
  board.toLowerCase();
  board.replace(" ", "");
  board.replace("-", "");
  board.replace(".", "");
  board.replace("/", "");
  board.toCharArray(buffer, sizeof(buffer));
  return buffer;
}

const char *get_hardware_label()
{
  static char label[32];
  static bool initialized = false;
  if (!initialized)
  {
    String board = String(teensyBoardVersion());
    board.trim();
    if (board.length() == 0)
    {
      board = "Teensy Controller";
    }
    board.toCharArray(label, sizeof(label));
    initialized = true;
  }
  return label;
}

bool parse_truth(const String &value)
{
  if (value.length() == 0)
  {
    return false;
  }
  if (value.equalsIgnoreCase("on") || value.equalsIgnoreCase("true"))
  {
    return true;
  }
  if (value.equalsIgnoreCase("off") || value.equalsIgnoreCase("false"))
  {
    return false;
  }
  return value.toInt() != 0;
}

String extract_command_value(const JsonDocument &payload)
{
  if (payload.is<JsonObjectConst>())
  {
    auto obj = payload.as<JsonObjectConst>();
    if (obj.containsKey("value"))
    {
      return obj["value"].as<String>();
    }
    if (obj.containsKey("state"))
    {
      return obj["state"].as<String>();
    }
    if (obj.containsKey("command"))
    {
      return obj["command"].as<String>();
    }
  }
  else if (payload.is<const char *>())
  {
    return payload.as<const char *>();
  }
  else if (payload.is<long>())
  {
    return String(payload.as<long>());
  }
  else if (payload.is<int>())
  {
    return String(payload.as<int>());
  }
  else if (payload.is<float>())
  {
    return String(payload.as<float>(), 3);
  }
  return String();
}
