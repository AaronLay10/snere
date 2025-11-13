# Fuse Puzzle Configuration Details

**RoomID**: Clockwork
**Microcontroller Type**: Puzzle
**PuzzleID**: Fuse
**Device ID**: clockwork-fuse
**Firmware Version**: v1.0.0
**SCS Sound Effect**: Q6

## Overview

The Fuse puzzle requires players to insert the correct RFID-tagged fuses into five slots AND place the correct resistor values into three main fuse slots, then activate a knife switch. Upon solving, panels can be dropped to reveal the next puzzle stage.

## Hardware Components

### Inputs/Sensors

#### RFID Readers (5x EM-18 Modules)
- **Type**: EM-18 RFID Reader, 9600 baud
- **Protocol**: STX (0x02) + Tag Data + ETX (0x03)

| Slot | Serial Port | TX/RX Pins | TIR Sensor Pin | READ Pin |
|------|-------------|------------|----------------|----------|
| A | Serial1 | 0, 1 | 4 | 26 |
| B | Serial2 | 7, 8 | 5 | 28 |
| C | Serial3 | 14, 15 | 2 | 27 |
| D | Serial4 | 16, 17 | 6 | 30 |
| E | Serial5 | 20, 21 | 3 | 29 |

- **TIR Sensors**: IR proximity detectors (INPUT_PULLDOWN)
  - HIGH = tag present
  - LOW = tag removed (clears tag data)
- **READ Pins**: Verification signal from RFID reader (INPUT_PULLDOWN)

#### Fuse Resistor Slots (3x Analog Voltage Dividers)
- **Type**: Voltage divider with 1kΩ reference resistor
- **Pins**:
  - MAIN_FUSE_A: A5 (Pin 19)
  - MAIN_FUSE_B: A8 (Pin 22)
  - MAIN_FUSE_C: A9 (Pin 23)
- **Calculation**: R_fuse = (1kΩ × (V_in - V_out)) / V_out
- **Range**: 0-1000Ω (values > 1000Ω read as 0)
- **Supply**: 3.3V (scaled to 3300 for integer math)

#### Knife Switch
- **Pin**: 18 (INPUT_PULLDOWN)
- **State**: HIGH = activated, LOW = off

### Outputs/Effects

#### Maglocks (3x Drop Panels)
- **Type**: Electromagnetic locks
- **Control**: HIGH = locked, LOW = unlocked (panel drops)

| Panel | Pin | Purpose |
|-------|-----|---------|
| B | 10 | Drop panel B |
| C | 11 | Drop panel C |
| D | 12 | Drop panel D |

#### Metal Gate
- **Pin**: 31
- **Control**: HIGH = locked, LOW = unlocked
- **Purpose**: Unlocks metal door mechanism

#### Actuator
- **Forward Pin**: 33
- **Reverse Pin**: 34
- **Initial State**: FWD=HIGH, RWD=LOW
- **Purpose**: Panel mechanism (not currently used in solve sequence)

## Solve Mechanism

The puzzle continuously publishes all sensor data via MQTT. The **Puzzle Engine** evaluates the solve condition:

### Solve Requirements (defined in Puzzle Engine)
1. **Correct RFID tags** in slots A-E
2. **Correct resistor values** in fuse slots A-C
3. **Knife switch activated**

### Solve Sequence
1. Player inserts 5 correct RFID-tagged fuses
2. Player inserts 3 correct resistor values
3. Player activates knife switch
4. Puzzle Engine detects solve → triggers Effects Controller
5. Effects Controller plays SCS sound effect **Q6**
6. Effects Controller sends `dropPanel` commands to drop specific panels

## MQTT Topic Structure

All topics follow: `paragon/Clockwork/Fuse/{DeviceID}/{Category}`

### Published Topics

| Topic | Purpose | Format | Frequency |
|-------|---------|--------|-----------|
| `.../Telemetry` | All sensor data | JSON with RFID tags + resistors + knife switch | Every 500ms when active |
| `.../Status` | Puzzle state changes | `{"puzzleStatus":"active"}` | On state change |
| `.../Events` | Puzzle lifecycle events | `{"event":"PuzzleActivated"}` | On events |
| `.../Heartbeat` | Health check | `{"status":"online","metadata":{...}}` | Every 5 seconds |

### Subscribed Topics

| Topic | Purpose |
|-------|---------|
| `.../Commands` | Receive control commands |

## Telemetry Data Format

```json
{
  "uniqueId": "clockwork-fuse",
  "timestamp": 1234567890,
  "sensors": [
    {
      "name": "rfidA",
      "value": "4D00FF1234",
      "present": true
    },
    {
      "name": "rfidB",
      "value": "EMPTY",
      "present": false
    },
    {
      "name": "rfidC",
      "value": "4D00AB5678",
      "present": true
    },
    {
      "name": "rfidD",
      "value": "EMPTY",
      "present": false
    },
    {
      "name": "rfidE",
      "value": "4D00CD9012",
      "present": true
    },
    {
      "name": "fuseA",
      "value": 220,
      "unit": "ohms"
    },
    {
      "name": "fuseB",
      "value": 470,
      "unit": "ohms"
    },
    {
      "name": "fuseC",
      "value": 0,
      "unit": "ohms"
    },
    {
      "name": "knifeSwitch",
      "value": 1
    }
  ]
}
```

## Universal Commands

### activate
**Payload**: `{"command":"activate"}`
**Effect**:
- Sets state to ACTIVE
- Begins publishing telemetry every 500ms
- Publishes PuzzleActivated event

### reset
**Payload**: `{"command":"reset"}`
**Effect**:
- Clears all RFID tag data
- Locks all maglocks (panels B, C, D)
- Locks metal gate
- Sets state to INACTIVE

### solved
**Payload**: `{"command":"solved"}`
**Effect**:
- Manual solve override (testing)
- Sets state to SOLVED
- Publishes PuzzleSolved event

### inactivate
**Payload**: `{"command":"inactivate"}`
**Effect**:
- Sets state to INACTIVE
- Stops telemetry publishing

### override
**Payload**: `{"command":"override","state":"active"}`
**Effect**:
- Force specific puzzle state

### powerOff
**Payload**: `{"command":"powerOff"}`
**Effect**:
- Locks all maglocks and metal gate
- Safe shutdown
- Disconnects MQTT

## Puzzle-Specific Commands

### metalDoor
**Purpose**: Unlock metal gate
**Payload**: `{"command":"metalDoor"}`
**Effect**:
- Sets METAL_GATE pin LOW (unlocked)
- Publishes MetalDoorUnlocked event

### dropPanel
**Purpose**: Drop specific panel by releasing maglock
**Payload**: `{"command":"dropPanel","panel":"b"}`
**Panel Options**: "b", "c", or "d" (case-insensitive)
**Effect**:
- Sets corresponding MAGLOCK pin LOW
- Panel falls under gravity
- Publishes PanelDropped event with panel letter

**Example**:
```json
{"command":"dropPanel","panel":"b"}  // Drops panel B
{"command":"dropPanel","panel":"C"}  // Drops panel C
```

## State Machine

```
┌─────────────┐
│  INACTIVE   │ ← Initial state, sensors monitored but not published
└──────┬──────┘
       │ activate
       ↓
┌─────────────┐
│   ACTIVE    │ ← Publishing all sensor data every 500ms
└──────┬──────┘
       │ solved (from Puzzle Engine when conditions met)
       ↓
┌─────────────┐
│   SOLVED    │ ← Triggers panel drops and metal gate unlock
└─────────────┘

  Any state → INACTIVE via reset command
```

## Integration with ParagonMythraOS

### Solve Sequence Flow

```
Fuse Teensy 4.1
  ↓ Publishes telemetry (500ms)
paragon/Clockwork/Fuse/clockwork-fuse/Telemetry
  ↓ Subscribed by
Device Monitor (port 3003)
  ↓ HTTP POST
Puzzle Engine (port 3004)
  ↓ Evaluates: correct tags + resistors + knife switch
  ↓ If solved, HTTP POST
Effects Controller (port 3005)
  ↓ Executes solve sequence:
  │  1. MQTT → SCS Bridge → Play Q6 sound effect
  │  2. MQTT → Fuse Teensy → dropPanel commands
  ↓
SCS plays audio, panels drop
```

### Puzzle Engine Configuration Example

```json
{
  "id": "clockwork-fuse",
  "name": "Fuse Puzzle",
  "roomId": "Clockwork",
  "description": "Insert correct fuses and resistors, activate knife switch",
  "timeLimitMs": 600000,
  "solveCondition": {
    "type": "multi-sensor",
    "deviceId": "clockwork-fuse",
    "requirements": {
      "rfidA": "4D00FF1234",
      "rfidB": "4D00AB5678",
      "rfidC": "4D00CD9012",
      "rfidD": "4D00EF3456",
      "rfidE": "4D0012ABCD",
      "fuseA": {"min": 215, "max": 225},
      "fuseB": {"min": 465, "max": 475},
      "fuseC": {"min": 990, "max": 1010},
      "knifeSwitch": 1
    }
  },
  "outputs": ["fuse-solved-sequence"]
}
```

### Effects Controller Sequence Example

```json
{
  "sequenceId": "fuse-solved-sequence",
  "steps": [
    {
      "order": 1,
      "offsetMs": 0,
      "action": "play-fuse-sfx",
      "description": "Play Fuse sound effect via SCS",
      "payload": {
        "topic": "paragon/Clockwork/Audio/commands/playCue",
        "command": "playCue",
        "cueId": "Q6"
      }
    },
    {
      "order": 2,
      "offsetMs": 500,
      "action": "drop-panel-b",
      "description": "Drop panel B",
      "payload": {
        "topic": "paragon/Clockwork/Fuse/clockwork-fuse/Commands",
        "command": "dropPanel",
        "panel": "b"
      }
    },
    {
      "order": 3,
      "offsetMs": 1000,
      "action": "drop-panel-c",
      "description": "Drop panel C",
      "payload": {
        "topic": "paragon/Clockwork/Fuse/clockwork-fuse/Commands",
        "command": "dropPanel",
        "panel": "c"
      }
    },
    {
      "order": 4,
      "offsetMs": 1500,
      "action": "unlock-metal-gate",
      "description": "Unlock metal gate",
      "payload": {
        "topic": "paragon/Clockwork/Fuse/clockwork-fuse/Commands",
        "command": "metalDoor"
      }
    }
  ]
}
```

## Testing Procedures

### 1. RFID Reader Test
```bash
# Activate puzzle
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Fuse/clockwork-fuse/Commands" \
  -m '{"command":"activate"}'

# Monitor telemetry
mosquitto_sub -h 192.168.20.3 -t "paragon/Clockwork/Fuse/clockwork-fuse/Telemetry" -v

# Insert RFID tags one at a time, verify they appear in telemetry
# Remove tags, verify they clear (show "EMPTY")
```

### 2. Resistor Test
```bash
# With puzzle active, insert resistors into fuse slots
# Verify analog readings convert correctly to ohm values
# Test with known resistor values (220Ω, 470Ω, 1kΩ)
```

### 3. Knife Switch Test
```bash
# Flip knife switch ON
# Verify knifeSwitch sensor changes from 0 to 1 in telemetry
```

### 4. Panel Drop Test
```bash
# Drop individual panels
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Fuse/clockwork-fuse/Commands" \
  -m '{"command":"dropPanel","panel":"b"}'

# Verify panel B maglock releases (panel falls)
```

### 5. Metal Gate Test
```bash
# Unlock metal gate
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Fuse/clockwork-fuse/Commands" \
  -m '{"command":"metalDoor"}'

# Verify gate unlocks
```

### 6. Reset Test
```bash
# Reset puzzle
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Fuse/clockwork-fuse/Commands" \
  -m '{"command":"reset"}'

# Verify all tags cleared, all panels locked
```

## Troubleshooting

### Issue: RFID tags not reading
**Check**:
- Serial baud rate (9600)
- TIR sensor wiring
- Tag proximity to reader
- Serial port conflicts

### Issue: Resistor values incorrect
**Check**:
- 1kΩ reference resistor installed
- 3.3V supply stable
- ADC pin connections
- Resistor tolerance (±5% typical)

### Issue: Panels won't drop
**Check**:
- Maglock power supply (12V typical)
- Pin states (LOW = unlocked)
- Mechanical obstruction

### Issue: Tags not clearing when removed
**Check**:
- TIR sensor functionality
- Sensor wiring (should be INPUT_PULLDOWN)
- IR LED power

## Hardware Notes

- **RFID Tag Format**: 10-14 character hexadecimal string
- **Tag Encoding**: Tags are cleaned (newlines/carriage returns removed)
- **Resistor Tolerance**: ±5% typical, use ±10 ohm window for solve conditions
- **Voltage Divider**: Uses 10-bit ADC (0-1023 range)
- **Maglock Safety**: Failsafe locked (HIGH = locked) for safety

## Pin Reference Quick Sheet

| Component | Pin | Mode | Notes |
|-----------|-----|------|-------|
| Power LED | 13 | OUTPUT | Onboard LED |
| RFID A TX/RX | 0, 1 | Serial1 | 9600 baud |
| RFID B TX/RX | 7, 8 | Serial2 | 9600 baud |
| RFID C TX/RX | 14, 15 | Serial3 | 9600 baud |
| RFID D TX/RX | 16, 17 | Serial4 | 9600 baud |
| RFID E TX/RX | 20, 21 | Serial5 | 9600 baud |
| TIR A-E | 4, 5, 2, 6, 3 | INPUT_PULLDOWN | Tag presence |
| READ A-E | 26, 28, 27, 30, 29 | INPUT_PULLDOWN | Read verify |
| Fuse A-C | A5, A8, A9 | ANALOG INPUT | Resistor sensing |
| Knife Switch | 18 | INPUT_PULLDOWN | Activation switch |
| Maglock B-D | 10, 11, 12 | OUTPUT | HIGH = locked |
| Metal Gate | 31 | OUTPUT | HIGH = locked |
| Actuator FWD/RWD | 33, 34 | OUTPUT | Panel mechanism |

## Version History

- **v1.0.0** (2025-10-11): Initial ParagonMythraOS migration
  - Standardized command protocol
  - MythraOS_MQTT library integration
  - 5 RFID readers + 3 resistor sensors
  - Panel drop and metal gate controls
  - SCS Q6 sound effect integration
