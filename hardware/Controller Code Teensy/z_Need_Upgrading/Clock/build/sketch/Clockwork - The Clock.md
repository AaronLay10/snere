#line 1 "/Users/aaron/Documents/ParagonEscape/Clockwork/Puzzles/Clock/Clockwork - The Clock.md"
Clockwork \- The Clock

There are multiple states for the Clock.

1. Idle  
   1. Turn on the Led strips to their assigned color  
2. Pilaster  
   1. Enable the Stepper Motors  
   2. Receive messages from the Pilaster puzzle and move the clock hands according to the math calculation. The message contains the status of 4 buttons in the room. Red, Black, Green, and Silver  
   3. The calculation is:  
      1. Red (subtract 3 hours)  
      2. Black (divide the hours by 2\)  
      3. Green (add 7 hours)  
      4. Silver (multiply the hours by 4\)  
   4. They have to solve the puzzle in 5 button presses.  
   5. If the hours go less than 0 at any time, the puzzle resets.  
   6. If the hours go over 24 hours at any time, the puzzle resets.  
   7. If the 5th button does not equal 6.5 hours or 6:30 then the puzzle resets  
   8. When a button is pressed. The calculation is made and then the clock hands will move accordingly. If there is a decimal hour, then the minute hand will move accordingly.  
   9. The objective is for the clock to read 6:30 within the 5 button presses.  
3. Lever  
   1. During the Lever state, we will turn on a blacklight on the clock door.  
4. Crank  
   1. There are gears in the room that will be placed on pegs causing the gears to interlock with each other. If they get all of the gears in the right place, they will turn a crank and the gears will turn 3 rotary encoders. We will use those rotary encoders to determine if the puzzle was finished properly. The encoders must turn with the correct ratios between the encoders.  
5. Operator  
   1. There are 8 wires hanging down towards 8 connectors. The goal is to put the wires in the correct order on the 8 connectors.  
   2. Each of the wires have a resistor inside of them. Using a 100 ohm reference resistor, we calculate the resistance of each resistor and send the results to the server.  
6. Finale

## Technical Notes & Troubleshooting

### Stepper Motor Configuration (DM542 Drivers)
The clock uses 3 stepper motors controlled by DM542 differential stepper drivers:
- **Hour Motor**: Pins 0-3 (STEP+, STEP-, DIR+, DIR-)
- **Gear Motor**: Pins 4-7 (STEP+, STEP-, DIR+, DIR-)  
- **Minute Motor**: Pins 8-11 (STEP+, STEP-, DIR+, DIR-)
- **Enable Pin**: Pin 12 (controls all motors)

### DM542 Differential Signaling Requirements
**CRITICAL**: DM542 drivers require specific differential signaling:
- **STEP Pulse**: STEP+ goes HIGH, STEP- stays LOW during pulse
- **Direction**: DIR+ and DIR- use complementary signals (one HIGH, one LOW)
- **Idle State**: Both STEP signals LOW when not pulsing
- **Timing**: Minimum 10μs pulse width, 200ms between steps for reliable operation

### Common Issues & Solutions

#### Problem: Motors humming but not moving
**Cause**: Incorrect differential signaling - both STEP+ and STEP- going HIGH simultaneously
**Solution**: 
```c
// CORRECT signaling for DM542
digitalWrite(stepPos, HIGH);  // STEP+ high
digitalWrite(stepNeg, LOW);   // STEP- low
delayMicroseconds(10);
digitalWrite(stepPos, LOW);   // Both low
digitalWrite(stepNeg, LOW);
```

#### Problem: Erratic movement or missed steps
**Cause**: Timing too fast for DM542 drivers
**Solution**: Use slower timing (200ms between steps minimum)

#### Testing Commands
- `ToDevice/Clock test_pins` - Test each motor individually to verify pin mapping
- `ToDevice/Clock test_hour 50` - Test hour motor (50 steps)
- `ToDevice/Clock test_minute 50` - Test minute motor (50 steps)
- `ToDevice/Clock test_gear 50` - Test gear motor (50 steps)
- `ToDevice/Clock test_enable` - Test stepper enable pin functionality