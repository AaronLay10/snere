#include <MythraOS_MQTT.h>
#include <IRremote.hpp> // Use the newer header
#include <FastLED.h>

const int IR_RECEIVE_PIN = 25; // IR receiver pin
const int POWERLED = 13;       // Built-in LED for visual feedback
const int MAGLOCK_PIN = 26;    // Maglock control pin (adjust as needed)
const int HALLEFFECT_A = 5;
const int HALLEFFECT_B = 6;
const int HALLEFFECT_C = 7;
const int HALLEFFECT_D = 8;
const int LEDSTRIP_PIN = 1;
const int LEDLEVER_PIN = 12;
const int PHOTOCELL = A10;
const int CUBE_BUTTON = 32;
const int LEDLEVERCOB = 30;

// Photocell threshold for lever detection (light on = lever open)
#define PHOTOCELL_THRESHOLD 500 // Adjust based on your setup

const int NUM_LEDS = 9;         // Number of LEDs in the strip
const int NUM_LEVER_LEDS = 10;  // Number of LEDs in the lever strip (adjust as needed)
const int BRIGHTNESS = 255;     // Brightness level (0-255)
CRGB leds[NUM_LEDS];            // Array to hold LED colors
CRGB leverLeds[NUM_LEVER_LEDS]; // Array for lever LED strip

const uint8_t TARGET_COMMAND = 0x51; // The IR command we're looking for

// IR Sensor variables
bool irSensorActive = true; // IR sensor activation state

// MythraOS_MQTT variables
#define DEVICE_ID "LeverRiddle"
#define DEVICE_FRIENDLY_NAME "Riddle Lever"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "LeverRiddle"

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

bool sensorA = false;
bool sensorB = false;
bool sensorC = false;
bool sensorD = false;
int photocellValue = 0;
bool cubeButtonPressed = false;

char lastIRMessage[128] = ""; // Buffer for latest IR message

// Telemetry change detection
char lastTelemetry[256] = "";
bool telemetryInitialized = false;

void setup()
{
    Serial.begin(115200);

    // Wait for serial to initialize
    delay(2000);

    // Initialize pins
    pinMode(POWERLED, OUTPUT);
    pinMode(MAGLOCK_PIN, OUTPUT);
    digitalWrite(POWERLED, HIGH);
    digitalWrite(MAGLOCK_PIN, HIGH); // Maglock normally HIGH (locked)
    pinMode(LEDLEVERCOB, OUTPUT);
    digitalWrite(LEDLEVERCOB, HIGH); // Power for lever COB LEDs

    // Initialize hall effect sensor pins as inputs with pullup
    pinMode(HALLEFFECT_A, INPUT_PULLUP);
    pinMode(HALLEFFECT_B, INPUT_PULLUP);
    pinMode(HALLEFFECT_C, INPUT_PULLUP);
    pinMode(HALLEFFECT_D, INPUT_PULLUP);

    // Initialize photocell and cube button pins
    pinMode(PHOTOCELL, INPUT);
    pinMode(CUBE_BUTTON, INPUT_PULLUP);

    // Initialize FastLED
    FastLED.addLeds<WS2812B, LEDSTRIP_PIN, RGB>(leds, NUM_LEDS);
    FastLED.addLeds<WS2812B, LEDLEVER_PIN, RGB>(leverLeds, NUM_LEVER_LEDS);
    FastLED.setBrightness(BRIGHTNESS);

    // Set initial color to red (waiting for all sensors)
    setAllLEDs(CRGB::Red);

    // Set lever LEDs to white and keep them on indefinitely
    setLeverLEDs(CRGB::White);

    // Initialize MythraOS_MQTT
    mythra.begin();

    // Set command callback for MQTT
    mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
      // Debug: Print all received commands
      Serial.print("MQTT Command Received: '");
      Serial.print(command);
      Serial.print("' with payload: ");
      
      if (payload.is<const char*>()) {
        Serial.println(payload.as<const char*>());
        const char* value = payload.as<const char*>();
        
        if (strcmp(command, "command") == 0) {
          activateIR(value);
        } else if (strcmp(command, "cob_light") == 0) {
          controlLeverCob(value);
        } else {
          Serial.print("Unknown command: ");
          Serial.println(command);
        }
      } else {
        Serial.println("(non-string payload)");
      }
    });

    // Start IR receiver
    IrReceiver.begin(IR_RECEIVE_PIN, DISABLE_LED_FEEDBACK);

    Serial.println("Lever Riddle IR Control - Teensy Version");
    Serial.println("========================================");
    Serial.print("IR Receiver on pin: ");
    Serial.println(IR_RECEIVE_PIN);
    Serial.print("Maglock control on pin: ");
    Serial.println(MAGLOCK_PIN);
    Serial.print("Target IR command: 0x");
    Serial.println(TARGET_COMMAND, HEX);
    Serial.print("Library version: ");
    Serial.println(VERSION_IRREMOTE);
    Serial.println("Ready to receive IR signals...");
    Serial.println();
}

void loop()
{
    mythra.loop();                     // Send data to MQTT broker
    
    // Debug MQTT connection status (print once every 10 seconds)
    static unsigned long lastConnectionCheck = 0;
    if (millis() - lastConnectionCheck > 10000) {
        Serial.print("MQTT Connection Status: ");
        Serial.println(mythra.isConnected() ? "CONNECTED" : "DISCONNECTED");
        lastConnectionCheck = millis();
    }
    
    checkHallEffectSensors();          // Check hall effect sensors and update LED colors
    checkPhotocellAndCubeButton();     // Check photocell and cube button status

    // Check for incoming IR signals and handle them if available

    if (irSensorActive && IrReceiver.decode())
    {
        handleIRSignal();
        IrReceiver.resume(); // Resume receiving
    }

    // Convert photocell to open/closed status
    const char* leverStatus = (photocellValue > PHOTOCELL_THRESHOLD) ? "OPEN" : "CLOSED";

    // Build telemetry WITHOUT IR message (IR messages sent separately)
    // Format: HallA:HallB:HallC:HallD,LeverStatus,CubeButtonStatus
    char telemetryBuffer[256];
    snprintf(telemetryBuffer, sizeof(telemetryBuffer),
             "%d:%d:%d:%d,%s,%d",
             sensorA ? 1 : 0,
             sensorB ? 1 : 0,
             sensorC ? 1 : 0,
             sensorD ? 1 : 0,
             leverStatus,
             cubeButtonPressed ? 1 : 0);

    // CHANGE DETECTION: Only publish if data changed and MQTT is connected
    bool dataChanged = (!telemetryInitialized) || (strcmp(telemetryBuffer, lastTelemetry) != 0);

    if (dataChanged && mythra.isConnected())
    {
        Serial.print("[PUBLISHING] ");
        Serial.println(telemetryBuffer);
        mythra.publishText("Telemetry", "data", telemetryBuffer);
        strcpy(lastTelemetry, telemetryBuffer);
        telemetryInitialized = true;
    }

    // Send IR messages separately as events (only when present)
    if (strlen(lastIRMessage) > 0 && mythra.isConnected())
    {
        Serial.print("[IR EVENT] ");
        Serial.println(lastIRMessage);
        mythra.publishText("Events", "IR", lastIRMessage);
        lastIRMessage[0] = '\0'; // Clear after sending
    }

    delay(50); // Essential delay for proper IR reception
}

void checkPhotocellAndCubeButton()
{
    photocellValue = analogRead(PHOTOCELL);

    // Check cube button with immediate messaging on state change
    bool currentCubeButtonState = !digitalRead(CUBE_BUTTON); // Invert for INPUT_PULLUP

    // Send immediate message if cube button state changed to active (pressed)
    if (currentCubeButtonState && !cubeButtonPressed)
    {
        // Cube button just became active - send immediate message
        mythra.publishText("Events", "event", "CUBE_BUTTON_ACTIVE");
        Serial.println("*** CUBE BUTTON ACTIVATED - Immediate message sent ***");
    }
    else if (!currentCubeButtonState && cubeButtonPressed)
    {
        // Cube button just became inactive - optional message
        Serial.println("Cube button deactivated");
    }

    cubeButtonPressed = currentCubeButtonState;
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

        Serial.print("=== IR Signal Received ===");
        Serial.print("Timestamp: ");
        Serial.println(millis());

        Serial.print("Protocol: ");
        Serial.print(getProtocolString(IrReceiver.decodedIRData.protocol));
        Serial.print(" (ID: ");
        Serial.print(IrReceiver.decodedIRData.protocol);
        Serial.println(")");

        Serial.print("Address: 0x");
        Serial.print(IrReceiver.decodedIRData.address, HEX);
        Serial.print(", Command: 0x");
        Serial.print(IrReceiver.decodedIRData.command, HEX);
        Serial.print(", Raw: 0x");
        Serial.println(IrReceiver.decodedIRData.decodedRawData, HEX);

        // Check if this is our target command and set publishDetail in one statement
        if (IrReceiver.decodedIRData.command == TARGET_COMMAND)
        {
            // Activate maglock (set LOW to unlock)
            digitalWrite(MAGLOCK_PIN, LOW);

            // Set lastIRMessage with IR data and success message
            snprintf(lastIRMessage, sizeof(lastIRMessage),
                     "IR Command: 0x%02X, Address: 0x%04X, Protocol: %d - CORRECT CODE! Maglock activated",
                     IrReceiver.decodedIRData.command,
                     IrReceiver.decodedIRData.address,
                     IrReceiver.decodedIRData.protocol);

            Serial.println("*** CORRECT IR CODE RECEIVED! ***");
            Serial.println("*** MAGLOCK ACTIVATED ***");
        }
        else
        {
            // Set lastIRMessage with IR data and wrong code message
            snprintf(lastIRMessage, sizeof(lastIRMessage),
                     "IR Command: 0x%02X, Address: 0x%04X, Protocol: %d - Wrong code",
                     IrReceiver.decodedIRData.command,
                     IrReceiver.decodedIRData.address,
                     IrReceiver.decodedIRData.protocol);
        }

        Serial.println("================================");
        Serial.println();
    }
    else
    {
        // Briefly show filtered signals for debugging (optional)
        if (isDuplicate)
        {
            Serial.print("FILTERED: Duplicate signal");
            Serial.print(" (Raw: 0x");
            Serial.print(IrReceiver.decodedIRData.decodedRawData, HEX);
            Serial.println(")");
        }
        else if (isWeakSignal)
        {
            Serial.print("FILTERED: Weak/Fragment signal");
            Serial.print(" (Protocol: ");
            Serial.print(IrReceiver.decodedIRData.protocol);
            Serial.println(")");
        }
    }

    // Update tracking variables
    lastRawData = IrReceiver.decodedIRData.decodedRawData;
    lastTimestamp = millis();
}

void checkHallEffectSensors()
{
    // Read all hall effect sensors (LOW = magnet detected)
    sensorA = !digitalRead(HALLEFFECT_A); // Invert because INPUT_PULLUP
    sensorB = !digitalRead(HALLEFFECT_B);
    sensorC = !digitalRead(HALLEFFECT_C);
    sensorD = !digitalRead(HALLEFFECT_D);

    // Check if all sensors detect magnets
    bool allSensorsActive = sensorA && sensorB && sensorC && sensorD;

    // Update LED color based on sensor states
    if (allSensorsActive)
    {
        setAllLEDs(CRGB::Green);
    }
    else
    {
        setAllLEDs(CRGB::Red);
    }
}

void setAllLEDs(CRGB color)
{
    // Set all LEDs to the specified color
    for (int i = 0; i < NUM_LEDS; i++)
    {
        leds[i] = color;
    }
    FastLED.show();
}

void setLeverLEDs(CRGB color)
{
    // Set all lever LEDs to the specified color
    for (int i = 0; i < NUM_LEVER_LEDS; i++)
    {
        leverLeds[i] = color;
    }
    FastLED.show();
}

void activateIR(const char *value)
{
    if (strcmp(value, "1") == 0 || strcmp(value, "on") == 0)
    {
        irSensorActive = true;
        Serial.println("IR Sensor activated");
    }
    else if (strcmp(value, "0") == 0 || strcmp(value, "off") == 0)
    {
        irSensorActive = false;
        Serial.println("IR Sensor deactivated");
    }
}

void turnOnLeverCob() {
    digitalWrite(LEDLEVERCOB, HIGH);
}

void controlLeverCob(const char *value) {
    if (strcmp(value, "1") == 0 || strcmp(value, "on") == 0 || strcmp(value, "ON") == 0) {
        digitalWrite(LEDLEVERCOB, HIGH);
        Serial.println("COB Light turned ON");
        mythra.publishText("Status", "cob_light", "ON");
    } else if (strcmp(value, "0") == 0 || strcmp(value, "off") == 0 || strcmp(value, "OFF") == 0) {
        digitalWrite(LEDLEVERCOB, LOW);
        Serial.println("COB Light turned OFF");
        mythra.publishText("Status", "cob_light", "OFF");
    } else {
        Serial.print("Invalid COB light command: ");
        Serial.println(value);
    }
}

