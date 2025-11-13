// Lab Mechanical SubPanel - The Cage Teensy A
// Migrated to MythraOS_MQTT

#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN

#include <MythraOS_MQTT.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>

// ──────────────────────────────────────────────────────────────────────────────
// Configuration Constants
// ──────────────────────────────────────────────────────────────────────────────
namespace config {
  // MQTT Broker Configuration
  const IPAddress MQTT_BROKER_IP(192, 168, 20, 3);
  constexpr const char *MQTT_HOST = "mythraos.com";
  constexpr uint16_t MQTT_PORT = 1883;

  // Device Identity
  constexpr const char *MQTT_NAMESPACE = "paragon";
  constexpr const char *ROOM_ID = "Clockwork";
  constexpr const char *DEVICE_ID = "LabRmCageA";
  constexpr const char *DEVICE_FRIENDLY_NAME = "Cage A Controller";

  // Timing Configuration
  constexpr unsigned long SENSOR_PUBLISH_INTERVAL_MS = 5000;
  constexpr unsigned long HEARTBEAT_INTERVAL_MS = 5000;

  // Hardware Pin Definitions
  constexpr uint8_t POWERLED = 13;

  // Door One
  constexpr uint8_t D1SENSOROPEN_A = 10;
  constexpr uint8_t D1SENSOROPEN_B = 12;
  constexpr uint8_t D1SENSORCLOSED_A = 9;
  constexpr uint8_t D1SENSORCLOSED_B = 11;
  constexpr uint8_t D1ENABLE = 35;

  // Door Two
  constexpr uint8_t D2SENSOROPEN_A = 3;
  constexpr uint8_t D2SENSOROPEN_B = 2;
  constexpr uint8_t D2SENSORCLOSED_A = 1;
  constexpr uint8_t D2SENSORCLOSED_B = 0;
  constexpr uint8_t D2ENABLE = 36;

  // Canister Charging
  constexpr uint8_t CANISTERCHARGING = 41;

  // JSON Buffer Sizes
  constexpr uint16_t COMMAND_JSON_CAPACITY = 512;
  constexpr uint16_t PUBLISH_JSON_CAPACITY = 768;

} // namespace config

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Configuration and Instance
// ──────────────────────────────────────────────────────────────────────────────
MythraOSMQTTConfig makeConfig() {
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = config::MQTT_NAMESPACE;
  cfg.roomId = config::ROOM_ID;
  cfg.puzzleId = config::DEVICE_ID;
  cfg.deviceId = config::DEVICE_ID;
  cfg.displayName = config::DEVICE_FRIENDLY_NAME;
  cfg.useDhcp = true;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// ──────────────────────────────────────────────────────────────────────────────
// Forward Declarations
// ──────────────────────────────────────────────────────────────────────────────
bool buildHeartbeatPayload(JsonDocument &doc, void *ctx);
void handleMqttCommand(const char *command, const JsonDocument &payload, void *ctx);
void publishSensorUpdate();

// ──────────────────────────────────────────────────────────────────────────────
// Global State
// ──────────────────────────────────────────────────────────────────────────────

// Door sensor readings
int D1OpenA = 0;
int D1OpenB = 0;
int D1ClosedA = 0;
int D1ClosedB = 0;

int D2OpenA = 0;
int D2OpenB = 0;
int D2ClosedA = 0;
int D2ClosedB = 0;

// Door direction control
int D1Direction = 0;  // 0 = stop, 1 = open, 2 = close
int D2Direction = 0;  // 0 = stop, 1 = open, 2 = close

// Stepper motors
// Pul+, Pul-, Dir+, Dir-
AccelStepper D1stepperOne(AccelStepper::FULL4WIRE, 24, 25, 26, 27);
AccelStepper D1stepperTwo(AccelStepper::FULL4WIRE, 28, 29, 30, 31);
AccelStepper D2stepperOne(AccelStepper::FULL4WIRE, 4, 5, 6, 7);

unsigned long lastSensorPublish = 0;
bool manualHeartbeatRequested = false;

// Serial debug
String readString;

// ──────────────────────────────────────────────────────────────────────────────
// Device Identifier Helper
// ──────────────────────────────────────────────────────────────────────────────
const char *buildDeviceIdentifier() {
  static char buffer[64];
  static bool initialized = false;

  if (!initialized) {
    String roomLower = String(config::ROOM_ID);
    roomLower.toLowerCase();
    String deviceLower = String(config::DEVICE_ID);
    deviceLower.toLowerCase();

    snprintf(buffer, sizeof(buffer), "%s-%s", roomLower.c_str(), deviceLower.c_str());
    initialized = true;
  }

  return buffer;
}

const char *getHardwareLabel() {
  static char label[32];
  static bool initialized = false;

  if (!initialized) {
    String board = String(teensyBoardVersion());
    board.trim();
    if (board.length() == 0) {
      board = "Teensy Controller";
    }
    board.toCharArray(label, sizeof(label));
    initialized = true;
  }

  return label;
}


// ──────────────────────────────────────────────────────────────────────────────
// Heartbeat Payload Builder
// ──────────────────────────────────────────────────────────────────────────────
bool buildHeartbeatPayload(JsonDocument &doc, void *ctx) {
  doc["uniqueId"] = buildDeviceIdentifier();
  doc["deviceId"] = config::DEVICE_ID;
  doc["status"] = "online";

  // Metadata
  JsonObject metadata = doc["metadata"].to<JsonObject>();
  metadata["hardware"] = getHardwareLabel();
  metadata["displayName"] = config::DEVICE_FRIENDLY_NAME;
  metadata["roomLabel"] = config::ROOM_ID;
  metadata["uptime"] = millis();

  // Current state
  metadata["d1Direction"] = D1Direction;
  metadata["d2Direction"] = D2Direction;

  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Command Handler
// ──────────────────────────────────────────────────────────────────────────────
void handleMqttCommand(const char *command, const JsonDocument &payload, void *ctx) {
  Serial.print("Received command: ");
  Serial.println(command);

  // Extract value from payload
  String value;
  if (payload.is<JsonObjectConst>()) {
    auto obj = payload.as<JsonObjectConst>();
    if (obj.containsKey("value")) {
      value = obj["value"].as<String>();
    } else if (obj.containsKey("state")) {
      value = obj["state"].as<String>();
    }
  } else if (payload.is<const char *>()) {
    value = payload.as<const char *>();
  }

  // cageDoors command
  if (strcmp(command, "cageDoors") == 0) {
    Serial.println("cageDoors Function");
    Serial.print("cageDoorValue: ");
    Serial.println(value);

    if (value.equalsIgnoreCase("open")) {
      D1Direction = 1;  // Set Door 1 direction to open
      D2Direction = 1;  // Set Door 2 direction to open
      Serial.println("Opening Doors");

      DynamicJsonDocument eventDoc(256);
      eventDoc["action"] = "opening";
      String eventData = "opening";
      mythra.publishText("Events", "event", eventData.c_str());
    }
    else if (value.equalsIgnoreCase("close")) {
      D1Direction = 2;  // Set Door 1 direction to close
      D2Direction = 2;  // Set Door 2 direction to close
      Serial.println("Closing Doors");

      DynamicJsonDocument eventDoc(256);
      eventDoc["action"] = "closing";
      String eventData = "closing";
      mythra.publishText("Events", "event", eventData.c_str());
    }
    else {
      Serial.println("Invalid Command - use 'open' or 'close'");
    }
    return;
  }

  // canisterCharger command
  if (strcmp(command, "canisterCharger") == 0) {
    Serial.println("canisterCharger Function");
    Serial.print("chargerValue: ");
    Serial.println(value);

    if (value.equalsIgnoreCase("on")) {
      digitalWrite(config::CANISTERCHARGING, HIGH);
      Serial.println("Canister Charger ON");

      DynamicJsonDocument eventDoc(256);
      eventDoc["state"] = "on";
      String eventData = "on";
      mythra.publishText("Events", "event", eventData.c_str());
    }
    else if (value.equalsIgnoreCase("off")) {
      digitalWrite(config::CANISTERCHARGING, LOW);
      Serial.println("Canister Charger OFF");

      DynamicJsonDocument eventDoc(256);
      eventDoc["state"] = "off";
      String eventData = "off";
      mythra.publishText("Events", "event", eventData.c_str());
    }
    else {
      Serial.println("Invalid Canister Charger Command - use 'on' or 'off'");
    }
    return;
  }

  // heartbeat command
  if (strcmp(command, "heartbeat") == 0) {
    manualHeartbeatRequested = true;
    return;
  }

  // reset command
  if (strcmp(command, "reset") == 0) {
    Serial.println("RESET command received");
    D1Direction = 0;
    D2Direction = 0;
    digitalWrite(config::CANISTERCHARGING, LOW);

    DynamicJsonDocument eventDoc(256);
    eventDoc["reset"] = true;
    String eventData = "reset";
    mythra.publishText("Events", "event", eventData.c_str());
    return;
  }

  Serial.print("Unknown command: ");
  Serial.println(command);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sensor Publishing
// ──────────────────────────────────────────────────────────────────────────────
void publishSensorUpdate() {
  DynamicJsonDocument doc(config::PUBLISH_JSON_CAPACITY);

  doc["uniqueId"] = buildDeviceIdentifier();
  doc["timestamp"] = millis();

  // Door 1 sensors
  JsonObject door1 = doc["door1"].to<JsonObject>();
  door1["openA"] = D1OpenA;
  door1["openB"] = D1OpenB;
  door1["closedA"] = D1ClosedA;
  door1["closedB"] = D1ClosedB;
  door1["direction"] = D1Direction;

  // Door 2 sensors
  JsonObject door2 = doc["door2"].to<JsonObject>();
  door2["openA"] = D2OpenA;
  door2["openB"] = D2OpenB;
  door2["closedA"] = D2ClosedA;
  door2["closedB"] = D2ClosedB;
  door2["direction"] = D2Direction;

  String telemetryData;
  serializeJson(doc, telemetryData);
  mythra.publishText("Telemetry", "data", telemetryData.c_str());
}

// ──────────────────────────────────────────────────────────────────────────────
// Hardware Initialization
// ──────────────────────────────────────────────────────────────────────────────
void initializeHardware() {
  Serial.println("Initializing Cage A hardware...");

  pinMode(config::POWERLED, OUTPUT);
  digitalWrite(config::POWERLED, HIGH); // Power LED ON

  // Door 1
  pinMode(config::D1SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(config::D1SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(config::D1SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(config::D1SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(config::D1ENABLE, OUTPUT);
  digitalWrite(config::D1ENABLE, LOW);

  // Door 2
  pinMode(config::D2SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(config::D2SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(config::D2SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(config::D2SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(config::D2ENABLE, OUTPUT);
  digitalWrite(config::D2ENABLE, LOW);

  // Canister Charging
  pinMode(config::CANISTERCHARGING, OUTPUT);
  digitalWrite(config::CANISTERCHARGING, LOW);

  // Configure stepper motors
  D1stepperOne.setMaxSpeed(500);
  D1stepperOne.setAcceleration(100);
  D1stepperTwo.setMaxSpeed(500);
  D1stepperTwo.setAcceleration(100);
  D2stepperOne.setMaxSpeed(500);
  D2stepperOne.setAcceleration(100);

  Serial.println("Cage A hardware initialized");
}

// ──────────────────────────────────────────────────────────────────────────────
// Sensor and Motor Updates
// ──────────────────────────────────────────────────────────────────────────────
void updateSensors() {
  // Read all door sensors
  D1OpenA = digitalRead(config::D1SENSOROPEN_A);
  D1OpenB = digitalRead(config::D1SENSOROPEN_B);
  D1ClosedA = digitalRead(config::D1SENSORCLOSED_A);
  D1ClosedB = digitalRead(config::D1SENSORCLOSED_B);

  D2OpenA = digitalRead(config::D2SENSOROPEN_A);
  D2OpenB = digitalRead(config::D2SENSOROPEN_B);
  D2ClosedA = digitalRead(config::D2SENSORCLOSED_A);
  D2ClosedB = digitalRead(config::D2SENSORCLOSED_B);

  // Publish sensor data periodically
  unsigned long now = millis();
  if (now - lastSensorPublish >= config::SENSOR_PUBLISH_INTERVAL_MS) {
    publishSensorUpdate();
    lastSensorPublish = now;
  }
}

void updateMotors() {
  // Door 1 logic
  if (D1Direction == 1 && D1OpenA != 0 && D1OpenB != 0) {
    D1stepperOne.setSpeed(-400);
    D1stepperTwo.setSpeed(400);
  }
  else if (D1Direction == 2 && D1ClosedA != 0 && D1ClosedB != 0) {
    D1stepperOne.setSpeed(400);
    D1stepperTwo.setSpeed(-400);
  }
  else {
    D1stepperOne.setSpeed(0);
    D1stepperTwo.setSpeed(0);
  }

  // Door 2 logic
  if (D2Direction == 1 && D2OpenA != 0 && D2OpenB != 0) {
    D2stepperOne.setSpeed(400);
  }
  else if (D2Direction == 2 && D2ClosedA != 0 && D2ClosedB != 0) {
    D2stepperOne.setSpeed(-400);
  }
  else {
    D2stepperOne.setSpeed(0);
  }

  // Always run steppers for smooth motion
  D1stepperOne.runSpeed();
  D1stepperTwo.runSpeed();
  D2stepperOne.runSpeed();
}

void processSerialDebug() {
  // Debug and Test Code
  while (Serial.available()) {
    delay(2); // delay to allow byte to arrive in input buffer
    char c = Serial.read();
    readString += c;
  }

  if (readString.length() > 0) {
    Serial.println(readString.toInt());
    // D1Direction = readString.toInt();
    D2Direction = readString.toInt();
    readString = "";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Arduino Setup
// ──────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("═══════════════════════════════════════════════════════════");
  Serial.print("ParagonMythraOS System Controller - ");
  Serial.println(config::DEVICE_FRIENDLY_NAME);
  Serial.print("Device ID: ");
  Serial.println(buildDeviceIdentifier());
  Serial.print("Board: ");
  Serial.println(teensyBoardVersion());
  Serial.print("USB SN: ");
  Serial.println(teensyUsbSN());
  Serial.print("MAC: ");
  Serial.println(teensyMAC());
  Serial.println("═══════════════════════════════════════════════════════════");

  initializeHardware();

  mythra.setCommandCallback(handleMqttCommand);
  mythra.setHeartbeatBuilder(buildHeartbeatPayload);

  if (!mythra.begin()) {
    Serial.println("[LabRmCageA] MQTT initialization failed");
  }

  Serial.println("Setup complete");
}

// ──────────────────────────────────────────────────────────────────────────────
// Arduino Loop
// ──────────────────────────────────────────────────────────────────────────────
void loop() {
  mythra.loop();

  if (manualHeartbeatRequested) {
    mythra.publishHeartbeat();
    manualHeartbeatRequested = false;
  }

  processSerialDebug();
  updateSensors();
  updateMotors();
}
