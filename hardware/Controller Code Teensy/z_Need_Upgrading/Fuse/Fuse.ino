#include <MythraOS_MQTT.h>

#define DEVICE_ID "Fuse" // CHANGE DEVICE_ID TO THE NAME YOU WANT THIS TEENSY TO BE IDENTIFIED
#define DEVICE_FRIENDLY_NAME "Fuse Box"
#define ROOM_ID "Clockwork"
#define PUZZLE_ID "Fuse"

#define RFID_A Serial1 // Pins 0,1          -------
#define RFID_B Serial2 // Pins 7,8          | A B |
#define RFID_C Serial3 // Pins 14,15        | C   |
#define RFID_D Serial4 // Pins 16,17        | D E |
#define RFID_E Serial5 // Pins 20,21        -------

// RFID - Tag in Range Sensor
#define TIR_A 4
#define TIR_B 5
#define TIR_C 2
#define TIR_D 6
#define TIR_E 3

// RFID read verification signal
#define READ_A 26
#define READ_B 28
#define READ_C 27
#define READ_D 30
#define READ_E 29

#define ACTUATOR_FWD 33
#define ACTUATOR_RWD 34

#define MAGLOCKB 10
#define MAGLOCKC 11
#define MAGLOCKD 12

#define METALGATE 31

#define POWERLED 13

#define MAINFUSEA A5
#define MAINFUSEB A8
#define MAINFUSEC A9
#define KNIFESWITCH 18

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

// Variables
const int tagLen = 14;
const int idLen = 20;
const int rfidDelay = 500;

char newTag_A[idLen];
char newTag_B[idLen];
char newTag_C[idLen];
char newTag_D[idLen];
char newTag_E[idLen];

char publish_A[idLen] = "";
char publish_B[idLen] = "";
char publish_C[idLen] = "";
char publish_D[idLen] = "";
char publish_E[idLen] = "";

bool tagPresent_A = false;
bool tagPresent_B = false;
bool tagPresent_C = false;
bool tagPresent_D = false;
bool tagPresent_E = false;

int resistorValues[3] = {0};

// Telemetry change detection
char lastTelemetry[256] = "";
bool telemetryInitialized = false;

void setup()
{

  // Onboard LED for power status
  pinMode(POWERLED, OUTPUT);
  digitalWrite(POWERLED, HIGH);

  Serial.begin(115200);
  RFID_A.begin(9600);
  RFID_B.begin(9600);
  RFID_C.begin(9600);
  RFID_D.begin(9600);
  RFID_E.begin(9600);

  pinMode(TIR_A, INPUT_PULLDOWN);
  pinMode(TIR_B, INPUT_PULLDOWN);
  pinMode(TIR_C, INPUT_PULLDOWN);
  pinMode(TIR_D, INPUT_PULLDOWN);
  pinMode(TIR_E, INPUT_PULLDOWN);

  pinMode(READ_A, INPUT_PULLDOWN);
  pinMode(READ_B, INPUT_PULLDOWN);
  pinMode(READ_C, INPUT_PULLDOWN);
  pinMode(READ_D, INPUT_PULLDOWN);
  pinMode(READ_E, INPUT_PULLDOWN);

  pinMode(ACTUATOR_FWD, OUTPUT);
  pinMode(ACTUATOR_RWD, OUTPUT);
  pinMode(MAGLOCKB, OUTPUT);
  pinMode(MAGLOCKC, OUTPUT);
  pinMode(MAGLOCKD, OUTPUT);
  pinMode(METALGATE, OUTPUT);
  pinMode(KNIFESWITCH, INPUT_PULLDOWN);

  digitalWrite(ACTUATOR_FWD, HIGH);
  digitalWrite(ACTUATOR_RWD, LOW);
  digitalWrite(MAGLOCKB, HIGH);
  digitalWrite(MAGLOCKC, HIGH);
  digitalWrite(MAGLOCKD, HIGH);
  digitalWrite(METALGATE, HIGH);

  if (Serial1)
  {
    Serial.println("RFID_A Ready");
  }

  if (Serial2)
  {
    Serial.println("RFID_B Ready");
  }

  if (Serial3)
  {
    Serial.println("RFID_C Ready");
  }

  if (Serial4)
  {
    Serial.println("RFID_D Ready");
  }

  if (Serial5)
  {
    Serial.println("RFID_E Ready");
  }

  delay(1000);
  // Initialize MythraOS
  mythra.begin();

  // Register action handlers - Customize to fit your needs
  mythra.setCommandCallback([](const char *command, const JsonDocument &payload, void *context) {
    if (strcmp(command, "fuse") == 0 && payload.is<const char*>()) {
      fuse(payload.as<const char*>());
    } else if (strcmp(command, "knifeswitch") == 0 && payload.is<const char*>()) {
      knifeswitch(payload.as<const char*>());
    } else if (strcmp(command, "metalDoor") == 0 && payload.is<const char*>()) {
      metalDoor(payload.as<const char*>());
    } else if (strcmp(command, "dropPanel") == 0 && payload.is<const char*>()) {
      dropPanel(payload.as<const char*>());
    }
  });
}

void loop()
{
  mythra.loop();
  resistorCalc();

  // TIR states (0 or 1 based on presence)
  int tirA = digitalRead(TIR_A);
  int tirB = digitalRead(TIR_B);
  int tirC = digitalRead(TIR_C);
  int tirD = digitalRead(TIR_D);
  int tirE = digitalRead(TIR_E);
  int knifeSwitch = digitalRead(KNIFESWITCH);

  // Build the telemetry string (without labels, just the tag data)
  char telemetryData[256];
  snprintf(telemetryData, sizeof(telemetryData),
           "%d:%d:%d,%d,%s:%s:%s:%s:%s",

           resistorValues[0], resistorValues[1], resistorValues[2],
           knifeSwitch,
           (strlen(publish_A) > 0 ? publish_A : "EMPTY"),
           (strlen(publish_B) > 0 ? publish_B : "EMPTY"),
           (strlen(publish_C) > 0 ? publish_C : "EMPTY"),
           (strlen(publish_D) > 0 ? publish_D : "EMPTY"),
           (strlen(publish_E) > 0 ? publish_E : "EMPTY"));

  // CHANGE DETECTION: Always publish first message, then only when data changes
  // But only if MQTT broker is connected
  bool dataChanged = (!telemetryInitialized) || (strcmp(telemetryData, lastTelemetry) != 0);

  if (dataChanged && mythra.isConnected())
  {
    Serial.print("[PUBLISHING] ");
    Serial.println(telemetryData);
    mythra.publishText("Telemetry", "data", telemetryData);
    strcpy(lastTelemetry, telemetryData);
    telemetryInitialized = true;
  }

  // Handle each RFID reader
  handleRFID(RFID_A, publish_A, TIR_A, &tagPresent_A);
  handleRFID(RFID_B, publish_B, TIR_B, &tagPresent_B);
  handleRFID(RFID_C, publish_C, TIR_C, &tagPresent_C);
  handleRFID(RFID_D, publish_D, TIR_D, &tagPresent_D);
  handleRFID(RFID_E, publish_E, TIR_E, &tagPresent_E);
}

// Function to handle RFID reading and publish tag
void handleRFID(HardwareSerial &rfid, char *publishBuffer, int tirPin, bool *tagPresent)
{
  if (rfid.available())
  {
    char incomingChar = rfid.read();
    processRFID(incomingChar, publishBuffer);
    *tagPresent = true; // Set tag as present when a valid tag is read
  }

  // Clear the tag if the TIR sensor indicates the tag is no longer present
  if (digitalRead(tirPin) == LOW)
  {
    *tagPresent = false;
    strcpy(publishBuffer, ""); // Clear the tag when TIR is low
  }
}

void processRFID(char incomingChar, char *publishBuffer)
{
  static char buffer[16];
  static int count = 0;
  static bool packetStarted = false;

  if (incomingChar == 0x02)
  { // STX
    count = 0;
    packetStarted = true;
  }
  else if (incomingChar == 0x03 && packetStarted)
  { // ETX
    buffer[count] = '\0';
    snprintf(publishBuffer, idLen, "%s", buffer); // Just store the tag data without labels
    cleanTag(publishBuffer);                      // Remove newlines and carriage returns
    packetStarted = false;
  }
  else if (packetStarted && count < sizeof(buffer) - 1)
  {
    buffer[count++] = incomingChar; // Accumulate tag data
  }
}

void cleanTag(char *tag)
{
  int j = 0;
  for (int i = 0; tag[i] != '\0'; i++)
  {
    if (tag[i] != '\n' && tag[i] != '\r')
    {
      tag[j++] = tag[i];
    }
  }
  tag[j] = '\0';
}

// Example action handlers
void fuse(const char *value)
{
  Serial.println("Action 1 identified!");
  int action1Value = atoi(value);
  // Perform actions related to "fuse"
}

void knifeswitch(const char *value)
{
  Serial.println("Study action identified!");
  int knifeSwitchValue = atoi(value);
  // Perform actions related to "knifeswitch"
}

// Round resistor value to nearest bucket (0, 100, 200, 300)
int roundResistorValue(int rawValue)
{
  // If very low or out of range, return 0
  if (rawValue < 50)
  {
    return 0;
  }

  // Round to nearest 100 (0, 100, 200, 300)
  // Add 50 for rounding, then divide by 100 and multiply by 100
  int rounded = ((rawValue + 50) / 100) * 100;

  // Cap at 300
  if (rounded > 300)
  {
    rounded = 300;
  }

  return rounded;
}

void resistorCalc()
{
  int fuseAraw = analogRead(MAINFUSEA);
  int fuseBraw = analogRead(MAINFUSEB);
  int fuseCraw = analogRead(MAINFUSEC);

  const int Vin_scaled = 3300;   // Vin * 1000 (3.3V scaled to 3300 for integer math)
  const int contResistor = 1000; // 1k ohm resistor
  const int threshold = 10;      // Threshold for "no resistor" (adjust as needed)
  const int maxResistor = 1000;  // Max allowed value

  int VoutA_scaled = (fuseAraw * Vin_scaled) / 1024;
  int VoutB_scaled = (fuseBraw * Vin_scaled) / 1024;
  int VoutC_scaled = (fuseCraw * Vin_scaled) / 1024;

  int rA = (VoutA_scaled >= threshold) ? (contResistor * (Vin_scaled - VoutA_scaled)) / VoutA_scaled : 0;
  int rB = (VoutB_scaled >= threshold) ? (contResistor * (Vin_scaled - VoutB_scaled)) / VoutB_scaled : 0;
  int rC = (VoutC_scaled >= threshold) ? (contResistor * (Vin_scaled - VoutC_scaled)) / VoutC_scaled : 0;

  // Apply bucketing/rounding to reduce noise
  resistorValues[0] = roundResistorValue((rA > maxResistor) ? 0 : rA);
  resistorValues[1] = roundResistorValue((rB > maxResistor) ? 0 : rB);
  resistorValues[2] = roundResistorValue((rC > maxResistor) ? 0 : rC);
}

void metalDoor(const char *value)
{
  Serial.println("Metal door action identified!");
  int metalDoorValue = atoi(value);
  digitalWrite(METALGATE, LOW); // Unlock the metal door
}

void dropPanel(const char *value)
{
  Serial.println("Drop panel action identified!");
  Serial.println("Panel: " + String(value));

  // Convert to lowercase for case-insensitive comparison
  char panel = tolower(value[0]);

  switch (panel)
  {
  case 'b':
    Serial.println("Dropping panel B (MAGLOCKB)");
    digitalWrite(MAGLOCKB, LOW); // Drop panel B
    break;
  case 'c':
    Serial.println("Dropping panel C (MAGLOCKC)");
    digitalWrite(MAGLOCKC, LOW); // Drop panel C
    break;
  case 'd':
    Serial.println("Dropping panel D (MAGLOCKD)");
    digitalWrite(MAGLOCKD, LOW); // Drop panel D
    break;
  default:
    Serial.println("Invalid panel specified. Use 'b', 'c', or 'd'");
    break;
  }
}
