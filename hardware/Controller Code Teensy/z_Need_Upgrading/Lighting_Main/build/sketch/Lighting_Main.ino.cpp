#include <Arduino.h>
#line 1 "/opt/sentient/hardware/Controller Code Teensy/z_archive/Version_1-archived/Lighting_Main/Lighting_Main.ino"
#include <Paragon_MQTT.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// ──────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ──────────────────────────────────────────────────────────────────────────────
namespace config {
constexpr uint8_t POWER_LED_PIN = 13;

// Pins for LED Strips
constexpr uint8_t GRATE_1 = 2;
constexpr uint8_t GRATE_2 = 0;
constexpr uint8_t GRATE_3 = 9;
constexpr uint8_t CEILING_SQUARE_A = 4;
constexpr uint8_t CEILING_SQUARE_B = 3;
constexpr uint8_t CEILING_SQUARE_C = 5;
constexpr uint8_t CEILING_SQUARE_D = 6;
constexpr uint8_t CEILING_SQUARE_E = 1;
constexpr uint8_t CEILING_SQUARE_F = 8;
constexpr uint8_t CEILING_SQUARE_G = 7;
constexpr uint8_t CEILING_SQUARE_H = 10;
constexpr uint8_t SCONCES = 12;
constexpr uint8_t STUDYLIGHTS = A1;
constexpr uint8_t BOILERLIGHTS = A4;
constexpr uint8_t CRAWLSPACE_LIGHTS = 11;

constexpr uint16_t NUM_LEDS_PER_STRIP = 300;

constexpr unsigned long HEARTBEAT_INTERVAL_MS = 5000;

const IPAddress MQTT_BROKER_IP(192, 168, 20, 3);
constexpr const char *MQTT_HOST = "mythraos.com";
constexpr uint16_t MQTT_PORT = 1883;
constexpr const char *MQTT_NAMESPACE = "paragon";
constexpr const char *ROOM_ID = "Clockwork";
constexpr const char *PUZZLE_ID = "SystemLighting";
constexpr const char *DEVICE_ID = "MainLights";
constexpr const char *DEVICE_FRIENDLY_NAME = "Main Lights";
} // namespace config

#define ROOM_ID config::ROOM_ID
#define PUZZLE_ID config::PUZZLE_ID
#define DEVICE_ID config::DEVICE_ID

// ──────────────────────────────────────────────────────────────────────────────
// Forward declarations
// ──────────────────────────────────────────────────────────────────────────────
bool buildHeartbeatPayload(JsonDocument &doc, void *ctx);
void handleMqttCommand(const char *command, const JsonDocument &payload, void *ctx);
void publishStateUpdate();

// ──────────────────────────────────────────────────────────────────────────────
// Hardware state
// ──────────────────────────────────────────────────────────────────────────────
CRGB leds_SA[config::NUM_LEDS_PER_STRIP];
CRGB leds_SB[config::NUM_LEDS_PER_STRIP];
CRGB leds_SC[config::NUM_LEDS_PER_STRIP];
CRGB leds_SD[config::NUM_LEDS_PER_STRIP];
CRGB leds_SE[config::NUM_LEDS_PER_STRIP];
CRGB leds_SF[config::NUM_LEDS_PER_STRIP];
CRGB leds_SG[config::NUM_LEDS_PER_STRIP];
CRGB leds_SH[config::NUM_LEDS_PER_STRIP];
CRGB leds_G1[config::NUM_LEDS_PER_STRIP];
CRGB leds_G2[config::NUM_LEDS_PER_STRIP];
CRGB leds_G3[config::NUM_LEDS_PER_STRIP];

int studyDimmer = 0;
int boilerDimmer = 0;
bool labLightsOn = false;
bool sconcesOn = false;
bool crawlspaceLightsOn = false;

// ──────────────────────────────────────────────────────────────────────────────
// MQTT client configuration
// ──────────────────────────────────────────────────────────────────────────────
MythraOSMQTTConfig makeConfig() {
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = "paragon";
  cfg.roomId = ROOM_ID;
  cfg.puzzleId = PUZZLE_ID;
  cfg.deviceId = DEVICE_ID;
  cfg.useDhcp = true;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// ──────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────────────────────
String extractCommandValue(const JsonDocument &payload) {
  if (payload.is<JsonObjectConst>()) {
    auto obj = payload.as<JsonObjectConst>();
    if (obj.containsKey("value")) {
      return obj["value"].as<String>();
    }
    if (obj.containsKey("state")) {
      return obj["state"].as<String>();
    }
    if (obj.containsKey("command")) {
      return obj["command"].as<String>();
    }
  } else if (payload.is<const char *>()) {
    return payload.as<const char *>();
  } else if (payload.is<long>()) {
    return String(payload.as<long>());
  } else if (payload.is<int>()) {
    return String(payload.as<int>());
  } else if (payload.is<float>()) {
    return String(payload.as<float>(), 3);
  }
  return String();
}

bool parseTruth(const String &value) {
  if (value.length() == 0) {
    return false;
  }
  if (value.equalsIgnoreCase("on") || value.equalsIgnoreCase("true") || value.equals("1")) {
    return true;
  }
  if (value.equalsIgnoreCase("off") || value.equalsIgnoreCase("false") || value.equals("0")) {
    return false;
  }
  return value.toInt() != 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Command handlers
// ──────────────────────────────────────────────────────────────────────────────
void commandStudyLights(const String &value) {
  if (value.equalsIgnoreCase("off") || value.equals("0")) {
    studyDimmer = 0;
  } else if (value.equalsIgnoreCase("on") || value.equals("1")) {
    studyDimmer = 255;
  } else {
    studyDimmer = value.toInt();
  }
  analogWrite(config::STUDYLIGHTS, studyDimmer);
  Serial.print(F("[MainLights] Study lights set to: "));
  Serial.println(studyDimmer);
  publishStateUpdate();
}

void commandBoilerLights(const String &value) {
  if (value.equalsIgnoreCase("off") || value.equals("0")) {
    boilerDimmer = 0;
  } else if (value.equalsIgnoreCase("on") || value.equals("1")) {
    boilerDimmer = 255;
  } else {
    boilerDimmer = value.toInt();
  }
  analogWrite(config::BOILERLIGHTS, boilerDimmer);
  Serial.print(F("[MainLights] Boiler lights set to: "));
  Serial.println(boilerDimmer);
  publishStateUpdate();
}

void commandLabLights(const String &value) {
  Serial.print(F("[MainLights] Lab lights: "));
  Serial.println(value);

  if (value.equalsIgnoreCase("off") || value.equals("0")) {
    fill_solid(leds_SA, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SB, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SC, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SD, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SE, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SF, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SG, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_SH, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_G1, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_G2, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    fill_solid(leds_G3, config::NUM_LEDS_PER_STRIP, CRGB::Black);
    FastLED.show();
    digitalWrite(config::SCONCES, LOW);
    labLightsOn = false;
    sconcesOn = false;
    Serial.println(F("[MainLights] Lab lights OFF"));
  } else if (value.equalsIgnoreCase("on") || value.equals("1")) {
    FastLED.setBrightness(255);
    fill_solid(leds_SA, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SB, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SC, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SD, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SE, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SF, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SG, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_SH, config::NUM_LEDS_PER_STRIP, CRGB::Yellow);
    fill_solid(leds_G1, config::NUM_LEDS_PER_STRIP, CRGB::Blue);
    fill_solid(leds_G2, config::NUM_LEDS_PER_STRIP, CRGB::Blue);
    fill_solid(leds_G3, config::NUM_LEDS_PER_STRIP, CRGB::Blue);
    FastLED.show();
    digitalWrite(config::SCONCES, HIGH);
    labLightsOn = true;
    sconcesOn = true;
    Serial.println(F("[MainLights] Lab lights ON"));
  } else {
    Serial.println(F("[MainLights] Invalid lab lights command - use 'on' or 'off'"));
  }
  publishStateUpdate();
}

void commandCrawlspaceLights(const String &value) {
  bool state = parseTruth(value);
  digitalWrite(config::CRAWLSPACE_LIGHTS, state ? HIGH : LOW);
  crawlspaceLightsOn = state;
  Serial.print(F("[MainLights] Crawlspace lights: "));
  Serial.println(state ? F("ON") : F("OFF"));
  publishStateUpdate();
}

// ──────────────────────────────────────────────────────────────────────────────
// MQTT callbacks
// ──────────────────────────────────────────────────────────────────────────────
void handleMqttCommand(const char *command, const JsonDocument &payload, void * /*ctx*/) {
  String value = extractCommandValue(payload);
  String cmd = String(command);

  if (cmd.equalsIgnoreCase("study")) {
    commandStudyLights(value);
  } else if (cmd.equalsIgnoreCase("boiler")) {
    commandBoilerLights(value);
  } else if (cmd.equalsIgnoreCase("lab")) {
    commandLabLights(value);
  } else if (cmd.equalsIgnoreCase("crawlspace")) {
    commandCrawlspaceLights(value);
  } else {
    Serial.print(F("[MainLights] Unknown command: "));
    Serial.println(command);
  }
}

bool buildHeartbeatPayload(JsonDocument &doc, void * /*ctx*/) {
  doc["studyDimmer"] = studyDimmer;
  doc["boilerDimmer"] = boilerDimmer;
  doc["labLights"] = labLightsOn ? 1 : 0;
  doc["sconces"] = sconcesOn ? 1 : 0;
  doc["crawlspace"] = crawlspaceLightsOn ? 1 : 0;
  doc["up"] = millis();
  return true;
}

void publishStateUpdate() {
  DynamicJsonDocument doc(256);
  doc["study"] = studyDimmer;
  doc["boiler"] = boilerDimmer;
  doc["lab"] = labLightsOn ? 1 : 0;
  doc["sconces"] = sconcesOn ? 1 : 0;
  doc["crawlspace"] = crawlspaceLightsOn ? 1 : 0;
  doc["t"] = millis();
  mythra.publishState("Running", doc);
}

// ──────────────────────────────────────────────────────────────────────────────
// Arduino lifecycle
// ──────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  unsigned long waited = 0;
  while (!Serial && waited < 2000) {
    delay(10);
    waited += 10;
  }

  Serial.println(F("=== Main Lights Controller Boot ==="));

  // Setup FastLED
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_A, GRB>(leds_SA, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_B, GRB>(leds_SB, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_C, GRB>(leds_SC, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_D, GRB>(leds_SD, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_E, GRB>(leds_SE, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_F, GRB>(leds_SF, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_G, GRB>(leds_SG, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::CEILING_SQUARE_H, GRB>(leds_SH, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::GRATE_1, GRB>(leds_G1, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::GRATE_2, GRB>(leds_G2, config::NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812, config::GRATE_3, GRB>(leds_G3, config::NUM_LEDS_PER_STRIP);

  // Setup pins
  pinMode(config::STUDYLIGHTS, OUTPUT);
  pinMode(config::BOILERLIGHTS, OUTPUT);
  pinMode(config::POWER_LED_PIN, OUTPUT);
  pinMode(config::SCONCES, OUTPUT);
  pinMode(config::CRAWLSPACE_LIGHTS, OUTPUT);

  // Set initial states
  digitalWrite(config::POWER_LED_PIN, HIGH);
  digitalWrite(config::SCONCES, LOW);
  digitalWrite(config::CRAWLSPACE_LIGHTS, LOW);
  analogWrite(config::STUDYLIGHTS, 0);
  analogWrite(config::BOILERLIGHTS, 0);

  // Initialize all LEDs to off
  FastLED.setBrightness(255);
  fill_solid(leds_SA, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SB, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SC, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SD, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SE, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SF, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SG, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_SH, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_G1, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_G2, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  fill_solid(leds_G3, config::NUM_LEDS_PER_STRIP, CRGB::Black);
  FastLED.show();

  Serial.println(F("Initial Power Off"));

  // Initialize MQTT
  if (!mythra.begin()) {
    Serial.println(F("[MainLights] MQTT initialization failed"));
  }
  mythra.setCommandCallback(handleMqttCommand);
  mythra.setHeartbeatBuilder(buildHeartbeatPayload);

  publishStateUpdate();

  Serial.println(F("=== Main Lights Ready ==="));
}

void loop() {
  mythra.loop();
}

