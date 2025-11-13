# Gear Puzzle Configuration Details

**RoomID**: Clockwork
**Microcontroller Type**: Puzzle
**PuzzleID**: Gear
**Device ID**: clockwork-gear
**Firmware Version**: v1.0.0

## Overview

The Gear puzzle uses two rotary encoders to track player input as they rotate physical gears. The puzzle monitors rotation counts continuously and publishes them for the Puzzle Engine to evaluate solve conditions.

## Hardware Components

### Inputs/Sensors

#### Encoder A (Gear A)
- **Type**: Quadrature rotary encoder
- **Pins**:
  - White wire → Pin 33 (Channel A)
  - Green wire → Pin 34 (Channel B)
- **Input Mode**: INPUT_PULLUP
- **Interrupts**: RISING edge on both channels
- **Counter**: `counterA` (volatile long, bidirectional)

#### Encoder B (Gear B)
- **Type**: Quadrature rotary encoder
- **Pins**:
  - White wire → Pin 35 (Channel A)
  - Green wire → Pin 36 (Channel B)
- **Input Mode**: INPUT_PULLUP
- **Interrupts**: RISING edge on both channels
- **Counter**: `counterB` (volatile long, bidirectional)

### Outputs/Effects

- **Power LED**: Pin 13 (onboard LED, indicates power status)
- **No other outputs** - This puzzle is pure sensor monitoring

## Solve Mechanism

The puzzle does **not** implement solve logic locally. It continuously publishes encoder counts to MQTT, and the **Puzzle Engine** evaluates whether the gears are in the correct positions.

### Expected Solve Conditions (from original firmware comments)
- Players must rotate gears to specific positions
- Solve thresholds are defined in Puzzle Engine configuration

## MQTT Topic Structure

All topics follow the pattern: `paragon/Clockwork/Gear/{DeviceID}/{Category}`

### Published Topics

| Topic | Purpose | Format | Frequency |
|-------|---------|--------|-----------|
| `.../Telemetry` | Encoder count data | `{"sensors":[{"name":"encoderA","value":123},{"name":"encoderB","value":456}]}` | Every 200ms when active |
| `.../Status` | Puzzle state changes | `{"puzzleStatus":"active","counterA":123,"counterB":456}` | On state change |
| `.../Events` | Puzzle events | `{"event":"PuzzleActivated","data":{...}}` | On events |
| `.../Heartbeat` | Health check | `{"status":"online","puzzleStatus":"active","metadata":{...}}` | Every 5 seconds |

### Subscribed Topics

| Topic | Purpose | Command Format |
|-------|---------|----------------|
| `.../Commands` | Receive control commands | `{"command":"activate"}` |

## Universal Commands

All commands sent to `paragon/Clockwork/Gear/clockwork-gear/Commands`:

### activate
**Purpose**: Start monitoring encoder rotations
**Payload**: `{"command":"activate"}`
**Effect**:
- Sets state to ACTIVE
- Begins publishing telemetry every 200ms
- Publishes PuzzleActivated event

### reset
**Purpose**: Reset puzzle to initial state
**Payload**: `{"command":"reset"}`
**Effect**:
- Resets both encoder counters to 0
- Sets state to INACTIVE
- Stops telemetry publishing
- Publishes PuzzleReset event

### solved
**Purpose**: Manual solve override (testing)
**Payload**: `{"command":"solved"}`
**Effect**:
- Sets state to SOLVED
- Publishes PuzzleSolved event with current encoder values

### inactivate
**Purpose**: Put puzzle to sleep
**Payload**: `{"command":"inactivate"}`
**Effect**:
- Sets state to INACTIVE
- Stops telemetry publishing

### override
**Purpose**: Force specific state or encoder values
**Payload**: `{"command":"override","state":"active","counterA":100,"counterB":200}`
**Optional Fields**:
- `state`: "inactive", "waiting", "active", or "solved"
- `counterA`: Set encoder A count
- `counterB`: Set encoder B count

### powerOff
**Purpose**: Safe shutdown
**Payload**: `{"command":"powerOff"}`
**Effect**:
- Sets state to INACTIVE
- Disconnects MQTT client gracefully

## Puzzle-Specific Commands

### resetCounters
**Purpose**: Zero encoder counters without changing state
**Payload**: `{"command":"resetCounters"}`
**Effect**:
- Sets counterA = 0
- Sets counterB = 0
- Publishes CountersReset event
- Does NOT change puzzle state

## State Machine

```
┌─────────────┐
│  INACTIVE   │ ← Initial state, counters can still rotate
└──────┬──────┘
       │ activate
       ↓
┌─────────────┐
│   ACTIVE    │ ← Publishing telemetry every 200ms
└──────┬──────┘
       │ solved (from Puzzle Engine or manual)
       ↓
┌─────────────┐
│   SOLVED    │ ← Final state
└─────────────┘

  Any state → INACTIVE via reset command
```

## Telemetry Data Format

### Sensor Data
```json
{
  "uniqueId": "clockwork-gear",
  "timestamp": 1234567890,
  "sensors": [
    {
      "name": "encoderA",
      "value": 123,
      "unit": "counts"
    },
    {
      "name": "encoderB",
      "value": -45,
      "unit": "counts"
    }
  ]
}
```

**Notes**:
- Encoder values can be positive or negative (bidirectional rotation)
- Values increment when rotated clockwise, decrement counter-clockwise
- No maximum/minimum bounds - counters are long integers

## Integration with ParagonMythraOS

### Service Interaction Flow

```
Gear Teensy 4.1
  ↓ Publishes telemetry (200ms interval)
paragon/Clockwork/Gear/clockwork-gear/Telemetry
  ↓ Subscribed by
Device Monitor (port 3003)
  ↓ HTTP POST /devices/clockwork-gear/telemetry
Puzzle Engine (port 3004)
  ↓ Evaluates solve condition
  ↓ If solved, HTTP POST to
Effects Controller (port 3005)
  ↓ Triggers solve sequence
  ↓ MQTT commands to
Hardware outputs + SCS Bridge (port 3006)
```

### Puzzle Engine Configuration

Example puzzle configuration for Puzzle Engine:

```json
{
  "id": "clockwork-gear",
  "name": "Gear Puzzle",
  "roomId": "Clockwork",
  "description": "Rotate gears to correct positions",
  "timeLimitMs": 300000,
  "solveCondition": {
    "type": "encoder-position",
    "deviceId": "clockwork-gear",
    "requirements": {
      "encoderA": {
        "min": 95,
        "max": 105
      },
      "encoderB": {
        "min": 195,
        "max": 205
      }
    }
  },
  "outputs": ["gear-solved-sequence"]
}
```

## Testing Procedures

### 1. Basic Hardware Test
```bash
# Send activate command
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Gear/clockwork-gear/Commands" \
  -m '{"command":"activate"}'

# Monitor telemetry
mosquitto_sub -h 192.168.20.3 -t "paragon/Clockwork/Gear/clockwork-gear/Telemetry" -v

# Rotate gears and verify encoder counts change
```

### 2. Reset Test
```bash
# Reset counters
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Gear/clockwork-gear/Commands" \
  -m '{"command":"reset"}'

# Verify counters are at 0
```

### 3. Override Test
```bash
# Set specific encoder values for testing
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Gear/clockwork-gear/Commands" \
  -m '{"command":"override","counterA":100,"counterB":200}'
```

### 4. Solve Test
```bash
# Manual solve
mosquitto_pub -h 192.168.20.3 -t "paragon/Clockwork/Gear/clockwork-gear/Commands" \
  -m '{"command":"solved"}'
```

## Troubleshooting

### Issue: Encoder counts not changing
**Check**:
- Verify encoder wiring (white/green to correct pins)
- Check pullup resistors are enabled
- Monitor Serial output for interrupt triggers

### Issue: Encoder counts erratic or jumping
**Cause**: Bounce or noise on encoder signals
**Solution**:
- Add hardware debouncing (0.1µF capacitors)
- Implement software debouncing in ISRs if needed

### Issue: Telemetry not publishing
**Check**:
- Puzzle must be in ACTIVE state
- MQTT broker connectivity
- Device Monitor subscription

## Hardware Notes

- **Encoder Type**: Quadrature incremental encoders
- **Resolution**: Depends on physical encoder (typically 360-600 PPR)
- **Direction Detection**: Uses quadrature phase relationship
- **Interrupt Efficiency**: ISRs are very short for minimal latency
- **No debouncing**: Relies on clean encoder signals (may need hardware caps)

## Migration from Old Firmware

### Changes from Original
1. **Removed**: Old `ParagonMQTT` library calls
2. **Added**: `MythraOS_MQTT` library integration
3. **Added**: Standardized command handling
4. **Added**: Structured telemetry format
5. **Added**: State machine with INACTIVE/ACTIVE/SOLVED states
6. **Added**: Event publishing for puzzle lifecycle
7. **Improved**: Consistent MQTT topic structure

### Backwards Compatibility
- Old MQTT topics are **not compatible**
- New topic structure: `paragon/Clockwork/Gear/clockwork-gear/{Category}`
- Old firmware used custom topic construction

## Pin Reference Quick Sheet

| Component | Pin | Mode | Notes |
|-----------|-----|------|-------|
| Power LED | 13 | OUTPUT | Onboard LED |
| Encoder A White | 33 | INPUT_PULLUP | Interrupt on RISING |
| Encoder A Green | 34 | INPUT_PULLUP | Interrupt on RISING |
| Encoder B White | 35 | INPUT_PULLUP | Interrupt on RISING |
| Encoder B Green | 36 | INPUT_PULLUP | Interrupt on RISING |

## Version History

- **v1.0.0** (2025-10-11): Initial ParagonMythraOS migration
  - Standardized command protocol
  - MythraOS_MQTT library integration
  - State machine implementation
  - Structured telemetry format
