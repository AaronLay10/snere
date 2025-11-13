#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN

#include <MythraOS_MQTT.h>
#include <AccelStepper.h>
#include <IRremote.hpp>

// Device Configuration
#define DEVICE_ID "LabRmDoorsHoist"
#define DEVICE_FRIENDLY_NAME "Lab Doors & Hoist"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "LabRmDoorsHoist"

const byte POWERLED = 13;
const byte HOISTSENSORUPONE = 15;
const byte HOISTSENSORUPTWO = 17;
const byte HOISTSENSORDNONE = 14;
const byte HOISTSENSORDNTWO = 16;
const byte LEFT_LABDOOR_SENSOR_OPEN_ONE = 40;
const byte LEFT_LABDOOR_SENSOR_OPEN_TWO = 37;
const byte LEFT_LABDOOR_SENSOR_CLOSE_ONE = 39;
const byte LEFT_LABDOOR_SENSOR_CLOSE_TWO = 38;
const byte RIGHT_LABDOOR_SENSOR_OPEN_ONE = 36;
const byte RIGHT_LABDOOR_SENSOR_OPEN_TWO = 34;
const byte RIGHT_LABDOOR_SENSOR_CLOSE_ONE = 35;
const byte RIGHT_LABDOOR_SENSOR_CLOSE_TWO = 33;

const byte IRSENSOR = 21;
const byte ROPEDROPSOLENOID = 23;

const byte HOIST_ENABLE = 20;
const byte LABDOORS_ENABLE = 19;

// Pul+, Pul-, Dir+, Dir-
AccelStepper stepperOne(AccelStepper::FULL4WIRE, 0, 1, 2, 3);
// Pul+, Pul-, Dir+, Dir-
AccelStepper stepperTwo(AccelStepper::FULL4WIRE, 5, 6, 7, 8);
// Pul+, Pul-, Dir+, Dir-
AccelStepper stepperDoorLeft(AccelStepper::FULL4WIRE, 24, 25, 26, 27);
// Pul+, Pul-, Dir+, Dir-
AccelStepper stepperDoorRight(AccelStepper::FULL4WIRE, 29, 30, 31, 32);

// IR Sensor variables
const uint32_t EXPECTED_GUN_ID = 0x51; // Gun ID that triggers rope drop solenoid
bool irSensorActive = true;            // IR sensor activation state

int hoistDirection = 0;
int sensorUp1 = 0;
int sensorUp2 = 0;
int sensorDn1 = 0;
int sensorDn2 = 0;

volatile int labDoorsDirection = 0;
int LeftLabDoorSensorOpen1 = 0;
int LeftLabDoorSensorOpen2 = 0;
int LeftLabDoorSensorClose1 = 0;
int LeftLabDoorSensorClose2 = 0;
int RightLabDoorSensorOpen1 = 0;
int RightLabDoorSensorOpen2 = 0;
int RightLabDoorSensorClose1 = 0;
int RightLabDoorSensorClose2 = 0;

// Telemetry change detection
char lastTelemetry[128] = "";
bool telemetryInitialized = false;

// MythraOS Configuration
MythraOSMQTTConfig makeConfig()
{
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

void setup()
{
  stepperOne.setMaxSpeed(4000);
  stepperOne.setAcceleration(1000);
  stepperTwo.setMaxSpeed(4000);
  stepperTwo.setAcceleration(1000);

  Serial.begin(115200);
  pinMode(POWERLED, OUTPUT);
  pinMode(ROPEDROPSOLENOID, OUTPUT);
  pinMode(HOISTSENSORUPONE, INPUT_PULLDOWN);
  pinMode(HOISTSENSORUPTWO, INPUT_PULLDOWN);
  pinMode(HOISTSENSORDNONE, INPUT_PULLDOWN);
  pinMode(HOISTSENSORDNTWO, INPUT_PULLDOWN);
  pinMode(LEFT_LABDOOR_SENSOR_OPEN_ONE, INPUT_PULLDOWN);
  pinMode(LEFT_LABDOOR_SENSOR_OPEN_TWO, INPUT_PULLDOWN);
  pinMode(LEFT_LABDOOR_SENSOR_CLOSE_ONE, INPUT_PULLDOWN);
  pinMode(LEFT_LABDOOR_SENSOR_CLOSE_TWO, INPUT_PULLDOWN);
  pinMode(RIGHT_LABDOOR_SENSOR_OPEN_ONE, INPUT_PULLDOWN);
  pinMode(RIGHT_LABDOOR_SENSOR_OPEN_TWO, INPUT_PULLDOWN);
  pinMode(RIGHT_LABDOOR_SENSOR_CLOSE_ONE, INPUT_PULLDOWN);
  pinMode(RIGHT_LABDOOR_SENSOR_CLOSE_TWO, INPUT_PULLDOWN);

  // IR Sensor Setup
  IrReceiver.begin(IRSENSOR, false);
  Serial.println("IR sensor initialized on pin 21");

  digitalWrite(POWERLED, HIGH); // Power LED ON
  digitalWrite(ROPEDROPSOLENOID, LOW);
  digitalWrite(HOIST_ENABLE, LOW);
  digitalWrite(LABDOORS_ENABLE, LOW);

  // Initialize MythraOS
  mythra.begin();

  // Register action handlers using setCommandCallback
  mythra.setCommandCallback(commandHandler);

  Serial.println("LabRmDoorsHoist is starting now!");
  delay(2000);
}

void loop()
{
  mythra.loop();

  sensorUp1 = digitalRead(HOISTSENSORUPONE);
  sensorUp2 = digitalRead(HOISTSENSORUPTWO);
  sensorDn1 = digitalRead(HOISTSENSORDNONE);
  sensorDn2 = digitalRead(HOISTSENSORDNTWO);

  LeftLabDoorSensorOpen1 = digitalRead(LEFT_LABDOOR_SENSOR_OPEN_ONE);
  LeftLabDoorSensorOpen2 = digitalRead(LEFT_LABDOOR_SENSOR_OPEN_TWO);
  LeftLabDoorSensorClose1 = digitalRead(LEFT_LABDOOR_SENSOR_CLOSE_ONE);
  LeftLabDoorSensorClose2 = digitalRead(LEFT_LABDOOR_SENSOR_CLOSE_TWO);
  RightLabDoorSensorOpen1 = digitalRead(RIGHT_LABDOOR_SENSOR_OPEN_ONE);
  RightLabDoorSensorOpen2 = digitalRead(RIGHT_LABDOOR_SENSOR_OPEN_TWO);
  RightLabDoorSensorClose1 = digitalRead(RIGHT_LABDOOR_SENSOR_CLOSE_ONE);
  RightLabDoorSensorClose2 = digitalRead(RIGHT_LABDOOR_SENSOR_CLOSE_TWO);

  // Publish sensor telemetry
  char telemetry[128];
  sprintf(telemetry, "%d:%d:%d:%d:%d:%d:%d:%d,%d:%d:%d:%d",
          LeftLabDoorSensorOpen1, LeftLabDoorSensorOpen2,
          LeftLabDoorSensorClose1, LeftLabDoorSensorClose2,
          RightLabDoorSensorOpen1, RightLabDoorSensorOpen2,
          RightLabDoorSensorClose1, RightLabDoorSensorClose2,
          sensorUp1, sensorUp2, sensorDn1, sensorDn2);

  // CHANGE DETECTION: Only publish if data has changed and MQTT is connected
  bool dataChanged = (!telemetryInitialized) || (strcmp(telemetry, lastTelemetry) != 0);

  if (dataChanged && mythra.isConnected())
  {
    Serial.print("[PUBLISHING] ");
    Serial.println(telemetry);
    mythra.publishText("Sensors", "DoorHoist", telemetry);
    strcpy(lastTelemetry, telemetry);
    telemetryInitialized = true;
  }

  irSensorRead();

  stepperDoorLeft.setMaxSpeed(6000);
  stepperDoorLeft.setAcceleration(1000);
  stepperDoorRight.setMaxSpeed(6000);
  stepperDoorRight.setAcceleration(1000);

  // Close = 1
  // Open = 2
  if (labDoorsDirection == 2 && LeftLabDoorSensorOpen1 != 1 && LeftLabDoorSensorOpen2 != 1)
  {
    digitalWrite(LABDOORS_ENABLE, LOW);
    stepperDoorLeft.setSpeed(6000);
    stepperDoorLeft.runSpeed();
  }
  if (labDoorsDirection == 2 && RightLabDoorSensorOpen1 != 1 && RightLabDoorSensorOpen2 != 1)
  {
    digitalWrite(LABDOORS_ENABLE, LOW);
    stepperDoorRight.setSpeed(6000);
    stepperDoorRight.runSpeed();
  }
  if (labDoorsDirection == 1 && LeftLabDoorSensorClose1 != 1 && LeftLabDoorSensorClose2 != 1)
  {
    digitalWrite(LABDOORS_ENABLE, LOW);
    stepperDoorLeft.setSpeed(-6000);
    stepperDoorLeft.runSpeed();
  }
  if (labDoorsDirection == 1 && RightLabDoorSensorClose1 != 1 && RightLabDoorSensorClose2 != 1)
  {
    digitalWrite(LABDOORS_ENABLE, LOW);
    stepperDoorRight.setSpeed(-6000);
    stepperDoorRight.runSpeed();
  }

  if (labDoorsDirection != 1 && labDoorsDirection != 2)
  {
    // Doors stopped
    digitalWrite(LABDOORS_ENABLE, HIGH);
  }

  if (hoistDirection == 2 && sensorUp1 != 1 && sensorUp2 != 1)
  { // Up
    digitalWrite(HOIST_ENABLE, LOW);
    stepperOne.setSpeed(4000);
    stepperOne.runSpeed();
    stepperTwo.setSpeed(4000);
    stepperTwo.runSpeed();
  }
  else if (hoistDirection == 1 && sensorDn1 != 1 && sensorDn2 != 1)
  { // Down
    digitalWrite(HOIST_ENABLE, LOW);
    stepperOne.setSpeed(-4000);
    stepperOne.runSpeed();
    stepperTwo.setSpeed(-4000);
    stepperTwo.runSpeed();
  }
  else
  {
    stepperOne.setSpeed(0);
    stepperOne.runSpeed();
    stepperTwo.setSpeed(0);
    stepperTwo.runSpeed();
  }
}

// ═══════════════════════════════════════════════════════════════
//                      MQTT COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════

void commandHandler(const char *command, const JsonDocument &payload, void *context)
{
  // Extract value from payload
  const char *value = payload["value"] | "";

  Serial.print("Command received: ");
  Serial.print(command);
  Serial.print(" = ");
  Serial.println(value);

  if (strcmp(command, "liftBox") == 0)
  {
    liftBox(value);
  }
  else if (strcmp(command, "ropeDrop") == 0)
  {
    ropeDrop(value);
  }
  else if (strcmp(command, "labDoors") == 0)
  {
    labDoors(value);
  }
  else if (strcmp(command, "resetIR") == 0)
  {
    resetIR(value);
  }
  else if (strcmp(command, "triggerRopeDrop") == 0)
  {
    triggerRopeDrop(value);
  }
  else if (strcmp(command, "activateIR") == 0)
  {
    activateIR(value);
  }
}

// ═══════════════════════════════════════════════════════════════
//                      ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

void liftBox(const char *value)
{
  if (strcmp(value, "down") == 0)
  {
    hoistDirection = 1; // Down = 1
  }
  else if (strcmp(value, "up") == 0)
  {
    hoistDirection = 2; // Up = 2
  }
  else if (strcmp(value, "stop") == 0)
  {
    hoistDirection = 0; // Stop/Invalid command
  }
}

void ropeDrop(const char *value)
{
  Serial.println("ropeDrop Action identified!");
  digitalWrite(ROPEDROPSOLENOID, HIGH);
  delay(2000);
  digitalWrite(ROPEDROPSOLENOID, LOW);
}

void labDoors(const char *value)
{
  if (strcmp(value, "close") == 0)
  {
    labDoorsDirection = 1; // Close = 1
  }
  else if (strcmp(value, "open") == 0)
  {
    labDoorsDirection = 2; // Open = 2
  }
  else
  {
    labDoorsDirection = 0; // Stop/Invalid command
  }
}

// ═══════════════════════════════════════════════════════════════
//                      IR SENSOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════

void irSensorRead()
{
  if (irSensorActive && IrReceiver.decode())
  {
    handleIRSignal();
    IrReceiver.resume(); // Prepare for the next reception
  }
}

void handleIRSignal()
{
  // Compare with previous signal to detect duplicates
  static uint32_t lastRawData = 0;
  static unsigned long lastTimestamp = 0;

  bool isDuplicate = (IrReceiver.decodedIRData.decodedRawData == lastRawData &&
                      (millis() - lastTimestamp) < 500);

  // Filter out weak signals and fragments
  bool isWeakSignal = (IrReceiver.decodedIRData.protocol == UNKNOWN ||
                       IrReceiver.decodedIRData.protocol == 2); // PulseDistance is often fragments

  // Only process strong, non-duplicate signals
  if (!isDuplicate && !isWeakSignal)
  {
    Serial.print("IR Signal received - Command: 0x");
    Serial.println(IrReceiver.decodedIRData.command, HEX);

    // Check if the received IR code matches our expected gun ID
    if (IrReceiver.decodedIRData.command == EXPECTED_GUN_ID)
    {
      Serial.println("CORRECT GUN DETECTED!");
      // Activate the rope drop solenoid
      digitalWrite(ROPEDROPSOLENOID, HIGH);
      Serial.println("Rope drop solenoid activated!");
      delay(500);
      digitalWrite(ROPEDROPSOLENOID, LOW);
      Serial.println("Rope drop solenoid deactivated!");

      // Publish event
      char eventMsg[64];
      sprintf(eventMsg, "correct_gun_detected_rope_dropped_0x%02X", IrReceiver.decodedIRData.command);
      mythra.publishText("Events", "IRGun", eventMsg);
    }
    else
    {
      Serial.println("WRONG GUN ID DETECTED!");
      Serial.print("  Received: 0x");
      Serial.println(IrReceiver.decodedIRData.command, HEX);
      Serial.print("  Expected: 0x");
      Serial.println(EXPECTED_GUN_ID, HEX);

      // Publish event
      char eventMsg[32];
      sprintf(eventMsg, "wrong_gun_0x%02X", IrReceiver.decodedIRData.command);
      mythra.publishText("Events", "IRGun", eventMsg);
    }
  }

  // Update tracking variables
  lastRawData = IrReceiver.decodedIRData.decodedRawData;
  lastTimestamp = millis();
}

void resetIR(const char *value)
{
  Serial.println("IR Reset action identified!");
  mythra.publishText("Events", "IRGun", "ir_reset");
}

void triggerRopeDrop(const char *value)
{
  Serial.println("Manual Rope Drop triggered!");
  digitalWrite(ROPEDROPSOLENOID, HIGH);
  Serial.println("Rope drop solenoid activated manually!");
  delay(2000);
  digitalWrite(ROPEDROPSOLENOID, LOW);
  Serial.println("Rope drop solenoid deactivated!");
  mythra.publishText("Events", "RopeDrop", "manual_rope_drop");
}

void activateIR(const char *value)
{
  if (strcmp(value, "1") == 0 || strcmp(value, "on") == 0)
  {
    irSensorActive = true;
    Serial.println("IR Sensor activated");
    mythra.publishText("Events", "IRSensor", "ir_activated");
  }
  else if (strcmp(value, "0") == 0 || strcmp(value, "off") == 0)
  {
    irSensorActive = false;
    Serial.println("IR Sensor deactivated");
    mythra.publishText("Events", "IRSensor", "ir_deactivated");
  }
}
