#include <MythraOS_MQTT.h>

#define DEVICE_ID "GunDrawers"
#define DEVICE_FRIENDLY_NAME "Gun Drawers"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "GunDrawers"

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

// Electromagnet pins
const int drawerElegant = 2;
const int drawerAlchemist = 3;
const int drawerBounty = 4;
const int drawerMechanic = 5;

#define POWERLED 13

void setup()
{
    Serial.begin(115200);
    pinMode(POWERLED, OUTPUT);
    pinMode(drawerElegant, OUTPUT);
    pinMode(drawerAlchemist, OUTPUT);
    pinMode(drawerBounty, OUTPUT);
    pinMode(drawerMechanic, OUTPUT);
    digitalWrite(POWERLED, HIGH);
    digitalWrite(drawerElegant, HIGH);
    digitalWrite(drawerAlchemist, HIGH);
    digitalWrite(drawerBounty, HIGH);
    digitalWrite(drawerMechanic, HIGH);

    // Initialize MythraOS
    mythra.begin();

    mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
        if (strcmp(command, "releaseAllDrawers") == 0 && payload.is<const char*>()) {
            digitalWrite(drawerElegant, LOW);
            digitalWrite(drawerAlchemist, LOW);
            digitalWrite(drawerBounty, LOW);
            digitalWrite(drawerMechanic, LOW);
        }
    });
}

void loop()
{
    mythra.loop();
}
