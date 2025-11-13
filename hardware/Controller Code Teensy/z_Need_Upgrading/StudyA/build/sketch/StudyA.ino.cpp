#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
#include <ParagonMQTT.h>

const char *deviceID = "StudyA";  // Unique device identifier
const char *roomID = "Clockwork"; // Room grouping

#define POWER_LED 13

// Tentacle Move Sensors - Pins 0-3
#define TENTACLEMOVEA1 0
#define TENTACLEMOVEA2 1
#define TENTACLEMOVEB1 2
#define TENTACLEMOVEB2 3

// Porthole Sensors - Pins 5-10
#define PORTHOLEA1 5
#define PORTHOLEA2 6
#define PORTHOLEB1 7
#define PORTHOLEB2 8
#define PORTHOLEC1 9
#define PORTHOLEC2 10

// Riddle Motor Control - Pin 12
#define RIDDLE_MOTOR 12

// Tentacle Sensors - Pins 14-23 & 36-41
#define TENTACLEA1 14
#define TENTACLEA2 15
#define TENTACLEA3 16
#define TENTACLEA4 17
#define TENTACLEB1 18
#define TENTACLEB2 19
#define TENTACLEB3 20
#define TENTACLEB4 21
#define TENTACLEC1 22
#define TENTACLEC2 23
#define TENTACLEC3 36
#define TENTACLEC4 37
#define TENTACLED1 38
#define TENTACLED2 39
#define TENTACLED3 40
#define TENTACLED4 41

// Porthole Control - Pins 33 & 34
#define PORTHOLEOPEN 33
#define PORTHOLECLOSE 34

// Global variables for riddle motor timing
unsigned long riddleMotorStartTime = 0;
bool riddleMotorActive = false;
const unsigned long RIDDLE_MOTOR_DURATION = 300000; // 5 minutes in milliseconds

// Global variables for porthole status tracking
bool previousPortholeStatus = false; // false = closed, true = open

// Global variables for tentacle status tracking
bool previousTentaclesFullyUpStatus = false; // false = not fully up, true = fully up

#line 58 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void setup();
#line 120 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void loop();
#line 204 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void riddleMotorHandler(const char *value);
#line 223 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void moveTentaclesHandler(const char *value);
#line 281 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void movePortholesHandler(const char *value);
#line 58 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyA/StudyA.ino"
void setup()
{
  pinMode(POWER_LED, OUTPUT);
  digitalWrite(POWER_LED, HIGH);
  Serial.begin(115200);
  delay(1000);

  // Initialize tentacle move sensors
  pinMode(TENTACLEMOVEA1, OUTPUT);
  pinMode(TENTACLEMOVEA2, OUTPUT);
  pinMode(TENTACLEMOVEB1, OUTPUT);
  pinMode(TENTACLEMOVEB2, OUTPUT);
  digitalWrite(TENTACLEMOVEA1, LOW);
  digitalWrite(TENTACLEMOVEA2, LOW);
  digitalWrite(TENTACLEMOVEB1, LOW);
  digitalWrite(TENTACLEMOVEB2, LOW);

  // Initialize porthole sensors
  pinMode(PORTHOLEA1, INPUT_PULLUP);
  pinMode(PORTHOLEA2, INPUT_PULLUP);
  pinMode(PORTHOLEB1, INPUT_PULLUP);
  pinMode(PORTHOLEB2, INPUT_PULLUP);
  pinMode(PORTHOLEC1, INPUT_PULLUP);
  pinMode(PORTHOLEC2, INPUT_PULLUP);

  // Initialize riddle motor
  pinMode(RIDDLE_MOTOR, OUTPUT);
  digitalWrite(RIDDLE_MOTOR, LOW);

  // Initialize tentacle sensors
  pinMode(TENTACLEA1, INPUT_PULLUP);
  pinMode(TENTACLEA2, INPUT_PULLUP);
  pinMode(TENTACLEA3, INPUT_PULLUP);
  pinMode(TENTACLEA4, INPUT_PULLUP);
  pinMode(TENTACLEB1, INPUT_PULLUP);
  pinMode(TENTACLEB2, INPUT_PULLUP);
  pinMode(TENTACLEB3, INPUT_PULLUP);
  pinMode(TENTACLEB4, INPUT_PULLUP);
  pinMode(TENTACLEC1, INPUT_PULLUP);
  pinMode(TENTACLEC2, INPUT_PULLUP);
  pinMode(TENTACLEC3, INPUT_PULLUP);
  pinMode(TENTACLEC4, INPUT_PULLUP);
  pinMode(TENTACLED1, INPUT_PULLUP);
  pinMode(TENTACLED2, INPUT_PULLUP);
  pinMode(TENTACLED3, INPUT_PULLUP);
  pinMode(TENTACLED4, INPUT_PULLUP);

  // Initialize porthole control
  pinMode(PORTHOLEOPEN, OUTPUT);
  pinMode(PORTHOLECLOSE, OUTPUT);
  digitalWrite(PORTHOLEOPEN, LOW);
  digitalWrite(PORTHOLECLOSE, HIGH);

  networkSetup();
  mqttSetup();

  // Register action handlers
  registerAction("riddleMotor", riddleMotorHandler);
  registerAction("moveTentacles", moveTentaclesHandler);
  registerAction("movePortholes", movePortholesHandler);
}

void loop()
{
  // Handle riddle motor timing
  if (riddleMotorActive && (millis() - riddleMotorStartTime >= RIDDLE_MOTOR_DURATION))
  {
    digitalWrite(RIDDLE_MOTOR, LOW);
    riddleMotorActive = false;
    Serial.println("Riddle motor turned OFF after 5 minutes");
  }

  // Check porthole status - portholes are "open" when all sensors are HIGH
  bool allPortholesSensorsHigh = (digitalRead(PORTHOLEA1) == HIGH && digitalRead(PORTHOLEA2) == HIGH &&
                                  digitalRead(PORTHOLEB1) == HIGH && digitalRead(PORTHOLEB2) == HIGH &&
                                  digitalRead(PORTHOLEC1) == HIGH && digitalRead(PORTHOLEC2) == HIGH);
  bool portholesOpen = allPortholesSensorsHigh;

  // Check if porthole status changed from closed to open
  if (portholesOpen && !previousPortholeStatus)
  {
    // Portholes just opened - send immediate MQTT message (server will route to Kraken)
    Serial.println("DEBUG: Portholes opened - sending MQTT message");
    sendImmediateMQTT("portHoles,opened");
  }

  // Update previous porthole status
  previousPortholeStatus = portholesOpen;

  // Check tentacle status - tentacles are "fully up" when all tentacle sensors are HIGH
  bool allTentaclesSensorsHigh = (digitalRead(TENTACLEA1) == HIGH && digitalRead(TENTACLEA2) == HIGH &&
                                  digitalRead(TENTACLEA3) == HIGH && digitalRead(TENTACLEA4) == HIGH &&
                                  digitalRead(TENTACLEB1) == HIGH && digitalRead(TENTACLEB2) == HIGH &&
                                  digitalRead(TENTACLEB3) == HIGH && digitalRead(TENTACLEB4) == HIGH &&
                                  digitalRead(TENTACLEC1) == HIGH && digitalRead(TENTACLEC2) == HIGH &&
                                  digitalRead(TENTACLEC3) == HIGH && digitalRead(TENTACLEC4) == HIGH &&
                                  digitalRead(TENTACLED1) == HIGH && digitalRead(TENTACLED2) == HIGH &&
                                  digitalRead(TENTACLED3) == HIGH && digitalRead(TENTACLED4) == HIGH);
  bool tentaclesFullyUp = allTentaclesSensorsHigh;

  // Check if tentacle status changed from not fully up to fully up
  if (tentaclesFullyUp && !previousTentaclesFullyUpStatus)
  {
    // Tentacles just reached fully up position - send immediate MQTT message
    Serial.println("DEBUG: Tentacles fully up - sending MQTT message");
    sendImmediateMQTT("tentacles,fullyUp");
  }

  // Update previous tentacle status
  previousTentaclesFullyUpStatus = tentaclesFullyUp;

  // Debug: Print porthole and tentacle status periodically
  static unsigned long lastDebugPrint = 0;
  if (millis() - lastDebugPrint >= 5000) // Every 5 seconds
  {
    Serial.printf("DEBUG: Porthole sensors - A1:%d A2:%d B1:%d B2:%d C1:%d C2:%d | Open:%s\n",
                  digitalRead(PORTHOLEA1), digitalRead(PORTHOLEA2),
                  digitalRead(PORTHOLEB1), digitalRead(PORTHOLEB2),
                  digitalRead(PORTHOLEC1), digitalRead(PORTHOLEC2),
                  portholesOpen ? "YES" : "NO");
    Serial.printf("DEBUG: Tentacle sensors - A:%d,%d,%d,%d B:%d,%d,%d,%d C:%d,%d,%d,%d D:%d,%d,%d,%d | FullyUp:%s\n",
                  digitalRead(TENTACLEA1), digitalRead(TENTACLEA2), digitalRead(TENTACLEA3), digitalRead(TENTACLEA4),
                  digitalRead(TENTACLEB1), digitalRead(TENTACLEB2), digitalRead(TENTACLEB3), digitalRead(TENTACLEB4),
                  digitalRead(TENTACLEC1), digitalRead(TENTACLEC2), digitalRead(TENTACLEC3), digitalRead(TENTACLEC4),
                  digitalRead(TENTACLED1), digitalRead(TENTACLED2), digitalRead(TENTACLED3), digitalRead(TENTACLED4),
                  tentaclesFullyUp ? "YES" : "NO");
    lastDebugPrint = millis();
  }

  // Read all sensors and publish data
  sprintf(publishDetail, "TentacleMove:%d,%d,%d,%d Porthole:%d,%d,%d,%d,%d,%d Tentacle:%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d",
          digitalRead(TENTACLEMOVEA1), digitalRead(TENTACLEMOVEA2), digitalRead(TENTACLEMOVEB1), digitalRead(TENTACLEMOVEB2),
          digitalRead(PORTHOLEA1), digitalRead(PORTHOLEA2), digitalRead(PORTHOLEB1), digitalRead(PORTHOLEB2), digitalRead(PORTHOLEC1), digitalRead(PORTHOLEC2),
          digitalRead(TENTACLEA1), digitalRead(TENTACLEA2), digitalRead(TENTACLEA3), digitalRead(TENTACLEA4),
          digitalRead(TENTACLEB1), digitalRead(TENTACLEB2), digitalRead(TENTACLEB3), digitalRead(TENTACLEB4),
          digitalRead(TENTACLEC1), digitalRead(TENTACLEC2), digitalRead(TENTACLEC3), digitalRead(TENTACLEC4),
          digitalRead(TENTACLED1), digitalRead(TENTACLED2), digitalRead(TENTACLED3), digitalRead(TENTACLED4));

  sendDataMQTT();
}

// ═══════════════════════════════════════════════════════════════
//                      ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

// Action handler for riddle motor control
void riddleMotorHandler(const char *value)
{
  if (riddleMotorActive)
  {
    Serial.println("RiddleMotor command received - resetting 5 minute timer");
  }
  else
  {
    Serial.println("RiddleMotor command received - turning ON for 5 minutes");
    digitalWrite(RIDDLE_MOTOR, HIGH);
  }

  riddleMotorStartTime = millis(); // Reset/start the timer
  riddleMotorActive = true;
}

// Action handler for tentacle movement control
// Expected format: "Down" or "Up"
// Examples: "Down" (move all tentacles down), "Up" (move all tentacles up)
void moveTentaclesHandler(const char *value)
{
  Serial.println("MoveTentacles command received: " + String(value));

  String command = String(value);
  command.toLowerCase(); // Convert to lowercase for case-insensitive comparison

  // Validate command
  if (!command.equals("down") && !command.equals("up"))
  {
    Serial.println("Error: Invalid command. Use 'Down' or 'Up'");
    return;
  }

  // Check if all porthole sensors are HIGH before allowing tentacle movement
  // All porthole sensors must read HIGH (state 1) to allow tentacle movement
  bool allPortholesSensorsHigh = (digitalRead(PORTHOLEA1) == HIGH && digitalRead(PORTHOLEA2) == HIGH &&
                                  digitalRead(PORTHOLEB1) == HIGH && digitalRead(PORTHOLEB2) == HIGH &&
                                  digitalRead(PORTHOLEC1) == HIGH && digitalRead(PORTHOLEC2) == HIGH);

  if (!allPortholesSensorsHigh)
  {
    Serial.println("Error: All porthole sensors must be HIGH (1) before tentacle movement");
    Serial.println("Porthole sensor readings - A1: " + String(digitalRead(PORTHOLEA1)) +
                   ", A2: " + String(digitalRead(PORTHOLEA2)) +
                   ", B1: " + String(digitalRead(PORTHOLEB1)) +
                   ", B2: " + String(digitalRead(PORTHOLEB2)) +
                   ", C1: " + String(digitalRead(PORTHOLEC1)) +
                   ", C2: " + String(digitalRead(PORTHOLEC2)));
    return;
  }
  if (command.equals("down"))
  {
    // Activate pins 0 & 2 (TENTACLEMOVEA1 & TENTACLEMOVEB1) for 500ms
    digitalWrite(TENTACLEMOVEA1, HIGH);
    digitalWrite(TENTACLEMOVEB1, HIGH);
    Serial.println("All tentacles moving DOWN - activating pins 0 & 2 for 500ms");
    delay(500);
    digitalWrite(TENTACLEMOVEA1, LOW);
    digitalWrite(TENTACLEMOVEB1, LOW);
    Serial.println("Tentacle DOWN movement complete - pins 0 & 2 turned OFF");
  }
  else if (command.equals("up"))
  {
    // Activate pins 1 & 3 (TENTACLEMOVEA2 & TENTACLEMOVEB2) for 500ms
    digitalWrite(TENTACLEMOVEA2, HIGH);
    digitalWrite(TENTACLEMOVEB2, HIGH);
    Serial.println("All tentacles moving UP - activating pins 1 & 3 for 500ms");
    delay(500);
    digitalWrite(TENTACLEMOVEA2, LOW);
    digitalWrite(TENTACLEMOVEB2, LOW);
    Serial.println("Tentacle UP movement complete - pins 1 & 3 turned OFF");
  }
}

// Action handler for porthole movement control
// Expected format: "Open" or "Close"
// Examples: "Open" (open portholes), "Close" (close portholes)
void movePortholesHandler(const char *value)
{
  Serial.println("MovePortholes command received: " + String(value));

  String command = String(value);
  command.toLowerCase(); // Convert to lowercase for case-insensitive comparison

  // Validate command
  if (!command.equals("open") && !command.equals("close"))
  {
    Serial.println("Error: Invalid command. Use 'Open' or 'Close'");
    return;
  }

  if (command.equals("open"))
  {
    // Open portholes: Set PORTHOLECLOSE HIGH, PORTHOLEOPEN LOW, turn on riddle motor
    digitalWrite(PORTHOLEOPEN, LOW);
    digitalWrite(PORTHOLECLOSE, HIGH);
    digitalWrite(RIDDLE_MOTOR, HIGH);
    Serial.println("Opening portholes - pin 33 LOW, pin 34 HIGH, pin 12 (riddle motor) ON");
  }
  else if (command.equals("close"))
  {
    // Close portholes: Set PORTHOLEOPEN HIGH, PORTHOLECLOSE LOW, turn on riddle motor
    digitalWrite(PORTHOLECLOSE, LOW);
    digitalWrite(PORTHOLEOPEN, HIGH);
    digitalWrite(RIDDLE_MOTOR, HIGH);
    Serial.println("Closing portholes - pin 33 HIGH, pin 34 LOW, pin 12 (riddle motor) ON");
  }
}

