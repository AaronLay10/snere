# Quick Start: v2.0.1 Deployment

## Status: ✅ READY TO FLASH

---

## TL;DR - What You Need to Do

1. **Open 4 terminal windows** and run these monitoring commands:
   ```bash
   # Terminal 1
   mosquitto_sub -h localhost -p 1883 -t 'sentient/system/register' -v

   # Terminal 2
   mosquitto_sub -h localhost -p 1883 -t 'sentient/paragon/clockwork/pilotlight/#' -v

   # Terminal 3
   mosquitto_sub -h localhost -p 1883 -t 'sentient/paragon/clockwork/leverboiler/#' -v

   # Terminal 4
   watch -n 1 'psql -U sentient -d sentient -c "SELECT COUNT(*) FROM controllers; SELECT COUNT(*) FROM devices;"'
   ```

2. **Flash PilotLight Teensy**:
   - Download Teensy Loader: https://www.pjrc.com/teensy/loader.html
   - Open HEX file: `/opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex`
   - Connect Teensy USB, press button, watch it flash
   - Connect Ethernet cable

3. **Flash LeverBoiler Teensy**:
   - Open HEX file: `/opt/sentient/hardware/HEX_UPLOAD_FILES/LeverBoiler_v2.0.1/LeverBoiler_v2.0.1.ino.hex`
   - Connect Teensy USB, press button, watch it flash
   - Connect Ethernet cable

4. **Watch the magic happen**:
   - Terminal 1: See registration messages (JSON)
   - Terminal 2: See PilotLight heartbeat every 5 seconds
   - Terminal 3: See LeverBoiler heartbeat every 5 seconds
   - Terminal 4: See database counts go from 0→2 controllers, 0→15 devices

---

## Expected Timeline

- **Flash Time**: ~30 seconds per Teensy
- **Network Connection**: ~5 seconds per Teensy
- **MQTT Connection**: ~2 seconds per Teensy
- **Registration**: Immediate
- **First Heartbeat**: Within 5 seconds
- **Total Time**: ~2 minutes from flash to fully operational

---

## What Success Looks Like

### Serial Monitor Output (PilotLight)
```
[PilotLight] Initializing...
[PilotLight] Firmware: 2.0.1
[SentientMQTT] Configuring network...
[SentientMQTT] IP Address: 192.168.20.xxx
[SentientMQTT] Connecting to broker at 192.168.20.201:1883
[SentientMQTT] Connected successfully
[CapabilityManifest] Building manifest...
[CapabilityManifest] Added 5 devices
[CapabilityManifest] Registration published successfully
[CapabilityManifest] Payload size: 1847
[PilotLight] Registration successful!
[PilotLight] Entering main loop...
[PilotLight] Heartbeat published
```

### MQTT Traffic (Terminal 1)
```
sentient/system/register {"controller":{"unique_id":"clockwork-pilotlight","friendly_name":"Pilot Light",...},...}
sentient/system/register {"controller":{"unique_id":"clockwork-leverboiler","friendly_name":"Lever Boiler",...},...}
```

### Database (Terminal 4)
```
 count
-------
     2

 count
-------
    15
```

---

## Quick Test Commands

### Test PilotLight
```bash
# Fire LEDs ON
mosquitto_pub -h localhost -p 1883 -t 'sentient/paragon/clockwork/pilotlight/commands/fireLEDs' -m '{"action":"fireLEDs","value":true}'

# Fire LEDs OFF
mosquitto_pub -h localhost -p 1883 -t 'sentient/paragon/clockwork/pilotlight/commands/fireLEDs' -m '{"action":"fireLEDs","value":false}'
```

### Test LeverBoiler
```bash
# Unlock boiler door (5 seconds)
mosquitto_pub -h localhost -p 1883 -t 'sentient/paragon/clockwork/leverboiler/commands/unlockBoiler' -m '{"action":"unlockBoiler","value":true}'

# Motor UP
mosquitto_pub -h localhost -p 1883 -t 'sentient/paragon/clockwork/leverboiler/commands/stepperUp' -m '{"action":"stepperUp"}'

# Motor STOP
mosquitto_pub -h localhost -p 1883 -t 'sentient/paragon/clockwork/leverboiler/commands/stepperStop' -m '{"action":"stepperStop"}'
```

---

## Troubleshooting Quick Fixes

**Teensy not connecting to network?**
```bash
# Check Ethernet cable is plugged in
# Check serial output for IP address
# Try power cycle (unplug USB, wait 5 sec, plug back in)
```

**MQTT connection failed?**
```bash
# Check broker is running
systemctl status mosquitto

# Check broker is listening
sudo ss -tlnp | grep 1883
```

**No registration message?**
```bash
# Check device-monitor is running
ps aux | grep device-monitor

# If not running
pm2 start device-monitor
# OR
cd /opt/sentient/services/device-monitor && npm start
```

**Database still empty?**
```bash
# Check PostgreSQL
systemctl status postgresql

# Check device-monitor logs
pm2 logs device-monitor
```

---

## If Something Goes Wrong

**Immediate Action**:
1. Power off both Teensys (unplug USB)
2. Stop monitoring terminals (Ctrl+C)
3. Check service status:
   ```bash
   systemctl status mosquitto
   systemctl status postgresql
   ps aux | grep device-monitor
   ```
4. Check logs:
   ```bash
   sudo journalctl -u mosquitto -n 50
   pm2 logs device-monitor --lines 50
   ```

**Get Help**:
- Read full docs: `/opt/sentient/hardware/FLASHING_INSTRUCTIONS.md`
- Read deployment summary: `/opt/sentient/hardware/v2.0.1_DEPLOYMENT_SUMMARY.md`
- Read firmware checklist: `/opt/sentient/docs/Teensy_Firmware_Checklist.md`

---

## Files You Need

**HEX Files**:
- PilotLight: `/opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex`
- LeverBoiler: `/opt/sentient/hardware/HEX_UPLOAD_FILES/LeverBoiler_v2.0.1/LeverBoiler_v2.0.1.ino.hex`

**Teensy Loader**: https://www.pjrc.com/teensy/loader.html

---

## Post-Deployment

After successful deployment:

1. **Document current state**:
   ```bash
   psql -U sentient -d sentient -c "SELECT unique_id, friendly_name, firmware_version FROM controllers;" > /opt/sentient/logs/v2.0.1_deployment_$(date +%Y%m%d_%H%M%S).txt
   ```

2. **Create backup**:
   ```bash
   pg_dump -U sentient sentient > /opt/sentient/backups/sentient_v2.0.1_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Monitor for 1 hour** to ensure stability

4. **Update other controllers** to v2.0.1 if successful

---

**Ready? Let's go! 🚀**

---

**Created**: 2025-10-15
**Version**: 2.0.1
**Status**: Production Ready
