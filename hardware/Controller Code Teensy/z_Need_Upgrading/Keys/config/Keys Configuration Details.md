# Keys Puzzle - Configuration Details

## Overview
The Keys puzzle requires players to activate 4 pairs of key switches simultaneously. Each pair is color-coded (Green, Yellow, Blue, Red) with LED visual feedback.

**Puzzle Type:** Multi-key activation puzzle
**Complexity:** Low - Simple digital input monitoring

---

## Hardware Specifications

### Controller
- **Teensy:** 4.1
- **Device ID:** clockwork-keys
- **MQTT Topic Base:** `paragon/Clockwork/Keys/clockwork-keys/`

### Key Switches (8 total, 4 pairs)
All key switches use INPUT_PULLUP configuration (active LOW when pressed).

| Color Pair | Key 1 Pin | Key 2 Pin | LED Index |
|------------|-----------|-----------|-----------|
| Green | 3 (Bottom) | 4 (Right) | 0 |
| Yellow | 5 (Right) | 6 (Top) | 1 |
| Blue | 7 (Left) | 8 (Bottom) | 2 |
| Red | 9 (Left) | 10 (Bottom) | 3 |

### LED Strip
- **Type:** WS2812B
- **Pin:** 2
- **Count:** 4 LEDs (one per color pair)
- **Brightness:** 255 (max)
- **Color Order:** RGB
- **Default Color:** Amber (0x886308)

### Status LED
- **Pin:** 13 (onboard LED)
- **Purpose:** Power/status indication

---

## Pin Configuration Reference

```cpp
// Key Switches (INPUT_PULLUP, active LOW)
GREEN_BOTTOM: Pin 3
GREEN_RIGHT: Pin 4
YELLOW_RIGHT: Pin 5
YELLOW_TOP: Pin 6
BLUE_LEFT: Pin 7
BLUE_BOTTOM: Pin 8
RED_LEFT: Pin 9
RED_BOTTOM: Pin 10

// LED Strip
LED_PIN: Pin 2 (WS2812B)
NUM_LEDS: 4

// Status
POWER_LED: Pin 13
```

---

## MQTT Topics

### Subscribe
- `paragon/Clockwork/Keys/clockwork-keys/Commands`

### Publish
- `paragon/Clockwork/Keys/clockwork-keys/Telemetry`
- `paragon/Clockwork/Keys/clockwork-keys/Status`
- `paragon/Clockwork/Keys/clockwork-keys/Events`
- `paragon/Clockwork/Keys/clockwork-keys/Heartbeat`

---

## Universal Commands

### activate
Starts key pair monitoring with LED feedback.

```json
{"action": "activate"}
```

**Response:**
- State changes to ACTIVE
- LEDs show amber (inactive) or color (active) based on key pairs
- Telemetry publishes every 100ms

### reset
Returns puzzle to ready state.

```json
{"action": "reset"}
```

**Response:**
- State changes to WAITING
- All LEDs set to amber
- Key pair states cleared

### solved
Manually marks puzzle as solved.

```json
{"action": "solved"}
```

**Response:**
- State changes to SOLVED
- All LEDs set to white

### inactivate
Disables puzzle monitoring.

```json
{"action": "inactivate"}
```

**Response:**
- State changes to INACTIVE
- All LEDs set to amber

### override
Force specific state.

```json
{"action": "override", "state": "ACTIVE"}
```

**Valid States:** INACTIVE, WAITING, ACTIVE, SOLVED, ERROR

### powerOff
Safe shutdown - turns off all LEDs.

```json
{"action": "powerOff"}
```

**Response:**
- All LEDs turn off (black)
- State changes to INACTIVE

---

## Puzzle-Specific Commands

### setLED
Manually control LED colors (for effects or testing).

**Option 1: Named Color**
```json
{
  "action": "setLED",
  "color": "green"
}
```

**Valid Colors:**
- `"green"` - 0x00FF00
- `"yellow"` - 0xFFFF00
- `"blue"` - 0x0000FF
- `"red"` - 0xFF0000
- `"white"` - White
- `"amber"` - 0x886308 (default)
- `"off"` - Black (LEDs off)

**Option 2: Custom RGB**
```json
{
  "action": "setLED",
  "r": 255,
  "g": 128,
  "b": 0
}
```

---

## Telemetry Format

Published every 100ms (responsive key detection):

```json
{
  "state": 2,
  "keyPairs": [1, 0, 1, 0],
  "individualKeys": {
    "greenBottom": true,
    "greenRight": true,
    "yellowRight": false,
    "yellowTop": false,
    "blueLeft": true,
    "blueBottom": true,
    "redLeft": false,
    "redBottom": false
  }
}
```

### Fields

**state** (integer):
- 0 = INACTIVE
- 1 = WAITING
- 2 = ACTIVE
- 3 = SOLVED
- 4 = ERROR

**keyPairs** (array[4] of integers):
- Index 0 = Green pair (1 = both keys pressed, 0 = incomplete)
- Index 1 = Yellow pair
- Index 2 = Blue pair
- Index 3 = Red pair

**individualKeys** (object of booleans):
- Each key's state (true = pressed, false = not pressed)
- Useful for debugging individual key failures

---

## LED Behavior

### STATE_INACTIVE / STATE_WAITING
- All 4 LEDs: Amber (0x886308)

### STATE_ACTIVE
- LED shows amber when pair incomplete
- LED shows pair color when both keys pressed:
  - LED 0: Green (0x00FF00) when both green keys pressed
  - LED 1: Yellow (0xFFFF00) when both yellow keys pressed
  - LED 2: Blue (0x0000FF) when both blue keys pressed
  - LED 3: Red (0xFF0000) when both red keys pressed

### STATE_SOLVED
- All 4 LEDs: White

### STATE_ERROR
- All 4 LEDs: Red

---

## Puzzle Solution Logic

The Puzzle Engine validates the correct key combination. Typical flow:

1. **Player Action:** Insert and turn correct keys
2. **Hardware Detection:**
   - Key switches close (go LOW)
   - Both keys in pair must be active simultaneously
3. **LED Feedback:** LED changes from amber to color when pair complete
4. **Telemetry Update:** Key pair states published
5. **Puzzle Engine:** Checks if correct combination of pairs active
6. **Success:**
   - Puzzle Engine sends `solved` command
   - All LEDs turn white
   - Next puzzle unlocked

---

## Testing Procedures

### Basic Key Test

1. **Power On:**
   ```bash
   # Monitor MQTT topic
   mosquitto_sub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/#' -v
   ```

2. **Activate Puzzle:**
   ```bash
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "activate"}'
   ```

3. **Test Green Pair:**
   - Turn green bottom key (pin 3)
   - Verify telemetry shows `greenBottom: true`
   - Turn green right key (pin 4)
   - Verify telemetry shows `greenRight: true`
   - Verify `keyPairs[0]` shows `1`
   - Verify LED 0 turns green

4. **Release Keys:**
   - Release both green keys
   - Verify `keyPairs[0]` shows `0`
   - Verify LED 0 returns to amber

### LED Test

1. **Test Each Color:**
   ```bash
   # Green
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "green"}'

   # Yellow
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "yellow"}'

   # Blue
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "blue"}'

   # Red
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "red"}'

   # White
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "white"}'

   # Amber (default)
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "color": "amber"}'
   ```

2. **Custom RGB Test:**
   ```bash
   # Purple
   mosquitto_pub -h localhost -t 'paragon/Clockwork/Keys/clockwork-keys/Commands' \
     -m '{"action": "setLED", "r": 128, "g": 0, "b": 128}'
   ```

### Full Integration Test

1. Start in WAITING state (all LEDs amber)
2. Activate puzzle
3. Turn all 4 key pairs in correct sequence
4. Verify each LED changes to its color when pair complete
5. Verify Puzzle Engine detects correct combination
6. Verify `solved` command sets all LEDs white
7. Reset puzzle and verify return to amber

---

## Troubleshooting

### Key Switch Not Detecting

**Symptoms:**
- Individual key shows false even when turned
- Key pair never activates

**Checks:**
1. Verify INPUT_PULLUP configuration
2. Check key switch wiring (should short to ground when active)
3. Test key continuity with multimeter
4. Monitor Serial output for individual key states

**Solution:**
- Replace suspect key switch
- Check for loose wiring connections
- Verify Teensy pin not damaged

### LED Not Changing Color

**Symptoms:**
- LED stays amber even when key pair active
- LED incorrect color

**Checks:**
1. Verify `updateLEDs()` function called in ACTIVE state
2. Check LED index mapping in code
3. Test LED strip with `setLED` command
4. Verify FastLED data pin (pin 2)

**Solution:**
- Verify LED strip power supply
- Check data pin connection
- Test with manual LED commands

### Pair Activates with Only One Key

**Symptoms:**
- Key pair shows active when only one key pressed
- Wiring issue or code bug

**Checks:**
1. Verify AND logic in `readKeySwitches()`:
   ```cpp
   greenPairActive = greenBottomPressed && greenRightPressed;
   ```
2. Check individual key telemetry
3. Test each key independently

**Solution:**
- Verify both keys required for pair activation
- Check for short circuits between key pins

### LEDs Flickering or Wrong Colors

**Symptoms:**
- LEDs show random colors
- Intermittent flickering

**Checks:**
1. Verify WS2812B data line integrity
2. Check power supply stability
3. Add capacitor across LED strip power (100-1000µF)
4. Check ground connection

**Solution:**
- Add 330Ω resistor on data line near strip
- Ensure common ground between Teensy and LED power
- Use separate power supply for LEDs if needed

---

## SFX Cues

**Keys Solved:** TBD (assigned by Puzzle Engine)

---

## Wiring Diagram Notes

### Key Switch Wiring
- **Common Terminal:** Ground
- **NO (Normally Open) Terminal:** Connect to Teensy digital pin
- **Internal Pullup:** Enabled in code (INPUT_PULLUP)
- **Active State:** LOW when key turned, HIGH when released

### LED Strip Wiring
- **Power:** 5V supply (separate from Teensy if >4 LEDs)
- **Ground:** Common with Teensy ground
- **Data:** Pin 2 (consider 330Ω series resistor)
- **Capacitor:** 100-1000µF across power near strip

### Physical Layout
```
    [Yellow Top]
         |
[Blue Left] - - [Green Right]
         |           |
    [Red Left]  [Yellow Right]
         |           |
[Blue Bottom] [Red Bottom] [Green Bottom]
```

---

## File Locations

### Firmware
- `/opt/paragon/hardware/Puzzle Code Teensy/Keys/Keys_NEW.ino`
- `/opt/paragon/hardware/Puzzle Code Teensy/Keys/FirmwareMetadata.h`

### Documentation
- `/opt/paragon/hardware/Puzzle Code Teensy/Keys/config/Keys Configuration Details.md` (this file)

---

**Firmware Version:** 2.0.0
**Architecture:** MythraOS_MQTT
**Migration Date:** 2025
**Complexity Rating:** Low (Simple digital inputs with LED feedback)
