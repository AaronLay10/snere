# Chemical Puzzle - Configuration Details

## Overview
The Chemical puzzle requires players to place 6 RFID-tagged chemical vials into the correct positions. The drawer mechanism is controlled by a linear actuator with magnetic locks.

**Puzzle Type:** Multi-RFID positioning puzzle
**Complexity:** High - 6 simultaneous RFID readers

---

## Hardware Specifications

### Controller
- **Teensy:** 4.1
- **Device ID:** clockwork-chemical
- **MQTT Topic Base:** `paragon/Clockwork/Chemical/clockwork-chemical/`

### RFID Readers (6x EM-18 Modules)
Each reader operates at 9600 baud with STX/ETX framing protocol.

| Position | Serial Port | RX Pin | TX Pin | TIR Sensor Pin |
|----------|-------------|--------|--------|----------------|
| A | Serial3 | 15 | 14 | 41 |
| B | Serial5 | 21 | 20 | 19 |
| C | Serial1 | 0 | 1 | 2 |
| D | Serial6 | 25 | 24 | 26 |
| E | Serial2 | 7 | 8 | 9 |
| F | Serial4 | 16 | 17 | 18 |

### TIR (Tag-in-Range) Sensors
- **Type:** Proximity sensors (digital input)
- **Logic:** HIGH = tag present, LOW = tag removed
- **Purpose:** Detects physical presence of RFID tag
- **Configuration:** INPUT_PULLDOWN

### Linear Actuator
- **Forward Pin:** 22 (HIGH = drawer UP/retracted)
- **Reverse Pin:** 23 (HIGH = drawer DOWN/extended)
- **Default State:** UP (retracted)
- **Control:** Directional control (forward/reverse/stop)

### Magnetic Locks
- **Pin:** 36
- **Logic:** HIGH = locked, LOW = unlocked
- **Default State:** Locked (HIGH)
- **Purpose:** Secure drawer mechanism

### Status LED
- **Pin:** 13 (onboard LED)
- **Purpose:** Power/status indication

---

## Pin Configuration Reference

```cpp
// RFID Serial Ports
#define RFID_A Serial3  // Pins 14/15
#define RFID_B Serial5  // Pins 20/21
#define RFID_C Serial1  // Pins 0/1
#define RFID_D Serial6  // Pins 24/25
#define RFID_E Serial2  // Pins 7/8
#define RFID_F Serial4  // Pins 16/17

// TIR Sensors
TIR_A: Pin 41
TIR_B: Pin 19
TIR_C: Pin 2
TIR_D: Pin 26
TIR_E: Pin 9
TIR_F: Pin 18

// Actuator
ACTUATOR_FWD: Pin 22
ACTUATOR_RWD: Pin 23

// Maglocks
MAGLOCKS: Pin 36

// Status
POWER_LED: Pin 13
```

---

## MQTT Topics

### Subscribe
- `paragon/Clockwork/Chemical/clockwork-chemical/Commands`

### Publish
- `paragon/Clockwork/Chemical/clockwork-chemical/Telemetry`
- `paragon/Clockwork/Chemical/clockwork-chemical/Status`
- `paragon/Clockwork/Chemical/clockwork-chemical/Events`
- `paragon/Clockwork/Chemical/clockwork-chemical/Heartbeat`

---

## Universal Commands

### activate
Starts RFID tag monitoring.

```json
{"action": "activate"}
```

**Response:**
- State changes to ACTIVE
- Begins publishing RFID tag positions every 200ms

### reset
Clears all RFID tag buffers and returns to ready state.

```json
{"action": "reset"}
```

**Response:**
- State changes to WAITING
- All tag buffers cleared
- TIR presence flags reset

### solved
Manually marks puzzle as solved.

```json
{"action": "solved"}
```

**Response:**
- State changes to SOLVED
- Event published

### inactivate
Disables puzzle monitoring.

```json
{"action": "inactivate"}
```

**Response:**
- State changes to INACTIVE
- RFID monitoring continues but state changes disabled

### override
Force specific state.

```json
{"action": "override", "state": "ACTIVE"}
```

**Valid States:** INACTIVE, WAITING, ACTIVE, SOLVED, ERROR

### powerOff
Safe shutdown - locks drawer and retracts actuator.

```json
{"action": "powerOff"}
```

**Response:**
- Maglocks engage (HIGH)
- Actuator moves UP
- State changes to INACTIVE

---

## Puzzle-Specific Commands

### actuator
Controls linear actuator movement.

```json
{"action": "actuator", "direction": "down"}
```

**Valid Directions:**
- `"down"` - Extend drawer (FWD=LOW, RWD=HIGH)
- `"up"` - Retract drawer (FWD=HIGH, RWD=LOW)
- `"stop"` - Stop movement (both LOW)

**Example - Extend Drawer:**
```json
{
  "action": "actuator",
  "direction": "down"
}
```

### maglock
Controls magnetic locks.

```json
{"action": "maglock", "state": "unlock"}
```

**Valid States:**
- `"unlock"` - Release locks (LOW)
- `"lock"` - Engage locks (HIGH)

**Example - Unlock Drawer:**
```json
{
  "action": "maglock",
  "state": "unlock"
}
```

---

## Telemetry Format

Published every 200ms (responsive RFID updates):

```json
{
  "state": 2,
  "tags": [
    "4A0012BC3F",
    "EMPTY",
    "4A00123456",
    "EMPTY",
    "4A00ABCDEF",
    "4A00FEDCBA"
  ],
  "tirSensors": [true, false, true, false, true, true]
}
```

### Fields

**state** (integer):
- 0 = INACTIVE
- 1 = WAITING
- 2 = ACTIVE
- 3 = SOLVED
- 4 = ERROR

**tags** (array[6] of strings):
- Index 0 = Position A
- Index 1 = Position B
- Index 2 = Position C
- Index 3 = Position D
- Index 4 = Position E
- Index 5 = Position F
- Value = RFID tag ID (10-character hex) or "EMPTY"

**tirSensors** (array[6] of booleans):
- Corresponds to tags array indices
- `true` = tag physically present
- `false` = slot empty

---

## RFID Protocol Details

### EM-18 Reader Specifications
- **Baud Rate:** 9600
- **Framing:** STX (0x02) + Data + ETX (0x03)
- **Tag Format:** 10-character hexadecimal string
- **Read Distance:** ~10cm
- **Read Rate:** Continuous when tag present

### Packet Structure
```
0x02 [10 hex characters] [optional CR] 0x03
```

Example: `0x02 4A0012BC3F 0x0D 0x03`

### Tag Clearing Logic
When TIR sensor goes LOW (tag removed):
- Tag buffer immediately cleared to empty string
- `tagPresent` flag set to false
- Next telemetry publish shows "EMPTY"

---

## Puzzle Solution Logic

The Puzzle Engine validates the correct combination. Typical flow:

1. **Player Action:** Place chemical vial on RFID reader
2. **Hardware Detection:**
   - TIR sensor goes HIGH
   - RFID reader reads tag ID
   - Tag stored in buffer
3. **Telemetry Update:** Tag ID published in telemetry
4. **Puzzle Engine:** Checks if all 6 positions have correct tags
5. **Success:**
   - Puzzle Engine sends `solved` command
   - Puzzle Engine sends `maglock unlock` command
   - Puzzle Engine sends `actuator down` command
   - Drawer extends to reveal next clue

---

## Testing Procedures

### Basic RFID Test

1. **Power On:**
   ```bash
   # Monitor MQTT topic
   mosquitto_sub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/#' -v
   ```

2. **Activate Puzzle:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "activate"}'
   ```

3. **Place Test Tag:**
   - Place RFID tag on Position A
   - Verify TIR sensor detects presence
   - Verify tag ID appears in telemetry:
     ```json
     {"state": 2, "tags": ["4A0012BC3F", "EMPTY", ...], "tirSensors": [true, false, ...]}
     ```

4. **Remove Test Tag:**
   - Remove RFID tag from Position A
   - Verify telemetry updates:
     ```json
     {"state": 2, "tags": ["EMPTY", "EMPTY", ...], "tirSensors": [false, false, ...]}
     ```

### Actuator Test

1. **Extend Drawer:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "actuator", "direction": "down"}'
   ```
   - Verify drawer extends (actuator moves down)

2. **Retract Drawer:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "actuator", "direction": "up"}'
   ```
   - Verify drawer retracts (actuator moves up)

3. **Stop Actuator:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "actuator", "direction": "stop"}'
   ```
   - Verify actuator stops immediately

### Maglock Test

1. **Unlock:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "maglock", "state": "unlock"}'
   ```
   - Verify magnetic locks release

2. **Lock:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Chemical/clockwork-chemical/Commands' \
     -m '{"action": "maglock", "state": "lock"}'
   ```
   - Verify magnetic locks engage

### Full Integration Test

1. Start in WAITING state
2. Activate puzzle
3. Place all 6 correct RFID tags simultaneously
4. Verify Puzzle Engine detects correct combination
5. Verify `solved` command received
6. Verify maglock unlocks
7. Verify actuator extends drawer
8. Remove tags and reset puzzle

---

## Troubleshooting

### RFID Tag Not Reading

**Symptoms:**
- Tag shows "EMPTY" even when physically present
- TIR sensor shows false

**Checks:**
1. Verify TIR sensor wiring and pin configuration
2. Check RFID reader serial connection (RX/TX)
3. Verify baud rate (9600)
4. Test TIR sensor directly with multimeter
5. Check for serial port conflicts

**Solution:**
- Monitor Serial console for raw RFID data
- Verify STX (0x02) and ETX (0x03) framing
- Check tag distance (should be <10cm)

### Actuator Not Moving

**Symptoms:**
- Actuator command accepted but no movement

**Checks:**
1. Verify actuator power supply
2. Check pin connections (FWD=22, RWD=23)
3. Test actuator directly with jumper wires
4. Check for mechanical obstruction

**Solution:**
- Verify control logic (FWD HIGH + RWD LOW = UP)
- Check actuator driver board status LEDs

### Maglocks Not Engaging

**Symptoms:**
- Lock command sent but drawer still movable

**Checks:**
1. Verify maglock power supply (typically 12V)
2. Check pin 36 output with multimeter
3. Test maglock relay/driver board
4. Verify maglock alignment

**Solution:**
- Check relay operation (should hear click)
- Verify maglock holding force
- Check for mechanical misalignment

### Incorrect Tag ID Published

**Symptoms:**
- Wrong tag ID in telemetry
- Corrupted or partial tag IDs

**Checks:**
1. Verify EM-18 reader quality
2. Check for RF interference
3. Verify tag quality and encoding
4. Check serial baud rate accuracy

**Solution:**
- Replace suspect RFID reader
- Add shielding to reduce interference
- Verify tag with known-good reader

---

## SFX Cues

**Chemical Solved:** TBD (assigned by Puzzle Engine)

---

## Wiring Diagram Notes

### RFID Reader Wiring (per reader)
- **VCC:** 5V
- **GND:** Ground
- **TX:** Connect to Teensy RX pin (see table above)
- **TIR:** Connect to dedicated digital pin (INPUT_PULLDOWN)

### TIR Sensor Logic
- **Active HIGH** when tag in range
- **Pulldown resistor** prevents floating when tag absent
- **Typical Distance:** 1-2cm above RFID antenna

### Actuator Wiring
- **Directional Control:** H-bridge or motor driver
- **Forward (UP):** Pin 22 HIGH, Pin 23 LOW
- **Reverse (DOWN):** Pin 22 LOW, Pin 23 HIGH
- **Brake:** Both LOW

### Maglock Wiring
- **Control:** Pin 36 via relay module
- **HIGH:** Relay energized, maglock powered (locked)
- **LOW:** Relay off, maglock unpowered (unlocked)

---

## File Locations

### Firmware
- `/opt/paragon/hardware/Puzzle Code Teensy/Chemical/Chemical_NEW.ino`
- `/opt/paragon/hardware/Puzzle Code Teensy/Chemical/FirmwareMetadata.h`

### Documentation
- `/opt/paragon/hardware/Puzzle Code Teensy/Chemical/config/Chemical Configuration Details.md` (this file)

---

**Firmware Version:** 2.0.0
**Architecture:** MythraOS_MQTT
**Migration Date:** 2025
**Complexity Rating:** High (6 independent RFID subsystems)
