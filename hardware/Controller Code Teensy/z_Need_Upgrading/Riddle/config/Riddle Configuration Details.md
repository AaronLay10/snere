# Riddle Puzzle Configuration Details

**RoomID**: Clockwork
**Microcontroller Type**: Puzzle
**PuzzleID**: Riddle
**Device ID**: clockwork-riddle
**Firmware Version**: v1.0.0
**SCS Sound Effect**: Q33

## Overview

The Riddle puzzle is a multi-stage puzzle featuring:
1. **Letter puzzle** with 20 rotary knobs and 50 NeoPixel LEDs
2. **Door mechanism** with dual stepper motors
3. **Lever/Gun detection** with IR receiver and photocell
4. **Maglock control** for access management

Players progress through different states, solving each stage to advance.

## Hardware Components

### Inputs/Sensors

#### Rotary Knobs (24 positions, organized by letter groups)
All knobs are INPUT_PULLUP, active when HIGH.

**Group A (2 knobs)**:
- A2: Pin 20
- A3: Pin 19

**Group B (4 knobs)**:
- B1: Pin 2
- B2: Pin 4
- B3: Pin 5
- B4: Pin 3

**Group C (4 knobs)**:
- C1: Pin 16
- C2: Pin 17
- C3: Pin 18
- C4: Pin 15

**Group D (4 knobs)**:
- D1: Pin 40
- D2: Pin 39
- D3: Pin 37
- D4: Pin 38

**Group E (4 knobs)**:
- E1: Pin 1
- E2: Pin 7
- E3: Pin 0
- E4: Pin 6

**Group F (4 knobs)**:
- F1: Pin 35
- F2: Pin 33
- F3: Pin 34
- F4: Pin 36

**Group G (2 knobs)**:
- G1: Pin 22
- G4: Pin 23

#### Clue Selection Buttons (3x)
- **Button 1**: Pin 31 (INPUT_PULLUP, active LOW)
- **Button 2**: Pin 30 (INPUT_PULLUP, active LOW)
- **Button 3**: Pin 32 (INPUT_PULLUP, active LOW)
- **Purpose**: Select which clue/word to display on LEDs

#### Door Endstop Sensors (4x)
- **SENSOR_UP_R**: Pin 28 (right side, door fully raised)
- **SENSOR_UP_L**: Pin 8 (left side, door fully raised)
- **SENSOR_DN_R**: Pin 41 (right side, door fully lowered)
- **SENSOR_DN_L**: Pin 21 (left side, door fully lowered)

#### IR Receiver
- **Pin**: 43
- **Type**: IR remote receiver (IRremote library)
- **Purpose**: Detect gun IR signals
- **Valid Gun IDs**: 0x51, 0x4D5E6F, 0x789ABC, 0xDEF123

#### Photocell
- **Pin**: A0 (analog)
- **Type**: Light-dependent resistor
- **Purpose**: Monitor light level in lever state

### Outputs/Effects

#### NeoPixel LED Strip
- **Pin**: 29 (WS2812B data)
- **Count**: 50 LEDs
- **Brightness**: 50 (0-255 scale)
- **Colors**:
  - Red (255, 0, 0) = LED off (no knobs active)
  - Black (0, 0, 0) = LED on (knob(s) active)

#### Stepper Motors (2x Full 4-Wire)
**Stepper One** (Right side):
- Pin1: 24
- Pin2: 25
- Pin3: 26
- Pin4: 27

**Stepper Two** (Left side):
- Pin1: 9
- Pin2: 10
- Pin3: 11
- Pin4: 12

**Configuration**:
- Max Speed: 8000 steps/sec
- Acceleration: 800 steps/sec²
- Run Speed: 1000 steps/sec

#### Maglock
- **Pin**: 42
- **Control**: HIGH = locked, LOW = unlocked
- **Purpose**: Lock lever mechanism until valid gun detected

## State Machine

```
STATE_STARTUP (0)
  ↓ activate command
STATE_KNOBS (1) ← Letter puzzle with LED feedback
  ↓ state command
STATE_MOTORS (2) ← Door raising/lowering
  ↓ state command
STATE_LEVER (3) ← IR gun detection
  ↓ state command
STATE_GUNS (4) ← Gun verification (future)
  ↓ state command
STATE_FINISHED (5) ← Completion
```

## Puzzle Mechanics

### State 1: KNOBS (Letter Puzzle)

Players rotate knobs to form letters/words on the LED strip.

**Mechanics**:
1. Each knob maps to specific LED pixels
2. When knob is rotated to active position (HIGH), its pixels light up
3. Multiple knobs can overlap on same pixels
4. LEDs show RED when no knobs active, BLACK when knobs active
5. Players press Button 1/2/3 to select which clue/word to display
6. `activeClue` variable tracks current selection (1, 2, or 3)

**Knob-to-LED Mapping** (defined in firmware):
- Each knob group (A2, A3, B1, etc.) maps to specific pixel indices
- Example: `knobPinA2[] = {42, 41, 40, 39, 38, 37}` means A2 controls pixels 42-37

### State 2: MOTORS (Door Mechanism)

Dual stepper motors raise or lower a door mechanism.

**Mechanics**:
1. Send `door` command with action: "lift", "lower", or "stop"
2. Motors run until endstop sensors trigger
3. Door position tracked: 1=closed, 2=open, 3=between
4. Motors synchronized (both run at same speed)
5. Automatic stop when limit switches hit

**Safety**:
- Cannot start new movement while motors running
- Endstops prevent over-travel
- Emergency stop via "stop" action

### State 3: LEVER (Gun Detection)

IR receiver detects valid gun signals to unlock maglock.

**Mechanics**:
1. IR receiver continuously monitors for signals
2. Weak signals filtered out (UNKNOWN protocol or protocol 2)
3. Valid gun IDs checked against whitelist
4. On valid gun: maglock unlocks (pin LOW), event published
5. Photocell monitors light level (reported in telemetry)

**Valid Gun IDs**:
- Gun 1: 0x51
- Gun 2: 0x4D5E6F
- Gun 3: 0x789ABC
- Gun 4: 0xDEF123

### State 4: GUNS

Reserved for future gun verification logic.

### State 5: FINISHED

Puzzle complete, standby state.

## MQTT Topic Structure

All topics: `paragon/Clockwork/Riddle/{DeviceID}/{Category}`

### Published Topics

| Topic | Purpose | Frequency |
|-------|---------|-----------|
| `.../Telemetry` | State-specific sensor data | Every 200ms when active |
| `.../Status` | Puzzle state changes | On state change |
| `.../Events` | Puzzle lifecycle events | On events |
| `.../Heartbeat` | Health check | Every 5 seconds |

### Subscribed Topics

| Topic | Purpose |
|-------|---------|
| `.../Commands` | Receive control commands |

## Telemetry Data Format

### State 1: KNOBS
```json
{
  "uniqueId": "clockwork-riddle",
  "timestamp": 1234567890,
  "state": 1,
  "activeClue": 2,
  "button1": 0,
  "button2": 1,
  "button3": 0,
  "knobs": {
    "A2": 1,
    "A3": 0,
    "B1": 1,
    "B2": 1,
    // ... all 24 knobs
  }
}
```

### State 2: MOTORS
```json
{
  "uniqueId": "clockwork-riddle",
  "timestamp": 1234567890,
  "state": 2,
  "direction": 1,
  "motorsRunning": true,
  "doorLocation": 3,
  "endstopUpR": false,
  "endstopUpL": false,
  "endstopDnR": false,
  "endstopDnL": false
}
```

### State 3: LEVER
```json
{
  "uniqueId": "clockwork-riddle",
  "timestamp": 1234567890,
  "state": 3,
  "photocell": 512,
  "gunCode": 81,
  "maglock": 0
}
```

## Universal Commands

### activate
**Payload**: `{"command":"activate"}`
**Effect**:
- Sets state to KNOBS (state 1)
- Begins telemetry publishing
- Publishes PuzzleActivated event

### reset
**Payload**: `{"command":"reset"}`
**Effect**:
- Stops motors
- Locks maglock
- Clears active clue
- Turns off all LEDs
- Sets state to STARTUP

### solved
**Payload**: `{"command":"solved"}`
**Effect**:
- Sets state to FINISHED
- Publishes PuzzleSolved event

### inactivate
**Payload**: `{"command":"inactivate"}`
**Effect**:
- Sets state to STARTUP

### override
**Payload**: `{"command":"override","state":2}`
**Effect**:
- Force specific state (0-5)

### powerOff
**Payload**: `{"command":"powerOff"}`
**Effect**:
- Stops motors
- Locks maglock
- Safe shutdown

## Puzzle-Specific Commands

### state
**Purpose**: Change puzzle state
**Payload**: `{"command":"state","value":1}`
**Value Range**: 0-5 (STARTUP, KNOBS, MOTORS, LEVER, GUNS, FINISHED)

**Example**:
```json
{"command":"state","value":1}  // Switch to KNOBS state
{"command":"state","value":2}  // Switch to MOTORS state
```

### door
**Purpose**: Control door mechanism
**Payload**: `{"command":"door","action":"lift"}`
**Actions**: "lift", "lower", "stop"

**Examples**:
```json
{"command":"door","action":"lift"}   // Raise door
{"command":"door","action":"lower"}  // Lower door
{"command":"door","action":"stop"}   // Emergency stop
```

**Notes**:
- Automatically switches to MOTORS state
- Ignores command if motors already running
- Motors stop automatically at endstops

### maglock
**Purpose**: Control lever maglock
**Payload**: `{"command":"maglock","action":"open"}`
**Actions**: "open", "close"

**Examples**:
```json
{"command":"maglock","action":"open"}   // Unlock (LOW)
{"command":"maglock","action":"close"}  // Lock (HIGH)
```

## Integration with ParagonMythraOS

### Solve Sequence Flow

```
Riddle Teensy 4.1
  ↓ Publishes telemetry (200ms)
paragon/Clockwork/Riddle/clockwork-riddle/Telemetry
  ↓ Subscribed by
Device Monitor (port 3003)
  ↓ HTTP POST
Puzzle Engine (port 3004)
  ↓ Evaluates state-specific solve conditions
  ↓ If solved, HTTP POST
Effects Controller (port 3005)
  ↓ Executes solve sequence:
  │  1. MQTT → SCS Bridge → Play Q33 sound effect
  │  2. MQTT → Riddle Teensy → state change commands
  ↓
SCS plays audio, puzzle advances states
```

### Puzzle Engine Configuration Example

```json
{
  "id": "clockwork-riddle",
  "name": "Riddle Puzzle",
  "roomId": "Clockwork",
  "description": "Multi-stage puzzle with letter knobs, door mechanism, and gun detection",
  "timeLimitMs": 900000,
  "stages": [
    {
      "stageId": "knobs",
      "solveCondition": {
        "type": "knob-pattern",
        "deviceId": "clockwork-riddle",
        "state": 1,
        "activeClue": 1,
        "requiredKnobs": ["A2", "B1", "C3", "D2"]
      }
    },
    {
      "stageId": "door",
      "solveCondition": {
        "type": "door-position",
        "deviceId": "clockwork-riddle",
        "state": 2,
        "doorLocation": 2
      }
    },
    {
      "stageId": "lever",
      "solveCondition": {
        "type": "gun-detected",
        "deviceId": "clockwork-riddle",
        "state": 3,
        "validGunCode": true
      }
    }
  ],
  "outputs": ["riddle-solved-sequence"]
}
```

### Effects Controller Sequence Example

```json
{
  "sequenceId": "riddle-solved-sequence",
  "steps": [
    {
      "order": 1,
      "offsetMs": 0,
      "action": "play-riddle-sfx",
      "description": "Play Riddle sound effect via SCS",
      "payload": {
        "topic": "paragon/Clockwork/Audio/commands/playCue",
        "command": "playCue",
        "cueId": "Q33"
      }
    },
    {
      "order": 2,
      "offsetMs": 500,
      "action": "advance-to-motors",
      "description": "Advance to door mechanism state",
      "payload": {
        "topic": "paragon/Clockwork/Riddle/clockwork-riddle/Commands",
        "command": "state",
        "value": 2
      }
    }
  ]
}
```

## Testing Procedures

### 1. Knobs State Test
```bash
# Activate puzzle (starts in KNOBS state)
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"activate"}'

# Monitor telemetry
mosquitto_sub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Telemetry" -v

# Rotate knobs and verify LED feedback
# Press buttons 1/2/3 to change active clue
```

### 2. Door Mechanism Test
```bash
# Switch to MOTORS state
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"state","value":2}'

# Lift door
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"door","action":"lift"}'

# Verify motors run until endstop

# Lower door
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"door","action":"lower"}'
```

### 3. Lever/Gun Test
```bash
# Switch to LEVER state
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"state","value":3}'

# Point IR gun at receiver
# Verify maglock unlocks on valid gun ID
# Check telemetry for gunCode value
```

### 4. Manual Maglock Test
```bash
# Unlock maglock
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"maglock","action":"open"}'

# Lock maglock
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Riddle/clockwork-riddle/Commands" \
  -m '{"command":"maglock","action":"close"}'
```

## Troubleshooting

### Issue: LEDs not updating
**Check**:
- Verify knob wiring (INPUT_PULLUP, active HIGH)
- Check NeoPixel data pin (29)
- Verify power supply (5V for WS2812B)
- Monitor Serial for knob state changes

### Issue: Motors not moving
**Check**:
- Verify stepper wiring (4-wire full step)
- Check endstop sensors (may be triggered)
- Ensure state is MOTORS (state 2)
- Check motorsRunning flag in telemetry

### Issue: Motors won't stop
**Check**:
- Endstop sensor wiring
- Send emergency stop: `{"command":"door","action":"stop"}`
- Verify endstop logic (active state)

### Issue: IR receiver not detecting guns
**Check**:
- IR receiver pin (43)
- Valid gun IDs in firmware
- Weak signal filtering (may be too aggressive)
- IR LED battery in gun

### Issue: Maglock won't unlock
**Check**:
- Maglock power supply (12V typical)
- Pin 42 state (LOW = unlocked)
- Valid gun detected event in logs

## Hardware Notes

- **NeoPixels**: WS2812B, 5V power, GRB color order
- **Steppers**: Full 4-wire stepper motors, unipolar/bipolar compatible
- **IR Protocol**: Supports multiple protocols, filters UNKNOWN and protocol 2
- **Photocell**: Analog reading 0-1023, higher = more light
- **Maglock**: Electromagnetic, failsafe locked (HIGH = locked)
- **Buttons**: Active LOW with internal pullups

## Knob-to-LED Pixel Mapping

This is the complex mapping that creates letters/words:

```cpp
// Example mappings (simplified):
knobPinA2[] = {42, 41, 40, 39, 38, 37}     // Controls 6 pixels
knobPinA3[] = {44, 45, 46, 47, 48, 49}     // Controls 6 pixels
knobPinB1[] = {30, 29, 28, 27, 26}         // Controls 5 pixels
// ... etc for all 24 knobs
```

**Logic**:
- Each knob lights up its assigned pixels when active (HIGH)
- Multiple knobs can share pixels (for letter intersections)
- `ledLetters` array counts how many knobs affect each pixel
- RED = 0 knobs active, BLACK = 1+ knobs active

## Pin Reference Quick Sheet

| Component | Pin(s) | Mode | Notes |
|-----------|--------|------|-------|
| Power LED | 13 | OUTPUT | Onboard LED |
| NeoPixel Data | 29 | OUTPUT | 50 LEDs, WS2812B |
| Buttons 1-3 | 31, 30, 32 | INPUT_PULLUP | Active LOW |
| Knobs A2-A3 | 20, 19 | INPUT_PULLUP | Active HIGH |
| Knobs B1-B4 | 2, 4, 5, 3 | INPUT_PULLUP | Active HIGH |
| Knobs C1-C4 | 16, 17, 18, 15 | INPUT_PULLUP | Active HIGH |
| Knobs D1-D4 | 40, 39, 37, 38 | INPUT_PULLUP | Active HIGH |
| Knobs E1-E4 | 1, 7, 0, 6 | INPUT_PULLUP | Active HIGH |
| Knobs F1-F4 | 35, 33, 34, 36 | INPUT_PULLUP | Active HIGH |
| Knobs G1, G4 | 22, 23 | INPUT_PULLUP | Active HIGH |
| Stepper One | 24, 25, 26, 27 | OUTPUT | Full 4-wire |
| Stepper Two | 9, 10, 11, 12 | OUTPUT | Full 4-wire |
| Endstops | 28, 8, 41, 21 | INPUT | Door position |
| IR Receiver | 43 | INPUT | IRremote lib |
| Photocell | A0 | ANALOG INPUT | 0-1023 |
| Maglock | 42 | OUTPUT | HIGH = locked |

## Version History

- **v1.0.0** (2025-10-11): Initial ParagonMythraOS migration
  - Standardized command protocol
  - MythraOS_MQTT library integration
  - Multi-state puzzle system
  - 20 knobs + 50 NeoPixels
  - Dual stepper motors
  - IR gun detection
  - SCS Q33 sound effect integration
