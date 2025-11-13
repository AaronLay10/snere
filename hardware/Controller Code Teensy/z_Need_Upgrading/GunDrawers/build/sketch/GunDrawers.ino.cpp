#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/GunDrawers/GunDrawers.ino"
#include <ParagonMQTT.h>

const char *deviceID = "GunDrawers";
const char *roomID = "Clockwork";

// Electromagnet pins
const int drawerElegant = 2;
const int drawerAlchemist = 3;
const int drawerBounty = 4;
const int drawerMechanic = 5;

#define POWERLED 13

#line 14 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/GunDrawers/GunDrawers.ino"
void setup();
#line 39 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/GunDrawers/GunDrawers.ino"
void loop();
#line 14 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/GunDrawers/GunDrawers.ino"
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

    networkSetup();
    mqttSetup();

    registerAction("releaseAllDrawers", [](const char *value)
                   { 
                       digitalWrite(drawerElegant, LOW);
                       digitalWrite(drawerAlchemist, LOW);
                       digitalWrite(drawerBounty, LOW);
                       digitalWrite(drawerMechanic, LOW); });
}

void loop()
{

    sendDataMQTT();
}

