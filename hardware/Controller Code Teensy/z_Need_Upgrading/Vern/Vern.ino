/*
 * CLOCKWORK SYSTEM - VERN
 * Paragon Escape Games - MythraOS_MQTT Integration
 *
 * This system controls the Vern mechanisms in the Clockwork room.
 *
 * Instructions:
 * 1. Define your hardware pins in the pin definitions section
 * 2. Add your hardware initialization in setup()
 * 3. Implement your action functions
 * 4. Register your actions with commandHandler() in setup()
 * 5. Add any continuous monitoring/control logic in loop()
 */

#include <MythraOS_MQTT.h>

// =============================================================================
// DEVICE CONFIGURATION
// =============================================================================
#define DEVICE_ID "Vern"
#define DEVICE_FRIENDLY_NAME "Vern Controller"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Vern"

// =============================================================================
// PIN DEFINITIONS
// =============================================================================
#define POWER_LED 13
#define OUTPUT_ONE 34
#define OUTPUT_TWO 35
#define OUTPUT_THREE 36
#define OUTPUT_FOUR 37
#define OUTPUT_FIVE 38
#define OUTPUT_SIX 39
#define OUTPUT_SEVEN 40
#define OUTPUT_EIGHT 41
#define VERNPOWERSWITCH 24

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================
// Add your global variables here
// Examples:
// bool systemActive = false;
// int sensorValue = 0;
// unsigned long lastSensorRead = 0;

// =============================================================================
// MYTHRAOS MQTT CONFIGURATION
// =============================================================================
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
  cfg.heartbeatIntervalMs = 5000;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// =============================================================================
// SETUP FUNCTION
// =============================================================================
void setup()
{
    // Initialize serial communication
    Serial.begin(115200);
    Serial.println("Starting Clockwork System: Vern");

    // Power LED initialization
    pinMode(POWER_LED, OUTPUT);
    digitalWrite(POWER_LED, HIGH);

    // ==========================================================================
    // HARDWARE INITIALIZATION
    // ==========================================================================
    // Initialize OUTPUT pins as outputs
    pinMode(OUTPUT_ONE, OUTPUT);
    pinMode(OUTPUT_TWO, OUTPUT);
    pinMode(OUTPUT_THREE, OUTPUT);
    pinMode(OUTPUT_FOUR, OUTPUT);
    pinMode(OUTPUT_FIVE, OUTPUT);
    pinMode(OUTPUT_SIX, OUTPUT);
    pinMode(OUTPUT_SEVEN, OUTPUT);
    pinMode(OUTPUT_EIGHT, OUTPUT);
    pinMode(VERNPOWERSWITCH, OUTPUT); // Assuming active low power switch

    // Set initial states to LOW (inactive state for active high logic)
    digitalWrite(OUTPUT_ONE, LOW);
    digitalWrite(OUTPUT_TWO, LOW);
    digitalWrite(OUTPUT_THREE, LOW);
    digitalWrite(OUTPUT_FOUR, LOW);
    digitalWrite(OUTPUT_FIVE, LOW);
    digitalWrite(OUTPUT_SIX, LOW);
    digitalWrite(OUTPUT_SEVEN, LOW);
    digitalWrite(OUTPUT_EIGHT, LOW);
    digitalWrite(VERNPOWERSWITCH, LOW);

    // ==========================================================================
    // MYTHRAOS MQTT SETUP
    // ==========================================================================
    // Initialize MythraOS
    mythra.begin();

    // Register command callback
    mythra.setCommandCallback(commandHandler);

    Serial.println("Vern system initialization complete");
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop()
{
    // Maintain MQTT connection and handle incoming messages
    mythra.loop();

    // ==========================================================================
    // CONTINUOUS MONITORING AND CONTROL
    // ==========================================================================
    // Add your continuous loop logic here
    // Examples:
    // readSensors();
    // updateOutputs();
    // checkSystemStatus();

    // Optional: Add a small delay to prevent overwhelming the system
    // delay(100);
}

// =============================================================================
// MQTT COMMAND HANDLER
// =============================================================================

void commandHandler(const char *command, const JsonDocument &payload, void *context)
{
    // Extract value from payload
    const char *value = payload["value"] | "";

    Serial.print("Command received: ");
    Serial.print(command);
    Serial.print(" = ");
    Serial.println(value);

    if (strcmp(command, "vern") == 0)
    {
        vernAction(value);
    }
}

// =============================================================================
// ACTION HANDLER FUNCTIONS
// =============================================================================

/*
 * Vern action handler
 * Responds to MQTT messages with action "vern"
 * When value is "1", triggers OUTPUT_ONE HIGH for 1 second (active high logic)
 */
void vernAction(const char *value)
{
    Serial.println("Vern action received!");
    Serial.println("Value: " + String(value));

    int actionValue = atoi(value);
    if (String(value) == "power on") {
        digitalWrite(VERNPOWERSWITCH, HIGH); // Disable power switch (active low)
        Serial.println("Vern power enabled");
        return;
    } else if (String(value) == "power off") {
        digitalWrite(VERNPOWERSWITCH, LOW); // Enable power switch (active low)
        Serial.println("Vern power disabled");
        return;
    }

    int pinToPulse = 0;
    String pinName;
    switch (actionValue)
    {
    case 1:
        pinToPulse = OUTPUT_ONE;
        pinName = "OUTPUT_ONE";
        break;
    case 2:
        pinToPulse = OUTPUT_TWO;
        pinName = "OUTPUT_TWO";
        break;
    case 3:
        pinToPulse = OUTPUT_THREE;
        pinName = "OUTPUT_THREE";
        break;
    case 4:
        pinToPulse = OUTPUT_FOUR;
        pinName = "OUTPUT_FOUR";
        break;
    case 5:
        pinToPulse = OUTPUT_FIVE;
        pinName = "OUTPUT_FIVE";
        break;
    case 6:
        pinToPulse = OUTPUT_SIX;
        pinName = "OUTPUT_SIX";
        break;
    case 7:
        pinToPulse = OUTPUT_SEVEN;
        pinName = "OUTPUT_SEVEN";
        break;
    case 8:
        pinToPulse = OUTPUT_EIGHT;
        pinName = "OUTPUT_EIGHT";
        break;
    default:
        pinToPulse = 0;
    }
    if (pinToPulse != 0)
    {
        Serial.print("Triggering ");
        Serial.print(pinName);
        Serial.println(" HIGH for 1 second (active high)");
        digitalWrite(pinToPulse, HIGH);
        delay(1000);
        digitalWrite(pinToPulse, LOW);
        Serial.print(pinName);
        Serial.println(" pulse complete");
    }
}
