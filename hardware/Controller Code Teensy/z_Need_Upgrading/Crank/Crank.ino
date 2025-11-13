#include <MythraOS_MQTT.h>

#define POWERLED 13

#define DEVICE_ID "Crank"
#define DEVICE_FRIENDLY_NAME "Crank Puzzle"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Crank"

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

// This variable will increase or decrease depending on the rotation of encoder
volatile long x, counterA = 0;
volatile long y, counterB = 0;

#define ENCODER_A_WHITE 33
#define ENCODER_A_GREEN 34
#define ENCODER_B_WHITE 35
#define ENCODER_B_GREEN 36

long previousMillisMqtt = 0;
int state = 0;

String sensorDetail;

void setup()
{

  // On board led for power status
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH);

  Serial.begin(115400);
  pinMode(ENCODER_A_WHITE, INPUT_PULLUP); // White
  pinMode(ENCODER_A_GREEN, INPUT_PULLUP); // Green
  pinMode(ENCODER_B_WHITE, INPUT_PULLUP); // White
  pinMode(ENCODER_B_GREEN, INPUT_PULLUP); // Green

  attachInterrupt(ENCODER_A_WHITE, CounterA, RISING); // Green Wire
  attachInterrupt(ENCODER_A_GREEN, CounterB, RISING); // White Wire
  attachInterrupt(ENCODER_B_WHITE, CounterC, RISING); // Green Wire
  attachInterrupt(ENCODER_B_GREEN, CounterD, RISING); // White Wire

  // Initialize MythraOS
  mythra.begin();

  // Register action handlers - Customize to fit your needs
  mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
    if (strcmp(command, "lab") == 0 && payload.is<const char*>()) {
      action1Handler(payload.as<const char*>());
    } else if (strcmp(command, "study") == 0 && payload.is<const char*>()) {
      studyHandler(payload.as<const char*>());
    } else if (strcmp(command, "boiler") == 0 && payload.is<const char*>()) {
      boilerHandler(payload.as<const char*>());
    }
  });
}

void loop()
{
  mythra.loop();

  // Send the value of counter
  if (counterA != x)
  {
    x = counterA;
  }

  if (counterB != y)
  {
    y = counterB;
  }

  char telemetry[50];
  sprintf(telemetry, "%ld:%ld", counterA, counterB);
  mythra.publishText("Telemetry", "data", telemetry);
  Serial.println(telemetry);
}

// Example action handlers
void action1Handler(const char *value)
{
  Serial.println("Action 1 identified!");
  int action1Value = atoi(value);
  // Perform actions related to "lab"
  action1Function(action1Value);
}

void studyHandler(const char *value)
{
  Serial.println("Study action identified!");
  int brightValueStudy = atoi(value);
  // Perform actions related to "study"
  studyLights(brightValueStudy);
}

void boilerHandler(const char *value)
{
  Serial.println("Boiler action identified!");
  int brightValueBoiler = atoi(value);
  // Perform actions related to "boiler"
  boilerLights(brightValueBoiler);
}

void action1Function(int value)
{
  Serial.println("Action 1 Function");
}

void studyLights(int value)
{
  Serial.println("StudyLights Function");
}

void boilerLights(int value)
{
  Serial.println("BoilerLights Function");
}

void CounterA()
{
  if (digitalRead(ENCODER_A_GREEN) == LOW)
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
  if (digitalRead(ENCODER_A_WHITE) == LOW)
  {
    counterA--;
  }
  else
  {
    counterA++;
  }
}

void CounterC()
{
  if (digitalRead(ENCODER_B_GREEN) == LOW)
  {
    counterB++;
  }
  else
  {
    counterB--;
  }
}

void CounterD()
{
  if (digitalRead(ENCODER_B_WHITE) == LOW)
  {
    counterB--;
  }
  else
  {
    counterB++;
  }
}
