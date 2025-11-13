#include <MythraOS_MQTT.h>
#include <ArduinoJson.h>

// ──────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ──────────────────────────────────────────────────────────────────────────────
namespace config {
  // Device Identity
  constexpr const char *MQTT_NAMESPACE = "paragon";
  constexpr const char *ROOM_ID = "Clockwork";
  constexpr const char *PUZZLE_ID = "StudyA";
  constexpr const char *DEVICE_ID = "Teensy 4.1";
  constexpr const char *DEVICE_FRIENDLY_NAME = "Study A Controller";

  // MQTT Broker Configuration
  const IPAddress MQTT_BROKER_IP(192, 168, 20, 3);
  constexpr const char *MQTT_HOST = "mythraos.com";
  constexpr uint16_t MQTT_PORT = 1883;

  // Hardware Pin Definitions
  constexpr uint8_t POWER_LED = 13;

  // Tentacle Move Sensors - Pins 0-3
  constexpr uint8_t TENTACLEMOVEA1 = 0;
  constexpr uint8_t TENTACLEMOVEA2 = 1;
  constexpr uint8_t TENTACLEMOVEB1 = 2;
  constexpr uint8_t TENTACLEMOVEB2 = 3;

  // Porthole Sensors - Pins 5-10
  constexpr uint8_t PORTHOLEA1 = 5;
  constexpr uint8_t PORTHOLEA2 = 6;
  constexpr uint8_t PORTHOLEB1 = 7;
  constexpr uint8_t PORTHOLEB2 = 8;
  constexpr uint8_t PORTHOLEC1 = 9;
  constexpr uint8_t PORTHOLEC2 = 10;

  // Riddle Motor Control - Pin 12
  constexpr uint8_t RIDDLE_MOTOR = 12;

  // Tentacle Sensors - Pins 14-23 & 36-41
  constexpr uint8_t TENTACLEA1 = 14;
  constexpr uint8_t TENTACLEA2 = 15;
  constexpr uint8_t TENTACLEA3 = 16;
  constexpr uint8_t TENTACLEA4 = 17;
  constexpr uint8_t TENTACLEB1 = 18;
  constexpr uint8_t TENTACLEB2 = 19;
  constexpr uint8_t TENTACLEB3 = 20;
  constexpr uint8_t TENTACLEB4 = 21;
  constexpr uint8_t TENTACLEC1 = 22;
  constexpr uint8_t TENTACLEC2 = 23;
  constexpr uint8_t TENTACLEC3 = 36;
  constexpr uint8_t TENTACLEC4 = 37;
  constexpr uint8_t TENTACLED1 = 38;
  constexpr uint8_t TENTACLED2 = 39;
  constexpr uint8_t TENTACLED3 = 40;
  constexpr uint8_t TENTACLED4 = 41;

  // Porthole Control - Pins 33 & 34
  constexpr uint8_t PORTHOLEOPEN = 33;
  constexpr uint8_t PORTHOLECLOSE = 34;

  // Timing Constants
  constexpr unsigned long RIDDLE_MOTOR_DURATION = 300000; // 5 minutes in milliseconds
  constexpr unsigned long SENSOR_PUBLISH_INTERVAL_MS = 1000;
  constexpr unsigned long HEARTBEAT_INTERVAL_MS = 5000;
  constexpr unsigned long DEBUG_PRINT_INTERVAL_MS = 5000;

  constexpr uint16_t TELEMETRY_JSON_CAPACITY = 768;
} // namespace config

// ──────────────────────────────────────────────────────────────────────────────
// Forward declarations
// ──────────────────────────────────────────────────────────────────────────────
void handleMqttCommand(const char *command, const JsonDocument &payload, void *ctx);
bool buildHeartbeatPayload(JsonDocument &doc, void *ctx);
void publishTelemetryData();
void checkPortholeStatus();
void checkTentacleStatus();
void riddleMotorHandler(const String &value);
void moveTentaclesHandler(const String &value);
void movePortholesHandler(const String &value);

// ──────────────────────────────────────────────────────────────────────────────
// Global state variables
// ──────────────────────────────────────────────────────────────────────────────
unsigned long riddleMotorStartTime = 0;
bool riddleMotorActive = false;
bool previousPortholeStatus = false;
bool previousTentaclesFullyUpStatus = false;
unsigned long lastTelemetryPublish = 0;
unsigned long lastDebugPrint = 0;

// ──────────────────────────────────────────────────────────────────────────────
// MQTT client configuration
// ──────────────────────────────────────────────────────────────────────────────
MythraOSMQTTConfig makeConfig() {
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = config::MQTT_NAMESPACE;
  cfg.roomId = config::ROOM_ID;
  cfg.puzzleId = config::PUZZLE_ID;
  cfg.deviceId = config::DEVICE_ID;
  cfg.displayName = config::DEVICE_FRIENDLY_NAME;
  cfg.useDhcp = true;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// ──────────────────────────────────────────────────────────────────────────────
// Utility functions
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

// ──────────────────────────────────────────────────────────────────────────────
// Hardware initialization
// ──────────────────────────────────────────────────────────────────────────────
void initializeHardware() {
  pinMode(config::POWER_LED, OUTPUT);
  digitalWrite(config::POWER_LED, HIGH);

  // Initialize tentacle move sensors
  pinMode(config::TENTACLEMOVEA1, OUTPUT);
  pinMode(config::TENTACLEMOVEA2, OUTPUT);
  pinMode(config::TENTACLEMOVEB1, OUTPUT);
  pinMode(config::TENTACLEMOVEB2, OUTPUT);
  digitalWrite(config::TENTACLEMOVEA1, LOW);
  digitalWrite(config::TENTACLEMOVEA2, LOW);
  digitalWrite(config::TENTACLEMOVEB1, LOW);
  digitalWrite(config::TENTACLEMOVEB2, LOW);

  // Initialize porthole sensors
  pinMode(config::PORTHOLEA1, INPUT_PULLUP);
  pinMode(config::PORTHOLEA2, INPUT_PULLUP);
  pinMode(config::PORTHOLEB1, INPUT_PULLUP);
  pinMode(config::PORTHOLEB2, INPUT_PULLUP);
  pinMode(config::PORTHOLEC1, INPUT_PULLUP);
  pinMode(config::PORTHOLEC2, INPUT_PULLUP);

  // Initialize riddle motor
  pinMode(config::RIDDLE_MOTOR, OUTPUT);
  digitalWrite(config::RIDDLE_MOTOR, LOW);

  // Initialize tentacle sensors
  pinMode(config::TENTACLEA1, INPUT_PULLUP);
  pinMode(config::TENTACLEA2, INPUT_PULLUP);
  pinMode(config::TENTACLEA3, INPUT_PULLUP);
  pinMode(config::TENTACLEA4, INPUT_PULLUP);
  pinMode(config::TENTACLEB1, INPUT_PULLUP);
  pinMode(config::TENTACLEB2, INPUT_PULLUP);
  pinMode(config::TENTACLEB3, INPUT_PULLUP);
  pinMode(config::TENTACLEB4, INPUT_PULLUP);
  pinMode(config::TENTACLEC1, INPUT_PULLUP);
  pinMode(config::TENTACLEC2, INPUT_PULLUP);
  pinMode(config::TENTACLEC3, INPUT_PULLUP);
  pinMode(config::TENTACLEC4, INPUT_PULLUP);
  pinMode(config::TENTACLED1, INPUT_PULLUP);
  pinMode(config::TENTACLED2, INPUT_PULLUP);
  pinMode(config::TENTACLED3, INPUT_PULLUP);
  pinMode(config::TENTACLED4, INPUT_PULLUP);

  // Initialize porthole control
  pinMode(config::PORTHOLEOPEN, OUTPUT);
  pinMode(config::PORTHOLECLOSE, OUTPUT);
  digitalWrite(config::PORTHOLEOPEN, LOW);
  digitalWrite(config::PORTHOLECLOSE, HIGH);

  Serial.println(F("[StudyA] Hardware initialized"));
}

// ──────────────────────────────────────────────────────────────────────────────
// MQTT callbacks
// ──────────────────────────────────────────────────────────────────────────────
void handleMqttCommand(const char *command, const JsonDocument &payload, void * /*ctx*/) {
  String value = extractCommandValue(payload);
  String cmd = String(command);

  Serial.print(F("[StudyA] Command received: "));
  Serial.print(cmd);
  Serial.print(F(" = "));
  Serial.println(value);

  if (cmd.equalsIgnoreCase("riddleMotor")) {
    riddleMotorHandler(value);
  } else if (cmd.equalsIgnoreCase("moveTentacles")) {
    moveTentaclesHandler(value);
  } else if (cmd.equalsIgnoreCase("movePortholes")) {
    movePortholesHandler(value);
  } else {
    Serial.print(F("[StudyA] Unknown command: "));
    Serial.println(command);
  }
}

bool buildHeartbeatPayload(JsonDocument &doc, void * /*ctx*/) {
  doc["riddleMotorActive"] = riddleMotorActive;
  doc["portholeOpen"] = previousPortholeStatus;
  doc["tentaclesFullyUp"] = previousTentaclesFullyUpStatus;
  doc["uptime"] = millis();
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Command handlers
// ──────────────────────────────────────────────────────────────────────────────
void riddleMotorHandler(const String &value) {
  (void)value;

  if (riddleMotorActive) {
    Serial.println(F("[StudyA] RiddleMotor command received - resetting 5 minute timer"));
  } else {
    Serial.println(F("[StudyA] RiddleMotor command received - turning ON for 5 minutes"));
    digitalWrite(config::RIDDLE_MOTOR, HIGH);
  }

  riddleMotorStartTime = millis();
  riddleMotorActive = true;

  // Publish event
  DynamicJsonDocument eventDoc(256);
  eventDoc["action"] = "riddleMotorActivated";
  eventDoc["duration"] = config::RIDDLE_MOTOR_DURATION;
  mythra.publishEvent("RiddleMotor", eventDoc);
}

void moveTentaclesHandler(const String &value) {
  Serial.print(F("[StudyA] MoveTentacles command received: "));
  Serial.println(value);

  String command = value;
  command.toLowerCase();

  // Validate command
  if (!command.equals("down") && !command.equals("up")) {
    Serial.println(F("[StudyA] Error: Invalid command. Use 'Down' or 'Up'"));
    return;
  }

  // Check if all porthole sensors are HIGH before allowing tentacle movement
  bool allPortholesSensorsHigh = (digitalRead(config::PORTHOLEA1) == HIGH && digitalRead(config::PORTHOLEA2) == HIGH &&
                                  digitalRead(config::PORTHOLEB1) == HIGH && digitalRead(config::PORTHOLEB2) == HIGH &&
                                  digitalRead(config::PORTHOLEC1) == HIGH && digitalRead(config::PORTHOLEC2) == HIGH);

  if (!allPortholesSensorsHigh) {
    Serial.println(F("[StudyA] Error: All porthole sensors must be HIGH (1) before tentacle movement"));
    Serial.print(F("[StudyA] Porthole sensor readings - A1: "));
    Serial.print(digitalRead(config::PORTHOLEA1));
    Serial.print(F(", A2: "));
    Serial.print(digitalRead(config::PORTHOLEA2));
    Serial.print(F(", B1: "));
    Serial.print(digitalRead(config::PORTHOLEB1));
    Serial.print(F(", B2: "));
    Serial.print(digitalRead(config::PORTHOLEB2));
    Serial.print(F(", C1: "));
    Serial.print(digitalRead(config::PORTHOLEC1));
    Serial.print(F(", C2: "));
    Serial.println(digitalRead(config::PORTHOLEC2));
    return;
  }

  if (command.equals("down")) {
    // Activate pins 0 & 2 (TENTACLEMOVEA1 & TENTACLEMOVEB1) for 500ms
    digitalWrite(config::TENTACLEMOVEA1, HIGH);
    digitalWrite(config::TENTACLEMOVEB1, HIGH);
    Serial.println(F("[StudyA] All tentacles moving DOWN - activating pins 0 & 2 for 500ms"));
    delay(500);
    digitalWrite(config::TENTACLEMOVEA1, LOW);
    digitalWrite(config::TENTACLEMOVEB1, LOW);
    Serial.println(F("[StudyA] Tentacle DOWN movement complete - pins 0 & 2 turned OFF"));

    // Publish event
    DynamicJsonDocument eventDoc(256);
    eventDoc["direction"] = "down";
    mythra.publishEvent("TentacleMove", eventDoc);
  } else if (command.equals("up")) {
    // Activate pins 1 & 3 (TENTACLEMOVEA2 & TENTACLEMOVEB2) for 500ms
    digitalWrite(config::TENTACLEMOVEA2, HIGH);
    digitalWrite(config::TENTACLEMOVEB2, HIGH);
    Serial.println(F("[StudyA] All tentacles moving UP - activating pins 1 & 3 for 500ms"));
    delay(500);
    digitalWrite(config::TENTACLEMOVEA2, LOW);
    digitalWrite(config::TENTACLEMOVEB2, LOW);
    Serial.println(F("[StudyA] Tentacle UP movement complete - pins 1 & 3 turned OFF"));

    // Publish event
    DynamicJsonDocument eventDoc(256);
    eventDoc["direction"] = "up";
    mythra.publishEvent("TentacleMove", eventDoc);
  }
}

void movePortholesHandler(const String &value) {
  Serial.print(F("[StudyA] MovePortholes command received: "));
  Serial.println(value);

  String command = value;
  command.toLowerCase();

  // Validate command
  if (!command.equals("open") && !command.equals("close")) {
    Serial.println(F("[StudyA] Error: Invalid command. Use 'Open' or 'Close'"));
    return;
  }

  if (command.equals("open")) {
    // Open portholes: Set PORTHOLECLOSE HIGH, PORTHOLEOPEN LOW, turn on riddle motor
    digitalWrite(config::PORTHOLEOPEN, LOW);
    digitalWrite(config::PORTHOLECLOSE, HIGH);
    digitalWrite(config::RIDDLE_MOTOR, HIGH);
    Serial.println(F("[StudyA] Opening portholes - pin 33 LOW, pin 34 HIGH, pin 12 (riddle motor) ON"));

    // Publish event
    DynamicJsonDocument eventDoc(256);
    eventDoc["action"] = "open";
    mythra.publishEvent("PortholeMove", eventDoc);
  } else if (command.equals("close")) {
    // Close portholes: Set PORTHOLEOPEN HIGH, PORTHOLECLOSE LOW, turn on riddle motor
    digitalWrite(config::PORTHOLECLOSE, LOW);
    digitalWrite(config::PORTHOLEOPEN, HIGH);
    digitalWrite(config::RIDDLE_MOTOR, HIGH);
    Serial.println(F("[StudyA] Closing portholes - pin 33 HIGH, pin 34 LOW, pin 12 (riddle motor) ON"));

    // Publish event
    DynamicJsonDocument eventDoc(256);
    eventDoc["action"] = "close";
    mythra.publishEvent("PortholeMove", eventDoc);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sensor monitoring
// ──────────────────────────────────────────────────────────────────────────────
void checkPortholeStatus() {
  // Check porthole status - portholes are "open" when all sensors are HIGH
  bool allPortholesSensorsHigh = (digitalRead(config::PORTHOLEA1) == HIGH && digitalRead(config::PORTHOLEA2) == HIGH &&
                                  digitalRead(config::PORTHOLEB1) == HIGH && digitalRead(config::PORTHOLEB2) == HIGH &&
                                  digitalRead(config::PORTHOLEC1) == HIGH && digitalRead(config::PORTHOLEC2) == HIGH);
  bool portholesOpen = allPortholesSensorsHigh;

  // Check if porthole status changed from closed to open
  if (portholesOpen && !previousPortholeStatus) {
    // Portholes just opened - send immediate MQTT message
    Serial.println(F("[StudyA] Portholes opened - sending MQTT message"));

    DynamicJsonDocument eventDoc(256);
    eventDoc["status"] = "opened";
    eventDoc["timestamp"] = millis();
    mythra.publishEvent("PortholesOpened", eventDoc);
  }

  // Update previous porthole status
  previousPortholeStatus = portholesOpen;
}

void checkTentacleStatus() {
  // Check tentacle status - tentacles are "fully up" when all tentacle sensors are HIGH
  bool allTentaclesSensorsHigh = (digitalRead(config::TENTACLEA1) == HIGH && digitalRead(config::TENTACLEA2) == HIGH &&
                                  digitalRead(config::TENTACLEA3) == HIGH && digitalRead(config::TENTACLEA4) == HIGH &&
                                  digitalRead(config::TENTACLEB1) == HIGH && digitalRead(config::TENTACLEB2) == HIGH &&
                                  digitalRead(config::TENTACLEB3) == HIGH && digitalRead(config::TENTACLEB4) == HIGH &&
                                  digitalRead(config::TENTACLEC1) == HIGH && digitalRead(config::TENTACLEC2) == HIGH &&
                                  digitalRead(config::TENTACLEC3) == HIGH && digitalRead(config::TENTACLEC4) == HIGH &&
                                  digitalRead(config::TENTACLED1) == HIGH && digitalRead(config::TENTACLED2) == HIGH &&
                                  digitalRead(config::TENTACLED3) == HIGH && digitalRead(config::TENTACLED4) == HIGH);
  bool tentaclesFullyUp = allTentaclesSensorsHigh;

  // Check if tentacle status changed from not fully up to fully up
  if (tentaclesFullyUp && !previousTentaclesFullyUpStatus) {
    // Tentacles just reached fully up position - send immediate MQTT message
    Serial.println(F("[StudyA] Tentacles fully up - sending MQTT message"));

    DynamicJsonDocument eventDoc(256);
    eventDoc["status"] = "fullyUp";
    eventDoc["timestamp"] = millis();
    mythra.publishEvent("TentaclesFullyUp", eventDoc);
  }

  // Update previous tentacle status
  previousTentaclesFullyUpStatus = tentaclesFullyUp;
}

void publishTelemetryData() {
  unsigned long now = millis();
  if (now - lastTelemetryPublish < config::SENSOR_PUBLISH_INTERVAL_MS) {
    return;
  }
  lastTelemetryPublish = now;

  // Build telemetry JSON
  DynamicJsonDocument doc(config::TELEMETRY_JSON_CAPACITY);

  // Tentacle move sensors
  JsonObject tentacleMove = doc.createNestedObject("tentacleMove");
  tentacleMove["a1"] = digitalRead(config::TENTACLEMOVEA1);
  tentacleMove["a2"] = digitalRead(config::TENTACLEMOVEA2);
  tentacleMove["b1"] = digitalRead(config::TENTACLEMOVEB1);
  tentacleMove["b2"] = digitalRead(config::TENTACLEMOVEB2);

  // Porthole sensors
  JsonObject porthole = doc.createNestedObject("porthole");
  porthole["a1"] = digitalRead(config::PORTHOLEA1);
  porthole["a2"] = digitalRead(config::PORTHOLEA2);
  porthole["b1"] = digitalRead(config::PORTHOLEB1);
  porthole["b2"] = digitalRead(config::PORTHOLEB2);
  porthole["c1"] = digitalRead(config::PORTHOLEC1);
  porthole["c2"] = digitalRead(config::PORTHOLEC2);
  porthole["allOpen"] = previousPortholeStatus;

  // Tentacle sensors
  JsonObject tentacle = doc.createNestedObject("tentacle");
  tentacle["a1"] = digitalRead(config::TENTACLEA1);
  tentacle["a2"] = digitalRead(config::TENTACLEA2);
  tentacle["a3"] = digitalRead(config::TENTACLEA3);
  tentacle["a4"] = digitalRead(config::TENTACLEA4);
  tentacle["b1"] = digitalRead(config::TENTACLEB1);
  tentacle["b2"] = digitalRead(config::TENTACLEB2);
  tentacle["b3"] = digitalRead(config::TENTACLEB3);
  tentacle["b4"] = digitalRead(config::TENTACLEB4);
  tentacle["c1"] = digitalRead(config::TENTACLEC1);
  tentacle["c2"] = digitalRead(config::TENTACLEC2);
  tentacle["c3"] = digitalRead(config::TENTACLEC3);
  tentacle["c4"] = digitalRead(config::TENTACLEC4);
  tentacle["d1"] = digitalRead(config::TENTACLED1);
  tentacle["d2"] = digitalRead(config::TENTACLED2);
  tentacle["d3"] = digitalRead(config::TENTACLED3);
  tentacle["d4"] = digitalRead(config::TENTACLED4);
  tentacle["fullyUp"] = previousTentaclesFullyUpStatus;

  // Motor status
  doc["riddleMotorActive"] = riddleMotorActive;
  doc["timestamp"] = now;

  mythra.publishJson("Telemetry", "sensors", doc);
}

void printDebugInfo() {
  unsigned long now = millis();
  if (now - lastDebugPrint < config::DEBUG_PRINT_INTERVAL_MS) {
    return;
  }
  lastDebugPrint = now;

  Serial.printf("[StudyA] Porthole sensors - A1:%d A2:%d B1:%d B2:%d C1:%d C2:%d | Open:%s\n",
                digitalRead(config::PORTHOLEA1), digitalRead(config::PORTHOLEA2),
                digitalRead(config::PORTHOLEB1), digitalRead(config::PORTHOLEB2),
                digitalRead(config::PORTHOLEC1), digitalRead(config::PORTHOLEC2),
                previousPortholeStatus ? "YES" : "NO");
  Serial.printf("[StudyA] Tentacle sensors - A:%d,%d,%d,%d B:%d,%d,%d,%d C:%d,%d,%d,%d D:%d,%d,%d,%d | FullyUp:%s\n",
                digitalRead(config::TENTACLEA1), digitalRead(config::TENTACLEA2), digitalRead(config::TENTACLEA3), digitalRead(config::TENTACLEA4),
                digitalRead(config::TENTACLEB1), digitalRead(config::TENTACLEB2), digitalRead(config::TENTACLEB3), digitalRead(config::TENTACLEB4),
                digitalRead(config::TENTACLEC1), digitalRead(config::TENTACLEC2), digitalRead(config::TENTACLEC3), digitalRead(config::TENTACLEC4),
                digitalRead(config::TENTACLED1), digitalRead(config::TENTACLED2), digitalRead(config::TENTACLED3), digitalRead(config::TENTACLED4),
                previousTentaclesFullyUpStatus ? "YES" : "NO");
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

  Serial.println(F("=== StudyA Controller Boot ==="));
  Serial.print(F("Device: "));
  Serial.println(config::DEVICE_FRIENDLY_NAME);
  Serial.print(F("Room: "));
  Serial.println(config::ROOM_ID);
  Serial.print(F("Puzzle ID: "));
  Serial.println(config::PUZZLE_ID);

  // Initialize hardware
  initializeHardware();

  // Initialize MQTT
  if (!mythra.begin()) {
    Serial.println(F("[StudyA] MQTT initialization failed"));
  }
  mythra.setCommandCallback(handleMqttCommand);
  mythra.setHeartbeatBuilder(buildHeartbeatPayload);

  Serial.println(F("[StudyA] Setup complete"));
}

void loop() {
  mythra.loop();

  // Handle riddle motor timing
  if (riddleMotorActive && (millis() - riddleMotorStartTime >= config::RIDDLE_MOTOR_DURATION)) {
    digitalWrite(config::RIDDLE_MOTOR, LOW);
    riddleMotorActive = false;
    Serial.println(F("[StudyA] Riddle motor turned OFF after 5 minutes"));

    // Publish event
    DynamicJsonDocument eventDoc(256);
    eventDoc["action"] = "riddleMotorStopped";
    eventDoc["reason"] = "timeout";
    mythra.publishEvent("RiddleMotor", eventDoc);
  }

  // Check sensor states
  checkPortholeStatus();
  checkTentacleStatus();

  // Publish telemetry
  publishTelemetryData();

  // Print debug info
  printDebugInfo();
}
