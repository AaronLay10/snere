#include <PWMServo.h>
#include <MythraOS_MQTT.h>

#define ROOM_ID "Clockwork"
#define PUZZLE_ID nullptr
#define DEVICE_ID "MaksServo"
#define DEVICE_FRIENDLY_NAME "Maks Servo Controller"

PWMServo myservo; // create servo object to control a servo

const int POWERLED = 13;

const int SERVOPIN = 1;
int pos = 0;                          // variable to store the servo position
const int OPEN_POSITION = 60;         // degrees for open position
const int CLOSED_POSITION = 0;        // degrees for closed position
int targetPosition = CLOSED_POSITION; // current target position

// MythraOS MQTT Configuration
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

// Forward declarations
void handleCommand(const char *command, const JsonDocument &payload, void *context);
bool buildHeartbeat(JsonDocument &doc, void *context);

void setup()
{
    Serial.begin(115200);

    pinMode(POWERLED, OUTPUT);
    digitalWrite(POWERLED, HIGH);

    myservo.attach(SERVOPIN); // attaches the servo on pin 1 to the servo object
                              // myservo.attach(SERVO_PIN_A, 1000, 2000); // some motors need min/max setting

    // Initialize MythraOS MQTT
    if (!mythra.begin()) {
        Serial.println(F("Failed to initialize MythraOS MQTT"));
        while (1) {
            digitalWrite(POWERLED, !digitalRead(POWERLED));
            delay(500);
        }
    }

    // Register callbacks
    mythra.setCommandCallback(handleCommand);
    mythra.setHeartbeatBuilder(buildHeartbeat);

    Serial.println("Servo MQTT Controller Ready (MythraOS_MQTT)");
}

void loop()
{
    // Handle MQTT communication
    mythra.loop();

    // Move to target position if different from current
    if (pos != targetPosition)
    {
        pos = targetPosition;
        myservo.write(pos);

        // Report position change via MQTT
        DynamicJsonDocument doc(256);
        doc["position"] = pos;
        doc["timestamp"] = millis() / 1000;
        mythra.publishState("moving", doc);

        Serial.print("Servo moved to: ");
        Serial.println(pos);
    }

    delay(100); // Small delay between checks
}

// MQTT Command Handler
void handleCommand(const char *command, const JsonDocument &payload, void *context)
{
    Serial.print("Command received: ");
    Serial.println(command);

    if (strcmp(command, "open") == 0) {
        targetPosition = OPEN_POSITION;

        DynamicJsonDocument doc(256);
        doc["position"] = OPEN_POSITION;
        doc["timestamp"] = millis() / 1000;
        mythra.publishEvent("open_ack", doc);

        Serial.println("Opening servo");
    }
    else if (strcmp(command, "close") == 0) {
        targetPosition = CLOSED_POSITION;

        DynamicJsonDocument doc(256);
        doc["position"] = CLOSED_POSITION;
        doc["timestamp"] = millis() / 1000;
        mythra.publishEvent("close_ack", doc);

        Serial.println("Closing servo");
    }
    else {
        Serial.print("Unknown command: ");
        Serial.println(command);
    }
}

// Heartbeat Builder
bool buildHeartbeat(JsonDocument &doc, void *context)
{
    doc["position"] = pos;
    doc["targetPosition"] = targetPosition;
    doc["firmware"] = "MaksServo_v2";
    doc["uptimeMs"] = millis();
    return true;
}
