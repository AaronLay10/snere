#include <MythraOS_MQTT.h>
#include <FastLED.h>

#define LED_PIN 2
#define NUM_LEDS 4
#define BRIGHTNESS 255
#define LED_TYPE WS2812B
#define COLOR_ORDER RGB
#define POWERLED 13

const int GrnBot = 3;
const int GrnRight = 4;
const int YlwRight = 5;
const int YlwTop = 6;
const int BluLeft = 7;
const int BluBot = 8;
const int RedLeft = 9;
const int RedBot = 10;

#define DEVICE_ID "Keys"
#define DEVICE_FRIENDLY_NAME "Keys Puzzle"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Keys"

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

CRGB leds[NUM_LEDS];

// Telemetry change detection
char lastTelemetry[64] = "";
bool telemetryInitialized = false;

void setup()
{
    Serial.begin(115200); // Initialize serial communication
    pinMode(GrnBot, INPUT_PULLUP);
    pinMode(GrnRight, INPUT_PULLUP);
    pinMode(YlwRight, INPUT_PULLUP);
    pinMode(YlwTop, INPUT_PULLUP);
    pinMode(BluLeft, INPUT_PULLUP);
    pinMode(BluBot, INPUT_PULLUP);
    pinMode(RedLeft, INPUT_PULLUP);
    pinMode(RedBot, INPUT_PULLUP);
    pinMode(POWERLED, OUTPUT);
    digitalWrite(POWERLED, HIGH); // Turn on power LED

    FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
    FastLED.setBrightness(BRIGHTNESS);

    fill_solid(leds, NUM_LEDS, CRGB(136, 99, 8));
    FastLED.show();

    mythra.begin();
}

void loop()
{
    // Read individual button states (inverted: LOW = active = 1)
    int GrnBotState = digitalRead(GrnBot) == LOW ? 1 : 0;
    int GrnRightState = digitalRead(GrnRight) == LOW ? 1 : 0;
    int YlwRightState = digitalRead(YlwRight) == LOW ? 1 : 0;
    int YlwTopState = digitalRead(YlwTop) == LOW ? 1 : 0;
    int BluLeftState = digitalRead(BluLeft) == LOW ? 1 : 0;
    int BluBotState = digitalRead(BluBot) == LOW ? 1 : 0;
    int RedLeftState = digitalRead(RedLeft) == LOW ? 1 : 0;
    int RedBotState = digitalRead(RedBot) == LOW ? 1 : 0;

    // Check if both buttons of each color are pressed
    int GreenPair = (GrnBotState && GrnRightState) ? 1 : 0;
    int YellowPair = (YlwRightState && YlwTopState) ? 1 : 0;
    int BluePair = (BluLeftState && BluBotState) ? 1 : 0;
    int RedPair = (RedLeftState && RedBotState) ? 1 : 0;

    char telemetryData[64];
    sprintf(telemetryData, "%d:%d:%d:%d", GreenPair, YellowPair, BluePair, RedPair);

    // CHANGE DETECTION: Only publish if data has changed and MQTT is connected
    bool dataChanged = (!telemetryInitialized) || (strcmp(telemetryData, lastTelemetry) != 0);

    if (dataChanged && mythra.isConnected())
    {
        Serial.print("[PUBLISHING] ");
        Serial.println(telemetryData);
        mythra.publishText("Telemetry", "data", telemetryData);
        strcpy(lastTelemetry, telemetryData);
        telemetryInitialized = true;
    }

    mythra.loop();
}
