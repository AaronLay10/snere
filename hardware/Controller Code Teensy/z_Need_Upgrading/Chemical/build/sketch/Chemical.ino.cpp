#include <Arduino.h>
#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Chemical/Chemical.ino"
#include <ParagonMQTT.h>

// ------------------- CONSTANTS & VARIABLES -------------------
const char *deviceID = "Chemical"; // e.g., can be used in MQTT topics
const char *roomID = "Clockwork";

#define RFID_C Serial1 // Pins 1(TX) - Green, 0(RX) - White - Verified
#define RFID_E Serial2 // Pins 8(TX) - Green, 7(RX) - White - Verified
#define RFID_A Serial3 // Pins 14(TX) - Green, 15(RX) - White - Verifed
#define RFID_F Serial4 // Pins 17(TX) - Green, 16(RX) - White - Verified
#define RFID_B Serial5 // Pins 20(TX) - Green, 21(RX) - White - Verified
#define RFID_D Serial6 // Pins 24(TX) - Green, 25(RX) - White - Verified

// RFID - Tag in Range Sensor (TIR)
#define TIR_B 19
#define TIR_E 9
#define TIR_A 41
#define TIR_C 2
#define TIR_F 18
#define TIR_D 26

#define ACTUATOR_FWD 22
#define ACTUATOR_RWD 23
#define MAGLOCKS 36
#define POWERLED 13

// Enough room for each RFID + comma. Increase if your tags are very long.
const int idLen = 20;

// Buffers to store the latest read from each RFID reader
char publish_A[idLen] = "";
char publish_B[idLen] = "";
char publish_C[idLen] = "";
char publish_D[idLen] = "";
char publish_E[idLen] = "";
char publish_F[idLen] = "";

// Booleans tracking whether a tag is present
bool tagPresent_A = false;
bool tagPresent_B = false;
bool tagPresent_C = false;
bool tagPresent_D = false;
bool tagPresent_E = false;
bool tagPresent_F = false;

// Track TIR states (if you need to detect removal/placement transitions)
bool lastTIR_A = false;
bool lastTIR_B = false;
bool lastTIR_C = false;
bool lastTIR_D = false;
bool lastTIR_E = false;
bool lastTIR_F = false;

// A buffer to remember the last comma-delimited string published
char lastCombinedTags[128] = "";
char tirStatus[20];

// ------------------- FORWARD DECLARATIONS -------------------
void handleRFID(
    HardwareSerial &rfid,
    char *publishBuffer,
    bool *tagPresent,
    bool *lastTIRState,
    int tirPin);
void processRFID(char incomingChar, char *publishBuffer);
void publishAllPresentTags();         // <--- New function to publish comma-delimited tags
void actuatorMove(const char *value); // <--- MQTT action handler for actuator control

// ------------------- SETUP -------------------
#line 70 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Chemical/Chemical.ino"
void setup();
#line 107 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Chemical/Chemical.ino"
void loop();
#line 127 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Chemical/Chemical.ino"
void handleRFID(HardwareSerial &rfid, char *publishBuffer, bool *tagPresent, bool *lastTIRState, int tirPin);
#line 70 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Chemical/Chemical.ino"
void setup()
{
  Serial.begin(115200);

  RFID_A.begin(9600);
  RFID_B.begin(9600);
  RFID_C.begin(9600);
  RFID_D.begin(9600);
  RFID_E.begin(9600);
  RFID_F.begin(9600);

  pinMode(TIR_A, INPUT_PULLDOWN);
  pinMode(TIR_B, INPUT_PULLDOWN);
  pinMode(TIR_C, INPUT_PULLDOWN);
  pinMode(TIR_D, INPUT_PULLDOWN);
  pinMode(TIR_E, INPUT_PULLDOWN);
  pinMode(TIR_F, INPUT_PULLDOWN);

  pinMode(ACTUATOR_FWD, OUTPUT);
  pinMode(ACTUATOR_RWD, OUTPUT);
  pinMode(MAGLOCKS, OUTPUT);
  pinMode(POWERLED, OUTPUT);

  digitalWrite(POWERLED, HIGH);
  digitalWrite(ACTUATOR_FWD, HIGH);
  digitalWrite(ACTUATOR_RWD, LOW);
  digitalWrite(MAGLOCKS, HIGH);

  // Setup Ethernet & MQTT (from ParagonMQTT or your own library)
  networkSetup();
  mqttSetup();

  // Register MQTT action handlers
  registerAction("actuator", actuatorMove);
}

// ------------------- LOOP -------------------
void loop()
{
  // Continuously handle RFID for each reader
  sprintf(tirStatus, "%d,%d,%d,%d,%d,%d", digitalRead(TIR_A), digitalRead(TIR_B), digitalRead(TIR_C), digitalRead(TIR_D), digitalRead(TIR_E), digitalRead(TIR_F));
  // Serial.println(tirStatus);
  handleRFID(RFID_A, publish_A, &tagPresent_A, &lastTIR_A, TIR_A);
  handleRFID(RFID_B, publish_B, &tagPresent_B, &lastTIR_B, TIR_B);
  handleRFID(RFID_C, publish_C, &tagPresent_C, &lastTIR_C, TIR_C);
  handleRFID(RFID_D, publish_D, &tagPresent_D, &lastTIR_D, TIR_D);
  handleRFID(RFID_E, publish_E, &tagPresent_E, &lastTIR_E, TIR_E);
  handleRFID(RFID_F, publish_F, &tagPresent_F, &lastTIR_F, TIR_F);

  // Serial.println(tirStatus);
  //  Now publish a single comma-delimited list of all currently present tags
  publishAllPresentTags();

  sendDataMQTT();
}

// ------------------- HANDLE RFID -------------------
void handleRFID(HardwareSerial &rfid,
                char *publishBuffer,
                bool *tagPresent,
                bool *lastTIRState,
                int tirPin)
{
  // Print raw bytes for debugging
  while (rfid.available())
  {
    char incomingChar = rfid.read();
    // Serial.print("Raw byte (hex): 0x");
    // Serial.println(incomingChar, HEX);
    //  If you want ASCII too:
    //  Serial.print(" (ascii): ");
    //  Serial.println(incomingChar);

    // Keep original parsing:
    processRFID(incomingChar, publishBuffer);
  }

  // TIR logic remains the same
  bool currentTIR = (digitalRead(tirPin) == HIGH);
  if (!currentTIR)
  {
    *tagPresent = false;
    publishBuffer[0] = '\0';
  }
  else
  {
    *tagPresent = true;
  }
  *lastTIRState = currentTIR;
}

// ------------------- PROCESS RFID -------------------
void processRFID(char incomingChar, char *publishBuffer)
{
  // We store the raw data of the latest read.
  // Ensure buffer is big enough for your typical RFID strings.
  static char buffer[32];
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
    // Remove trailing CR if present
    int len = strlen(buffer);
    if (len > 0 && buffer[len - 1] == '\r')
    {
      buffer[len - 1] = '\0';
    }
    snprintf(publishBuffer, idLen, "%s", buffer);
    packetStarted = false;
  }
  else if (packetStarted && count < (int)sizeof(buffer) - 1)
  {
    buffer[count++] = incomingChar;
  }
}

// ------------------- BUILD & PUBLISH COMMA-DELIMITED TAGS -------------------
void publishAllPresentTags()
{
  // Always output 6 fields (A,B,C,D,E,F), using "EMPTY" for missing tags.
  char combined[128];
  combined[0] = '\0'; // start empty

  // Use local copies to avoid race conditions with publish_X buffers
  char local_A[idLen], local_B[idLen], local_C[idLen], local_D[idLen], local_E[idLen], local_F[idLen];
  strncpy(local_A, publish_A, idLen);
  local_A[idLen - 1] = '\0';
  strncpy(local_B, publish_B, idLen);
  local_B[idLen - 1] = '\0';
  strncpy(local_C, publish_C, idLen);
  local_C[idLen - 1] = '\0';
  strncpy(local_D, publish_D, idLen);
  local_D[idLen - 1] = '\0';
  strncpy(local_E, publish_E, idLen);
  local_E[idLen - 1] = '\0';
  strncpy(local_F, publish_F, idLen);
  local_F[idLen - 1] = '\0';

  // Remove any embedded newlines or carriage returns from each tag
  for (int i = 0; i < idLen; ++i)
  {
    if (local_A[i] == '\n' || local_A[i] == '\r')
      local_A[i] = '\0';
    if (local_B[i] == '\n' || local_B[i] == '\r')
      local_B[i] = '\0';
    if (local_C[i] == '\n' || local_C[i] == '\r')
      local_C[i] = '\0';
    if (local_D[i] == '\n' || local_D[i] == '\r')
      local_D[i] = '\0';
    if (local_E[i] == '\n' || local_E[i] == '\r')
      local_E[i] = '\0';
    if (local_F[i] == '\n' || local_F[i] == '\r')
      local_F[i] = '\0';
  }

  // Use a local buffer for the publish string to avoid stack overflow or buffer overrun
  snprintf(combined, sizeof(combined), "%s,%s,%s,%s,%s,%s",
           (tagPresent_A && local_A[0] != '\0') ? local_A : "EMPTY",
           (tagPresent_B && local_B[0] != '\0') ? local_B : "EMPTY",
           (tagPresent_C && local_C[0] != '\0') ? local_C : "EMPTY",
           (tagPresent_D && local_D[0] != '\0') ? local_D : "EMPTY",
           (tagPresent_E && local_E[0] != '\0') ? local_E : "EMPTY",
           (tagPresent_F && local_F[0] != '\0') ? local_F : "EMPTY");

  // Debug print
  // Serial.print("Publishing current tags: ");
  // Serial.println(combined);

  // Assign to publishDetail for MQTT publishing
  strncpy(publishDetail, combined, sizeof(publishDetail) - 1);
  publishDetail[sizeof(publishDetail) - 1] = '\0';

  strncpy(lastCombinedTags, combined, sizeof(lastCombinedTags) - 1);
  lastCombinedTags[sizeof(lastCombinedTags) - 1] = '\0';
}

// ------------------- ACTION HANDLERS -------------------
void actuatorMove(const char *value)
{
  Serial.print("Actuator command received: ");
  Serial.println(value);

  if (strcmp(value, "down") == 0)
  {
    Serial.println("Moving actuator DOWN");
    digitalWrite(ACTUATOR_FWD, LOW);
    digitalWrite(ACTUATOR_RWD, HIGH);
  }
  else if (strcmp(value, "up") == 0)
  {
    Serial.println("Moving actuator UP");
    digitalWrite(ACTUATOR_FWD, HIGH);
    digitalWrite(ACTUATOR_RWD, LOW);
  }
  else
  {
    Serial.print("Unknown actuator command: ");
    Serial.println(value);
  }
}

