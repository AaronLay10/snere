// Lab Mechanical SubPanel
// The Cage Teensy B

#include <MythraOS_MQTT.h>
#include <AccelStepper.h>

// ------------------- CONSTANTS & CONFIGURATION -------------------
#define DEVICE_ID "LabRmCageB"
#define DEVICE_FRIENDLY_NAME "Cage B Controller"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "LabCage"

const byte POWERLED = 13;

// Door Three
const byte D3SENSOROPEN_A = 11;
const byte D3SENSOROPEN_B = 9;
const byte D3SENSORCLOSED_A = 10;
const byte D3SENSORCLOSED_B = 8;
const byte D3ENABLE = 35;
int D3OpenA = 0;
int D3OpenB = 0;
int D3ClosedA = 0;
int D3ClosedB = 0;
int D3Direction = 0;

// Door Three Steppers
// Pul+, Pul-, Dir+, Dir-
AccelStepper D3stepperOne(AccelStepper::FULL4WIRE, 24, 25, 26, 27);
AccelStepper D3stepperTwo(AccelStepper::FULL4WIRE, 28, 29, 30, 31);

// Door Four
const byte D4SENSOROPEN_A = 0;
const byte D4SENSOROPEN_B = 1;
const byte D4SENSORCLOSED_A = 2;
const byte D4SENSORCLOSED_B = 3;
const byte D4ENABLE = 36;
int D4OpenA = 0;
int D4OpenB = 0;
int D4ClosedA = 0;
int D4ClosedB = 0;
int D4Direction = 0;

// Door Four Steppers
// Pul+, Pul-, Dir+, Dir-
AccelStepper D4stepperOne(AccelStepper::FULL4WIRE, 4, 5, 6, 7);

// Door Five
const byte D5SENSOROPEN_A = 23;
const byte D5SENSOROPEN_B = 21;
const byte D5SENSORCLOSED_A = 22;
const byte D5SENSORCLOSED_B = 20;
const byte D5ENABLE = 36;
int D5OpenA = 0;
int D5OpenB = 0;
int D5ClosedA = 0;
int D5ClosedB = 0;
int D5Direction = 0;

// Door Five Steppers
// Pul+, Pul-, Dir+, Dir-
AccelStepper D5stepperOne(AccelStepper::FULL4WIRE, 16, 17, 18, 19);
AccelStepper D5stepperTwo(AccelStepper::FULL4WIRE, 38, 39, 40, 41);

// ------------------- MQTT CONFIGURATION -------------------
MythraOSMQTTConfig makeConfig() {
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = "paragon";
  cfg.roomId = ROOM_ID;
  cfg.puzzleId = PUZZLE_ID;
  cfg.deviceId = DEVICE_ID;
  cfg.displayName = DEVICE_FRIENDLY_NAME;
  cfg.useDhcp = true;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// ------------------- FORWARD DECLARATIONS -------------------
void handleCommand(const char *command, const JsonDocument &payload, void *ctx);
bool buildHeartbeat(JsonDocument &doc, void *ctx);
void cageDoors(const char *value);

// ------------------- SETUP -------------------
void setup()
{
  Serial.begin(115200);
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH); // Power LED ON

  // Door 3
  pinMode(D3SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D3SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D3SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D3SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D3ENABLE, OUTPUT);
  digitalWrite(D3ENABLE, HIGH);

  // Door 4
  pinMode(D4SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D4SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D4SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D4SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D4ENABLE, OUTPUT);
  digitalWrite(D4ENABLE, HIGH);

  // Door 5
  pinMode(D5SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D5SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D5SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D5SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D5ENABLE, OUTPUT);
  digitalWrite(D5ENABLE, HIGH);

  // Configure stepper motors
  D3stepperOne.setMaxSpeed(250);
  D3stepperOne.setAcceleration(200);
  D3stepperTwo.setMaxSpeed(250);
  D3stepperTwo.setAcceleration(200);
  D4stepperOne.setMaxSpeed(250);
  D4stepperOne.setAcceleration(200);
  D5stepperOne.setMaxSpeed(250);
  D5stepperOne.setAcceleration(200);
  D5stepperTwo.setMaxSpeed(250);
  D5stepperTwo.setAcceleration(200);

  // Initialize MythraOS MQTT
  if (!mythra.begin()) {
    Serial.println(F("Failed to start MQTT"));
    return;
  }

  mythra.setCommandCallback(handleCommand);
  mythra.setHeartbeatBuilder(buildHeartbeat);

  delay(2000);
  Serial.println(F("LabRmCageB initialized"));
}

// ------------------- LOOP -------------------
void loop()
{
  mythra.loop();

  // Read Door 3 sensors
  D3OpenA = digitalRead(D3SENSOROPEN_A);
  D3OpenB = digitalRead(D3SENSOROPEN_B);
  D3ClosedA = digitalRead(D3SENSORCLOSED_A);
  D3ClosedB = digitalRead(D3SENSORCLOSED_B);

  // Read Door 4 sensors
  D4OpenA = digitalRead(D4SENSOROPEN_A);
  D4OpenB = digitalRead(D4SENSOROPEN_B);
  D4ClosedA = digitalRead(D4SENSORCLOSED_A);
  D4ClosedB = digitalRead(D4SENSORCLOSED_B);

  // Read Door 5 sensors
  D5OpenA = digitalRead(D5SENSOROPEN_A);
  D5OpenB = digitalRead(D5SENSOROPEN_B);
  D5ClosedA = digitalRead(D5SENSORCLOSED_A);
  D5ClosedB = digitalRead(D5SENSORCLOSED_B);

  // Set speeds based on direction and sensors
  // Door 3
  if (D3Direction == 1 && D3OpenA != 0 && D3OpenB != 0)
  {
    D3stepperOne.setSpeed(-250);
    D3stepperTwo.setSpeed(-250);
  }
  else if (D3Direction == 2 && D3ClosedA != 0 && D3ClosedB != 0)
  {
    D3stepperOne.setSpeed(250);
    D3stepperTwo.setSpeed(250);
  }
  else
  {
    D3stepperOne.setSpeed(0);
    D3stepperTwo.setSpeed(0);
  }

  // Door 4
  if (D4Direction == 1 && D4OpenA != 0 && D4OpenB != 0)
  {
    D4stepperOne.setSpeed(250);
  }
  else if (D4Direction == 2 && D4ClosedA != 0 && D4ClosedB != 0)
  {
    D4stepperOne.setSpeed(-250);
  }
  else
  {
    D4stepperOne.setSpeed(0);
  }

  // Door 5
  if (D5Direction == 1 && D5OpenA != 0 && D5OpenB != 0)
  {
    D5stepperOne.setSpeed(250);
    D5stepperTwo.setSpeed(250);
  }
  else if (D5Direction == 2 && D5ClosedA != 0 && D5ClosedB != 0)
  {
    D5stepperOne.setSpeed(-250);
    D5stepperTwo.setSpeed(-250);
  }
  else
  {
    D5stepperOne.setSpeed(0);
    D5stepperTwo.setSpeed(0);
  }

  // Always run steppers for smooth motion
  D3stepperOne.runSpeed();
  D3stepperTwo.runSpeed();
  D4stepperOne.runSpeed();
  D5stepperOne.runSpeed();
  D5stepperTwo.runSpeed();

  // Publish sensor data periodically (handled by heartbeat)
}

// ------------------- MQTT CALLBACKS -------------------
void handleCommand(const char *command, const JsonDocument &payload, void * /*ctx*/) {
  Serial.print(F("[Command] "));
  Serial.println(command);

  // Extract the value from the payload
  const char *value = nullptr;
  if (payload.containsKey("value")) {
    value = payload["value"].as<const char*>();
  } else if (payload.is<const char*>()) {
    value = payload.as<const char*>();
  }

  // Route commands
  if (strcmp(command, "cageDoors") == 0 && value != nullptr) {
    cageDoors(value);
  } else {
    Serial.print(F("Unknown command or missing value: "));
    Serial.println(command);
  }
}

bool buildHeartbeat(JsonDocument &doc, void * /*ctx*/) {
  doc["uptimeMs"] = millis();
  doc["firmware"] = "LabRmCageB_MythraOS";

  // Add door sensor states
  JsonObject sensors = doc.createNestedObject("sensors");

  JsonObject door3 = sensors.createNestedObject("door3");
  door3["openA"] = D3OpenA;
  door3["openB"] = D3OpenB;
  door3["closedA"] = D3ClosedA;
  door3["closedB"] = D3ClosedB;
  door3["direction"] = D3Direction;

  JsonObject door4 = sensors.createNestedObject("door4");
  door4["openA"] = D4OpenA;
  door4["openB"] = D4OpenB;
  door4["closedA"] = D4ClosedA;
  door4["closedB"] = D4ClosedB;
  door4["direction"] = D4Direction;

  JsonObject door5 = sensors.createNestedObject("door5");
  door5["openA"] = D5OpenA;
  door5["openB"] = D5OpenB;
  door5["closedA"] = D5ClosedA;
  door5["closedB"] = D5ClosedB;
  door5["direction"] = D5Direction;

  return true;
}

// ------------------- ACTION HANDLERS -------------------
void cageDoors(const char *value)
{
  Serial.println(F("cageDoors Function"));
  Serial.print(F("cageDoorValue: "));
  Serial.println(value);

  if (strcmp(value, "open") == 0)
  {
    D3Direction = 1; // Set Door 3 direction to open
    D4Direction = 1; // Set Door 4 direction to open
    D5Direction = 1; // Set Door 5 direction to open
    Serial.println(F("Opening Doors"));

    // Publish state change
    DynamicJsonDocument stateDoc(256);
    stateDoc["action"] = "open";
    mythra.publishEvent("DoorsOpening", stateDoc);
  }
  else if (strcmp(value, "close") == 0)
  {
    D3Direction = 2; // Set Door 3 direction to close
    D4Direction = 2; // Set Door 4 direction to close
    D5Direction = 2; // Set Door 5 direction to close
    Serial.println(F("Closing Doors"));

    // Publish state change
    DynamicJsonDocument stateDoc(256);
    stateDoc["action"] = "close";
    mythra.publishEvent("DoorsClosing", stateDoc);
  }
  else
  {
    Serial.println(F("Invalid Command - use 'open' or 'close'"));
  }
}
