# Teensy Firmware Flashing Instructions

## v2.0.1 Controllers Ready for Deployment

### Controllers Compiled and Ready

1. **PilotLight_v2.0.1**
   - HEX File: `/opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex`
   - Size: 1.2 MB
   - Memory Usage: 324KB code, 82KB data, 322KB free RAM
   - Unique ID: `clockwork-pilotlight`
   - Devices: 5 (boiler_fire_leds, newell_power, flange_leds, boiler_monitor, color_sensor)

2. **LeverBoiler_v2.0.1**
   - HEX File: `/opt/sentient/hardware/HEX_UPLOAD_FILES/LeverBoiler_v2.0.1/LeverBoiler_v2.0.1.ino.hex`
   - Size: 1.1 MB
   - Memory Usage: 300KB code, 85KB data, 317KB free RAM
   - Unique ID: `clockwork-leverboiler`
   - Devices: 10 (photocells, IR sensors, maglocks, LEDs, stepper motor)

---

## Pre-Flashing Checklist

- [ ] Verify MQTT broker is running: `systemctl status mosquitto`
- [ ] Verify device-monitor service is running: `ps aux | grep device-monitor`
- [ ] Verify PostgreSQL is running: `systemctl status postgresql`
- [ ] Database is clean (no test controllers): `psql -U sentient -d sentient -c "SELECT COUNT(*) FROM controllers;"`
- [ ] Ethernet cables ready for both Teensys (W5500 connections)
- [ ] USB cables ready for power and serial monitoring

---

## Flashing Method Options

### Option 1: Teensy Loader Application (GUI - Recommended)

**Download**: https://www.pjrc.com/teensy/loader.html

**Steps**:
1. Open Teensy Loader application
2. Connect Teensy 4.1 via USB
3. Click "File" → "Open HEX File"
4. Navigate to HEX file location
5. Press the physical button on Teensy board to enter bootloader mode
6. Teensy Loader will automatically flash the firmware
7. Wait for "Download Complete" message
8. Teensy will automatically reboot

### Option 2: Arduino IDE

**Steps**:
1. Open Arduino IDE
2. Install Teensy board support (if not already): `Tools` → `Board` → `Boards Manager` → search "Teensy"
3. Open the `.ino` file:
   - `/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1/PilotLight_v2.0.1.ino`
   - OR `/opt/sentient/hardware/Puzzle Code Teensy/LeverBoiler_v2.0.1/LeverBoiler_v2.0.1.ino`
4. Select board: `Tools` → `Board` → `Teensy 4.1`
5. Select port: `Tools` → `Port` → (select USB port)
6. Click Upload button (→)
7. Press button on Teensy when prompted

### Option 3: Teensy Loader CLI (Command Line)

**Installation** (if needed):
```bash
cd /opt/sentient/bin
git clone https://github.com/PaulStoffregen/teensy_loader_cli.git
cd teensy_loader_cli
make
sudo cp teensy_loader_cli /usr/local/bin/
```

**Flash Commands**:
```bash
# Flash PilotLight
teensy_loader_cli -mmcu=TEENSY41 -w -v \
  /opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex

# Flash LeverBoiler
teensy_loader_cli -mmcu=TEENSY41 -w -v \
  /opt/sentient/hardware/HEX_UPLOAD_FILES/LeverBoiler_v2.0.1/LeverBoiler_v2.0.1.ino.hex
```

---

## Post-Flashing Verification

### 1. Monitor MQTT Registration (Open in separate terminals)

**Terminal 1: Watch Registration Topic**
```bash
mosquitto_sub -h localhost -p 1883 -t 'sentient/system/register' -v
```

**Terminal 2: Watch PilotLight Traffic**
```bash
mosquitto_sub -h localhost -p 1883 -t 'sentient/paragon/clockwork/pilotlight/#' -v
```

**Terminal 3: Watch LeverBoiler Traffic**
```bash
mosquitto_sub -h localhost -p 1883 -t 'sentient/paragon/clockwork/leverboiler/#' -v
```

**Terminal 4: Watch All Sentient Traffic**
```bash
mosquitto_sub -h localhost -p 1883 -t 'sentient/#' -v | grep -E 'pilotlight|leverboiler'
```

### 2. Monitor Serial Output

**Using Arduino IDE Serial Monitor**:
1. Connect to Teensy via USB
2. Open `Tools` → `Serial Monitor`
3. Set baud rate to 115200
4. Watch for:
   ```
   [PilotLight] Initializing...
   [SentientMQTT] Network configured successfully
   [SentientMQTT] Connected to broker
   [CapabilityManifest] Registration published successfully
   [PilotLight] Registration successful!
   ```

**Using screen command**:
```bash
# Find Teensy USB port
ls /dev/ttyACM*

# Connect to serial (replace /dev/ttyACM0 with actual port)
screen /dev/ttyACM0 115200

# Exit screen: Ctrl+A then K, then Y to confirm
```

### 3. Verify Database Registration

**Check Controllers**:
```bash
psql -U sentient -d sentient -c "SELECT id, unique_id, friendly_name, firmware_version FROM controllers ORDER BY created_at DESC;"
```

**Expected Output**:
```
                  id                  |      unique_id          |   friendly_name   | firmware_version
--------------------------------------+-------------------------+-------------------+------------------
 <uuid>                               | clockwork-pilotlight    | Pilot Light       | 2.0.1
 <uuid>                               | clockwork-leverboiler   | Lever Boiler      | 2.0.1
```

**Check Devices**:
```bash
psql -U sentient -d sentient -c "SELECT controller_id, device_id, friendly_name, device_type, device_category FROM devices ORDER BY controller_id, device_id;"
```

**Expected Output**: 15 total devices
- 5 from PilotLight: boiler_fire_leds, newell_power, flange_leds, boiler_monitor, color_sensor
- 10 from LeverBoiler: photocell_boiler, photocell_stairs, ir_sensor_1, ir_sensor_2, maglock_boiler, maglock_stairs, lever_led_boiler, lever_led_stairs, newell_post_light, newell_post_motor

### 4. Expected MQTT Messages on Startup

**Registration Message** (to `sentient/system/register`):
```json
{
  "controller": {
    "unique_id": "clockwork-pilotlight",
    "friendly_name": "Pilot Light",
    "firmware_version": "2.0.1",
    "controller_type": "PilotLight",
    "room_id": "clockwork",
    "puzzle_id": "PUZZLE_PILOT_LIGHT"
  },
  "devices": [
    {
      "device_id": "boiler_fire_leds",
      "friendly_name": "Boiler Fire Animation",
      "device_type": "led_strip",
      "device_category": "output"
    },
    // ... more devices
  ],
  "mqtt_topics_publish": [
    {
      "device_id": "boiler_fire_leds",
      "topic": "commands/fireLEDs",
      "topic_type": "command"
    },
    // ... more topics
  ],
  "actions": [
    {
      "device_id": "boiler_fire_leds",
      "action_name": "set_fire_leds",
      "param_type": "bool",
      "description": "Control fire LED animation on/off"
    },
    // ... more actions
  ]
}
```

**Heartbeat Message** (every 5 seconds):
```
sentient/paragon/clockwork/pilotlight/heartbeat
{
  "device_id": "DEVICE_PILOT_LIGHT",
  "puzzle_id": "PUZZLE_PILOT_LIGHT",
  "state": "IDLE",
  "timestamp": 1697234567890
}
```

---

## Troubleshooting

### Teensy Not Connecting to MQTT

**Check Network**:
```bash
# Verify Teensy has IP address (check serial output for:)
# [SentientMQTT] IP: 192.168.x.x

# Ping the Teensy from server
ping 192.168.x.x

# Check if Teensy can reach MQTT broker
# (Look for connection messages in serial output)
```

**Check MQTT ACLs**:
```bash
sudo cat /etc/mosquitto/mosquitto.acl

# Should have lines like:
# user paragon
# topic write sentient/paragon/#
# topic read sentient/paragon/#
```

### Registration Not Appearing in Database

**Check device-monitor logs**:
```bash
pm2 logs device-monitor

# OR if running directly
ps aux | grep device-monitor
# Find PID, then check logs location
```

**Manually test registration endpoint**:
```bash
curl -X POST http://localhost:3003/register \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "controller": {
    "unique_id": "test-controller",
    "friendly_name": "Test",
    "firmware_version": "2.0.1",
    "controller_type": "Test",
    "room_id": "testroom",
    "puzzle_id": "TEST_001"
  },
  "devices": []
}
EOF
```

### Serial Monitor Shows Connection Errors

**Common Issues**:
1. **"Failed to configure Ethernet"**
   - Check W5500 wiring
   - Verify Ethernet cable is connected
   - Check if DHCP server is running on network

2. **"Connection refused"**
   - MQTT broker not running: `systemctl status mosquitto`
   - Wrong broker IP in firmware (check `mqtt_config` in code)

3. **"Authentication failed"**
   - Wrong username/password in firmware
   - Check `/etc/mosquitto/mosquitto_passwd`

4. **"Connection timeout"**
   - Firewall blocking port 1883
   - MQTT broker not listening: `sudo ss -tlnp | grep 1883`

---

## Testing Commands After Flashing

### Test PilotLight Commands

**Turn on fire LEDs**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/pilotlight/commands/fireLEDs' \
  -m '{"action":"fireLEDs","value":true}'
```

**Turn on boiler monitor**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/pilotlight/commands/boilerMonitor' \
  -m '{"action":"boilerMonitor","value":true}'
```

**Turn on Newell power**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/pilotlight/commands/newellPower' \
  -m '{"action":"newellPower","value":true}'
```

**Reset all**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/pilotlight/commands/reset' \
  -m '{"action":"reset"}'
```

### Test LeverBoiler Commands

**Unlock boiler door**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/unlockBoiler' \
  -m '{"action":"unlockBoiler","value":true}'
```

**Unlock stairs door**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/unlockStairs' \
  -m '{"action":"unlockStairs","value":true}'
```

**Move Newell post motor up**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/stepperUp' \
  -m '{"action":"stepperUp"}'
```

**Move Newell post motor down**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/stepperDown' \
  -m '{"action":"stepperDown"}'
```

**Stop motor**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/stepperStop' \
  -m '{"action":"stepperStop"}'
```

**Reset all**:
```bash
mosquitto_pub -h localhost -p 1883 \
  -t 'sentient/paragon/clockwork/leverboiler/commands/reset' \
  -m '{"action":"reset"}'
```

---

## Success Criteria

Both controllers are successfully deployed when:

- [x] Both HEX files compiled successfully (✓ Completed)
- [ ] Both Teensys flashed via Teensy Loader
- [ ] Both Teensys connect to network (verify via serial output)
- [ ] Both Teensys connect to MQTT broker
- [ ] Both registration messages received on `sentient/system/register` topic
- [ ] Database shows 2 controllers (clockwork-pilotlight, clockwork-leverboiler)
- [ ] Database shows 15 devices total (5 + 10)
- [ ] Both controllers publishing heartbeat messages every 5 seconds
- [ ] Test commands execute successfully (LEDs turn on, relays switch, motor moves)
- [ ] Sensor data publishing correctly (photocells, IR sensors, color sensor)
- [ ] All devices respond to commands within 100ms

---

## Notes

- Both controllers use **SentientMQTT** library for MQTT communication
- Both controllers use **SentientCapabilityManifest** library for self-registration
- Firmware follows **v2.0.1 standards**: snake_case, const int, stateless architecture
- LeverBoiler uses **manual stepper control** (no AccelStepper library)
- All firmware is **stateless** - Sentient controls all game logic
- Controllers use **Listen/Detect/Execute** loop pattern
- Sensor publishing uses **change-based thresholds** to reduce MQTT traffic

---

**Last Updated**: 2025-10-15
**Version**: 2.0.1
**Ready for Production**: ✓ YES
