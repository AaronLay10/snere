#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
#include <ParagonMQTT.h>
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

const int NUM_LEDS = 9;         // Number of LEDs in the strip
const int NUM_LEVER_LEDS = 10;  // Number of LEDs in the lever strip (adjust as needed)
const int BRIGHTNESS = 255;     // Brightness level (0-255)
CRGB leds[NUM_LEDS];            // Array to hold LED colors
CRGB leverLeds[NUM_LEVER_LEDS]; // Array for lever LED strip

const uint8_t TARGET_COMMAND = 0x51; // The IR command we're looking for

// IR Sensor variables
bool irSensorActive = true; // IR sensor activation state

// ParagonMQTT variables
const char *deviceID = "LeverRiddle";
const char *roomID = "Clockwork";

bool sensorA = false;
bool sensorB = false;
bool sensorC = false;
bool sensorD = false;
int photocellValue = 0;
bool cubeButtonPressed = false;

char lastIRMessage[128] = ""; // Buffer for latest IR message

#line 41 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void setup();
#line 96 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void loop();
#line 127 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void checkPhotocellAndCubeButton();
#line 150 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void handleIRSignal();
#line 237 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void checkHallEffectSensors();
#line 259 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void setAllLEDs(CRGB color);
#line 269 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void setLeverLEDs(CRGB color);
#line 279 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
void activateIR(const char *value);
#line 41 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/LeverRiddle/LeverRiddle.ino"
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

    // Initialize ParagonMQTT
    networkSetup(); // Initialize network settings
    mqttSetup();    // Setup MQTT connection

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
    sendDataMQTT();                // Send data to MQTT broker
    checkHallEffectSensors();      // Check hall effect sensors and update LED colors
    checkPhotocellAndCubeButton(); // Check photocell and cube button status

    // Check for incoming IR signals and handle them if available

    if (irSensorActive && IrReceiver.decode())
    {
        handleIRSignal();
        IrReceiver.resume(); // Resume receiving
    }

    // Send MQTT message Format: HallA:HallB:HallC:HallD,PhotocellReading,CubeButtonStatus,IR Messages
    snprintf(publishDetail, sizeof(publishDetail),
             "%d:%d:%d:%d,%d,%d,%s",
             sensorA ? 1 : 0,
             sensorB ? 1 : 0,
             sensorC ? 1 : 0,
             sensorD ? 1 : 0,
             photocellValue,
             cubeButtonPressed ? 1 : 0,
             lastIRMessage);

    // Clear lastIRMessage after publishing to avoid repeating old messages
    lastIRMessage[0] = '\0';

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
        sendImmediateMQTT("CUBE_BUTTON_ACTIVE");
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
