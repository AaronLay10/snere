#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmCageB/LabRmCageB.ino"
// Lab Mechanical SubPanel
// The Cage Teensy B

#include <ParagonMQTT.h>
#include <AccelStepper.h>

const char *deviceID = "LabRmCageB";
const char *roomID = "Clockwork";
const byte POWERLED = 13;

// Door Three
const byte D3SENSOROPEN_A = 11;
const byte D3SENSOROPEN_B = 9;
const byte D3SENSORCLOSED_A = 10;
const byte D3SENSORCLOSED_B = 8;
const byte D3ENABLE = 35;
int D3OpenA = 0;
int D3OpenB = 0;
int D3ClosedA = 0;
int D3ClosedB = 0;

int D3Direction = 0;
// Pul+, Pul-, Dir+, Dir-
AccelStepper D3stepperOne(AccelStepper::FULL4WIRE, 24, 25, 26, 27);
AccelStepper D3stepperTwo(AccelStepper::FULL4WIRE, 28, 29, 30, 31);

unsigned long lastStatusTime = 0;
const unsigned long statusInterval = 5000; // ms

// Door Four
const byte D4SENSOROPEN_A = 0;
const byte D4SENSOROPEN_B = 1;
const byte D4SENSORCLOSED_A = 2;
const byte D4SENSORCLOSED_B = 3;
const byte D4ENABLE = 36;
int D4OpenA = 0;
int D4OpenB = 0;
int D4ClosedA = 0;
int D4ClosedB = 0;
int D4Direction = 0;
// Pul+, Pul-, Dir+, Dir-
AccelStepper D4stepperOne(AccelStepper::FULL4WIRE, 4, 5, 6, 7);

// Door Five
const byte D5SENSOROPEN_A = 23;
const byte D5SENSOROPEN_B = 21;
const byte D5SENSORCLOSED_A = 22;
const byte D5SENSORCLOSED_B = 20;
const byte D5ENABLE = 36;
int D5OpenA = 0;
int D5OpenB = 0;
int D5ClosedA = 0;
int D5ClosedB = 0;
int D5Direction = 0;
// Pul+, Pul-, Dir+, Dir-
AccelStepper D5stepperOne(AccelStepper::FULL4WIRE, 16, 17, 18, 19);
AccelStepper D5stepperTwo(AccelStepper::FULL4WIRE, 38, 39, 40, 41);

char sensors[50];
String readString;

#line 62 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmCageB/LabRmCageB.ino"
void setup();
#line 110 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmCageB/LabRmCageB.ino"
void loop();
#line 191 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmCageB/LabRmCageB.ino"
void cageDoors(const char *value);
#line 62 "/Users/aaron/Documents/ParagonEscape/Clockwork/Systems/LabRmCageB/LabRmCageB.ino"
void setup()
{
  Serial.begin(115200);
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH); // Power LED ON

  // Door 3
  pinMode(D3SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D3SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D3SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D3SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D3ENABLE, OUTPUT);
  digitalWrite(D3ENABLE, HIGH);

  // Door 4
  pinMode(D4SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D4SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D4SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D4SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D4ENABLE, OUTPUT);
  digitalWrite(D4ENABLE, HIGH);

  // Door 5
  pinMode(D5SENSOROPEN_A, INPUT_PULLDOWN);
  pinMode(D5SENSOROPEN_B, INPUT_PULLDOWN);
  pinMode(D5SENSORCLOSED_A, INPUT_PULLDOWN);
  pinMode(D5SENSORCLOSED_B, INPUT_PULLDOWN);
  pinMode(D5ENABLE, OUTPUT);
  digitalWrite(D5ENABLE, HIGH);

  registerAction("cageDoors", cageDoors);

  networkSetup();
  mqttSetup();
  delay(2000);

  D3stepperOne.setMaxSpeed(250);
  D3stepperOne.setAcceleration(200);
  D3stepperTwo.setMaxSpeed(250);
  D3stepperTwo.setAcceleration(200);
  D4stepperOne.setMaxSpeed(250);
  D4stepperOne.setAcceleration(200);
  D5stepperOne.setMaxSpeed(250);
  D5stepperOne.setAcceleration(200);
  D5stepperTwo.setMaxSpeed(250);
  D5stepperTwo.setAcceleration(200);
}

void loop()
{
  sendDataMQTT();

  // Door 3
  D3OpenA = digitalRead(D3SENSOROPEN_A);
  D3OpenB = digitalRead(D3SENSOROPEN_B);
  D3ClosedA = digitalRead(D3SENSORCLOSED_A);
  D3ClosedB = digitalRead(D3SENSORCLOSED_B);

  // Door 4
  D4OpenA = digitalRead(D4SENSOROPEN_A);
  D4OpenB = digitalRead(D4SENSOROPEN_B);
  D4ClosedA = digitalRead(D4SENSORCLOSED_A);
  D4ClosedB = digitalRead(D4SENSORCLOSED_B);

  // Door 5
  D5OpenA = digitalRead(D5SENSOROPEN_A);
  D5OpenB = digitalRead(D5SENSOROPEN_B);
  D5ClosedA = digitalRead(D5SENSORCLOSED_A);
  D5ClosedB = digitalRead(D5SENSORCLOSED_B);

  // Set speeds based on direction and sensors
  // Door 3
  if (D3Direction == 1 && D3OpenA != 0 && D3OpenB != 0)
  {
    D3stepperOne.setSpeed(-250);
    D3stepperTwo.setSpeed(-250);
  }
  else if (D3Direction == 2 && D3ClosedA != 0 && D3ClosedB != 0)
  {
    D3stepperOne.setSpeed(250);
    D3stepperTwo.setSpeed(250);
  }
  else
  {
    D3stepperOne.setSpeed(0);
    D3stepperTwo.setSpeed(0);
  }

  // Door 4
  if (D4Direction == 1 && D4OpenA != 0 && D4OpenB != 0)
  {
    D4stepperOne.setSpeed(250);
  }
  else if (D4Direction == 2 && D4ClosedA != 0 && D4ClosedB != 0)
  {
    D4stepperOne.setSpeed(-250);
  }
  else
  {
    D4stepperOne.setSpeed(0);
  }

  // Door 5
  if (D5Direction == 1 && D5OpenA != 0 && D5OpenB != 0)
  {
    D5stepperOne.setSpeed(250);
    D5stepperTwo.setSpeed(250);
  }
  else if (D5Direction == 2 && D5ClosedA != 0 && D5ClosedB != 0)
  {
    D5stepperOne.setSpeed(-250);
    D5stepperTwo.setSpeed(-250);
  }
  else
  {
    D5stepperOne.setSpeed(0);
    D5stepperTwo.setSpeed(0);
  }

  // Always run steppers for smooth motion
  D3stepperOne.runSpeed();
  D3stepperTwo.runSpeed();
  D4stepperOne.runSpeed();
  D5stepperOne.runSpeed();
  D5stepperTwo.runSpeed();

  sprintf(publishDetail, "%d,%d,%d,%d -- %d,%d,%d,%d -- %d,%d,%d,%d", D3OpenA, D3OpenB, D3ClosedA, D3ClosedB, D4OpenA, D4OpenB, D4ClosedA, D4ClosedB, D5OpenA, D5OpenB, D5ClosedA, D5ClosedB);
}

void cageDoors(const char *value)
{
  Serial.println("cageDoors Function");
  Serial.print("cageDoorValue: ");
  Serial.println(value);

  if (strcmp(value, "open") == 0)
  {
    D3Direction = 1; // Set Door 3 direction to open
    D4Direction = 1; // Set Door 4 direction to open
    D5Direction = 1; // Set Door 5 direction to open
    Serial.println("Opening Doors");
  }
  else if (strcmp(value, "close") == 0)
  {
    D3Direction = 2; // Set Door 3 direction to close
    D4Direction = 2; // Set Door 4 direction to close
    D5Direction = 2; // Set Door 5 direction to close
    Serial.println("Closing Doors");
  }
  else
  {
    Serial.println("Invalid Command - use 'open' or 'close'");
  }
}

