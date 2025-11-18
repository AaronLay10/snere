#include <MythraOS_MQTT.h>

#define DEVICE_ID "Pilaster"
#define DEVICE_FRIENDLY_NAME "Pilaster Puzzle"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Pilaster"

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

const int powerLED = 13;

// Pin Assignments for buttons
const int button1 = 12; // Green button
const int button2 = 10; // Silver button
const int button3 = 9;  // Red button
const int button4 = 11; // Black button

// Button state variables
bool buttonState1 = false, buttonState2 = false, buttonState3 = false, buttonState4 = false;
bool lastButtonState1 = false, lastButtonState2 = false, lastButtonState3 = false, lastButtonState4 = false;

// Debounce timing
unsigned long lastDebounceTime1 = 0, lastDebounceTime2 = 0, lastDebounceTime3 = 0, lastDebounceTime4 = 0;
const unsigned long debounceDelay = 50; // 50ms debounce delay

// Heartbeat timing
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 5000; // 5 seconds

void setup()
{
  // On-board LED setup
  pinMode(powerLED, OUTPUT);
  digitalWrite(powerLED, HIGH);

  Serial.begin(115200);

  // Button setup with internal pull-down resistors for active HIGH
  Serial.println("Setting up Button Sensors...");
  pinMode(button1, INPUT_PULLDOWN);
  pinMode(button2, INPUT_PULLDOWN);
  pinMode(button3, INPUT_PULLDOWN);
  pinMode(button4, INPUT_PULLDOWN);

  // Initialize MythraOS
  mythra.begin();

  Serial.println("Pilaster puzzle ready!");
}

void loop()
{
  mythra.loop();

  // Read and debounce all buttons
  checkButton(button1, buttonState1, lastButtonState1, lastDebounceTime1, '1'); // Green
  checkButton(button2, buttonState2, lastButtonState2, lastDebounceTime2, '2'); // Silver
  checkButton(button3, buttonState3, lastButtonState3, lastDebounceTime3, '3'); // Red
  checkButton(button4, buttonState4, lastButtonState4, lastDebounceTime4, '4'); // Black

  // Send heartbeat every 5 seconds using telemetry
  unsigned long currentTime = millis();
  if (currentTime - lastHeartbeat >= heartbeatInterval)
  {
    mythra.publishText("Telemetry", "heartbeat", "heartbeat");
    lastHeartbeat = currentTime;
    Serial.println("Heartbeat queued");
  }
}

void checkButton(int pin, bool &currentState, bool &lastState, unsigned long &lastDebounceTime, char buttonName)
{
  bool reading = digitalRead(pin); // Direct reading for active HIGH with pull-down

  if (reading != lastState)
  {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay)
  {
    if (reading != currentState)
    {
      currentState = reading;

      // Only send message on button press (HIGH state)
      if (currentState)
      {
        // Send button number immediately for responsive gameplay
        char buttonMessage[2];
        buttonMessage[0] = buttonName;
        buttonMessage[1] = '\0';
        mythra.publishText("Events", "button", buttonMessage);

        Serial.print("Button ");
        Serial.print(buttonName);
        Serial.println(" pressed!");
      }
    }
  }

  lastState = reading;
}
