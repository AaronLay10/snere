#include <Adafruit_NeoPixel.h>
#include <MythraOS_MQTT.h>

#define NUM_STRIPS 32
#define NUM_LEDS_PER_STRIP 12
#define POWER_LED 13

// Create Adafruit_NeoPixel objects for each strip with your pin assignments
Adafruit_NeoPixel strips[NUM_STRIPS] = {
    // Strips 0-7 (Vincent's TV): Pins 0-7
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 0, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 1, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 2, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 3, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 4, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 5, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 6, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 7, NEO_GRB + NEO_KHZ800),

    // Strips 8-15 (Edith's TV): Pins 16-23
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 16, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 17, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 18, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 19, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 20, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 21, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 22, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 23, NEO_GRB + NEO_KHZ800),

    // Strips 16-23 (Maks' TV): Pins 25-32
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 25, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 26, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 27, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 28, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 29, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 30, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 31, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 32, NEO_GRB + NEO_KHZ800),

    // Strips 24-31 (Oliver's TV): Pins 14,15,8,9,10,11,12,24
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 14, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 15, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 8, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 9, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 10, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 11, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 12, NEO_GRB + NEO_KHZ800),
    Adafruit_NeoPixel(NUM_LEDS_PER_STRIP, 24, NEO_GRB + NEO_KHZ800)};

// TV definitions
#define STRIPS_PER_TV 8
const char *tvNames[4] = {"Vincent", "Edith", "Maks", "Oliver"};

// TV colors: Red, Green, Blue values (0-255)
struct TVColor
{
  uint8_t r, g, b;
};

TVColor tvColors[4] = {
    {218, 190, 0}, // Vincent - Mustard Yellow
    {70, 0, 150},  // Edith - Dark Lavender
    {20, 91, 0},   // Maks - Forest Green
    {10, 10, 100}  // Oliver - Greyish Blue
};

// Power state variable
bool ledsOn = true;

// MythraOS MQTT Configuration
MythraOSMQTTConfig makeConfig()
{
  MythraOSMQTTConfig cfg;
  cfg.brokerHost = "192.168.20.3";
  cfg.brokerPort = 1883;
  cfg.namespaceId = "paragon";
  cfg.roomId = "Clockwork";
  cfg.puzzleId = nullptr;
  cfg.deviceId = "PictureFrameLEDs";
  cfg.heartbeatIntervalMs = 5000;
  cfg.autoHeartbeat = true;
  return cfg;
}

MythraOSMQTT mqtt(makeConfig());

// Forward declarations
void handleCommand(const char *command, const JsonDocument &payload, void *context);
void turnOffAllLEDs();
void flickerAllTVs();
bool buildHeartbeat(JsonDocument &doc, void *context);

void setup()
{
  Serial.begin(115200);
  Serial.println("Picture Frame LEDs System Starting Up...");
  Serial.println("============================================");

  // Initialize all NeoPixel strips
  for (int i = 0; i < NUM_STRIPS; i++)
  {
    strips[i].begin();
    strips[i].setBrightness(10); // Set brightness (0-255)
    strips[i].clear();           // Turn off all LEDs
  }

  pinMode(POWER_LED, OUTPUT);
  digitalWrite(POWER_LED, HIGH);

  // Initialize MythraOS MQTT
  if (!mqtt.begin())
  {
    Serial.println("Failed to start MythraOS MQTT");
    return;
  }

  // Register command callback and heartbeat builder
  mqtt.setCommandCallback(handleCommand);
  mqtt.setHeartbeatBuilder(buildHeartbeat);

  Serial.println("Setup complete!");
  Serial.println("Starting TV identification sequence...");
}

void loop()
{
  static bool initialized = false;

  if (!initialized)
  {
    Serial.println("Starting flickering LED display...");
    Serial.println("Vincent=MUSTARD YELLOW, Edith=DARK LAVENDER, Maks=FOREST GREEN, Oliver=GREYISH BLUE");
    Serial.println("MQTT Commands: Send 'power' command with value 'off' to turn off LEDs, 'on' to turn on LEDs");
    initialized = true;
  }

  // Handle MQTT messages
  mqtt.loop();

  // Apply flickering effect to all TVs only if LEDs are on
  if (ledsOn)
  {
    flickerAllTVs();
  }

  // Small delay to control flicker speed
  delay(50);
}

void handleCommand(const char *command, const JsonDocument &payload, void *context)
{
  Serial.print("Received command: ");
  Serial.println(command);

  // Extract the value from the JSON payload
  const char *value = nullptr;
  if (payload.containsKey("value"))
  {
    value = payload["value"];
  }
  else if (payload.is<const char *>())
  {
    value = payload.as<const char *>();
  }

  if (strcmp(command, "power") == 0 && value != nullptr)
  {
    Serial.print("Power command value: ");
    Serial.println(value);

    if (strcmp(value, "off") == 0)
    {
      ledsOn = false;
      turnOffAllLEDs();
      Serial.println("LEDs turned OFF via MQTT");
      mqtt.publishState("off");
    }
    else if (strcmp(value, "on") == 0)
    {
      ledsOn = true;
      Serial.println("LEDs turned ON via MQTT - resuming flicker effect");
      mqtt.publishState("on");
    }
    else
    {
      Serial.print("Unknown power value: ");
      Serial.println(value);
    }
  }
  else
  {
    Serial.print("Unknown command: ");
    Serial.println(command);
  }
}

bool buildHeartbeat(JsonDocument &doc, void *context)
{
  doc["ledsOn"] = ledsOn;
  doc["numStrips"] = NUM_STRIPS;
  doc["ledsPerStrip"] = NUM_LEDS_PER_STRIP;
  doc["firmware"] = "PictureFrameLEDs";
  return true;
}

void turnOffAllLEDs()
{
  for (int i = 0; i < NUM_STRIPS; i++)
  {
    strips[i].clear();
    strips[i].show();
  }
}

void flickerAllTVs()
{
  for (int tv = 0; tv < 4; tv++)
  {
    for (int stripInTV = 0; stripInTV < STRIPS_PER_TV; stripInTV++)
    {
      int stripIndex = tv * STRIPS_PER_TV + stripInTV;

      for (int led = 0; led < NUM_LEDS_PER_STRIP; led++)
      {
        // Random flicker: 90% chance to show normal color, 10% chance for variation
        if (random(100) < 90)
        {
          // Normal color with slight random brightness variation (80-100%)
          float brightness = random(80, 101) / 100.0;
          strips[stripIndex].setPixelColor(led,
                                           strips[stripIndex].Color(
                                               tvColors[tv].r * brightness,
                                               tvColors[tv].g * brightness,
                                               tvColors[tv].b * brightness));
        }
        else
        {
          // Occasional flicker: dim the LED significantly or turn it off briefly
          if (random(100) < 50)
          {
            // Dim flicker (20-40% brightness)
            float dimness = random(20, 41) / 100.0;
            strips[stripIndex].setPixelColor(led,
                                             strips[stripIndex].Color(
                                                 tvColors[tv].r * dimness,
                                                 tvColors[tv].g * dimness,
                                                 tvColors[tv].b * dimness));
          }
          else
          {
            // Brief off flicker
            strips[stripIndex].setPixelColor(led, strips[stripIndex].Color(0, 0, 0));
          }
        }
      }
      strips[stripIndex].show();
    }
  }
}
