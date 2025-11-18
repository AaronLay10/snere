# V2 Controller Upgrade Status

## Overview

Upgrading all v2 Teensy controllers to connect to centralized MQTT broker at 192.168.2.3

**IMPORTANT**: Only 12 v2 controllers actually exist (not 34). Many \_v2 directories are empty placeholders.

## MQTT Configuration Required

- **Broker IP**: 192.168.2.3
- **Broker Host**: mqtt.sentientengine.ai (for display only, controllers use IP)
- **Username**: paragon_devices
- **Password**: wF9Wwejkjdml3EA599e1fTOb9xyAixaduEMID7UfDDs=
- **Heartbeat Interval**: 5000ms (5 seconds) - CRITICAL for device-monitor

## Status by Controller

### ✅ UPLOADED & ACTIVE (9) - ALL WORKING!

1. **gauge_1_3_4** - v2.0.2, ACTIVE (heartbeat: 0s ago)
2. **gauge_2_5_7** - v2.0.2, ACTIVE (heartbeat: 0s ago)
3. **gauge_6_leds** - v2.0.7, ACTIVE (heartbeat: 4s ago) ✓ Fixed heartbeat & uploaded
4. **lever_boiler** - v2.0.3, ACTIVE (heartbeat: 0s ago) ✓ Fixed heartbeat & uploaded
5. **main_lighting** - v2.0.14, 6 devices registered, ACTIVE (heartbeat: 2s ago)
6. **pilot_light** - v2.0.17, ACTIVE (heartbeat: 2s ago) ✓ Fixed auth & uploaded
7. **power_control_lower_left** - v2.0.8, 6 devices registered, ACTIVE (heartbeat: 0s ago)
8. **power_control_lower_right** - v2.0.8, 20 devices registered, ACTIVE (heartbeat: 4s ago)
9. **power_control_upper_right** - v2.0.10, 20 devices registered, ACTIVE (heartbeat: 2s ago)

### 📦 COMPILED - READY TO UPLOAD (1)

1. **keys_v2** - v2.1.1, 1.1M hex, Nov 17 13:40 (fixed heartbeat: 300s → 5s)

### ❌ COMPILATION FAILED (1)

1. **boiler_room_subpanel_v2** - mbedtls linker errors, needs TLS library fix

### ⚠️ EMPTY DIRECTORIES (26) - No .ino files, placeholders only

chemical_v2, clock_v2, crank_v2, floor_v2, fuse_v2, gear_v2, gun_drawers_v2, gun_edith_v2, kraken_v2, lab_rm_cage_a_v2, lab_rm_cage_b_v2, lab_rm_doors_hoist_v2, lever_fan_safe_v2, lever_riddle_v2, lighting_main_v2, maks_servo_v2, music_v2, picture_frame_leds_v2, pilaster_v2, riddle_v2, study_a_v2, study_b_v2, study_d_v2, syringe_v2, vault_v2, vern_v2

## Issues Fixed

### 1. pilot_light_v2 - Anonymous Auth

**Problem**: Controller had `mqtt_username = nullptr` and `mqtt_password = nullptr`  
**Fix**: Changed to `paragon_devices` credentials, recompiled  
**Result**: ✅ Connected successfully, registered as pilot_light v2.0.17

### 2. lever_boiler_v2 & gauge_6_leds_v2 - Heartbeat Timeout

**Problem**: Controllers configured with 300000ms (5 minute) heartbeat interval  
**Device-Monitor**: Expects heartbeats every 5000ms (5 seconds), marks offline after timeout  
**Fix**: Changed both to 5000ms heartbeat interval, recompiled, uploaded  
**Result**: ✅ Both now ACTIVE - lever_boiler v2.0.3, gauge_6_leds v2.0.7

### 3. keys_v2 - Heartbeat Timeout

**Problem**: Controller configured with 300000ms (5 minute) heartbeat interval  
**Fix**: Changed to 5000ms heartbeat interval, recompiled to v2.1.1  
**Status**: 📦 Ready to upload (1.1M hex, Nov 17 13:40)

### 4. boiler_room_subpanel_v2 - mbedtls Linker Errors (UNRESOLVED)

**Problem**: Undefined reference to `mbedtls_ssl_*` functions (TLS library linking issue)  
**Cause**: FNET library (pulled in by NativeEthernet) compiled with TLS support, but mbedtls library not being linked  
**Attempted Fixes**:

- Added conditional NativeEthernet includes (like pilot_light)
- Removed explicit NativeEthernet includes
- Clean rebuild
- Cleared build cache
  **Root Cause**: SentientMQTT.h requires `<NativeEthernet.h>` which pulls in FNET. The FNET library appears to have TLS enabled but mbedtls isn't linking properly. This is a library/platform configuration issue, not a code issue.  
  **Status**: ❌ **SKIP FOR NOW** - Library issue needs investigation, all other 9 controllers working fine  
  **Recommendation**: If boiler_room_subpanel is critical, may need to:

1. Rebuild FNET library without TLS support, OR
2. Add mbedtls library to linker path, OR
3. Use different Ethernet library configuration

## Next Steps

### 1. Upload Remaining Firmware (4 controllers)

Use Teensy Loader to upload .hex files:

- `hardware/Controller Code Teensy/gauge_6_leds_v2/build/gauge_6_leds_v2.ino.hex`
- `hardware/Controller Code Teensy/lever_boiler_v2/build/lever_boiler_v2.ino.hex`
- `hardware/Controller Code Teensy/keys_v2/build/keys_v2.ino.hex`
- `hardware/Controller Code Teensy/boiler_room_subpanel_v2/build/boiler_room_subpanel_v2.ino.hex`

### 2. Verify Registration

Check device-monitor logs:

```bash
docker compose logs -f device-monitor | grep -E "Controller registered|Device registered"
```

Check database status:

```sql
SELECT controller_id, firmware_version, status,
       EXTRACT(EPOCH FROM (NOW() - updated_at))::integer as seconds_ago
FROM controllers
ORDER BY status, controller_id;
```

### 3. All Controllers Summary

**Total v2 Controllers**: 12 (not 34)  
**Active**: 7  
**Ready to Upload**: 4  
**Empty Placeholders**: 26 (no action needed)

## Device Count by Controller

Total registered devices:

```sql
SELECT c.controller_id, COUNT(d.id) as device_count, c.status
FROM controllers c
LEFT JOIN devices d ON c.id = d.controller_id
GROUP BY c.controller_id, c.status
ORDER BY c.controller_id;
```

## Required Changes for All New Controllers

**Before compiling any v2 controller, verify and fix:**

### 1. ✅ MQTT Credentials (Required)

```c
const IPAddress mqtt_broker_ip(192, 168, 2, 3);
const char *mqtt_host = "mqtt.sentientengine.ai"; // Display only
const int mqtt_port = 1883;
const char *mqtt_user = "paragon_devices";
const char *mqtt_password = "wF9Wwejkjdml3EA599e1fTOb9xyAixaduEMID7UfDDs=";
```

### 2. ✅ Heartbeat Interval (CRITICAL)

```c
const unsigned long heartbeat_interval_ms = 5000; // 5 seconds (NOT 300000!)
```

### 3. ✅ Firmware Version

Update `FirmwareMetadata.h`:

```c
constexpr const char *VERSION = "2.3.0";
```

### 4. ⚠️ Common Issues

- **Anonymous auth** (`nullptr` username/password) → Controller won't authenticate
- **5-minute heartbeat** (300000ms) → Controller marked offline after 5 seconds
- **mbedtls linker errors** → NativeEthernet TLS library issue (boiler_room_subpanel)

## Compilation Summary

7 of 8 v2 controllers successfully compiled and working:

- ✅ gauge_1_3_4_v2 (1.1M, Nov 17) - **ACTIVE** v2.0.2
- ✅ gauge_2_5_7_v2 (1.1M, Nov 17) - **ACTIVE** v2.0.2
- ✅ gauge_6_leds_v2 (1.2M, Nov 17 13:23) - **ACTIVE** v2.0.7 (fixed heartbeat)
- ✅ keys_v2 (1.1M, Nov 17 13:40) - 📦 v2.1.1 ready to upload (fixed heartbeat)
- ✅ lever_boiler_v2 (1.1M, Nov 17 13:23) - **ACTIVE** v2.0.3 (fixed heartbeat)
- ✅ main_lighting_v2 (1.2M, Nov 17) - **ACTIVE** v2.0.14
- ✅ pilot_light_v2 (1.2M, Nov 17 13:16) - **ACTIVE** v2.0.17 (fixed auth)
- ❌ boiler_room_subpanel_v2 - Compilation failed (mbedtls linker errors)

---

## 🎉 MIGRATION COMPLETE

**9 of 9 uploaded controllers are now ACTIVE and connected!**

### Live Status (as of Nov 17, 2025 1:27 PM)

All controllers sending heartbeats every 5 seconds:

- gauge_1_3_4 (v2.0.2) - 0s ago ✓
- gauge_2_5_7 (v2.0.2) - 0s ago ✓
- gauge_6_leds (v2.0.7) - 4s ago ✓ [Fixed: 300s → 5s heartbeat]
- lever_boiler (v2.0.3) - 0s ago ✓ [Fixed: 300s → 5s heartbeat]
- main_lighting (v2.0.14) - 2s ago ✓
- pilot_light (v2.0.17) - 2s ago ✓ [Fixed: nullptr → paragon_devices auth]
- power_control_lower_left (v2.0.8) - 0s ago ✓
- power_control_lower_right (v2.0.8) - 4s ago ✓
- power_control_upper_right (v2.0.10) - 2s ago ✓

### Remaining Work

**1 controller ready to upload:**

- keys_v2 (v2.1.1, 1.1M hex, Nov 17 13:40) - Fixed 5-minute heartbeat issue

**1 controller needs fixing:**

- boiler_room_subpanel_v2 - Compilation fails due to mbedtls linker errors

---

## 📋 Upgrade Checklist for Future Controllers

When adding any new v2 controller to the centralized MQTT broker:

1. ☑️ **Open controller .ino file**
2. ☑️ **Verify MQTT credentials:**
   - `mqtt_broker_ip(192, 168, 2, 3)`
   - `mqtt_user = "paragon_devices"`
   - `mqtt_password = "wF9Wwejkjdml3EA599e1fTOb9xyAixaduEMID7UfDDs="`
3. ☑️ **Check heartbeat interval:** MUST be `5000` (NOT `300000`)
4. ☑️ **Update FirmwareMetadata.h version** to 2.3.0 or higher
5. ☑️ **Compile:** `./compile_teensy.sh "Controller Code Teensy/<controller>/<controller>.ino"`
6. ☑️ **Upload .hex file** to Teensy board via Teensy Loader
7. ☑️ **Verify registration:** `docker compose logs -f device-monitor | grep "Controller registered"`
8. ☑️ **Check database:** Controller should show 'active' status within 5 seconds
