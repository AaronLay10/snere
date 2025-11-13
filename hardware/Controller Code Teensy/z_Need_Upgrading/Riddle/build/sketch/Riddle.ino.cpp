#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
#include <ParagonMQTT.h>
#include <Adafruit_NeoPixel.h>
#include <IRremote.hpp>
#include <AccelStepper.h>

const char *deviceID = "Riddle";
const char *roomID = "Clockwork";
#define POWERLED 13

// LED and Sensor Definitions
#define LEDPIN 29
#define NUMLEDS 50
#define NUM_GUNS 4

// Knob Pins Definitions
#define A2 20
#define A3 19
#define B_1 2
#define B2 4
#define B3 5
#define B4 3
#define C1 16
#define C2 17
#define C3 18
#define C4 15
#define D1 40
#define D2 39
#define D3 37
#define D4 38
#define E1 1
#define E2 7
#define E3 0
#define E4 6
#define F1 35
#define F2 33
#define F3 34
#define F4 36
#define G1 22
#define G4 23

// Button Management
#define BUTTONONE 31
#define BUTTONTWO 30
#define BUTTONTHREE 32

#define SENSOR_UP_R 28
#define SENSOR_UP_L 8
#define SENSOR_DN_R 41
#define SENSOR_DN_L 21

#define PHOTOCELL A0
#define IRRECEIVER 43
#define MAGLOCK 42

bool moveUp;
bool moveDn;
bool endstopOneUp;
bool endstopOneDn;
bool endstopTwoUp;
bool endstopTwoDn;
int direction = 0;
int doorLocation = 0; // 1 = closed, 2 = open, 3 = between
int photoCell = 0;

// Knob LED Mappings
const int knobPinA2[] = {42, 41, 40, 39, 38, 37};
const int knobPinA3[] = {44, 45, 46, 47, 48, 49};
const int knobPinB1[] = {30, 29, 28, 27, 26};
const int knobPinB2[] = {32, 33, 34, 35, 36};
const int knobPinB3[] = {42};
const int knobPinB4[] = {44};
const int knobPinC1[] = {30, 45};
const int knobPinC2[] = {22, 23, 24, 25};
const int knobPinC3[] = {20, 19, 18, 17};
const int knobPinC4[] = {32, 41};
const int knobPinD1[] = {22, 29, 46};
const int knobPinD2[] = {12, 11, 10};
const int knobPinD3[] = {14, 15, 16};
const int knobPinD4[] = {20, 33, 40};
const int knobPinE1[] = {12, 23, 28, 47};
const int knobPinE2[] = {8, 9};
const int knobPinE3[] = {6, 5};
const int knobPinE4[] = {14, 19, 34, 39};
const int knobPinF1[] = {8, 11, 24, 27, 48};
const int knobPinF3[] = {2};
const int knobPinF4[] = {4};
const int knobPinF2[] = {6, 15, 18, 35, 38};
const int knobPinG1[] = {2, 9, 10, 25, 26, 49};
const int knobPinG4[] = {4, 5, 16, 17, 36, 37};

AccelStepper stepperOne(AccelStepper::FULL4WIRE, 24, 25, 26, 27);
AccelStepper stepperTwo(AccelStepper::FULL4WIRE, 9, 10, 11, 12);

int activeClue = 0;
int state = 0;
uint32_t receivedGunCode = 0; // Store the received gun code
const uint32_t GUN_IDS[] = {0x51, 0x4D5E6F, 0x789ABC, 0xDEF123};

// Motor control variables
bool motorsRunning = false;
bool motorSpeedSet = false;

// LED Strip Setup
Adafruit_NeoPixel strip = Adafruit_NeoPixel(NUMLEDS, LEDPIN, NEO_GRB + NEO_KHZ800);

bool button1;
bool button2;
bool button3;
int ledLetters[NUMLEDS];

enum state
{
  STARTUP,
  KNOBS,
  MOTORS,
  LEVER,
  GUNS,
  FINISHED
};

#line 121 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void setup();
#line 192 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void loop();
#line 227 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void stateChange(const char *value);
#line 234 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void motorMove(const char *value);
#line 276 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void leverMaglock(const char *value);
#line 298 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void buttonRiddle();
#line 327 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void handleKnobs();
#line 532 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void updateLEDs();
#line 565 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void readPhotoCell();
#line 571 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void processIR();
#line 625 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void checkMotors();
#line 644 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void runMotors();
#line 727 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void readSensors();
#line 121 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Riddle/Riddle.ino"
void setup()
{
  // Setup onboard LED for power status
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH);

  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(2000);

  IrReceiver.begin(IRRECEIVER, ENABLE_LED_FEEDBACK);

  // Initialize Ethernet and MQTT
  networkSetup();
  mqttSetup();

  // Register action handlers - Customize to fit your needs
  registerAction("state", stateChange);
  registerAction("door", motorMove);
  registerAction("maglock", leverMaglock);

  // Setup knob pins
  pinMode(A2, INPUT_PULLUP);
  pinMode(A3, INPUT_PULLUP);
  pinMode(B_1, INPUT_PULLUP);
  pinMode(B2, INPUT_PULLUP);
  pinMode(B3, INPUT_PULLUP);
  pinMode(B4, INPUT_PULLUP);
  pinMode(C1, INPUT_PULLUP);
  pinMode(C2, INPUT_PULLUP);
  pinMode(C3, INPUT_PULLUP);
  pinMode(C4, INPUT_PULLUP);
  pinMode(D1, INPUT_PULLUP);
  pinMode(D2, INPUT_PULLUP);
  pinMode(D3, INPUT_PULLUP);
  pinMode(D4, INPUT_PULLUP);
  pinMode(E1, INPUT_PULLUP);
  pinMode(E2, INPUT_PULLUP);
  pinMode(E3, INPUT_PULLUP);
  pinMode(E4, INPUT_PULLUP);
  pinMode(F1, INPUT_PULLUP);
  pinMode(F2, INPUT_PULLUP);
  pinMode(F3, INPUT_PULLUP);
  pinMode(F4, INPUT_PULLUP);
  pinMode(G1, INPUT_PULLUP);
  pinMode(G4, INPUT_PULLUP);

  // Setup switch pins
  pinMode(BUTTONONE, INPUT_PULLUP);
  pinMode(BUTTONTWO, INPUT_PULLUP);
  pinMode(BUTTONTHREE, INPUT_PULLUP);

  // Setup onboard LED
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH);

  pinMode(MAGLOCK, OUTPUT);
  digitalWrite(MAGLOCK, HIGH);

  // Initialize stepper motors
  stepperOne.setMaxSpeed(8000);    // Set to match target speed for smoother operation
  stepperOne.setAcceleration(800); // Reduced from 1000 for smoother acceleration
  stepperTwo.setMaxSpeed(8000);
  stepperTwo.setAcceleration(800);

  // Initialize NeoPixel strip
  strip.begin();
  strip.setBrightness(50);
  strip.show(); // Initialize all LEDs to 'off'
}

void loop()
{
  sendDataMQTT();
  readSensors();

  switch (state)
  {
  case STARTUP:
    // Do Nothing
    break;
  case KNOBS:
    buttonRiddle();
    handleKnobs();
    updateLEDs();
    break;
  case MOTORS:
    Serial.println("Case:Motors");
    Serial.println(direction);
    checkMotors();
    runMotors();
    break;
  case LEVER:
    // Process IR signals and unlock maglock for valid gun IDs
    processIR();
    break;
  case GUNS:
    // Guns Stuff
    break;
  case FINISHED:
    // Stand by
    break;
  }
}

// Example action handlers
void stateChange(const char *value)
{
  int action1Value = atoi(value);
  Serial.println("State Change Action Recieved");
  state = action1Value;
}

void motorMove(const char *value)
{
  Serial.println("Door Action Received");

  // Only accept new commands if motors aren't currently running
  if (motorsRunning)
  {
    Serial.println("Motors already running - ignoring command");
    return;
  }

  // Handle string commands
  if (strcmp(value, "lift") == 0)
  {
    direction = 1;
    Serial.println("Door command: LIFT");
  }
  else if (strcmp(value, "lower") == 0)
  {
    direction = -1;
    Serial.println("Door command: LOWER");
  }
  else if (strcmp(value, "stop") == 0)
  {
    // Emergency stop command
    stepperOne.stop();
    stepperTwo.stop();
    motorsRunning = false;
    motorSpeedSet = false;
    direction = 0;
    Serial.println("Door command: EMERGENCY STOP");
    return;
  }
  else
  {
    Serial.println("Invalid Door Command - use 'lift', 'lower', or 'stop'");
    return;
  }

  state = 2; // Switch to MOTORS state
}

void leverMaglock(const char *value)
{
  Serial.println("Maglock Action Received");
  Serial.print("maglockValue: ");
  Serial.println(value);

  if (strcmp(value, "open") == 0)
  {
    digitalWrite(MAGLOCK, LOW);
    Serial.println("Maglock OPEN (unlocked)");
  }
  else if (strcmp(value, "close") == 0)
  {
    digitalWrite(MAGLOCK, HIGH);
    Serial.println("Maglock CLOSE (locked)");
  }
  else
  {
    Serial.println("Invalid Maglock Command - use 'open' or 'close'");
  }
}

void buttonRiddle()
{
  static bool lastButton1 = HIGH;
  static bool lastButton2 = HIGH;
  static bool lastButton3 = HIGH;

  // Detect button press (transition from HIGH to LOW)
  if (button1 == LOW && lastButton1 == HIGH)
  {
    activeClue = 1;
    Serial.println("Button 1 pressed - Active Clue: 1");
  }
  else if (button2 == LOW && lastButton2 == HIGH)
  {
    activeClue = 2;
    Serial.println("Button 2 pressed - Active Clue: 2");
  }
  else if (button3 == LOW && lastButton3 == HIGH)
  {
    activeClue = 3;
    Serial.println("Button 3 pressed - Active Clue: 3");
  }

  // Store current states for next comparison
  lastButton1 = button1;
  lastButton2 = button2;
  lastButton3 = button3;
}

void handleKnobs()
{
  // Reset ledLetters array
  memset(ledLetters, 0, sizeof(ledLetters));

  // Handle Knob A2
  if (digitalRead(A2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinA2) / sizeof(knobPinA2[0]); i++)
    {
      ledLetters[knobPinA2[i]]++;
    }
  }

  if (digitalRead(A3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinA3) / sizeof(knobPinA3[0]); i++)
    {
      ledLetters[knobPinA3[i]]++;
    }
  }

  // Handle Knob B
  if (digitalRead(B_1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinB1) / sizeof(knobPinB1[0]); i++)
    {
      ledLetters[knobPinB1[i]]++;
    }
  }

  if (digitalRead(B2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinB2) / sizeof(knobPinB2[0]); i++)
    {
      ledLetters[knobPinB2[i]]++;
    }
  }

  if (digitalRead(B3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinB3) / sizeof(knobPinB3[0]); i++)
    {
      ledLetters[knobPinB3[i]]++;
    }
  }

  if (digitalRead(B4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinB4) / sizeof(knobPinB4[0]); i++)
    {
      ledLetters[knobPinB4[i]]++;
    }
  }

  // Handle Knob C
  if (digitalRead(C1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinC1) / sizeof(knobPinC1[0]); i++)
    {
      ledLetters[knobPinC1[i]]++;
    }
  }

  if (digitalRead(C2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinC2) / sizeof(knobPinC2[0]); i++)
    {
      ledLetters[knobPinC2[i]]++;
    }
  }

  if (digitalRead(C3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinC3) / sizeof(knobPinC3[0]); i++)
    {
      ledLetters[knobPinC3[i]]++;
    }
  }

  if (digitalRead(C4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinC4) / sizeof(knobPinC4[0]); i++)
    {
      ledLetters[knobPinC4[i]]++;
    }
  }

  // Handle Knob D
  if (digitalRead(D1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinD1) / sizeof(knobPinD1[0]); i++)
    {
      ledLetters[knobPinD1[i]]++;
    }
  }

  if (digitalRead(D2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinD2) / sizeof(knobPinD2[0]); i++)
    {
      ledLetters[knobPinD2[i]]++;
    }
  }

  if (digitalRead(D3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinD3) / sizeof(knobPinD3[0]); i++)
    {
      ledLetters[knobPinD3[i]]++;
    }
  }

  if (digitalRead(D4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinD4) / sizeof(knobPinD4[0]); i++)
    {
      ledLetters[knobPinD4[i]]++;
    }
  }

  // Handle Knob E
  if (digitalRead(E1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinE1) / sizeof(knobPinE1[0]); i++)
    {
      ledLetters[knobPinE1[i]]++;
    }
  }

  if (digitalRead(E2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinE2) / sizeof(knobPinE2[0]); i++)
    {
      ledLetters[knobPinE2[i]]++;
    }
  }

  if (digitalRead(E3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinE3) / sizeof(knobPinE3[0]); i++)
    {
      ledLetters[knobPinE3[i]]++;
    }
  }

  if (digitalRead(E4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinE4) / sizeof(knobPinE4[0]); i++)
    {
      ledLetters[knobPinE4[i]]++;
    }
  }

  // Handle Knob F
  if (digitalRead(F1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinF1) / sizeof(knobPinF1[0]); i++)
    {
      ledLetters[knobPinF1[i]]++;
    }
  }

  if (digitalRead(F2) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinF2) / sizeof(knobPinF2[0]); i++)
    {
      ledLetters[knobPinF2[i]]++;
    }
  }

  if (digitalRead(F3) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinF3) / sizeof(knobPinF3[0]); i++)
    {
      ledLetters[knobPinF3[i]]++;
    }
  }

  if (digitalRead(F4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinF4) / sizeof(knobPinF4[0]); i++)
    {
      ledLetters[knobPinF4[i]]++;
    }
  }

  // Handle Knob G
  if (digitalRead(G1) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinG1) / sizeof(knobPinG1[0]); i++)
    {
      ledLetters[knobPinG1[i]]++;
    }
  }

  if (digitalRead(G4) == HIGH)
  {
    for (size_t i = 0; i < sizeof(knobPinG4) / sizeof(knobPinG4[0]); i++)
    {
      ledLetters[knobPinG4[i]]++;
    }
  }
}

void updateLEDs()
{
  static int lastLedLetters[NUMLEDS] = {0}; // Track previous LED states
  bool hasChanged = false;

  // Check if any LED state has changed
  for (int i = 0; i < NUMLEDS; i++)
  {
    if (ledLetters[i] != lastLedLetters[i])
    {
      hasChanged = true;
      lastLedLetters[i] = ledLetters[i];
    }
  }

  // Only update LEDs if something changed
  if (hasChanged)
  {
    for (int i = 0; i < NUMLEDS; i++)
    {
      if (ledLetters[i] == 0)
      {
        strip.setPixelColor(i, 255, 0, 0);
      }
      else
      {
        strip.setPixelColor(i, 0, 0, 0);
      }
    }
    strip.show(); // Only call show() when there are actual changes
  }
}

void readPhotoCell()
{
  photoCell = analogRead(PHOTOCELL);
  Serial.printf("Photocell: %d\n", photoCell);
}

void processIR()
{
  if (IrReceiver.decode())
  {
    // Filter out weak signals and fragments (similar to IRSensor.ino)
    bool isWeakSignal = (IrReceiver.decodedIRData.protocol == UNKNOWN ||
                         IrReceiver.decodedIRData.protocol == 2); // PulseDistance is often fragments

    if (!isWeakSignal)
    {
      uint32_t receivedID = IrReceiver.decodedIRData.decodedRawData;
      Serial.printf("=== IR Signal Received ===\n");
      Serial.printf("Protocol ID: %d\n", IrReceiver.decodedIRData.protocol);
      Serial.printf("Address: 0x%X, Command: 0x%X\n",
                    IrReceiver.decodedIRData.address,
                    IrReceiver.decodedIRData.command);
      Serial.printf("Raw Data: 0x%lX\n", receivedID);

      // Match ID and trigger maglock action
      bool validGunFound = false;
      for (int i = 0; i < NUM_GUNS; i++)
      {
        if (receivedID == GUN_IDS[i])
        {
          Serial.printf("*** VALID GUN ID MATCHED: 0x%lX (Gun %d) ***\n", receivedID, i + 1);

          // Store the received gun code for publishDetail
          receivedGunCode = receivedID;

          // Unlock the maglock
          digitalWrite(MAGLOCK, LOW);
          Serial.println("MAGLOCK UNLOCKED!");

          validGunFound = true;
          break;
        }
      }

      if (!validGunFound)
      {
        Serial.printf("Unknown Gun ID: 0x%lX\n", receivedID);
      }

      Serial.println("========================\n");
    }
    else
    {
      Serial.printf("FILTERED: Weak/Fragment signal (Protocol ID: %d)\n", IrReceiver.decodedIRData.protocol);
    }

    IrReceiver.resume(); // Prepare for the next signal
  }
}

void checkMotors()
{
  if (endstopOneUp == false && endstopOneDn == false && endstopTwoUp == false && endstopTwoDn == false)
  {
    Serial.println("Door Location is somewhere in between.");
    doorLocation = 3;
  }
  else if (endstopOneDn == true || endstopTwoDn == true)
  {
    Serial.println("Door is Closed.");
    doorLocation = 1;
  }
  else if (endstopOneUp == true || endstopTwoUp == true)
  {
    Serial.println("Door is Open.");
    doorLocation = 2;
  }
}

void runMotors()
{
  // Start motor movement if not already running and direction is set
  if (direction != 0 && !motorsRunning)
  {
    if (direction == 1 && !endstopOneUp && !endstopTwoUp) // Move Up
    {
      motorsRunning = true;
      motorSpeedSet = false; // Reset speed flag so it gets set on first loop
      Serial.println("Starting motor movement UP - will run until sensor triggered");
    }
    else if (direction == -1 && !endstopOneDn && !endstopTwoDn) // Move Down
    {
      motorsRunning = true;
      motorSpeedSet = false; // Reset speed flag so it gets set on first loop
      Serial.println("Starting motor movement DOWN - will run until sensor triggered");
    }
    else
    {
      direction = 0; // Invalid direction or already at limit
      Serial.println("Cannot move - at limit switch or invalid direction");
    }
  }

  // Continue running motors if they're moving
  if (motorsRunning)
  {
    // Check for endstop hits first - stop immediately if sensor triggered
    if (direction == 1 && (endstopOneUp || endstopTwoUp))
    {
      stepperOne.stop();
      stepperTwo.stop();
      motorsRunning = false;
      motorSpeedSet = false;
      direction = 0;
      Serial.println("Motors stopped - reached UP endstop sensor");
    }
    else if (direction == -1 && (endstopOneDn || endstopTwoDn))
    {
      stepperOne.stop();
      stepperTwo.stop();
      motorsRunning = false;
      motorSpeedSet = false;
      direction = 0;
      Serial.println("Motors stopped - reached DOWN endstop sensor");
    }
    else
    {
      // Set speed only once when starting movement to prevent stuttering
      if (!motorSpeedSet)
      {
        if (direction == 1)
        {
          stepperOne.setSpeed(1000); // Even slower for maximum smoothness
          stepperTwo.setSpeed(1000);
        }
        else if (direction == -1)
        {
          stepperOne.setSpeed(-1000); // Even slower for maximum smoothness
          stepperTwo.setSpeed(-1000);
        }
        motorSpeedSet = true;
        Serial.println("Motor speed set once - smooth motion starting");
      }

      // Just run at the already-set speed
      stepperOne.runSpeed();
      stepperTwo.runSpeed();
    }

    // Debug output (less frequent than before)
    static unsigned long lastDebugTime = 0;
    if (millis() - lastDebugTime > 500) // Print debug every 500ms instead of every loop
    {
      Serial.printf("Moving %s - Sensors UP:%d:%d DN:%d:%d\n",
                    (direction == 1) ? "UP" : "DOWN",
                    digitalRead(SENSOR_UP_R), digitalRead(SENSOR_UP_L),
                    digitalRead(SENSOR_DN_R), digitalRead(SENSOR_DN_L));
      lastDebugTime = millis();
    }
  }
}

void readSensors()
{

  // Read switches
  button1 = digitalRead(BUTTONONE);
  button2 = digitalRead(BUTTONTWO);
  button3 = digitalRead(BUTTONTHREE);

  endstopOneUp = digitalRead(SENSOR_UP_R);
  endstopOneDn = digitalRead(SENSOR_DN_R);
  endstopTwoUp = digitalRead(SENSOR_UP_L);
  endstopTwoDn = digitalRead(SENSOR_DN_L);

  // Format publishDetail based on current state
  switch (state)
  {
  case STARTUP:
    sprintf(publishDetail, "State:%01X,Ready", state);
    break;

  case KNOBS:
    sprintf(publishDetail, "%01X,%01X:%01X:%01X,%01X:%01X,%01X:%01X:%01X:%01X,%01X:%01X:%01X:%01X,%01X:%01X:%01X:%01X,%01X:%01X:%01X:%01X,%01X:%01X:%01X:%01X,%01X:%01X,%01X",
            state,
            (activeClue == 1 ? 0 : 1), (activeClue == 2 ? 0 : 1), (activeClue == 3 ? 0 : 1), // Latched button states
            digitalRead(A2), digitalRead(A3),
            digitalRead(B_1), digitalRead(B2), digitalRead(B3), digitalRead(B4),
            digitalRead(C1), digitalRead(C2), digitalRead(C3), digitalRead(C4),
            digitalRead(D1), digitalRead(D2), digitalRead(D3), digitalRead(D4),
            digitalRead(E1), digitalRead(E2), digitalRead(E3), digitalRead(E4),
            digitalRead(F1), digitalRead(F2), digitalRead(F3), digitalRead(F4),
            digitalRead(G1), digitalRead(G4),
            activeClue);
    break;

  case MOTORS:
    sprintf(publishDetail, "State:%01X,Direction:%d,Running:%d,Sensors_UP:%01X:%01X,Sensors_DN:%01X:%01X,DoorLoc:%d",
            state, direction, motorsRunning ? 1 : 0,
            digitalRead(SENSOR_UP_R), digitalRead(SENSOR_UP_L),
            digitalRead(SENSOR_DN_R), digitalRead(SENSOR_DN_L),
            doorLocation);
    break;

  case LEVER:
    sprintf(publishDetail, "State:%01X,Photocell:%d,GunCode:0x%lX,MagLock:%01X",
            state, analogRead(PHOTOCELL), receivedGunCode, digitalRead(MAGLOCK));
    break;

  case GUNS:
    sprintf(publishDetail, "State:%01X,GunCode:0x%lX", state, receivedGunCode);
    break;

  case FINISHED:
    sprintf(publishDetail, "State:%01X,Complete", state);
    break;

  default:
    sprintf(publishDetail, "State:%01X,Unknown", state);
    break;
  }
}
