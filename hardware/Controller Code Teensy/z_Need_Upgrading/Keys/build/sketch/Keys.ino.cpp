#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Keys/Keys.ino"
#include <ParagonMQTT.h>
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

const char *deviceID = "Keys"; // e.g., can be used in MQTT topics
const char *roomID = "Clockwork";

CRGB leds[NUM_LEDS];

#line 25 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Keys/Keys.ino"
void setup();
#line 49 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Keys/Keys.ino"
void loop();
#line 25 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Keys/Keys.ino"
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

    networkSetup();
    mqttSetup();
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

    sprintf(publishDetail, "%d:%d:%d:%d", GreenPair, YellowPair, BluePair, RedPair);

    Serial.println(publishDetail);

    sendDataMQTT();
}
