// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: INCLUDES AND GLOBAL DECLARATIONS
// ══════════════════════════════════════════════════════════════════════════════

#define USE_NO_SEND_PWM
#define SUPPRESS_ERROR_MESSAGE_FOR_BEGIN

#ifndef MQTT_MAX_PACKET_SIZE
#define MQTT_MAX_PACKET_SIZE 512
#endif

#include <SentientCapabilityManifest.h>
#include <SentientMQTT.h>
#include <SentientDeviceRegistry.h>
#include <ArduinoJson.h>
#include <IRremote.hpp>
#include "FirmwareMetadata.h"

// ──────────────────────────────────────────────────────────────────────────────
// Device Definitions
// ──────────────────────────────────────────────────────────────────────────────
// *** Photocell Boiler - Reads light through boiler valve, sends open/closed status
// *** Photocell Stairs - Reads light through stairs valve, sends open/closed status
// *** IR Sensor 1 - Reads IR signal from boiler gun for verification
// *** IR Sensor 2 - Reads IR signal from stairs gun for verification
// *** Maglock Boiler - Door lock, locked by default, unlocked on command
// *** Maglock Stairs - Door lock, locked by default, unlocked on command
// *** Lever LED Boiler - LED illuminating boiler valve
// *** Lever LED Stairs - LED illuminating stairs valve
// *** Newell Post Light - Light on Newell post
// *** Newell Post Motor System - Stepper motor with 2 proximity sensors (up/down)
//                                 for raising/lowering Newell post

// ──────────────────────────────────────────────────────────────────────────────
// Pin Assignments
// ──────────────────────────────────────────────────────────────────────────────
const int power_led_pin = 13;
const int photocell_boiler_pin = A1;
const int photocell_stairs_pin = A0;
const int ir_sensor_1_pin = 16;
const int ir_sensor_2_pin = 17;
const int maglock_boiler_pin = 33;
const int maglock_stairs_pin = 34;
const int lever_led_boiler_pin = 20;
const int lever_led_stairs_pin = 19;
const int newell_post_light_pin = 36;
const int newell_prox_up_pin = 39;
const int newell_prox_down_pin = 38;

// Stepper motor pins
const int stepper_pin_1 = 1;
const int stepper_pin_2 = 2;
const int stepper_pin_3 = 3;
const int stepper_pin_4 = 4;

// ──────────────────────────────────────────────────────────────────────────────
// Configuration Constants
// ──────────────────────────────────────────────────────────────────────────────
const int photocell_threshold = 500; // Above 500 = OPEN, Below 500 = CLOSED
const unsigned long heartbeat_interval_ms = 5000;
const unsigned long ir_switch_interval = 200; // Alternate between IR sensors
const uint32_t target_ir_code = 0x51;         // Target IR code from guns

// Stepper motor configuration
const int stepper_speed_delay_us = 1000; // Delay between steps (microseconds)
const int step_sequence[4][4] = {
    {1, 0, 0, 0},
    {0, 1, 0, 0},
    {0, 0, 1, 0},
    {0, 0, 0, 1}};

// MQTT Configuration
const IPAddress mqtt_broker_ip(192, 168, 20, 3);
const char *mqtt_host = "sentientengine.ai";
const int mqtt_port = 1883;
const char *mqtt_namespace = "paragon";
const char *room_id = "clockwork";
// Single source of truth: controller_id comes from firmware::UNIQUE_ID
const char *controller_id = firmware::UNIQUE_ID;
const char *controller_model = "teensy41";
const char *device_id = "lever_boiler";
const char *device_friendly_name = "Lever Boiler Controller";

// ──────────────────────────────────────────────────────────────────────────────
// Hardware State Variables (NOT game state)
// ──────────────────────────────────────────────────────────────────────────────
bool boiler_door_unlocked = false;
bool stairs_door_unlocked = false;
bool newell_post_light_on = false;
bool ir_sensor_active = true;
bool manual_heartbeat_requested = false;

// Stepper motor state
enum StepperDirection
{
  STEPPER_STOP,
  STEPPER_UP,
  STEPPER_DOWN
};
StepperDirection current_direction = STEPPER_STOP;
bool stepper_moving = false;
int step_index = 0;
unsigned long last_step_time = 0;

// IR sensor state
int current_ir_pin = ir_sensor_1_pin;
unsigned long last_ir_switch_time = 0;
bool ir_signal_in_progress = false;

// Sensor readings
int photocell_boiler = 0;
int photocell_stairs = 0;
int last_photocell_boiler = 0;
int last_photocell_stairs = 0;
bool boiler_valve_open = false;
bool stairs_valve_open = false;
bool last_boiler_valve_open = false;
bool last_stairs_valve_open = false;

// Periodic sensor publishing (ensures fresh data even without changes)
unsigned long last_sensor_publish_time = 0;
const unsigned long sensor_publish_interval_ms = 60000; // Publish every 60 seconds

// Proximity sensor state
bool last_prox_up = false;
bool last_prox_down = false;

// ============================================================================
// DEVICE REGISTRY (SINGLE SOURCE OF TRUTH!)
// ============================================================================

// Input device sensors
const char *photocellBoiler_sensors[] = {"PhotocellBoiler"};
const char *photocellStairs_sensors[] = {"PhotocellStairs"};
const char *irSensor1_sensors[] = {"IRSensor1"};
const char *irSensor2_sensors[] = {"IRSensor2"};

// Output device commands - Separate commands for on/off actions
const char *maglockBoiler_commands[] = {"maglockBoiler_unlock", "maglockBoiler_lock"};
const char *maglockStairs_commands[] = {"maglockStairs_unlock", "maglockStairs_lock"};
const char *leverLEDBoiler_commands[] = {"leverLEDBoiler_on", "leverLEDBoiler_off"};
const char *leverLEDStairs_commands[] = {"leverLEDStairs_on", "leverLEDStairs_off"};
const char *newellLight_commands[] = {"newellLight_on", "newellLight_off"};

// Bidirectional device (motor with commands and sensors)
const char *newellMotor_commands[] = {"stepperUp", "stepperDown", "stepperStop"};
const char *newellMotor_sensors[] = {"ProximitySensors"};

// Create device definitions
SentientDeviceDef dev_photocell_boiler(
    "photocell_boiler", "Boiler Valve Sensor", "sensor",
    photocellBoiler_sensors, 1, true);

SentientDeviceDef dev_photocell_stairs(
    "photocell_stairs", "Stairs Valve Sensor", "sensor",
    photocellStairs_sensors, 1, true);

SentientDeviceDef dev_ir_sensor_1(
    "ir_sensor_1", "Boiler Gun IR Receiver", "sensor",
    irSensor1_sensors, 1, true);

SentientDeviceDef dev_ir_sensor_2(
    "ir_sensor_2", "Stairs Gun IR Receiver", "sensor",
    irSensor2_sensors, 1, true);

SentientDeviceDef dev_maglock_boiler(
    "maglock_boiler", "Boiler Door Lock", "maglock",
    maglockBoiler_commands, 2 // unlock, lock
);

SentientDeviceDef dev_maglock_stairs(
    "maglock_stairs", "Stairs Door Lock", "maglock",
    maglockStairs_commands, 2 // unlock, lock
);

SentientDeviceDef dev_lever_led_boiler(
    "lever_led_boiler", "Boiler Valve LED", "led",
    leverLEDBoiler_commands, 2 // on, off
);

SentientDeviceDef dev_lever_led_stairs(
    "lever_led_stairs", "Stairs Valve LED", "led",
    leverLEDStairs_commands, 2 // on, off
);

SentientDeviceDef dev_newell_post_light(
    "newell_post_light", "Newell Post Light", "led",
    newellLight_commands, 2 // on, off
);

SentientDeviceDef dev_newell_post_motor(
    "newell_post_motor", "Newell Post Motor System", "stepper",
    newellMotor_commands, 3,
    newellMotor_sensors, 1);

// Create the device registry
SentientDeviceRegistry deviceRegistry;

// ──────────────────────────────────────────────────────────────────────────────
// Forward Declarations (required for MQTT initialization)
// ──────────────────────────────────────────────────────────────────────────────
void build_capability_manifest();
SentientMQTTConfig build_mqtt_config();
bool build_heartbeat_payload(JsonDocument &doc, void *ctx);
void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx);

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Objects
// ──────────────────────────────────────────────────────────────────────────────
SentientCapabilityManifest manifest;
SentientMQTT mqtt(build_mqtt_config());

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: SETUP FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

void setup()
{
  Serial.begin(115200);
  unsigned long waited = 0;
  while (!Serial && waited < 2000)
  {
    delay(10);
    waited += 10;
  }

  Serial.println(F("=== LeverBoiler Controller - STATELESS MODE ==="));
  Serial.print(F("Board: "));
  Serial.println(teensyBoardVersion());
  Serial.print(F("USB SN: "));
  Serial.println(teensyUsbSN());
  Serial.print(F("MAC: "));
  Serial.println(teensyMAC());
  Serial.print(F("Firmware: "));
  Serial.println(firmware::VERSION);

  // Initialize GPIO pins
  pinMode(power_led_pin, OUTPUT);
  pinMode(maglock_boiler_pin, OUTPUT);
  pinMode(maglock_stairs_pin, OUTPUT);
  pinMode(lever_led_boiler_pin, OUTPUT);
  pinMode(lever_led_stairs_pin, OUTPUT);
  pinMode(newell_post_light_pin, OUTPUT);
  pinMode(newell_prox_up_pin, INPUT_PULLDOWN);
  pinMode(newell_prox_down_pin, INPUT_PULLDOWN);

  // Stepper motor pins
  pinMode(stepper_pin_1, OUTPUT);
  pinMode(stepper_pin_2, OUTPUT);
  pinMode(stepper_pin_3, OUTPUT);
  pinMode(stepper_pin_4, OUTPUT);

  // Set initial states
  digitalWrite(power_led_pin, HIGH);
  digitalWrite(maglock_boiler_pin, HIGH);   // Locked
  digitalWrite(maglock_stairs_pin, HIGH);   // Locked
  digitalWrite(lever_led_boiler_pin, HIGH); // On
  digitalWrite(lever_led_stairs_pin, HIGH); // On
  digitalWrite(newell_post_light_pin, LOW); // Off
  set_stepper_pins(0, 0, 0, 0);             // Off

  // Initialize IR sensor
  IrReceiver.begin(current_ir_pin, ENABLE_LED_FEEDBACK);
  Serial.println(F("[LeverBoiler] IR sensors initialized (alternating pins 16 & 17)"));

  // Register all devices (SINGLE SOURCE OF TRUTH!)
  Serial.println(F("[LeverBoiler] Registering devices..."));
  deviceRegistry.addDevice(&dev_photocell_boiler);
  deviceRegistry.addDevice(&dev_photocell_stairs);
  deviceRegistry.addDevice(&dev_ir_sensor_1);
  deviceRegistry.addDevice(&dev_ir_sensor_2);
  deviceRegistry.addDevice(&dev_maglock_boiler);
  deviceRegistry.addDevice(&dev_maglock_stairs);
  deviceRegistry.addDevice(&dev_lever_led_boiler);
  deviceRegistry.addDevice(&dev_lever_led_stairs);
  deviceRegistry.addDevice(&dev_newell_post_light);
  deviceRegistry.addDevice(&dev_newell_post_motor);
  deviceRegistry.printSummary();

  // Build capability manifest
  Serial.println(F("[LeverBoiler] Building capability manifest..."));
  build_capability_manifest();
  Serial.println(F("[LeverBoiler] Manifest built successfully"));

  // Initialize MQTT
  Serial.println(F("[LeverBoiler] Initializing MQTT..."));
  if (!mqtt.begin())
  {
    Serial.println(F("[LeverBoiler] MQTT initialization failed"));
  }
  else
  {
    Serial.println(F("[LeverBoiler] MQTT initialization successful"));
    mqtt.setCommandCallback(handle_mqtt_command);
    mqtt.setHeartbeatBuilder(build_heartbeat_payload);

    // Wait for broker connection (max 5 seconds)
    Serial.println(F("[LeverBoiler] Waiting for broker connection..."));
    unsigned long connection_start = millis();
    while (!mqtt.isConnected() && (millis() - connection_start < 5000))
    {
      mqtt.loop();
      delay(100);
    }

    if (mqtt.isConnected())
    {
      Serial.println(F("[LeverBoiler] Broker connected!"));

      // Register with Sentient system
      Serial.println(F("[LeverBoiler] Registering with Sentient system..."));
      if (manifest.publish_registration(mqtt.get_client(), room_id, controller_id))
      {
        Serial.println(F("[LeverBoiler] Registration successful!"));
      }
      else
      {
        Serial.println(F("[LeverBoiler] Registration failed"));
      }

      // Publish initial status
      publish_hardware_status();
    }
    else
    {
      Serial.println(F("[LeverBoiler] Broker connection timeout - will retry in main loop"));
    }
  }

  Serial.println(F("[LeverBoiler] Ready - awaiting Sentient commands"));
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: LOOP FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

void loop()
{
  // 1. LISTEN for commands from Sentient
  mqtt.loop();

  // 2. DETECT sensor changes and publish if needed
  check_and_publish_sensor_changes();

  // 3. EXECUTE active hardware operations
  run_stepper();

  // Handle IR sensor monitoring (alternate between two sensors)
  if (ir_sensor_active && IrReceiver.decode())
  {
    ir_signal_in_progress = true;
    handle_ir_signal(current_ir_pin);
    IrReceiver.resume();
    ir_signal_in_progress = false;
    last_ir_switch_time = millis();
  }

  // Switch between IR sensors
  if (ir_sensor_active && !ir_signal_in_progress &&
      (millis() - last_ir_switch_time > ir_switch_interval))
  {
    current_ir_pin = (current_ir_pin == ir_sensor_1_pin) ? ir_sensor_2_pin : ir_sensor_1_pin;
    IrReceiver.begin(current_ir_pin, ENABLE_LED_FEEDBACK);
    last_ir_switch_time = millis();
  }

  // Handle manual heartbeat request
  if (manual_heartbeat_requested)
  {
    if (mqtt.publishHeartbeat())
    {
      manual_heartbeat_requested = false;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: COMMANDS AND THEIR ASSOCIATED FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

void handle_mqtt_command(const char *command, const JsonDocument &payload, void *ctx)
{
  String value = extract_command_value(payload);
  String cmd = String(command);

  Serial.print(F("[LeverBoiler] Command: "));
  Serial.print(command);
  Serial.print(F(" = "));
  Serial.println(value);

  // ────────────────────────────────────────────────────────────────────────────
  // Boiler Door Lock
  // ────────────────────────────────────────────────────────────────────────────
  if (cmd.equalsIgnoreCase("maglockBoiler_unlock"))
  {
    digitalWrite(maglock_boiler_pin, LOW); // LOW = de-energize = unlock
    boiler_door_unlocked = true;
    Serial.println(F("[LeverBoiler] Boiler door: UNLOCKED"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("maglockBoiler_lock"))
  {
    digitalWrite(maglock_boiler_pin, HIGH); // HIGH = energize = lock
    boiler_door_unlocked = false;
    Serial.println(F("[LeverBoiler] Boiler door: LOCKED"));
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // Stairs Door Lock
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("maglockStairs_unlock"))
  {
    digitalWrite(maglock_stairs_pin, LOW); // LOW = de-energize = unlock
    stairs_door_unlocked = true;
    Serial.println(F("[LeverBoiler] Stairs door: UNLOCKED"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("maglockStairs_lock"))
  {
    digitalWrite(maglock_stairs_pin, HIGH); // HIGH = energize = lock
    stairs_door_unlocked = false;
    Serial.println(F("[LeverBoiler] Stairs door: LOCKED"));
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // Lever LEDs
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("leverLEDBoiler_on"))
  {
    digitalWrite(lever_led_boiler_pin, HIGH);
    Serial.println(F("[LeverBoiler] Boiler LED: ON"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("leverLEDBoiler_off"))
  {
    digitalWrite(lever_led_boiler_pin, LOW);
    Serial.println(F("[LeverBoiler] Boiler LED: OFF"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("leverLEDStairs_on"))
  {
    digitalWrite(lever_led_stairs_pin, HIGH);
    Serial.println(F("[LeverBoiler] Stairs LED: ON"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("leverLEDStairs_off"))
  {
    digitalWrite(lever_led_stairs_pin, LOW);
    Serial.println(F("[LeverBoiler] Stairs LED: OFF"));
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // Newell Post Light
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("newellLight_on"))
  {
    newell_post_light_on = true;
    digitalWrite(newell_post_light_pin, HIGH);
    Serial.println(F("[LeverBoiler] Newell light: ON"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("newellLight_off"))
  {
    newell_post_light_on = false;
    digitalWrite(newell_post_light_pin, LOW);
    Serial.println(F("[LeverBoiler] Newell light: OFF"));
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // Stepper Motor Control
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("stepperUp"))
  {
    move_stepper_up();
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("stepperDown"))
  {
    move_stepper_down();
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("stepperStop"))
  {
    stop_stepper();
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // IR Sensor Control
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("activateIR"))
  {
    // REQUIRED: Validate parameter before processing
    if (value.length() == 0)
    {
      Serial.println(F("[LeverBoiler] ERROR: activateIR requires value parameter (on/off)"));
      return;
    }
    ir_sensor_active = parse_truth(value);
    if (ir_sensor_active)
    {
      IrReceiver.begin(current_ir_pin, ENABLE_LED_FEEDBACK);
    }
    else
    {
      IrReceiver.stop();
    }
    Serial.print(F("[LeverBoiler] IR sensors: "));
    Serial.println(ir_sensor_active ? F("ACTIVE") : F("INACTIVE"));
    publish_hardware_status();

    // ────────────────────────────────────────────────────────────────────────────
    // System Commands
    // ────────────────────────────────────────────────────────────────────────────
  }
  else if (cmd.equalsIgnoreCase("reset"))
  {
    Serial.println(F("[LeverBoiler] RESET command"));
    digitalWrite(maglock_boiler_pin, HIGH);   // Lock
    digitalWrite(maglock_stairs_pin, HIGH);   // Lock
    digitalWrite(lever_led_boiler_pin, HIGH); // On
    digitalWrite(lever_led_stairs_pin, HIGH); // On
    digitalWrite(newell_post_light_pin, LOW); // Off
    boiler_door_unlocked = false;
    stairs_door_unlocked = false;
    newell_post_light_on = false;
    stop_stepper();
    publish_hardware_status();
    Serial.println(F("[LeverBoiler] Reset complete"));
  }
  else if (cmd.equalsIgnoreCase("requestStatus"))
  {
    Serial.println(F("[LeverBoiler] Status requested"));
    publish_hardware_status();
  }
  else if (cmd.equalsIgnoreCase("heartbeat"))
  {
    manual_heartbeat_requested = true;
  }
  else
  {
    Serial.print(F("[LeverBoiler] Unknown command: "));
    Serial.println(command);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hardware Execution Functions (called by command handler)
// ──────────────────────────────────────────────────────────────────────────────

void set_stepper_pins(int a, int b, int c, int d)
{
  digitalWrite(stepper_pin_1, a);
  digitalWrite(stepper_pin_2, b);
  digitalWrite(stepper_pin_3, c);
  digitalWrite(stepper_pin_4, d);
}

void step_motor(int direction)
{
  // direction: 1 = forward (down), -1 = backward (up)
  if (micros() - last_step_time < stepper_speed_delay_us)
  {
    return; // Not enough time has passed
  }

  step_index += direction;
  if (step_index < 0)
    step_index = 3;
  if (step_index > 3)
    step_index = 0;

  set_stepper_pins(
      step_sequence[step_index][0],
      step_sequence[step_index][1],
      step_sequence[step_index][2],
      step_sequence[step_index][3]);

  last_step_time = micros();
}

void stop_stepper()
{
  current_direction = STEPPER_STOP;
  stepper_moving = false;
  set_stepper_pins(0, 0, 0, 0); // Turn off all coils
  Serial.println(F("[LeverBoiler] Stepper stopped"));
}

void move_stepper_up()
{
  if (digitalRead(newell_prox_up_pin) == HIGH)
  {
    Serial.println(F("[LeverBoiler] Already at UP limit"));
    return;
  }
  Serial.println(F("[LeverBoiler] Moving stepper UP"));
  current_direction = STEPPER_UP;
  stepper_moving = true;
}

void move_stepper_down()
{
  if (digitalRead(newell_prox_down_pin) == HIGH)
  {
    Serial.println(F("[LeverBoiler] Already at DOWN limit"));
    return;
  }
  Serial.println(F("[LeverBoiler] Moving stepper DOWN"));
  current_direction = STEPPER_DOWN;
  stepper_moving = true;
}

void run_stepper()
{
  // Check proximity sensors and stop if limit reached
  if (current_direction == STEPPER_UP && digitalRead(newell_prox_up_pin) == HIGH)
  {
    Serial.println(F("[LeverBoiler] Stepper reached UP limit"));
    stop_stepper();
    publish_hardware_status();
    return;
  }

  if (current_direction == STEPPER_DOWN && digitalRead(newell_prox_down_pin) == HIGH)
  {
    Serial.println(F("[LeverBoiler] Stepper reached DOWN limit"));
    stop_stepper();
    publish_hardware_status();
    return;
  }

  // Execute motor steps
  if (stepper_moving)
  {
    if (current_direction == STEPPER_UP)
    {
      step_motor(-1); // Negative for up
    }
    else if (current_direction == STEPPER_DOWN)
    {
      step_motor(1); // Positive for down
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: ALL OTHER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────────
// Capability Manifest Builder
// ──────────────────────────────────────────────────────────────────────────────

void build_capability_manifest()
{
  manifest.set_controller_info(
      firmware::UNIQUE_ID,
      device_friendly_name,
      firmware::VERSION,
      room_id,
      controller_id);

  // Auto-generate entire manifest from device registry - ONE LINE!
  deviceRegistry.buildManifest(manifest);

  // That's it! No manual device/topic registration needed!
  // All devices and topics are defined once in the Device Registry section above.
}

// ──────────────────────────────────────────────────────────────────────────────
// MQTT Configuration Builder
// ──────────────────────────────────────────────────────────────────────────────

SentientMQTTConfig build_mqtt_config()
{
  SentientMQTTConfig cfg{};
  if (mqtt_host && mqtt_host[0] != '\0')
  {
    cfg.brokerHost = mqtt_host;
  }
  cfg.brokerIp = mqtt_broker_ip;
  cfg.brokerPort = mqtt_port;
  cfg.namespaceId = mqtt_namespace;
  cfg.roomId = room_id;
  cfg.puzzleId = controller_id;
  cfg.deviceId = device_id;
  cfg.displayName = device_friendly_name;
  cfg.publishJsonCapacity = 1536; // Increased for large registration messages (1536 * 4 = 6144 bytes)
  cfg.heartbeatIntervalMs = heartbeat_interval_ms;
  cfg.autoHeartbeat = true;
#if !defined(ESP32)
  cfg.useDhcp = true;
#endif
  return cfg;
}

// ──────────────────────────────────────────────────────────────────────────────
// Heartbeat Builder
// ──────────────────────────────────────────────────────────────────────────────

bool build_heartbeat_payload(JsonDocument &doc, void *ctx)
{
  doc["uid"] = firmware::UNIQUE_ID;
  doc["fw"] = firmware::VERSION;
  doc["up"] = millis();
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Status Publishing
// ──────────────────────────────────────────────────────────────────────────────

void publish_hardware_status()
{
  DynamicJsonDocument doc(512);
  doc["boilerDoorUnlocked"] = boiler_door_unlocked;
  doc["stairsDoorUnlocked"] = stairs_door_unlocked;
  doc["newellLight"] = newell_post_light_on;
  doc["stepperMoving"] = stepper_moving;
  doc["stepperDirection"] = (current_direction == STEPPER_UP) ? "up" : (current_direction == STEPPER_DOWN) ? "down"
                                                                                                           : "stop";
  doc["boilerValveOpen"] = boiler_valve_open;
  doc["stairsValveOpen"] = stairs_valve_open;
  doc["irActive"] = ir_sensor_active;
  doc["ts"] = millis();
  doc["uid"] = firmware::UNIQUE_ID;
  mqtt.publishState("hardware", doc);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sensor Change Detection and Publishing
// ──────────────────────────────────────────────────────────────────────────────

void check_and_publish_sensor_changes()
{
  // Read photocells
  photocell_boiler = analogRead(photocell_boiler_pin);
  photocell_stairs = analogRead(photocell_stairs_pin);

  // Convert to open/closed state
  boiler_valve_open = (photocell_boiler > photocell_threshold);
  stairs_valve_open = (photocell_stairs > photocell_threshold);

  // Check if periodic publish interval has elapsed
  unsigned long current_time = millis();
  bool force_publish = (current_time - last_sensor_publish_time >= sensor_publish_interval_ms);

  // Check for changes and publish
  bool changed = false;
  DynamicJsonDocument doc(256);

  if (boiler_valve_open != last_boiler_valve_open)
  {
    doc["boilerValve"] = boiler_valve_open ? "OPEN" : "CLOSED";
    doc["boilerRaw"] = photocell_boiler;
    last_boiler_valve_open = boiler_valve_open;
    changed = true;
  }

  if (stairs_valve_open != last_stairs_valve_open)
  {
    doc["stairsValve"] = stairs_valve_open ? "OPEN" : "CLOSED";
    doc["stairsRaw"] = photocell_stairs;
    last_stairs_valve_open = stairs_valve_open;
    changed = true;
  }

  if (changed || force_publish)
  {
    doc["ts"] = millis();
    mqtt.publishJson("sensors", "photocells", doc);
    last_sensor_publish_time = current_time;
  }

  // Check proximity sensors
  bool prox_up = digitalRead(newell_prox_up_pin) == HIGH;
  bool prox_down = digitalRead(newell_prox_down_pin) == HIGH;

  if (prox_up != last_prox_up || prox_down != last_prox_down)
  {
    DynamicJsonDocument prox_doc(128);
    prox_doc["proxUp"] = prox_up;
    prox_doc["proxDown"] = prox_down;
    prox_doc["ts"] = millis();
    mqtt.publishJson("sensors", "proximity_sensors", prox_doc);
    last_prox_up = prox_up;
    last_prox_down = prox_down;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// IR Signal Handler
// ──────────────────────────────────────────────────────────────────────────────

void handle_ir_signal(int pin)
{
  // Skip if stepper is moving (safety)
  if (stepper_moving)
  {
    return;
  }

  // Check for noise
  bool is_noise = (IrReceiver.decodedIRData.command == 0 &&
                   IrReceiver.decodedIRData.address == 0 &&
                   IrReceiver.decodedIRData.decodedRawData == 0 &&
                   IrReceiver.decodedIRData.numberOfBits == 0);

  if (is_noise)
  {
    return;
  }

  uint32_t command = IrReceiver.decodedIRData.command;
  uint32_t raw_data = IrReceiver.decodedIRData.decodedRawData;

  // Check if target code
  if (command == target_ir_code || raw_data == target_ir_code)
  {
    Serial.println(F("[LeverBoiler] *** TARGET CODE 0x51 DETECTED! ***"));

    // Publish to Sentient
    DynamicJsonDocument doc(128);
    doc["sensor"] = (pin == ir_sensor_1_pin) ? "sensor1" : "sensor2";
    doc["code"] = command;
    doc["ts"] = millis();
    mqtt.publishJson("sensors", "ir_signal", doc);

    // Flash power LED
    digitalWrite(power_led_pin, LOW);
    delay(100);
    digitalWrite(power_led_pin, HIGH);
    delay(100);
    digitalWrite(power_led_pin, LOW);
    delay(100);
    digitalWrite(power_led_pin, HIGH);
  }
  else
  {
    // Wrong code
    Serial.print(F("[LeverBoiler] Wrong gun ID: 0x"));
    Serial.println(command, HEX);

    DynamicJsonDocument doc(128);
    doc["sensor"] = (pin == ir_sensor_1_pin) ? "sensor1" : "sensor2";
    doc["code"] = command;
    doc["error"] = "wrong_gun_id";
    doc["ts"] = millis();
    mqtt.publishJson("sensors", "ir_signal", doc);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────

bool parse_truth(const String &value)
{
  String lower = value;
  lower.toLowerCase();
  return (lower == "1" || lower == "true" || lower == "on" || lower == "yes");
}

String extract_command_value(const JsonDocument &payload)
{
  if (payload.is<const char *>())
  {
    return String(payload.as<const char *>());
  }
  else if (payload.is<int>())
  {
    return String(payload.as<int>());
  }
  return String();
}
