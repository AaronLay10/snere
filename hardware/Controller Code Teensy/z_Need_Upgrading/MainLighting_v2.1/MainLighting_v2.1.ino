// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: INCLUDES AND GLOBAL DECLARATIONS
// ══════════════════════════════════════════════════════════════════════════════

/*
 * MainLighting v2.1.0 - Room Lighting Controller
 *
 * Controlled Systems:
 * - Study Lights (analog dimmer)
 * - Boiler Room Lights (analog dimmer)
 * - Lab Lights (8 ceiling squares + 3 floor grates via FastLED)
 * - Sconces (digital relay)
 * - Crawlspace Lights (digital relay)
 *
 * Architecture:
 * - Pure command-driven controller
 * - Publishes state updates after each command
 * - Integrates with Sentient device registry
 */

#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN

#ifndef MQTT_MAX_PACKET_SIZE
#define MQTT_MAX_PACKET_SIZE 512
#endif

#include <SentientCapabilityManifest.h>
#include <SentientMQTT.h>
#include <SentientDeviceRegistry.h>
#include <ArduinoJson.h>
#include <FastLED.h>

#include "FirmwareMetadata.h"

// ──────────────────────────────────────────────────────────────────────────────
// Pin Assignments
// ──────────────────────────────────────────────────────────────────────────────
const int power_led_pin = 13;

// LED Strips (FastLED)
const int ceiling_square_a_pin = 4;
const int ceiling_square_b_pin = 3;
const int ceiling_square_c_pin = 5;
const int ceiling_square_d_pin = 6;
const int ceiling_square_e_pin = 1;
const int ceiling_square_f_pin = 8;
const int ceiling_square_g_pin = 7;
const int ceiling_square_h_pin = 10;
const int grate_1_pin = 2;
const int grate_2_pin = 0;
const int grate_3_pin = 9;

// Analog Dimmers
const int study_lights_pin = A1;
const int boiler_lights_pin = A4;

// Digital Relays
const int sconces_pin = 12;
const int crawlspace_lights_pin = 11;

// LED configuration
const int num_leds_per_strip = 300;

CRGB leds_sa[num_leds_per_strip];
CRGB leds_sb[num_leds_per_strip];
CRGB leds_sc[num_leds_per_strip];
CRGB leds_sd[num_leds_per_strip];
CRGB leds_se[num_leds_per_strip];
CRGB leds_sf[num_leds_per_strip];
CRGB leds_sg[num_leds_per_strip];
CRGB leds_sh[num_leds_per_strip];
CRGB leds_g1[num_leds_per_strip];
CRGB leds_g2[num_leds_per_strip];
CRGB leds_g3[num_leds_per_strip];

// ──────────────────────────────────────────────────────────────────────────────
// Hardware State
// ──────────────────────────────────────────────────────────────────────────────
int study_dimmer = 0;
int boiler_dimmer = 0;
bool lab_lights_on = false;
bool sconces_on = false;
bool crawlspace_lights_on = false;

// ══════════════════════════════════════════════════════════════════════════════
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ══════════════════════════════════════════════════════════════════════════════

// Study lights commands - dim control (0-255)
const char *study_lights_commands[] = {"studyLights_on", "studyLights_off", "studyLights_dim"};

// Boiler room lights commands - dim control (0-255)
const char *boiler_lights_commands[] = {"boilerLights_on", "boilerLights_off", "boilerLights_dim"};

// Lab lights commands - on/off for all LED strips
const char *lab_lights_commands[] = {"labLights_on", "labLights_off"};

// Sconces commands - simple on/off relay
const char *sconces_commands[] = {"sconces_on", "sconces_off"};

// Crawlspace lights commands - simple on/off relay
const char *crawlspace_lights_commands[] = {"crawlspaceLights_on", "crawlspaceLights_off"};

// Create device definitions
SentientDeviceDef dev_study_lights(
    "study_lights", "Study Lights", "dimmer",
    study_lights_commands, 3
);

SentientDeviceDef dev_boiler_lights(
    "boiler_lights", "Boiler Room Lights", "dimmer",
    boiler_lights_commands, 3
);

SentientDeviceDef dev_lab_lights(
    "lab_lights", "Lab Main Lights", "led_strip",
    lab_lights_commands, 2
);

SentientDeviceDef dev_sconces(
    "sconces", "Wall Sconces", "relay",
    sconces_commands, 2
);

SentientDeviceDef dev_crawlspace_lights(
    "crawlspace_lights", "Crawlspace Lights", "relay",
    crawlspace_lights_commands, 2
);

// Device Registry
SentientDeviceRegistry deviceRegistry;

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────
IPAddress mqtt_broker_ip(192, 168, 20, 3);
const char *mqtt_host = "mythraos.com";
const uint16_t mqtt_port = 1883;
const char *mqtt_namespace = "paragon";
const char *room_id = "clockwork";
const char *controller_id = firmware::UNIQUE_ID;
const char *controller_model = "teensy_4_1";
const char *controller_friendly_name = "Main Lighting Controller";

const unsigned long heartbeat_interval_ms = 5000;
const uint16_t metadata_json_capacity = 4096;

// ──────────────────────────────────────────────────────────────────────────────
// Forward Declarations
// ──────────────────────────────────────────────────────────────────────────────
void build_capability_manifest();
SentientMQTTConfig build_mqtt_config();
bool build_heartbeat_payload(JsonDocument &doc, void *ctx);
void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx);
void publish_hardware_status();

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Objects
// ──────────────────────────────────────────────────────────────────────────────
SentientCapabilityManifest manifest;
SentientMQTT mqtt(build_mqtt_config());

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: SETUP FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println(F(""));
  Serial.println(F("╔════════════════════════════════════════════════════════════╗"));
  Serial.println(F("║       Sentient Engine - Main Lighting Controller      ║"));
  Serial.println(F("╚════════════════════════════════════════════════════════════╝"));
  Serial.print(F("[MainLighting] Firmware Version: "));
  Serial.println(firmware::VERSION);
  Serial.print(F("[MainLighting] Unique ID: "));
  Serial.println(firmware::UNIQUE_ID);

  // Configure power LED
  pinMode(power_led_pin, OUTPUT);
  digitalWrite(power_led_pin, HIGH);

  // Configure analog dimmers
  pinMode(study_lights_pin, OUTPUT);
  pinMode(boiler_lights_pin, OUTPUT);
  analogWrite(study_lights_pin, 0);
  analogWrite(boiler_lights_pin, 0);

  // Configure digital relays
  pinMode(sconces_pin, OUTPUT);
  pinMode(crawlspace_lights_pin, OUTPUT);
  digitalWrite(sconces_pin, LOW);
  digitalWrite(crawlspace_lights_pin, LOW);

  // Configure LED strips
  FastLED.addLeds<WS2812B, ceiling_square_a_pin, GRB>(leds_sa, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_b_pin, GRB>(leds_sb, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_c_pin, GRB>(leds_sc, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_d_pin, GRB>(leds_sd, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_e_pin, GRB>(leds_se, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_f_pin, GRB>(leds_sf, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_g_pin, GRB>(leds_sg, num_leds_per_strip);
  FastLED.addLeds<WS2812B, ceiling_square_h_pin, GRB>(leds_sh, num_leds_per_strip);
  FastLED.addLeds<WS2812B, grate_1_pin, GRB>(leds_g1, num_leds_per_strip);
  FastLED.addLeds<WS2812B, grate_2_pin, GRB>(leds_g2, num_leds_per_strip);
  FastLED.addLeds<WS2812B, grate_3_pin, GRB>(leds_g3, num_leds_per_strip);

  FastLED.setBrightness(255);
  fill_solid(leds_sa, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sb, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sc, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sd, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_se, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sf, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sg, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_sh, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_g1, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_g2, num_leds_per_strip, CRGB::Black);
  fill_solid(leds_g3, num_leds_per_strip, CRGB::Black);
  FastLED.show();

  Serial.println(F("[MainLighting] Hardware initialized"));

  // Register all devices
  Serial.println(F("[MainLighting] Registering devices..."));
  deviceRegistry.addDevice(&dev_study_lights);
  deviceRegistry.addDevice(&dev_boiler_lights);
  deviceRegistry.addDevice(&dev_lab_lights);
  deviceRegistry.addDevice(&dev_sconces);
  deviceRegistry.addDevice(&dev_crawlspace_lights);
  deviceRegistry.printSummary();

  // Build capability manifest
  build_capability_manifest();

  // Initialize MQTT
  Serial.println(F("[MainLighting] Initializing MQTT..."));
  if (!mqtt.begin())
  {
    Serial.println(F("[MainLighting] ERROR: MQTT initialization failed"));
    return;
  }

  mqtt.setCommandCallback(handle_mqtt_command);
  mqtt.setHeartbeatBuilder(build_heartbeat_payload);

  Serial.println(F("[MainLighting] Controller ready"));
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: LOOP FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

void loop()
{
  mqtt.loop();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: COMMAND HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx)
{
  String cmd(command);
  Serial.print(F("[MainLighting] Command: "));
  Serial.println(cmd);

  // Study Lights
  if (cmd.startsWith("studyLights_"))
  {
    if (cmd.equalsIgnoreCase("studyLights_on"))
    {
      study_dimmer = 255;
      analogWrite(study_lights_pin, study_dimmer);
      Serial.println(F("[MainLighting] Study lights: ON"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("studyLights_off"))
    {
      study_dimmer = 0;
      analogWrite(study_lights_pin, study_dimmer);
      Serial.println(F("[MainLighting] Study lights: OFF"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("studyLights_dim"))
    {
      if (payload["value"].is<int>())
      {
        study_dimmer = payload["value"].as<int>();
        analogWrite(study_lights_pin, study_dimmer);
        Serial.print(F("[MainLighting] Study lights dimmed to: "));
        Serial.println(study_dimmer);
        publish_hardware_status();
      }
    }
    return;
  }

  // Boiler Lights
  if (cmd.startsWith("boilerLights_"))
  {
    if (cmd.equalsIgnoreCase("boilerLights_on"))
    {
      boiler_dimmer = 255;
      analogWrite(boiler_lights_pin, boiler_dimmer);
      Serial.println(F("[MainLighting] Boiler lights: ON"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("boilerLights_off"))
    {
      boiler_dimmer = 0;
      analogWrite(boiler_lights_pin, boiler_dimmer);
      Serial.println(F("[MainLighting] Boiler lights: OFF"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("boilerLights_dim"))
    {
      if (payload["value"].is<int>())
      {
        boiler_dimmer = payload["value"].as<int>();
        analogWrite(boiler_lights_pin, boiler_dimmer);
        Serial.print(F("[MainLighting] Boiler lights dimmed to: "));
        Serial.println(boiler_dimmer);
        publish_hardware_status();
      }
    }
    return;
  }

  // Lab Lights (LED strips + sconces)
  if (cmd.startsWith("labLights_"))
  {
    if (cmd.equalsIgnoreCase("labLights_on"))
    {
      FastLED.setBrightness(255);
      fill_solid(leds_sa, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sb, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sc, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sd, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_se, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sf, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sg, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_sh, num_leds_per_strip, CRGB::Yellow);
      fill_solid(leds_g1, num_leds_per_strip, CRGB::Blue);
      fill_solid(leds_g2, num_leds_per_strip, CRGB::Blue);
      fill_solid(leds_g3, num_leds_per_strip, CRGB::Blue);
      FastLED.show();
      digitalWrite(sconces_pin, HIGH);
      lab_lights_on = true;
      sconces_on = true;
      Serial.println(F("[MainLighting] Lab lights: ON"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("labLights_off"))
    {
      fill_solid(leds_sa, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sb, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sc, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sd, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_se, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sf, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sg, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_sh, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_g1, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_g2, num_leds_per_strip, CRGB::Black);
      fill_solid(leds_g3, num_leds_per_strip, CRGB::Black);
      FastLED.show();
      digitalWrite(sconces_pin, LOW);
      lab_lights_on = false;
      sconces_on = false;
      Serial.println(F("[MainLighting] Lab lights: OFF"));
      publish_hardware_status();
    }
    return;
  }

  // Sconces (standalone control)
  if (cmd.startsWith("sconces_"))
  {
    if (cmd.equalsIgnoreCase("sconces_on"))
    {
      digitalWrite(sconces_pin, HIGH);
      sconces_on = true;
      Serial.println(F("[MainLighting] Sconces: ON"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("sconces_off"))
    {
      digitalWrite(sconces_pin, LOW);
      sconces_on = false;
      Serial.println(F("[MainLighting] Sconces: OFF"));
      publish_hardware_status();
    }
    return;
  }

  // Crawlspace Lights
  if (cmd.startsWith("crawlspaceLights_"))
  {
    if (cmd.equalsIgnoreCase("crawlspaceLights_on"))
    {
      digitalWrite(crawlspace_lights_pin, HIGH);
      crawlspace_lights_on = true;
      Serial.println(F("[MainLighting] Crawlspace lights: ON"));
      publish_hardware_status();
    }
    else if (cmd.equalsIgnoreCase("crawlspaceLights_off"))
    {
      digitalWrite(crawlspace_lights_pin, LOW);
      crawlspace_lights_on = false;
      Serial.println(F("[MainLighting] Crawlspace lights: OFF"));
      publish_hardware_status();
    }
    return;
  }

  Serial.print(F("[MainLighting] Unknown command: "));
  Serial.println(command);
}

// ──────────────────────────────────────────────────────────────────────────────
// State Publishing
// ──────────────────────────────────────────────────────────────────────────────

void publish_hardware_status()
{
  JsonDocument doc;
  doc["uid"] = firmware::UNIQUE_ID;
  doc["study_dimmer"] = study_dimmer;
  doc["boiler_dimmer"] = boiler_dimmer;
  doc["lab_lights"] = lab_lights_on;
  doc["sconces"] = sconces_on;
  doc["crawlspace"] = crawlspace_lights_on;
  doc["ts"] = millis();

  mqtt.publishJson("status", "hardware", doc);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: MQTT CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

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
  cfg.deviceId = controller_model;
  cfg.displayName = controller_friendly_name;
  cfg.useDhcp = true;
  cfg.heartbeatIntervalMs = heartbeat_interval_ms;
  cfg.publishJsonCapacity = metadata_json_capacity;
  cfg.autoHeartbeat = true;
  return cfg;
}

// ──────────────────────────────────────────────────────────────────────────────
// Heartbeat Builder
// ──────────────────────────────────────────────────────────────────────────────

bool build_heartbeat_payload(JsonDocument &doc, void *ctx)
{
  doc["uid"] = firmware::UNIQUE_ID;
  doc["fw"] = firmware::VERSION;
  doc["up"] = millis();
  doc["study"] = study_dimmer;
  doc["boiler"] = boiler_dimmer;
  doc["lab"] = lab_lights_on ? 1 : 0;
  doc["sconces"] = sconces_on ? 1 : 0;
  doc["crawlspace"] = crawlspace_lights_on ? 1 : 0;
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6: CAPABILITY MANIFEST BUILDER
// ══════════════════════════════════════════════════════════════════════════════

void build_capability_manifest()
{
  manifest.set_controller_info(
      firmware::UNIQUE_ID,
      controller_friendly_name,
      firmware::VERSION,
      room_id,
      controller_id);

  // Auto-generate entire manifest from device registry
  deviceRegistry.buildManifest(manifest);

  Serial.println(F("[MainLighting] Capability manifest built successfully"));
}
