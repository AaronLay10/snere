#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
#include <ParagonMQTT.h>
#include <TeensyDMX.h>

// Device Configuration
const char *deviceID = "StudyD";
const char *roomID = "Clockwork";

// TeensyDMX Configuration
namespace teensydmx = ::qindesign::teensydmx;
teensydmx::Sender dmxTx{Serial7};   // Use Serial7 for DMX output
#define DMX_RX_PIN 28               // DMX receive data pin (Serial7 RX)
#define DMX_TX_PIN 29               // DMX transmit data pin (Serial7 TX)
#define DMX_TX_ENABLE_PIN 30        // DMX transmitter enable pin (separate from TX)
#define FOG_DMX_CHANNEL_VOLUME 1    // DMX channel 1: Fog volume/intensity (0-255)
#define FOG_DMX_CHANNEL_TIMER 2     // DMX channel 2: Timer duration (0-255)
#define FOG_DMX_CHANNEL_FAN_SPEED 3 // DMX channel 3: Fan speed (0-255) - if supported

// Pin Definitions
#define POWER_LED 13

// Stepper Motor 1 - Pins 15-18 (DM542/DMX542 Differential Signaling)
#define MOTORLEFT_STEP_POS 15 // STEP+ for Motor 1
#define MOTORLEFT_STEP_NEG 16 // STEP- for Motor 1
#define MOTORLEFT_DIR_POS 17  // DIR+ for Motor 1
#define MOTORLEFT_DIR_NEG 18  // DIR- for Motor 1

// Stepper Motor 2 - Pins 20-23 (DM542/DMX542 Differential Signaling)
#define MOTORRIGHT_STEP_POS 20 // STEP+ for Motor 2
#define MOTORRIGHT_STEP_NEG 21 // STEP- for Motor 2
#define MOTORRIGHT_DIR_POS 22  // DIR+ for Motor 2
#define MOTORRIGHT_DIR_NEG 23  // DIR- for Motor 2

// Motor Power Control
#define MOTORS_POWER 1   // Power control for both stepper drivers
#define MOTORS_ENABLE 14 // Enable pin for stepper drivers (LOW = enabled)

// Proximity Sensors - Correlated to Left/Right Motors
// Left Motor Sensors (Motor on pins 15-18)
#define PROX_LEFT_TOP_1 39    // TopLeft sensor 6 -> pin 39
#define PROX_LEFT_TOP_2 40    // TopLeft sensor 7 -> pin 40
#define PROX_LEFT_BOTTOM_1 38 // BottomLeft sensor 5 -> pin 38
#define PROX_LEFT_BOTTOM_2 41 // BottomLeft sensor 8 -> pin 41

// Right Motor Sensors (Motor on pins 20-23)
#define PROX_RIGHT_TOP_1 35    // TopRight sensor 2 -> pin 35
#define PROX_RIGHT_TOP_2 36    // TopRight sensor 3 -> pin 36
#define PROX_RIGHT_BOTTOM_1 34 // BottomRight sensor 1 -> pin 34
#define PROX_RIGHT_BOTTOM_2 37 // BottomRight sensor 4 -> pin 37

// Note: DMX pins 28 & 29 are configured above in TeensyDMX section

// Stepper Control Variables
unsigned long lastStepTime = 0;

// Motor Speed Settings (step intervals in microseconds)
unsigned long stepInterval = 250; // 0.25ms = 4000 steps/sec

// Global Variables
bool systemActive = false;
bool motorsRunning = false;
bool leftMotorRunning = false;  // Individual motor control
bool rightMotorRunning = false; // Individual motor control
bool motorDirection = true;     // true = up, false = down

// Sensor state tracking - organized by motor correlation
bool leftTopSensors[2] = {false, false};     // TopLeft sensors 6 & 7
bool leftBottomSensors[2] = {false, false};  // BottomLeft sensors 5 & 8
bool rightTopSensors[2] = {false, false};    // TopRight sensors 2 & 3
bool rightBottomSensors[2] = {false, false}; // BottomRight sensors 1 & 4

// DMX Fog Machine Variables
bool dmxEnabled = false;       // DMX output enable flag
bool dmxInitEnabled = true;    // Set to false to disable DMX initialization for testing
uint8_t fogVolume = 0;         // Current fog volume (0-255)
uint8_t fogTimer = 0;          // Current fog timer (0-255)
uint8_t fogFanSpeed = 0;       // Current fan speed (0-255)
uint8_t lastFogVolume = 255;   // Initialize to different value to force first update
uint8_t lastFogTimer = 255;    // Initialize to different value to force first update
uint8_t lastFogFanSpeed = 255; // Initialize to different value to force first update

// ═══════════════════════════════════════════════════════════════
//                          SETUP & LOOP
// ═══════════════════════════════════════════════════════════════

#line 85 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setup();
#line 166 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void loop();
#line 202 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void stepBothMotors(bool direction);
#line 246 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void runBothMotors();
#line 266 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
bool checkProximitySensors();
#line 339 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void activateHandler(const char *value);
#line 412 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void moveUpHandler(const char *value);
#line 427 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void moveDownHandler(const char *value);
#line 442 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void stopMotorsHandler(const char *value);
#line 450 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void resetHandler(const char *value);
#line 463 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void testRightHandler(const char *value);
#line 511 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void testLeftHandler(const char *value);
#line 537 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void testPinsHandler(const char *value);
#line 562 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void initializeDMX();
#line 599 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setFogVolume(uint8_t volume);
#line 609 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setFogTimer(uint8_t timer);
#line 619 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setFogFanSpeed(uint8_t fanSpeed);
#line 629 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setFogMachine(uint8_t volume, uint8_t timer, uint8_t fanSpeed);
#line 657 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setFogMachine(uint8_t volume, uint8_t timer);
#line 666 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void fogIntensityHandler(const char *data);
#line 706 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void fogTriggerHandler(const char *data);
#line 718 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void fogMachineHandler(const char *data);
#line 772 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void dmxTestHandler(const char *data);
#line 85 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyD/StudyD.ino"
void setup()
{
    Serial.begin(115200);
    Serial.println("StudyD System Starting...");

    // Pin Setup
    pinMode(POWER_LED, OUTPUT);
    digitalWrite(POWER_LED, HIGH);

    // Stepper Motor Pin Setup (DM542/DMX542 differential signaling)
    pinMode(MOTORLEFT_STEP_POS, OUTPUT);
    pinMode(MOTORLEFT_STEP_NEG, OUTPUT);
    pinMode(MOTORLEFT_DIR_POS, OUTPUT);
    pinMode(MOTORLEFT_DIR_NEG, OUTPUT);
    pinMode(MOTORRIGHT_STEP_POS, OUTPUT);
    pinMode(MOTORRIGHT_STEP_NEG, OUTPUT);
    pinMode(MOTORRIGHT_DIR_POS, OUTPUT);
    pinMode(MOTORRIGHT_DIR_NEG, OUTPUT);
    pinMode(MOTORS_POWER, OUTPUT);
    pinMode(MOTORS_ENABLE, OUTPUT);

    // Proximity Sensor Pin Setup - organized by motor correlation
    pinMode(PROX_LEFT_TOP_1, INPUT_PULLUP);     // TopLeft sensor 6
    pinMode(PROX_LEFT_TOP_2, INPUT_PULLUP);     // TopLeft sensor 7
    pinMode(PROX_LEFT_BOTTOM_1, INPUT_PULLUP);  // BottomLeft sensor 5
    pinMode(PROX_LEFT_BOTTOM_2, INPUT_PULLUP);  // BottomLeft sensor 8
    pinMode(PROX_RIGHT_TOP_1, INPUT_PULLUP);    // TopRight sensor 2
    pinMode(PROX_RIGHT_TOP_2, INPUT_PULLUP);    // TopRight sensor 3
    pinMode(PROX_RIGHT_BOTTOM_1, INPUT_PULLUP); // BottomRight sensor 1
    pinMode(PROX_RIGHT_BOTTOM_2, INPUT_PULLUP); // BottomRight sensor 4

    // Initialize stepper pins to idle state (like Clock.ino)
    digitalWrite(MOTORLEFT_STEP_POS, LOW);
    digitalWrite(MOTORLEFT_STEP_NEG, LOW);
    digitalWrite(MOTORLEFT_DIR_POS, LOW);
    digitalWrite(MOTORLEFT_DIR_NEG, HIGH);
    digitalWrite(MOTORRIGHT_STEP_POS, LOW);
    digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
    digitalWrite(MOTORRIGHT_DIR_POS, LOW);
    digitalWrite(MOTORRIGHT_DIR_NEG, HIGH);
    digitalWrite(MOTORS_POWER, LOW);   // Start with motors powered off
    digitalWrite(MOTORS_ENABLE, HIGH); // Start with motors disabled (HIGH = disabled)

    // Initialize custom stepper control variables
    lastStepTime = micros();

    // Initialize DMX (can be disabled for testing)
    if (dmxInitEnabled)
    {
        initializeDMX();
    }
    else
    {
        Serial.println("DMX initialization DISABLED for testing");
    }

    // Network and MQTT Setup
    networkSetup();
    mqttSetup();

    // Register Action Handlers
    registerAction("activate", activateHandler);
    registerAction("moveUp", moveUpHandler);
    registerAction("moveDown", moveDownHandler);
    registerAction("stopMotors", stopMotorsHandler);
    registerAction("reset", resetHandler);
    registerAction("testRight", testRightHandler);
    registerAction("testLeft", testLeftHandler);
    registerAction("testPins", testPinsHandler);

    // Register DMX fog machine controls
    registerAction("fogIntensity", fogIntensityHandler);
    registerAction("fogTrigger", fogTriggerHandler);
    registerAction("fogMachine", fogMachineHandler);
    registerAction("dmxTest", dmxTestHandler);

    Serial.println("StudyD System Ready - Custom Stepper Control + DMX Initialized");
    Serial.println("Motors: LEFT(pins 15-18) RIGHT(pins 20-23), Power(pin 1), Enable(pin 14)");
    Serial.println("Sensors: LEFT(T:6,7 B:5,8) RIGHT(T:2,3 B:1,4)");
}

void loop()
{
    // Run synchronized stepper motor control
    runBothMotors();

    // Check proximity sensors and stop motors if triggered
    checkProximitySensors();

    // Prepare status data for MQTT publishing (organized by motor correlation)
    sprintf(publishDetail, "act:%d,run:%d,L:%d,R:%d,dir:%s,LS:%d%d%d%d,RS:%d%d%d%d",
            systemActive ? 1 : 0,
            motorsRunning ? 1 : 0,
            leftMotorRunning ? 1 : 0,  // Individual left motor state
            rightMotorRunning ? 1 : 0, // Individual right motor state
            motorDirection ? "UP" : "DOWN",
            leftTopSensors[0] ? 1 : 0,      // TopLeft sensor 6
            leftTopSensors[1] ? 1 : 0,      // TopLeft sensor 7
            leftBottomSensors[0] ? 1 : 0,   // BottomLeft sensor 5
            leftBottomSensors[1] ? 1 : 0,   // BottomLeft sensor 8
            rightTopSensors[0] ? 1 : 0,     // TopRight sensor 2
            rightTopSensors[1] ? 1 : 0,     // TopRight sensor 3
            rightBottomSensors[0] ? 1 : 0,  // BottomRight sensor 1
            rightBottomSensors[1] ? 1 : 0); // BottomRight sensor 4

    // Send data and maintain MQTT connection
    sendDataMQTT();

    // Small delay for system stability
    delay(1); // 1ms delay for stable operation
}

// ═══════════════════════════════════════════════════════════════
//                    CUSTOM STEPPER CONTROL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Step motors independently based on their running state
void stepBothMotors(bool direction)
{
    // Set direction for motors that are still running
    if (leftMotorRunning)
    {
        digitalWrite(MOTORLEFT_DIR_POS, direction ? HIGH : LOW);
        digitalWrite(MOTORLEFT_DIR_NEG, direction ? LOW : HIGH);
    }
    if (rightMotorRunning)
    {
        digitalWrite(MOTORRIGHT_DIR_POS, direction ? HIGH : LOW);
        digitalWrite(MOTORRIGHT_DIR_NEG, direction ? LOW : HIGH);
    }

    // Generate step pulse for motors that are still running
    if (leftMotorRunning)
    {
        digitalWrite(MOTORLEFT_STEP_POS, HIGH);
        digitalWrite(MOTORLEFT_STEP_NEG, LOW);
    }
    if (rightMotorRunning)
    {
        digitalWrite(MOTORRIGHT_STEP_POS, HIGH);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
    }

    delayMicroseconds(5); // Reliable pulse width for DM542

    // Turn off step pulses for motors that stepped
    if (leftMotorRunning)
    {
        digitalWrite(MOTORLEFT_STEP_POS, LOW);
        digitalWrite(MOTORLEFT_STEP_NEG, LOW);
    }
    if (rightMotorRunning)
    {
        digitalWrite(MOTORRIGHT_STEP_POS, LOW);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
    }

    delayMicroseconds(3); // Settling time
}

// Run both motors at current direction and speed
void runBothMotors()
{
    if (!motorsRunning || !systemActive)
    {
        return;
    }

    unsigned long currentTime = micros();

    // Check if it's time for the next step
    if (currentTime - lastStepTime >= stepInterval)
    {
        lastStepTime = currentTime;

        // Step both motors in current direction
        stepBothMotors(motorDirection);
    }
}

// Check proximity sensors and stop motors if triggered (directional logic)
bool checkProximitySensors()
{
    bool sensorTriggered = false;

    // Read Left Motor sensors
    leftTopSensors[0] = digitalRead(PROX_LEFT_TOP_1);       // TopLeft sensor 6
    leftTopSensors[1] = digitalRead(PROX_LEFT_TOP_2);       // TopLeft sensor 7
    leftBottomSensors[0] = digitalRead(PROX_LEFT_BOTTOM_1); // BottomLeft sensor 5
    leftBottomSensors[1] = digitalRead(PROX_LEFT_BOTTOM_2); // BottomLeft sensor 8

    // Read Right Motor sensors
    rightTopSensors[0] = digitalRead(PROX_RIGHT_TOP_1);       // TopRight sensor 2
    rightTopSensors[1] = digitalRead(PROX_RIGHT_TOP_2);       // TopRight sensor 3
    rightBottomSensors[0] = digitalRead(PROX_RIGHT_BOTTOM_1); // BottomRight sensor 1
    rightBottomSensors[1] = digitalRead(PROX_RIGHT_BOTTOM_2); // BottomRight sensor 4

    // Independent motor sensor logic - each motor stops only when its own sensors are triggered
    // Note: Proximity sensors are active HIGH (output HIGH when triggered)
    if (motorsRunning)
    {
        if (motorDirection) // Moving UP - check TOP sensors
        {
            // Check left motor sensors
            if (leftTopSensors[0] || leftTopSensors[1])
            {
                leftMotorRunning = false;
                Serial.println("LEFT TOP sensor triggered - stopping left motor");
            }
            // Check right motor sensors
            if (rightTopSensors[0] || rightTopSensors[1])
            {
                rightMotorRunning = false;
                Serial.println("RIGHT TOP sensor triggered - stopping right motor");
            }
        }
        else // Moving DOWN - check BOTTOM sensors
        {
            // Check left motor sensors
            if (leftBottomSensors[0] || leftBottomSensors[1])
            {
                leftMotorRunning = false;
                Serial.println("LEFT BOTTOM sensor triggered - stopping left motor");
            }
            // Check right motor sensors
            if (rightBottomSensors[0] || rightBottomSensors[1])
            {
                rightMotorRunning = false;
                Serial.println("RIGHT BOTTOM sensor triggered - stopping right motor");
            }
        }

        // Stop overall system only when both motors have stopped
        if (!leftMotorRunning && !rightMotorRunning)
        {
            motorsRunning = false;
            sensorTriggered = true;
            Serial.println("Both motors stopped - system stopped");
        }
    }

    // Stop motors if relevant sensors are triggered
    if (sensorTriggered)
    {
        motorsRunning = false;
    }

    return sensorTriggered;
}

// ═══════════════════════════════════════════════════════════════
//                          ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

void activateHandler(const char *value)
{
    Serial.println("Activate command received: '" + String(value) + "'");

    // Handle empty or null values - toggle system or default to activate
    String command = String(value);
    command.trim(); // Remove any whitespace
    command.toLowerCase();

    bool shouldActivate;

    // If empty string or null, toggle the current state (or default to activate)
    if (command.length() == 0 || command == "null")
    {
        shouldActivate = !systemActive; // Toggle current state
        Serial.println("Empty command - toggling system state");
    }
    else
    {
        // Explicit activation commands
        bool isActivateCommand = (command == "1" || command == "true" || command == "on" ||
                                  command == "activate" || command == "start" || command == "enable");

        // Explicit deactivation commands
        bool isDeactivateCommand = (command == "0" || command == "false" || command == "off" ||
                                    command == "deactivate" || command == "stop" || command == "disable");

        if (isActivateCommand)
        {
            shouldActivate = true;
        }
        else if (isDeactivateCommand)
        {
            shouldActivate = false;
        }
        else
        {
            // Unknown command - default to activate for safety
            shouldActivate = true;
            Serial.println("Unknown command '" + command + "' - defaulting to ACTIVATE");
        }
    }

    Serial.println("Action: " + String(shouldActivate ? "ACTIVATE" : "DEACTIVATE"));

    if (shouldActivate && !systemActive)
    {
        systemActive = true;
        digitalWrite(MOTORS_POWER, HIGH); // Power on stepper drivers
        digitalWrite(MOTORS_ENABLE, LOW); // Enable stepper drivers (LOW = enabled)
        Serial.println("StudyD system ACTIVATED - motors powered and enabled");
    }
    else if (!shouldActivate && systemActive)
    {
        systemActive = false;
        // Stop all motors when system deactivated
        motorsRunning = false;
        leftMotorRunning = false;
        rightMotorRunning = false;
        digitalWrite(MOTORS_ENABLE, HIGH); // Disable stepper drivers
        digitalWrite(MOTORS_POWER, LOW);   // Power off stepper drivers
        Serial.println("StudyD system DEACTIVATED - motors stopped, disabled, and powered off");
    }
    else if (shouldActivate && systemActive)
    {
        Serial.println("StudyD system already ACTIVE - no change needed");
    }
    else
    {
        Serial.println("StudyD system already INACTIVE - no change needed");
    }
}

void moveUpHandler(const char *value)
{
    if (!systemActive)
    {
        Serial.println("System not active - move up ignored");
        return;
    }

    motorsRunning = true;
    leftMotorRunning = true; // Start both motors
    rightMotorRunning = true;
    motorDirection = true; // true = up direction
    Serial.println("Motors moving UP - both motors started");
}

void moveDownHandler(const char *value)
{
    if (!systemActive)
    {
        Serial.println("System not active - move down ignored");
        return;
    }

    motorsRunning = true;
    leftMotorRunning = true; // Start both motors
    rightMotorRunning = true;
    motorDirection = false; // false = down direction
    Serial.println("Motors moving DOWN - both motors started");
}

void stopMotorsHandler(const char *value)
{
    motorsRunning = false;
    leftMotorRunning = false;
    rightMotorRunning = false;
    Serial.println("Motors STOPPED - both motors stopped");
}

void resetHandler(const char *value)
{
    Serial.println("Reset command received");
    systemActive = false;
    motorsRunning = false;

    // Power off and reset stepper drivers
    digitalWrite(MOTORS_ENABLE, HIGH); // Disable stepper drivers
    digitalWrite(MOTORS_POWER, LOW);   // Power off stepper drivers

    Serial.println("StudyD system reset - all motors stopped, disabled, and powered off");
}

void testRightHandler(const char *value)
{
    if (!systemActive)
    {
        Serial.println("System not active - right motor test ignored");
        return;
    }

    Serial.println("Testing RIGHT motor - Direction 1...");
    Serial.println("Power: " + String(digitalRead(MOTORS_POWER)) + ", Enable: " + String(digitalRead(MOTORS_ENABLE)));

    // Test Direction 1
    digitalWrite(MOTORRIGHT_DIR_POS, HIGH);
    digitalWrite(MOTORRIGHT_DIR_NEG, LOW);
    Serial.println("DIR_POS=HIGH, DIR_NEG=LOW");

    for (int i = 0; i < 50; i++)
    {
        digitalWrite(MOTORRIGHT_STEP_POS, HIGH);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
        delay(5);
        digitalWrite(MOTORRIGHT_STEP_POS, LOW);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
        delay(15);
    }

    delay(1000); // Pause between tests

    Serial.println("Testing RIGHT motor - Direction 2...");

    // Test Direction 2 (opposite)
    digitalWrite(MOTORRIGHT_DIR_POS, LOW);
    digitalWrite(MOTORRIGHT_DIR_NEG, HIGH);
    Serial.println("DIR_POS=LOW, DIR_NEG=HIGH");

    for (int i = 0; i < 50; i++)
    {
        digitalWrite(MOTORRIGHT_STEP_POS, HIGH);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
        delay(5);
        digitalWrite(MOTORRIGHT_STEP_POS, LOW);
        digitalWrite(MOTORRIGHT_STEP_NEG, LOW);
        delay(15);
    }

    Serial.println("RIGHT motor test complete - check if either direction worked");
}

void testLeftHandler(const char *value)
{
    if (!systemActive)
    {
        Serial.println("System not active - left motor test ignored");
        return;
    }

    Serial.println("Testing LEFT motor for comparison...");

    // Set direction for left motor
    digitalWrite(MOTORLEFT_DIR_POS, HIGH);
    digitalWrite(MOTORLEFT_DIR_NEG, LOW);

    for (int i = 0; i < 50; i++)
    {
        digitalWrite(MOTORLEFT_STEP_POS, HIGH);
        digitalWrite(MOTORLEFT_STEP_NEG, LOW);
        delay(5);
        digitalWrite(MOTORLEFT_STEP_POS, LOW);
        digitalWrite(MOTORLEFT_STEP_NEG, LOW);
        delay(15);
    }
    Serial.println("LEFT motor test complete");
}

void testPinsHandler(const char *value)
{
    Serial.println("=== PIN ASSIGNMENT TEST ===");
    Serial.println("LEFT Motor Pins:");
    Serial.println("STEP_POS: " + String(MOTORLEFT_STEP_POS) + " (should be 15)");
    Serial.println("STEP_NEG: " + String(MOTORLEFT_STEP_NEG) + " (should be 16)");
    Serial.println("DIR_POS: " + String(MOTORLEFT_DIR_POS) + " (should be 17)");
    Serial.println("DIR_NEG: " + String(MOTORLEFT_DIR_NEG) + " (should be 18)");

    Serial.println("RIGHT Motor Pins:");
    Serial.println("STEP_POS: " + String(MOTORRIGHT_STEP_POS) + " (should be 20)");
    Serial.println("STEP_NEG: " + String(MOTORRIGHT_STEP_NEG) + " (should be 21)");
    Serial.println("DIR_POS: " + String(MOTORRIGHT_DIR_POS) + " (should be 22)");
    Serial.println("DIR_NEG: " + String(MOTORRIGHT_DIR_NEG) + " (should be 23)");

    Serial.println("Control Pins:");
    Serial.println("POWER: " + String(MOTORS_POWER) + " (should be 1)");
    Serial.println("ENABLE: " + String(MOTORS_ENABLE) + " (should be 14)");
    Serial.println("=== END PIN TEST ===");
}

// ═══════════════════════════════════════════════════════════════
//                    DMX FOG MACHINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

void initializeDMX()
{
    Serial.println("Initializing DMX system...");

    // Configure DMX enable pin (separate from TX pin to avoid conflicts)
    pinMode(DMX_TX_ENABLE_PIN, OUTPUT);
    digitalWrite(DMX_TX_ENABLE_PIN, LOW); // Start with DMX transmitter disabled

    delay(100); // Small delay for pin stabilization

    // Initialize fog machine DMX channels to 0 before starting transmission
    dmxTx.set(FOG_DMX_CHANNEL_VOLUME, 0);
    dmxTx.set(FOG_DMX_CHANNEL_TIMER, 0);
    dmxTx.set(FOG_DMX_CHANNEL_FAN_SPEED, 0);

    // Start DMX transmission
    Serial.println("Starting TeensyDMX transmission...");
    dmxTx.begin();

    delay(100); // Allow DMX to initialize

    // Now enable DMX transmitter
    digitalWrite(DMX_TX_ENABLE_PIN, HIGH);

    fogVolume = 0;
    fogTimer = 0;
    fogFanSpeed = 0;
    dmxEnabled = true;

    Serial.println("TeensyDMX initialized for Antari Z-350:");
    Serial.println("  DMX TX Pin: " + String(DMX_TX_PIN) + " (Serial7)");
    Serial.println("  DMX TX Enable Pin: " + String(DMX_TX_ENABLE_PIN));
    Serial.println("  Fog Volume Channel: " + String(FOG_DMX_CHANNEL_VOLUME));
    Serial.println("  Fog Timer Channel: " + String(FOG_DMX_CHANNEL_TIMER));
    Serial.println("  Fan Speed Channel: " + String(FOG_DMX_CHANNEL_FAN_SPEED));
}

void setFogVolume(uint8_t volume)
{
    fogVolume = volume;
    if (dmxEnabled)
    {
        dmxTx.set(FOG_DMX_CHANNEL_VOLUME, volume);
    }
    Serial.println("DMX Fog Volume set to: " + String(volume));
}

void setFogTimer(uint8_t timer)
{
    fogTimer = timer;
    if (dmxEnabled)
    {
        dmxTx.set(FOG_DMX_CHANNEL_TIMER, timer);
    }
    Serial.println("DMX Fog Timer set to: " + String(timer));
}

void setFogFanSpeed(uint8_t fanSpeed)
{
    fogFanSpeed = fanSpeed;
    if (dmxEnabled)
    {
        dmxTx.set(FOG_DMX_CHANNEL_FAN_SPEED, fanSpeed);
    }
    Serial.println("DMX Fan Speed set to: " + String(fanSpeed));
}

void setFogMachine(uint8_t volume, uint8_t timer, uint8_t fanSpeed)
{
    // Only update if values have changed to prevent spam
    if (volume != lastFogVolume || timer != lastFogTimer || fanSpeed != lastFogFanSpeed)
    {
        Serial.println("🌫️ ANTARI Z-350 DMX UPDATE:");
        Serial.println("   Channel " + String(FOG_DMX_CHANNEL_VOLUME) + " (Volume): " + String(lastFogVolume) + " → " + String(volume));
        Serial.println("   Channel " + String(FOG_DMX_CHANNEL_TIMER) + " (Timer): " + String(lastFogTimer) + " → " + String(timer));
        Serial.println("   Channel " + String(FOG_DMX_CHANNEL_FAN_SPEED) + " (Fan): " + String(lastFogFanSpeed) + " → " + String(fanSpeed));

        setFogVolume(volume);
        setFogTimer(timer);
        setFogFanSpeed(fanSpeed);
        // TeensyDMX automatically handles transmission

        lastFogVolume = volume;
        lastFogTimer = timer;
        lastFogFanSpeed = fanSpeed;

        Serial.println("   DMX transmission updated!");
    }
    else
    {
        Serial.println("🌫️ DMX values unchanged - no update needed");
    }
}

// Overloaded version for 2-parameter compatibility
void setFogMachine(uint8_t volume, uint8_t timer)
{
    setFogMachine(volume, timer, fogFanSpeed); // Keep current fan speed
}

// ═══════════════════════════════════════════════════════════════
//                    DMX FOG MACHINE MQTT HANDLERS
// ═══════════════════════════════════════════════════════════════

void fogIntensityHandler(const char *data)
{
    // Parse data format: "volume,timer" or just "volume"
    char dataCopy[50];
    strcpy(dataCopy, data);

    char *volumeStr = strtok(dataCopy, ",");
    char *timerStr = strtok(NULL, ",");

    int volume = 0;
    int timer = 0;

    if (volumeStr != NULL)
    {
        volume = atoi(volumeStr);
        if (volume < 0)
            volume = 0;
        if (volume > 255)
            volume = 255;
    }

    if (timerStr != NULL)
    {
        timer = atoi(timerStr);
        if (timer < 0)
            timer = 0;
        if (timer > 255)
            timer = 255;

        Serial.println("MQTT: Setting Z-350 via fogIntensity - Volume: " + String(volume) + ", Timer: " + String(timer));
        setFogMachine((uint8_t)volume, (uint8_t)timer);
    }
    else
    {
        // Single value - just set volume
        Serial.println("MQTT: Setting fog volume to " + String(volume));
        setFogVolume((uint8_t)volume);
    }
}

void fogTriggerHandler(const char *data)
{
    int timer = atoi(data);
    if (timer < 0)
        timer = 0;
    if (timer > 255)
        timer = 255;

    Serial.println("MQTT: Setting fog timer to " + String(timer));
    setFogTimer((uint8_t)timer);
}

void fogMachineHandler(const char *data)
{
    // Parse data format: "volume,timer,fan" or "volume,timer" or just "volume"
    char dataCopy[50];
    strcpy(dataCopy, data);

    char *volumeStr = strtok(dataCopy, ",");
    char *timerStr = strtok(NULL, ",");
    char *fanStr = strtok(NULL, ",");

    int volume = 0;
    int timer = 0;
    int fanSpeed = fogFanSpeed; // Default to current fan speed

    if (volumeStr != NULL)
    {
        volume = atoi(volumeStr);
        if (volume < 0)
            volume = 0;
        if (volume > 255)
            volume = 255;
    }

    if (timerStr != NULL)
    {
        timer = atoi(timerStr);
        if (timer < 0)
            timer = 0;
        if (timer > 255)
            timer = 255;
    }
    else
    {
        // If only volume provided, set timer to same value for continuous fog
        timer = volume;
    }

    if (fanStr != NULL)
    {
        fanSpeed = atoi(fanStr);
        if (fanSpeed < 0)
            fanSpeed = 0;
        if (fanSpeed > 255)
            fanSpeed = 255;
    }

    Serial.println("MQTT: Setting Z-350 - Volume: " + String(volume) + ", Timer: " + String(timer) + ", Fan: " + String(fanSpeed));
    setFogMachine((uint8_t)volume, (uint8_t)timer, (uint8_t)fanSpeed);
}

// ═══════════════════════════════════════════════════════════════
//                    DMX DEBUGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

void dmxTestHandler(const char *data)
{
    Serial.println("=== ANTARI Z-350 DMX DEBUG TEST ===");

    // Show current DMX status
    Serial.println("Current DMX Status:");
    Serial.println("  DMX Enabled: " + String(dmxEnabled ? "YES" : "NO"));
    Serial.println("  Current Volume: " + String(fogVolume));
    Serial.println("  Current Timer: " + String(fogTimer));
    Serial.println("  Current Fan Speed: " + String(fogFanSpeed));
    Serial.println("  DMX TX Enable Pin " + String(DMX_TX_ENABLE_PIN) + ": " + String(digitalRead(DMX_TX_ENABLE_PIN) ? "HIGH" : "LOW"));

    Serial.println("\nTesting Z-350 with different combinations:");

    // Test 1: Full volume, short timer, medium fan
    Serial.println("Test 1: Volume=255, Timer=64, Fan=128 (3 sec burst)");
    setFogMachine(255, 64, 128);
    delay(4000);

    // Test 2: Medium volume, medium timer, full fan
    Serial.println("Test 2: Volume=128, Timer=128, Fan=255 (5 sec medium)");
    setFogMachine(128, 128, 255);
    delay(6000);

    // Test 3: Full volume, long timer, full fan (maximum fog)
    Serial.println("Test 3: Volume=255, Timer=255, Fan=255 (continuous max)");
    setFogMachine(255, 255, 255);
    delay(8000);

    // Test 4: Low volume, short bursts
    Serial.println("Test 4: Volume=64, Timer=32, Fan=64 (light fog)");
    setFogMachine(64, 32, 64);
    delay(3000);

    // Test 5: Turn off
    Serial.println("Test 5: Volume=0, Timer=0, Fan=0 (OFF)");
    setFogMachine(0, 0, 0);

    Serial.println("=== Z-350 TEST COMPLETE ===");
    Serial.println("Antari Z-350 DMX Channels:");
    Serial.println("  Ch1: Volume (0-255) - Amount of fog produced");
    Serial.println("  Ch2: Timer (0-255) - Duration of fog output");
    Serial.println("  Ch3: Fan (0-255) - Fan speed for fog distribution");
    Serial.println("For continuous fog: Set Volume > 0 and Timer = 255");
}
