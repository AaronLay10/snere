
#include <MythraOS_MQTT.h>
#include <FastLED.h>
#include <IRremote.h>
#include <LittleFS.h>
#include "AudioFileSourceLittleFS.h"
#include "AudioGeneratorWAV.h"
#include "AudioOutputI2S.h"

// MQTT Configuration
#define DEVICE_ID "Edith"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "GunEdith"

const char *wifiSSID = "YourSSID";     // TODO: Update with actual WiFi credentials
const char *wifiPASS = "YourPassword"; // TODO: Update with actual WiFi credentials

MythraOSMQTTConfig makeConfig() {
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = "paragon";
  cfg.roomId = ROOM_ID;
  cfg.puzzleId = PUZZLE_ID;
  cfg.deviceId = DEVICE_ID;
  cfg.useDhcp = true;
  return cfg;
}

MythraOSMQTT mythra(makeConfig());

// Unique GUN ID for IR
#define GUN_ADDRESS 0x11 // For Gun #1, change for others

// Pin definitions for ESP32-C6 (SparkFun Thing Plus)
#define TRIGGER 9       // Digital input for trigger (GPIO9)
#define IR_SEND 8       // IR LED output (GPIO8)
#define LED_PIN_E 10    // WS2812B LED strip data (GPIO10)
#define NUM_LEDS 50     // Number of LEDs in strip
#define SHOT_DELAY 2000 // Minimum delay between shots (ms)

CRGB leds_E[NUM_LEDS];

AudioGeneratorWAV *wav = nullptr;
AudioFileSourceLittleFS *file = nullptr;
AudioOutputI2S *out = nullptr;
bool isPlaying = false;
unsigned long lastShotTime = 0;

// Gun state variables
bool gunEnabled = true;
int ledBrightness = 128;
String gunMode = "normal";

// MQTT Action Handlers
void fireHandler(const char *value)
{
  Serial.println("Remote fire command received: " + String(value));
  if (gunEnabled)
  {
    fireGun();
  }
}

void modeHandler(const char *value)
{
  Serial.println("Mode change: " + String(value));
  gunMode = String(value);

  // Publish status update
  char telemetry[50];
  sprintf(telemetry, "mode:%s", value);
  mythra.publishText("Telemetry", "data", telemetry);
}

void brightnessHandler(const char *value)
{
  int brightness = atoi(value);
  if (brightness >= 0 && brightness <= 255)
  {
    ledBrightness = brightness;
    FastLED.setBrightness(ledBrightness);
    Serial.printf("LED brightness set to: %d\n", ledBrightness);

    // Publish status update
    char telemetry[50];
    sprintf(telemetry, "brightness:%d", ledBrightness);
    mythra.publishText("Telemetry", "data", telemetry);
  }
}

void setup()
{
  Serial.begin(115200);

  // Pin setup
  pinMode(TRIGGER, INPUT_PULLUP); // Use internal pullup for trigger
  pinMode(IR_SEND, OUTPUT);

  // IR initialization
  IrSender.begin(IR_SEND);

  // LED setup
  FastLED.addLeds<WS2812B, LED_PIN_E, GRB>(leds_E, NUM_LEDS);
  FastLED.clear(true);

  // LittleFS
  if (!LittleFS.begin())
  {
    Serial.println("LittleFS Mount Failed!");
    return;
  }

  // Audio output - I2S pins for ESP32-C6
  out = new AudioOutputI2S();
  out->SetPinout(4, 5, 6); // BCLK, LRCLK, DOUT (GPIO4, GPIO5, GPIO6)
  out->SetOutputModeMono(true);
  out->SetGain(1.0);
  out->SetRate(16000);

  // Initialize MythraOS
  mythra.begin();

  // Register MQTT action handlers for remote control
  mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
    if (strcmp(command, "fire") == 0 && payload.is<const char*>()) {
      fireHandler(payload.as<const char*>());
    } else if (strcmp(command, "setMode") == 0 && payload.is<const char*>()) {
      modeHandler(payload.as<const char*>());
    } else if (strcmp(command, "setBrightness") == 0 && payload.is<const char*>()) {
      brightnessHandler(payload.as<const char*>());
    }
  });
}

void loop()
{
  mythra.loop();

  // Keep MQTT alive and publish status
  static unsigned long lastStatusUpdate = 0;
  if (millis() - lastStatusUpdate > 5000)
  { // Update every 5 seconds
    char telemetry[100];
    sprintf(telemetry, "status:ready,mode:%s,brightness:%d", gunMode.c_str(), ledBrightness);
    mythra.publishText("Telemetry", "data", telemetry);
    lastStatusUpdate = millis();
  }

  // Audio update
  if (wav && wav->isRunning())
  {
    wav->loop();
  }
  else if (isPlaying && wav && !wav->isRunning())
  {
    wav->stop();
    delete wav;
    wav = nullptr;
    delete file;
    file = nullptr;
    isPlaying = false;
    Serial.println("Playback finished");
  }

  // Check for trigger to fire (only if gun is enabled) - LOW when pressed due to pullup
  if (gunEnabled && digitalRead(TRIGGER) == LOW)
  {
    unsigned long now = millis();
    if (now - lastShotTime > SHOT_DELAY)
    {
      fireGun();
      lastShotTime = now;
    }
  }

  // Optional idle LED effect while waiting
  idleAnimation();
}

void fireGun()
{
  Serial.println("Firing gun...");

  // 1) Audio
  file = new AudioFileSourceLittleFS("/sound.wav");
  wav = new AudioGeneratorWAV();
  wav->begin(file, out);
  isPlaying = true;

  // 2) LED muzzle flash
  animateMuzzleFlash();

  // 3) Send IR
  Serial.printf("Sending IR code with address=0x%X\n", GUN_ADDRESS);
  IrSender.sendNEC(GUN_ADDRESS, 0x34, 0);

  // 4) Publish firing event to MQTT
  char telemetry[100];
  sprintf(telemetry, "fired:0x%X,time:%lu", GUN_ADDRESS, millis());
  mythra.publishText("Telemetry", "data", telemetry);
}

void animateMuzzleFlash()
{
  fill_solid(leds_E, NUM_LEDS, CRGB::White);
  FastLED.setBrightness(255);
  FastLED.show();
  delay(50);

  // Then fade out
  for (int b = 255; b >= 0; b -= 10)
  {
    FastLED.setBrightness(b);
    FastLED.show();
    delay(10);
  }
}

void idleAnimation()
{
  static int brightness = 0;
  static int fadeAmount = 5;

  brightness += fadeAmount;
  if (brightness <= 0 || brightness >= 255)
  {
    fadeAmount = -fadeAmount;
  }
  fill_solid(leds_E, NUM_LEDS, CRGB::Purple);
  FastLED.setBrightness(brightness);
  FastLED.show();
  delay(20);
}
