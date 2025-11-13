#include <MythraOS_MQTT.h>
#include <AccelStepper.h>
#include <IRremote.hpp> // IR sensor library

#define POWERLED 13
#define PHOTOCELLSAFE A1
#define PHOTOCELLFAN A0
#define IRFAN 16
#define IRSAFE 17 // Second IR sensor pin for the safe
#define MAGLOCKFAN 41
#define SOLENOIDSAFE 40

// Photocell threshold for lever detection (light on = lever open)
#define PHOTOCELL_THRESHOLD 500 // Adjust based on your setup - light on > threshold

#define DEVICE_ID "LeverFanSafe"
#define DEVICE_FRIENDLY_NAME "Fan & Safe Lever"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "LeverFanSafe"

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

const byte FANMOTORENABLE = 37;

AccelStepper stepper(AccelStepper::FULL4WIRE, 33, 34, 35, 36);

int photoCellSafe = 0;
int photoCellFan = 0;

// IR sensor variables
int currentIRPin = IRFAN;
unsigned long lastIRSwitchTime = 0;
const unsigned long IR_SWITCH_INTERVAL = 200;
bool irSignalInProgress = false;
const uint32_t TARGET_IR_CODE = 0x51; // Target IR code to look for
bool irSensorActive = true;           // IR sensor activation state

// Motor control variables
bool fanMotorStopped = true;
char fanMessage[64]; // Buffer for fan MQTT messages

// Telemetry change detection
char lastTelemetryData[64] = "";
bool telemetryInitialized = false;

// Heartbeat timing
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000; // Heartbeat every 10 seconds

void setup()
{
  Serial.begin(115200);

  pinMode(POWERLED, OUTPUT);
  pinMode(MAGLOCKFAN, OUTPUT);
  pinMode(SOLENOIDSAFE, OUTPUT);

  pinMode(FANMOTORENABLE, OUTPUT);

  digitalWrite(POWERLED, HIGH);
  digitalWrite(MAGLOCKFAN, HIGH);
  digitalWrite(SOLENOIDSAFE, LOW);
  digitalWrite(FANMOTORENABLE, LOW);

  // Initialize IR sensor
  IrReceiver.begin(currentIRPin, ENABLE_LED_FEEDBACK);

  Serial.println("LeverFanSafe IR Sensor System Ready");

  // Setup MythraOS
  mythra.begin();

  // Register action handlers - Customize to fit your needs
  mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
    if (strcmp(command, "fanMaglock") == 0 && payload.is<const char*>()) {
      fanMaglockControl(payload.as<const char*>());
    }
    else if (strcmp(command, "fanControl") == 0 && payload.is<const char*>()) {
      fanControl(payload.as<const char*>());
    }
    else if (strcmp(command, "safeControl") == 0 && payload.is<const char*>()) {
      safeMaglockControl(payload.as<const char*>());
    }
    else if (strcmp(command, "activateIR") == 0 && payload.is<const char*>()) {
      activateIR(payload.as<const char*>());
    }
  });

  stepper.setMaxSpeed(3000);
  stepper.setSpeed(0); // Ensure stepper starts stopped
  stepper.stop();      // Explicitly stop the stepper motor
}

void loop()
{
  // Maintain MQTT connection and process incoming messages
  mythra.loop();

  // Read photocells and convert to open/closed status
  photoCellSafe = analogRead(PHOTOCELLSAFE);
  photoCellFan = analogRead(PHOTOCELLFAN);

  // Convert analog readings to simple open/closed status (light on = open)
  const char* safeStatus = (photoCellSafe > PHOTOCELL_THRESHOLD) ? "OPEN" : "CLOSED";
  const char* fanStatus = (photoCellFan > PHOTOCELL_THRESHOLD) ? "OPEN" : "CLOSED";

  // CHANGE DETECTION: Only publish telemetry if lever status changed and MQTT is connected
  char telemetryData[64];
  sprintf(telemetryData, "Safe:%s,Fan:%s", safeStatus, fanStatus);

  bool dataChanged = (!telemetryInitialized) || (strcmp(telemetryData, lastTelemetryData) != 0);

  if (dataChanged && mythra.isConnected())
  {
    Serial.print("[PUBLISHING] ");
    Serial.println(telemetryData);
    mythra.publishText("Telemetry", "data", telemetryData);
    strcpy(lastTelemetryData, telemetryData);
    telemetryInitialized = true;
  }

  // Heartbeat message to confirm loop is running
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL)
  {
    mythra.publishText("Events", "event", "HEARTBEAT IR_System_running_and_monitoring");
    lastHeartbeat = millis();
  }

  // Handle IR sensor monitoring (alternate between two sensors)
  if (irSensorActive && IrReceiver.decode())
  {
    irSignalInProgress = true;
    handleIRSignal(currentIRPin);
    IrReceiver.resume(); // Resume receiving
    irSignalInProgress = false;
    lastIRSwitchTime = millis(); // Reset switch timer after receiving a signal
  }

  // Switch between IR sensors if no signal is in progress and IR is active
  if (irSensorActive && !irSignalInProgress && (millis() - lastIRSwitchTime > IR_SWITCH_INTERVAL))
  {
    // Switch to the other IR sensor pin
    if (currentIRPin == IRFAN)
    {
      currentIRPin = IRSAFE;
    }
    else
    {
      currentIRPin = IRFAN;
    }

    // Reinitialize IR receiver for the new pin
    IrReceiver.begin(currentIRPin, ENABLE_LED_FEEDBACK);
    lastIRSwitchTime = millis();
  }

  // Only run stepper motor if explicitly enabled and not stopped
  if (!fanMotorStopped && digitalRead(FANMOTORENABLE) == HIGH)
  {
    stepper.runSpeed();
  }
}

// MQTT Action Handler Functions
void fanMaglockControl(const char *action)
{
  Serial.print("Fan Maglock Action: ");
  Serial.println(action);
  if (strcmp(action, "unlock") == 0)
  {
    digitalWrite(MAGLOCKFAN, LOW);
    Serial.println("Fan maglock UNLOCKED");
  }
  else if (strcmp(action, "lock") == 0)
  {
    digitalWrite(MAGLOCKFAN, HIGH);
    Serial.println("Fan maglock LOCKED");
  }
}

void fanControl(const char *action)
{
  Serial.print("Fan Control Action: ");
  Serial.println(action);
  if (strcmp(action, "on") == 0)
  {
    digitalWrite(FANMOTORENABLE, LOW);
    fanMotorStopped = false; // Allow stepper motor to run
    stepper.setSpeed(1500);  // Restore stepper speed
    Serial.println("Fan motor ENABLED");
  }
  else if (strcmp(action, "off") == 0)
  {
    digitalWrite(FANMOTORENABLE, HIGH);
    fanMotorStopped = true; // Stop stepper motor
    stepper.setSpeed(0);    // Set stepper speed to 0
    Serial.println("Fan motor DISABLED");
  }
}

void safeMaglockControl(const char *action)
{
  Serial.print("Safe Control Action: ");
  Serial.println(action);
  if (strcmp(action, "open") == 0)
  {
    digitalWrite(SOLENOIDSAFE, HIGH);
    Serial.println("Safe solenoid ACTIVATED (opened)");
  }
  else if (strcmp(action, "close") == 0)
  {
    digitalWrite(SOLENOIDSAFE, LOW);
    Serial.println("Safe solenoid DEACTIVATED (closed)");
  }
}

void handleIRSignal(int pin)
{
  // Check for noise (all zeros with no bits)
  bool isNoise = (IrReceiver.decodedIRData.command == 0 &&
                  IrReceiver.decodedIRData.address == 0 &&
                  IrReceiver.decodedIRData.decodedRawData == 0 &&
                  IrReceiver.decodedIRData.numberOfBits == 0);

  if (isNoise)
  {
    return;
  }

  // Check for any non-zero data
  bool hasAnyData = (IrReceiver.decodedIRData.command != 0 ||
                     IrReceiver.decodedIRData.address != 0 ||
                     IrReceiver.decodedIRData.decodedRawData != 0 ||
                     IrReceiver.decodedIRData.numberOfBits > 0);

  if (!hasAnyData)
  {
    return;
  }

  // Process signal with data
  uint32_t command = IrReceiver.decodedIRData.command;
  uint32_t rawData = IrReceiver.decodedIRData.decodedRawData;

  // Check if this is our target code (check both command and raw data)
  if (command == TARGET_IR_CODE || rawData == TARGET_IR_CODE)
  {
    Serial.println("*** TARGET CODE 0x51 DETECTED! ***");

    // Determine which sensor detected the code and take appropriate action
    if (pin == IRFAN)
    {
      Serial.println("Fan IR sensor triggered - unlocking maglock and stopping fan");
      // Directly control fan: unlock maglock and stop fan motor
      digitalWrite(MAGLOCKFAN, LOW);     // Unlock the fan maglock
      digitalWrite(FANMOTORENABLE, LOW); // Stop the fan motor
      fanMotorStopped = true;            // Stop stepper motor
      stepper.setSpeed(0);               // Set stepper speed to 0
      snprintf(fanMessage, sizeof(fanMessage), "Fan,1");
      mythra.publishText("Events", "event", fanMessage); // Publish message to MQTT server
    }
    else if (pin == IRSAFE)
    {
      Serial.println("Safe IR sensor triggered - sending MQTT message to server");
      // Send MQTT message to server requesting safe action
      char message[64];
      snprintf(message, sizeof(message), "Safe,1");
      mythra.publishText("Events", "event", message);
      digitalWrite(SOLENOIDSAFE, HIGH);
      delay(200); // Open the safe solenoid
      digitalWrite(SOLENOIDSAFE, LOW);
    }

    // Flash LED to indicate target code received
    digitalWrite(POWERLED, LOW);
    delay(100);
    digitalWrite(POWERLED, HIGH);
    delay(100);
    digitalWrite(POWERLED, LOW);
    delay(100);
    digitalWrite(POWERLED, HIGH);
  }
}

void activateIR(const char *value)
{
  if (strcmp(value, "1") == 0 || strcmp(value, "on") == 0)
  {
    if (!irSensorActive)
    {
      // Restart IR sensing when activated
      IrReceiver.begin(currentIRPin, ENABLE_LED_FEEDBACK);
    }
    irSensorActive = true;
    Serial.println("IR Sensor activated");
    mythra.publishText("Telemetry", "data", "ir_activated");
  }
  else if (strcmp(value, "0") == 0 || strcmp(value, "off") == 0)
  {
    if (irSensorActive)
    {
      // Stop IR sensing when deactivated
      IrReceiver.stop();
    }
    irSensorActive = false;
    Serial.println("IR Sensor deactivated");
    mythra.publishText("Telemetry", "data", "ir_deactivated");
  }
}
