#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN
// Lab Mechanical SubPanel
// Lab Doors and Chemical Hoist
// IR Sensor on Pin 22 for Rope Drop Solenoid

#include <ParagonMQTT.h>
#include <AccelStepper.h>
#include <IRremote.hpp>

const char *deviceID = "LabRmDoorsHoist";
const char *roomID = "Clockwork";

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

String readString;

// IR Sensor variables
const uint32_t EXPECTED_GUN_ID = 0x51; // Gun ID that triggers rope drop solenoid
bool irSensorActive = true;            // IR sensor activation state

int hoistDirection = 0;
int sensorUp1 = 0;
int sensorUp2 = 0;
int sensorDn1 = 0;
int sensorDn2 = 0;
char hoistSensors[10];

volatile int labDoorsDirection = 0;
int LeftLabDoorSensorOpen1 = 0;
int LeftLabDoorSensorOpen2 = 0;
int LeftLabDoorSensorClose1 = 0;
int LeftLabDoorSensorClose2 = 0;
int RightLabDoorSensorOpen1 = 0;
int RightLabDoorSensorOpen2 = 0;
int RightLabDoorSensorClose1 = 0;
int RightLabDoorSensorClose2 = 0;

#line 66 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void setup();
#line 113 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void loop();
#line 232 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void liftBox(const char *value);
#line 248 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void ropeDrop(const char *value);
#line 256 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void labDoors(const char *value);
#line 276 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void irSensorRead();
#line 285 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void handleIRSignal();
#line 333 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void resetIR(const char *value);
#line 339 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void triggerRopeDrop(const char *value);
#line 350 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
void activateIR(const char *value);
#line 66 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmDoorsHoist/LabRmDoorsHoist.ino"
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

  networkSetup();
  mqttSetup();

  // Serial.println("LabRmDoorsHoist is starting now!");
  delay(2000);

  // Register action handlers
  registerAction("liftBox", liftBox);
  registerAction("ropeDrop", ropeDrop);
  registerAction("labDoors", labDoors); // open, close, stop
  registerAction("resetIR", resetIR);
  registerAction("triggerRopeDrop", triggerRopeDrop);
  registerAction("activateIR", activateIR);
}

void loop()
{
  // Process MQTT messages frequently - this is critical for receiving commands
  if (MQTTclient.connected())
  {
    MQTTclient.loop();
  }
  sensorUp1 = digitalRead(HOISTSENSORUPONE);
  sensorUp2 = digitalRead(HOISTSENSORUPTWO);
  sensorDn1 = digitalRead(HOISTSENSORDNONE);
  sensorDn2 = digitalRead(HOISTSENSORDNTWO);

  // sprintf(hoistSensors, "%d:%d:%d:%d", sensorUp1, sensorUp2, sensorDn1, sensorDn2);
  // Serial.println(hoistSensors);

  LeftLabDoorSensorOpen1 = digitalRead(LEFT_LABDOOR_SENSOR_OPEN_ONE);
  LeftLabDoorSensorOpen2 = digitalRead(LEFT_LABDOOR_SENSOR_OPEN_TWO);
  LeftLabDoorSensorClose1 = digitalRead(LEFT_LABDOOR_SENSOR_CLOSE_ONE);
  LeftLabDoorSensorClose2 = digitalRead(LEFT_LABDOOR_SENSOR_CLOSE_TWO);
  RightLabDoorSensorOpen1 = digitalRead(RIGHT_LABDOOR_SENSOR_OPEN_ONE);
  RightLabDoorSensorOpen2 = digitalRead(RIGHT_LABDOOR_SENSOR_OPEN_TWO);
  RightLabDoorSensorClose1 = digitalRead(RIGHT_LABDOOR_SENSOR_CLOSE_ONE);
  RightLabDoorSensorClose2 = digitalRead(RIGHT_LABDOOR_SENSOR_CLOSE_TWO);

  sprintf(publishDetail, "%d:%d:%d:%d:%d:%d:%d:%d,%d:%d:%d:%d",
          LeftLabDoorSensorOpen1, LeftLabDoorSensorOpen2,
          LeftLabDoorSensorClose1, LeftLabDoorSensorClose2,
          RightLabDoorSensorOpen1, RightLabDoorSensorOpen2,
          RightLabDoorSensorClose1, RightLabDoorSensorClose2,
          sensorUp1, sensorUp2, sensorDn1, sensorDn2);

  sendDataMQTT();

  // Add MQTT connection status check
  if (!MQTTclient.connected())
  {
    Serial.println("WARNING: MQTT not connected!");
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

  sendDataMQTT();
  // Serial.println("Looping...");

  // Print MQTT connection status every 30 seconds (reduced frequency)
  static unsigned long lastStatusPrint = 0;
  if (millis() - lastStatusPrint > 30000)
  {
    lastStatusPrint = millis();
    if (!MQTTclient.connected())
    {
      Serial.print("MQTT disconnected - State: ");
      Serial.println(MQTTclient.state());
    }
  }
}

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
      Serial.println("✓ CORRECT GUN DETECTED!");
      // Activate the rope drop solenoid
      digitalWrite(ROPEDROPSOLENOID, HIGH);
      Serial.println("Rope drop solenoid activated!");
      delay(500);
      digitalWrite(ROPEDROPSOLENOID, LOW);
      Serial.println("Rope drop solenoid deactivated!");
      sprintf(publishDetail, "correct_gun_detected_rope_dropped_0x%02X", IrReceiver.decodedIRData.command);
    }
    else
    {
      Serial.println("✗ WRONG GUN ID DETECTED!");
      Serial.print("  Received: 0x");
      Serial.println(IrReceiver.decodedIRData.command, HEX);
      Serial.print("  Expected: 0x");
      Serial.println(EXPECTED_GUN_ID, HEX);

      sprintf(publishDetail, "wrong_gun_0x%02X", IrReceiver.decodedIRData.command);
    }
  }

  // Update tracking variables
  lastRawData = IrReceiver.decodedIRData.decodedRawData;
  lastTimestamp = millis();
}

void resetIR(const char *value)
{
  Serial.println("IR Reset action identified!");
  sprintf(publishDetail, "ir_reset");
}

void triggerRopeDrop(const char *value)
{
  Serial.println("Manual Rope Drop triggered!");
  digitalWrite(ROPEDROPSOLENOID, HIGH);
  Serial.println("Rope drop solenoid activated manually!");
  delay(2000);
  digitalWrite(ROPEDROPSOLENOID, LOW);
  Serial.println("Rope drop solenoid deactivated!");
  sprintf(publishDetail, "manual_rope_drop");
}

void activateIR(const char *value)
{
  if (strcmp(value, "1") == 0 || strcmp(value, "on") == 0)
  {
    irSensorActive = true;
    Serial.println("IR Sensor activated");
    sprintf(publishDetail, "ir_activated");
  }
  else if (strcmp(value, "0") == 0 || strcmp(value, "off") == 0)
  {
    irSensorActive = false;
    Serial.println("IR Sensor deactivated");
    sprintf(publishDetail, "ir_deactivated");
  }
}


