#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
#include <ParagonMQTT.h>

// Pin Definitions
#define POWER_LED 13

// Study Fan Motor - DMX542 Stepper Driver Pins
#define STUDYFAN_PUL_PLUS 0  // Pulse+ (Step)
#define STUDYFAN_PUL_MINUS 1 // Pulse- (Step complement)
#define STUDYFAN_DIR_PLUS 2  // Direction+
#define STUDYFAN_DIR_MINUS 3 // Direction- (complement)
#define STUDYFAN_ENABLE 7    // Enable pin (LOW = enabled)

// WallGears Motors - 3x DMX542 Stepper Drivers (identical operation)
// WallGear 1 - Pins 38-41
#define WALLGEAR1_PUL_PLUS 38  // Pulse+ (Step)
#define WALLGEAR1_PUL_MINUS 39 // Pulse- (Step complement)
#define WALLGEAR1_DIR_PLUS 40  // Direction+
#define WALLGEAR1_DIR_MINUS 41 // Direction- (complement)

// WallGear 2 - Pins 20-23
#define WALLGEAR2_PUL_PLUS 20  // Pulse+ (Step)
#define WALLGEAR2_PUL_MINUS 21 // Pulse- (Step complement)
#define WALLGEAR2_DIR_PLUS 22  // Direction+
#define WALLGEAR2_DIR_MINUS 23 // Direction- (complement)

// WallGear 3 - Pins 16-19
#define WALLGEAR3_PUL_PLUS 16  // Pulse+ (Step)
#define WALLGEAR3_PUL_MINUS 17 // Pulse- (Step complement)
#define WALLGEAR3_DIR_PLUS 18  // Direction+
#define WALLGEAR3_DIR_MINUS 19 // Direction- (complement)

// Shared enable pin for all WallGears motors
#define WALLGEARS_ENABLE 15 // Shared enable pin (LOW = enabled)
#define MOTORS_POWER 24     // Power supply control for both Fan and WallGears motors (HIGH = powered)

// TV Power Control Pins
#define TV_POWER_1 9  // TV 1 power control (HIGH = powered on)
#define TV_POWER_2 10 // TV 2 power control (HIGH = powered on)

// MAKSERVO Power Control Pin
#define MAKSERVO_POWER 8 // MAKSERVO power control (HIGH = powered on)

// Fog Machine Control Pins
#define FOG_POWER 4   // Fog machine power control (HIGH = powered on)
#define FOG_TRIGGER 5 // Fog machine trigger control (HIGH = fog on)

#define STUDYFANLIGHT 11
#define BLACKLIGHTS 36

// Device Configuration
const char *deviceID = "StudyB";
const char *roomID = "Clockwork";

// Global Variables
bool systemActive = false;
bool fanRunning = false;
int fanSpeed = 0; // 0=stopped, 1=slow, 2=fast
bool wallGearsRunning = false;
int wallGearsSpeed = 0; // 0=stopped, 1=slow, 2=fast
bool tv1Power = false;
bool tv2Power = false;
bool makservoPower = false;
bool fogPower = false;
bool fogTrigger = false;

// Custom Stepper Control Variables (like Clock.ino)
long studyFanPosition = 0;
long studyFanTarget = 0;
unsigned long lastStepTime = 0;

// WallGears Stepper Control Variables
long wallGearsPosition = 0;
long wallGearsTarget = 0;
unsigned long lastWallGearsStepTime = 0;

// Motor Speed Settings (step intervals in microseconds)
const unsigned long stepIntervalSlow = 2000; // 2ms = 500 steps/sec
const unsigned long stepIntervalFast = 667;  // 0.667ms = 1500 steps/sec
unsigned long currentStepInterval = stepIntervalSlow;
unsigned long currentWallGearsStepInterval = stepIntervalSlow;

// ═══════════════════════════════════════════════════════════════
//                          SETUP & LOOP
// ═══════════════════════════════════════════════════════════════

#line 86 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void setup();
#line 216 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void loop();
#line 246 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void activateHandler(const char *value);
#line 272 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void studyFanLightHandler(const char *value);
#line 279 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void blackLightsHandler(const char *value);
#line 307 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void fanControlHandler(const char *value);
#line 341 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void wallGearsControlHandler(const char *value);
#line 380 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void tvPowerHandler(const char *value);
#line 398 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void makservoPowerHandler(const char *value);
#line 406 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void fogPowerHandler(const char *value);
#line 422 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void fogTriggerHandler(const char *value);
#line 437 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void fogControlHandler(const char *value);
#line 478 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void resetHandler(const char *value);
#line 511 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void stepFanMotor(bool direction);
#line 530 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void runFanMotor();
#line 550 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void stepWallGearsMotors(bool direction);
#line 584 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void runWallGearsMotors();
#line 86 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/StudyB/StudyB.ino"
void setup()
{
    Serial.begin(115200);

    Serial.print("USB Serial Number: ");
    Serial.println(teensyUsbSN());

    Serial.print("Device ID: ");
    Serial.println(deviceID);

    Serial.print("MAC Address: ");
    Serial.println(teensyMAC());

    Serial.print("Board Model: ");
    Serial.println(teensyBoardVersion());

    // Pin Setup
    pinMode(POWER_LED, OUTPUT);

    // Stepper Motor Pin Setup (DMX542 differential signaling)
    pinMode(STUDYFAN_PUL_PLUS, OUTPUT);
    pinMode(STUDYFAN_PUL_MINUS, OUTPUT);
    pinMode(STUDYFAN_DIR_PLUS, OUTPUT);
    pinMode(STUDYFAN_DIR_MINUS, OUTPUT);
    pinMode(STUDYFAN_ENABLE, OUTPUT);

    // WallGears Motor Pin Setup (3x DMX542 drivers)
    pinMode(WALLGEAR1_PUL_PLUS, OUTPUT);
    pinMode(WALLGEAR1_PUL_MINUS, OUTPUT);
    pinMode(WALLGEAR1_DIR_PLUS, OUTPUT);
    pinMode(WALLGEAR1_DIR_MINUS, OUTPUT);
    pinMode(WALLGEAR2_PUL_PLUS, OUTPUT);
    pinMode(WALLGEAR2_PUL_MINUS, OUTPUT);
    pinMode(WALLGEAR2_DIR_PLUS, OUTPUT);
    pinMode(WALLGEAR2_DIR_MINUS, OUTPUT);
    pinMode(WALLGEAR3_PUL_PLUS, OUTPUT);
    pinMode(WALLGEAR3_PUL_MINUS, OUTPUT);
    pinMode(WALLGEAR3_DIR_PLUS, OUTPUT);
    pinMode(WALLGEAR3_DIR_MINUS, OUTPUT);
    pinMode(WALLGEARS_ENABLE, OUTPUT);
    pinMode(MOTORS_POWER, OUTPUT);

    // TV Power Control Pin Setup
    pinMode(TV_POWER_1, OUTPUT);
    pinMode(TV_POWER_2, OUTPUT);

    // MAKSERVO Power Control Pin Setup
    pinMode(MAKSERVO_POWER, OUTPUT);

    // Fog Machine Control Pin Setup
    pinMode(FOG_POWER, OUTPUT);
    pinMode(FOG_TRIGGER, OUTPUT);

    pinMode(STUDYFANLIGHT, OUTPUT);
    pinMode(BLACKLIGHTS, OUTPUT);

    // Initialize stepper pins to idle state
    digitalWrite(STUDYFAN_PUL_PLUS, LOW);
    digitalWrite(STUDYFAN_PUL_MINUS, LOW);
    digitalWrite(STUDYFAN_DIR_PLUS, LOW);
    digitalWrite(STUDYFAN_DIR_MINUS, HIGH);
    digitalWrite(STUDYFAN_ENABLE, HIGH); // Start disabled

    // Initialize WallGears stepper pins to idle state
    digitalWrite(WALLGEAR1_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR1_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR1_DIR_PLUS, LOW);
    digitalWrite(WALLGEAR1_DIR_MINUS, HIGH);
    digitalWrite(WALLGEAR2_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR2_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR2_DIR_PLUS, LOW);
    digitalWrite(WALLGEAR2_DIR_MINUS, HIGH);
    digitalWrite(WALLGEAR3_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR3_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR3_DIR_PLUS, LOW);
    digitalWrite(WALLGEAR3_DIR_MINUS, HIGH);
    digitalWrite(WALLGEARS_ENABLE, HIGH); // Start disabled
    digitalWrite(MOTORS_POWER, LOW);      // Start motors powered off

    // Initialize TV power to OFF
    digitalWrite(TV_POWER_1, LOW);
    digitalWrite(TV_POWER_2, LOW);

    // Initialize MAKSERVO power to OFF
    digitalWrite(MAKSERVO_POWER, LOW);

    // Initialize fog machine to OFF
    digitalWrite(FOG_POWER, LOW);
    digitalWrite(FOG_TRIGGER, LOW);

    digitalWrite(STUDYFANLIGHT, LOW);
    digitalWrite(BLACKLIGHTS, LOW);

    // Initialize custom stepper control variables
    studyFanPosition = 0;
    studyFanTarget = 0;
    lastStepTime = micros();
    currentStepInterval = stepIntervalSlow;

    // Initialize WallGears stepper control variables
    wallGearsPosition = 0;
    wallGearsTarget = 0;
    lastWallGearsStepTime = micros();
    currentWallGearsStepInterval = stepIntervalSlow;

    // Initial States
    digitalWrite(POWER_LED, HIGH);

    // Setup the ethernet network connection
    networkSetup();
    // Setup the MQTT service
    mqttSetup();

    // Register Action Handlers
    registerAction("activate", activateHandler);
    registerAction("fanControl", fanControlHandler);
    registerAction("wallGearsControl", wallGearsControlHandler);
    registerAction("tvPower", tvPowerHandler);
    registerAction("makservoPower", makservoPowerHandler);
    registerAction("fogPower", fogPowerHandler);
    registerAction("fogTrigger", fogTriggerHandler);
    registerAction("fogControl", fogControlHandler);
    registerAction("reset", resetHandler);
    registerAction("studyFanLight", studyFanLightHandler);
    registerAction("blackLights", blackLightsHandler);
    registerAction("blacklights", blackLightsHandler); // Alternative lowercase version

    Serial.println("StudyB System Ready - Custom Stepper Control Initialized");
}

void loop()
{
    // Run custom stepper motor control
    runFanMotor();
    runWallGearsMotors();

    // Prepare status data for MQTT publishing
    sprintf(publishDetail, "act:%d,fan:%d:%d:%ld,wall:%d:%d:%ld,tv:%d:%d,mak:%d,fog:%d:%d",
            systemActive ? 1 : 0,
            fanRunning ? 1 : 0,
            fanSpeed,
            studyFanPosition,
            wallGearsRunning ? 1 : 0,
            wallGearsSpeed,
            wallGearsPosition,
            tv1Power ? 1 : 0,
            tv2Power ? 1 : 0,
            makservoPower ? 1 : 0,
            fogPower ? 1 : 0,
            fogTrigger ? 1 : 0);

    // Send data and maintain MQTT connection
    sendDataMQTT();
}

// ═══════════════════════════════════════════════════════════════
//                      HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Action Handlers
void activateHandler(const char *value)
{
    Serial.println("Activate command received: " + String(value));
    systemActive = (String(value) == "1" || String(value).equalsIgnoreCase("true"));

    if (!systemActive)
    {
        // Stop all motors when system deactivated
        fanRunning = false;
        fanSpeed = 0;
        wallGearsRunning = false;
        wallGearsSpeed = 0;
        digitalWrite(STUDYFAN_ENABLE, HIGH);  // Disable fan motor
        digitalWrite(WALLGEARS_ENABLE, HIGH); // Disable WallGears motors
        digitalWrite(MOTORS_POWER, LOW);      // Power off both Fan and WallGears motors
    }
    else
    {
        digitalWrite(MOTORS_POWER, HIGH);    // Power on both Fan and WallGears motors
        digitalWrite(STUDYFAN_ENABLE, LOW);  // Enable fan motor
        digitalWrite(WALLGEARS_ENABLE, LOW); // Enable WallGears motors
    }

    Serial.println("StudyB system " + String(systemActive ? "activated" : "deactivated"));
}

void studyFanLightHandler(const char *value)
{
    bool lightState = (String(value) == "1" || String(value).equalsIgnoreCase("on"));
    digitalWrite(STUDYFANLIGHT, lightState ? HIGH : LOW);
    Serial.println("Study Fan Light " + String(lightState ? "ON" : "OFF"));
}

void blackLightsHandler(const char *value)
{
    Serial.println("Black Lights command received: '" + String(value) + "'");

    bool shouldTurnOn = false;
    String command = String(value);
    command.trim();
    command.toLowerCase();

    // Handle various on/off formats
    if (command == "1" || command == "true" || command == "on" || command == "activate")
    {
        shouldTurnOn = true;
    }
    else if (command == "0" || command == "false" || command == "off" || command == "deactivate")
    {
        shouldTurnOn = false;
    }
    else
    {
        // Default to numeric interpretation
        shouldTurnOn = (atoi(value) != 0);
    }

    digitalWrite(BLACKLIGHTS, shouldTurnOn ? HIGH : LOW);
    Serial.println("Black Lights " + String(shouldTurnOn ? "ON" : "OFF"));
}

void fanControlHandler(const char *value)
{

    int speed = atoi(value);
    Serial.println("Fan control received: " + String(speed));

    switch (speed)
    {
    case 0: // Stop
        fanRunning = false;
        fanSpeed = 0;
        Serial.println("Fan stopped");
        break;

    case 1: // Slow speed - continuous rotation
        fanRunning = true;
        fanSpeed = 1;
        currentStepInterval = stepIntervalSlow;
        Serial.println("Fan running at slow speed (500 steps/sec)");
        break;

    case 2: // Fast speed - continuous rotation
        fanRunning = true;
        fanSpeed = 2;
        currentStepInterval = stepIntervalFast;
        Serial.println("Fan running at fast speed (1500 steps/sec)");
        break;

    default:
        Serial.println("Invalid fan speed: " + String(speed));
        break;
    }
}

void wallGearsControlHandler(const char *value)
{
    if (!systemActive)
    {
        Serial.println("System not active - WallGears control ignored");
        return;
    }

    int speed = atoi(value);
    Serial.println("WallGears control received: " + String(speed));

    switch (speed)
    {
    case 0: // Stop
        wallGearsRunning = false;
        wallGearsSpeed = 0;
        Serial.println("WallGears stopped");
        break;

    case 1: // Slow speed - continuous rotation
        wallGearsRunning = true;
        wallGearsSpeed = 1;
        currentWallGearsStepInterval = stepIntervalSlow;
        Serial.println("WallGears running at slow speed (500 steps/sec)");
        break;

    case 2: // Fast speed - continuous rotation
        wallGearsRunning = true;
        wallGearsSpeed = 2;
        currentWallGearsStepInterval = stepIntervalFast;
        Serial.println("WallGears running at fast speed (1500 steps/sec)");
        break;

    default:
        Serial.println("Invalid WallGears speed: " + String(speed));
        break;
    }
}

void tvPowerHandler(const char *value)
{
    bool powerState = (String(value) == "1" || String(value).equalsIgnoreCase("true"));
    if (powerState == (tv1Power && tv2Power))
    {
        Serial.println("TV power state unchanged");
        return;
    }

    // Update global variables to track state
    tv1Power = powerState;
    tv2Power = powerState;

    digitalWrite(TV_POWER_1, powerState ? HIGH : LOW);
    digitalWrite(TV_POWER_2, powerState ? HIGH : LOW);
    Serial.println("TVs power " + String(powerState ? "ON" : "OFF"));
}

void makservoPowerHandler(const char *value)
{
    bool powerState = (String(value) == "1" || String(value).equalsIgnoreCase("true"));
    makservoPower = powerState;
    digitalWrite(MAKSERVO_POWER, powerState ? HIGH : LOW);
    Serial.println("MAKSERVO power " + String(powerState ? "ON" : "OFF"));
}

void fogPowerHandler(const char *value)
{
    bool powerState = (String(value) == "1" || String(value).equalsIgnoreCase("true"));
    fogPower = powerState;
    digitalWrite(FOG_POWER, powerState ? HIGH : LOW);

    // If turning off power, also turn off trigger
    if (!powerState)
    {
        fogTrigger = false;
        digitalWrite(FOG_TRIGGER, LOW);
    }

    Serial.println("Fog machine power " + String(powerState ? "ON" : "OFF"));
}

void fogTriggerHandler(const char *value)
{
    // Can only trigger if power is on
    if (!fogPower)
    {
        Serial.println("Fog machine not powered - trigger ignored");
        return;
    }

    bool triggerState = (String(value) == "1" || String(value).equalsIgnoreCase("true"));
    fogTrigger = triggerState;
    digitalWrite(FOG_TRIGGER, triggerState ? HIGH : LOW);
    Serial.println("Fog machine trigger " + String(triggerState ? "ON" : "OFF"));
}

void fogControlHandler(const char *value)
{
    // Parse format: "power:1,trigger:1" or "1,1" or single values
    String data = String(value);

    // Check for named format
    if (data.indexOf("power:") >= 0 || data.indexOf("trigger:") >= 0)
    {
        // Format: "power:1,trigger:1"
        int powerStart = data.indexOf("power:");
        int triggerStart = data.indexOf("trigger:");

        if (powerStart >= 0)
        {
            int powerValue = data.substring(powerStart + 6, powerStart + 7).toInt();
            fogPowerHandler(String(powerValue).c_str());
        }

        if (triggerStart >= 0)
        {
            int triggerValue = data.substring(triggerStart + 8, triggerStart + 9).toInt();
            fogTriggerHandler(String(triggerValue).c_str());
        }
    }
    else if (data.indexOf(",") >= 0)
    {
        // Format: "1,1" (power,trigger)
        int commaIndex = data.indexOf(",");
        String powerVal = data.substring(0, commaIndex);
        String triggerVal = data.substring(commaIndex + 1);

        fogPowerHandler(powerVal.c_str());
        fogTriggerHandler(triggerVal.c_str());
    }
    else
    {
        // Single value - treat as trigger command (power must be on first)
        fogTriggerHandler(value);
    }
}

void resetHandler(const char *value)
{
    Serial.println("Reset command received");
    systemActive = false;
    fanRunning = false;
    fanSpeed = 0;
    studyFanPosition = 0;
    studyFanTarget = 0;
    wallGearsRunning = false;
    wallGearsSpeed = 0;
    wallGearsPosition = 0;
    wallGearsTarget = 0;
    tv1Power = false;
    tv2Power = false;
    makservoPower = false;
    fogPower = false;
    fogTrigger = false;
    digitalWrite(STUDYFAN_ENABLE, HIGH);  // Disable fan motor
    digitalWrite(WALLGEARS_ENABLE, HIGH); // Disable WallGears motors
    digitalWrite(MOTORS_POWER, LOW);      // Power off both Fan and WallGears motors
    digitalWrite(TV_POWER_1, LOW);        // Turn off both TVs
    digitalWrite(TV_POWER_2, LOW);
    digitalWrite(MAKSERVO_POWER, LOW); // Turn off MAKSERVO
    digitalWrite(FOG_POWER, LOW);      // Turn off fog machine power
    digitalWrite(FOG_TRIGGER, LOW);    // Turn off fog machine trigger
    Serial.println("StudyB system reset");
}

// ═══════════════════════════════════════════════════════════════
//                    CUSTOM STEPPER CONTROL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Step the fan motor in differential mode (like Clock.ino)
void stepFanMotor(bool direction)
{
    // Set direction using differential signaling
    digitalWrite(STUDYFAN_DIR_PLUS, direction ? HIGH : LOW);
    digitalWrite(STUDYFAN_DIR_MINUS, direction ? LOW : HIGH);

    // Generate step pulse - DMX542 differential signaling
    digitalWrite(STUDYFAN_PUL_PLUS, HIGH);
    digitalWrite(STUDYFAN_PUL_MINUS, LOW);
    delayMicroseconds(10); // Pulse width for DMX542 (hardware requirement)
    digitalWrite(STUDYFAN_PUL_PLUS, LOW);
    digitalWrite(STUDYFAN_PUL_MINUS, LOW);
    delayMicroseconds(10); // Settling time (hardware requirement)

    // Update position (for continuous rotation, we just track total steps)
    studyFanPosition += direction ? 1 : -1;
}

// Run the fan motor continuously at current speed
void runFanMotor()
{
    if (!fanRunning || !systemActive)
    {
        return;
    }

    unsigned long currentTime = micros();

    // Check if it's time for the next step
    if (currentTime - lastStepTime >= currentStepInterval)
    {
        lastStepTime = currentTime;

        // For continuous rotation, always step forward
        stepFanMotor(true); // Always clockwise direction
    }
}

// Step all three WallGears motors simultaneously
void stepWallGearsMotors(bool direction)
{
    // Set direction for all three motors using differential signaling
    digitalWrite(WALLGEAR1_DIR_PLUS, direction ? HIGH : LOW);
    digitalWrite(WALLGEAR1_DIR_MINUS, direction ? LOW : HIGH);
    digitalWrite(WALLGEAR2_DIR_PLUS, direction ? HIGH : LOW);
    digitalWrite(WALLGEAR2_DIR_MINUS, direction ? LOW : HIGH);
    digitalWrite(WALLGEAR3_DIR_PLUS, direction ? HIGH : LOW);
    digitalWrite(WALLGEAR3_DIR_MINUS, direction ? LOW : HIGH);

    // Generate step pulse simultaneously for all three motors
    digitalWrite(WALLGEAR1_PUL_PLUS, HIGH);
    digitalWrite(WALLGEAR1_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR2_PUL_PLUS, HIGH);
    digitalWrite(WALLGEAR2_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR3_PUL_PLUS, HIGH);
    digitalWrite(WALLGEAR3_PUL_MINUS, LOW);

    delayMicroseconds(10); // Pulse width for DMX542 (hardware requirement)

    digitalWrite(WALLGEAR1_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR1_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR2_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR2_PUL_MINUS, LOW);
    digitalWrite(WALLGEAR3_PUL_PLUS, LOW);
    digitalWrite(WALLGEAR3_PUL_MINUS, LOW);

    delayMicroseconds(10); // Settling time (hardware requirement)

    // Update position (all motors step together)
    wallGearsPosition += direction ? 1 : -1;
}

// Run the WallGears motors continuously at current speed
void runWallGearsMotors()
{
    if (!wallGearsRunning || !systemActive)
    {
        return;
    }

    unsigned long currentTime = micros();

    // Check if it's time for the next step
    if (currentTime - lastWallGearsStepTime >= currentWallGearsStepInterval)
    {
        lastWallGearsStepTime = currentTime;

        // For continuous rotation, always step forward
        stepWallGearsMotors(true); // Always clockwise direction
    }
}

