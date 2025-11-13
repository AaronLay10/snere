#include <MythraOS_MQTT.h>

// ------------------- CONSTANTS & VARIABLES -------------------
#define DEVICE_ID "Kraken" // e.g., can be used in MQTT topics
#define DEVICE_FRIENDLY_NAME "Kraken Puzzle"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Kraken"

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

#define POWERLED 13

// Throttle Handle
#define FWD1 6
#define FWD2 7
#define FWD3 5
#define NEUTRAL 2
#define REV1 3
#define REV2 4
#define REV3 1

// Capitan Wheel
#define WHEELA 8 // White Wire
#define WHEELB 9 // Green Wire

// This variable will increase or decrease depending on the rotation of encoder
volatile long x, counterA = 0;
volatile long y, counterB = 0;

String sensorDetail;
String direction;

int readingA = 0;
int readingB = 0;
int moveValue = 0;
int throttle = 0;

// Telemetry change detection
char lastTelemetry[32] = "";
bool telemetryInitialized = false;

void setup()
{
    Serial.begin(9600);
    pinMode(WHEELB, INPUT_PULLUP);
    pinMode(WHEELA, INPUT_PULLUP);
    pinMode(FWD1, INPUT_PULLUP);
    pinMode(FWD2, INPUT_PULLUP);
    pinMode(FWD3, INPUT_PULLUP);
    pinMode(NEUTRAL, INPUT_PULLUP);
    pinMode(REV1, INPUT_PULLUP);
    pinMode(REV2, INPUT_PULLUP);
    pinMode(REV3, INPUT_PULLUP);

    pinMode(POWERLED, OUTPUT);

    attachInterrupt(WHEELB, CounterA, RISING); // Green Wire
    attachInterrupt(WHEELA, CounterB, RISING); // White Wire

    digitalWrite(POWERLED, HIGH);

    // Setup Ethernet & MQTT (from MythraOS_MQTT library)
    mythra.begin();

    // Register MQTT action handlers
    mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
      if (strcmp(command, "resetCounter") == 0 && payload.is<const char*>()) {
        resetCounterHandler(payload.as<const char*>());
      }
    });
}

void loop()
{
    Serial.print(counterA);
    Serial.print(":");
    Serial.print(digitalRead(FWD1));
    Serial.print(":");
    Serial.print(digitalRead(FWD2));
    Serial.print(":");
    Serial.print(digitalRead(FWD3));
    Serial.print(":");
    Serial.print(digitalRead(NEUTRAL));
    Serial.print(":");
    Serial.print(digitalRead(REV1));
    Serial.print(":");
    Serial.print(digitalRead(REV2));
    Serial.print(":");
    Serial.println(digitalRead(REV3));

    if (digitalRead(NEUTRAL) == LOW)
    {
        throttle = 0;
    }
    else if (digitalRead(FWD1) == LOW)
    {
        throttle = 1;
    }
    else if (digitalRead(FWD2) == LOW)
    {
        throttle = 2;
    }
    else if (digitalRead(FWD3) == LOW)
    {
        throttle = 3;
    }
    else if (digitalRead(REV1) == LOW)
    {
        throttle = -1;
    }
    else if (digitalRead(REV2) == LOW)
    {
        throttle = -2;
    }
    else if (digitalRead(REV3) == LOW)
    {
        throttle = -3;
    }

    // Send telemetry with current sensor readings
    char telemetryData[32];
    sprintf(telemetryData, "%ld:%d", counterA, throttle);

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

    // mythra.loop() maintains MQTT connection
    mythra.loop();
}

void CounterA()
{
    if (digitalRead(WHEELA) == LOW)
    {
        counterA++;
    }
    else
    {
        counterA--;
    }
}

void CounterB()
{
    if (digitalRead(WHEELB) == LOW)
    {
        counterA--;
    }
    else
    {
        counterA++;
    }
}

// ------------------- ACTION HANDLERS -------------------
void resetCounterHandler(const char *value)
{
    Serial.print("Reset counter command received: ");
    Serial.println(value);

    counterA = 0;
    counterB = 0;

    Serial.println("Wheel counter reset to 0");
}
