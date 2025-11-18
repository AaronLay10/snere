// Music v2.3.0
// Teensy 4.1 - Connected to Sentient System (STATELESS EXECUTOR)
// ══════════════════════════════════════════════════════════════════════════════
// STATELESS ARCHITECTURE:
// - 6 button sensors with pull-up resistors (active LOW)
// - No game logic - Sentient makes all decisions
// - Publishes button state changes on press/release
// - Heartbeat every 5 seconds for connection monitoring
// ══════════════════════════════════════════════════════════════════════════════

#include <SentientMQTT.h>
#include <SentientCapabilityManifest.h>
#include <SentientDeviceRegistry.h>
#include "controller_naming.h"
#include "FirmwareMetadata.h"

using namespace naming;

// MQTT Configuration helper
SentientMQTTConfig build_mqtt_config()
{
  SentientMQTTConfig cfg;
  cfg.brokerHost = "mqtt.sentientengine.ai";
  cfg.brokerPort = 1883;
  cfg.username = "paragon_devices";
  cfg.password = "wF9Wwejkjdml3EA599e1fTOb9xyAixaduEMID7UfDDs=";
  cfg.namespaceId = CLIENT_ID;
  cfg.roomId = ROOM_ID;
  cfg.puzzleId = CONTROLLER_ID;
  cfg.deviceId = CONTROLLER_ID;
  cfg.displayName = CONTROLLER_FRIENDLY_NAME;
  cfg.useDhcp = true;
  cfg.autoHeartbeat = true;
  cfg.heartbeatIntervalMs = 5000;
  return cfg;
}

SentientMQTT sentient(build_mqtt_config());

const int powerLED = 13;

// Pin Assignments for buttons
const int button1 = 0;
const int button2 = 1;
const int button3 = 2;
const int button4 = 3;
const int button5 = 4;
const int button6 = 5;

// Button state variables
bool buttonState1 = false, buttonState2 = false, buttonState3 = false;
bool buttonState4 = false, buttonState5 = false, buttonState6 = false;
bool lastButtonState1 = false, lastButtonState2 = false, lastButtonState3 = false;
bool lastButtonState4 = false, lastButtonState5 = false, lastButtonState6 = false;

// Debounce timing
unsigned long lastDebounceTime1 = 0, lastDebounceTime2 = 0, lastDebounceTime3 = 0;
unsigned long lastDebounceTime4 = 0, lastDebounceTime5 = 0, lastDebounceTime6 = 0;
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
  while (!Serial && millis() < 3000)
  {
    delay(10);
  }

  Serial.println("\n═════════════════════════════════════════════════");
  Serial.println("  Music Controller v2.3.0");
  Serial.println("  STATELESS EXECUTOR Architecture");
  Serial.println("═════════════════════════════════════════════════");
  Serial.print("  Version: ");
  Serial.println(firmware::VERSION);
  Serial.print("  Build Date: ");
  Serial.println(firmware::BUILD_DATE);
  Serial.print("  Controller ID: ");
  Serial.println(naming::CONTROLLER_ID);
  Serial.println("═════════════════════════════════════════════════\n");

  // Button setup with internal pull-up resistors
  Serial.println("Setting up Button Sensors...");
  pinMode(button1, INPUT_PULLUP);
  pinMode(button2, INPUT_PULLUP);
  pinMode(button3, INPUT_PULLUP);
  pinMode(button4, INPUT_PULLUP);
  pinMode(button5, INPUT_PULLUP);
  pinMode(button6, INPUT_PULLUP);

  // Initialize Sentient MQTT
  if (!sentient.begin())
  {
    Serial.println("  ⚠ MQTT initialization failed - continuing without network");
  }
  else
  {
    Serial.println("  ✓ MQTT connected successfully");
  }

  Serial.println("✓ Music Controller Ready!");
  Serial.println("  Waiting for commands from Sentient...\n");
}

void loop()
{
  sentient.loop();

  // Read and debounce all buttons
  checkButton(button1, buttonState1, lastButtonState1, lastDebounceTime1, "button_1");
  checkButton(button2, buttonState2, lastButtonState2, lastDebounceTime2, "button_2");
  checkButton(button3, buttonState3, lastButtonState3, lastDebounceTime3, "button_3");
  checkButton(button4, buttonState4, lastButtonState4, lastDebounceTime4, "button_4");
  checkButton(button5, buttonState5, lastButtonState5, lastDebounceTime5, "button_5");
  checkButton(button6, buttonState6, lastButtonState6, lastDebounceTime6, "button_6");

  // Send heartbeat every 5 seconds
  unsigned long currentTime = millis();
  if (currentTime - lastHeartbeat >= heartbeatInterval)
  {
    sentient.publishHeartbeat();
    lastHeartbeat = currentTime;
  }
}

void checkButton(int pin, bool &currentState, bool &lastState, unsigned long &lastDebounceTime, const char *device_id)
{
  bool reading = !digitalRead(pin); // Inverted because of pull-up resistor

  if (reading != lastState)
  {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay)
  {
    if (reading != currentState)
    {
      currentState = reading;

      // Publish on state change (both press and release)
      String state = currentState ? "pressed" : "released";
      sentient.publishText("sensors", device_id, state.c_str());

      Serial.print("[SENSOR] ");
      Serial.print(device_id);
      Serial.print(": ");
      Serial.println(state);
    }
  }

  lastState = reading;
}
