# Automatic Firmware Version Bumping

## Overview

The Sentient Engine now includes an **automatic version bumping system** that increments the firmware patch version (2.0.X) every time you compile. This ensures you always know which firmware version is running on each Teensy.

**Benefits**:
- ✅ No manual version editing required
- ✅ Every compilation gets a unique version number
- ✅ Version history is automatically logged
- ✅ Database shows exact firmware version for troubleshooting
- ✅ Prevents confusion about which firmware is deployed

---

## Quick Start

### Compile with Auto Version Bump

Instead of using `arduino-cli compile` directly, use the automated script:

```bash
# Compile PilotLight (version will auto-increment)
bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh PilotLight_v2.0.1

# Compile LeverBoiler (version will auto-increment)
bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh LeverBoiler_v2.0.1
```

**What happens**:
1. Script reads current version from `FirmwareMetadata.h` (e.g., `2.0.5`)
2. Increments patch version to `2.0.6`
3. Creates backup of `FirmwareMetadata.h`
4. Updates version in the file
5. Compiles firmware with new version
6. Logs the version change to `/opt/sentient/hardware/logs/version_history.log`

---

## Version Format

**Format**: `MAJOR.MINOR.PATCH`

- **MAJOR** (2): Major system architecture changes
- **MINOR** (0): Feature additions, library updates, breaking changes
- **PATCH** (X): Bug fixes, minor improvements, **auto-incremented on every compile**

**Examples**:
- `2.0.1` → First v2.0 firmware
- `2.0.2` → Second compilation (could be same code, different compile)
- `2.0.15` → Fifteenth compilation

---

## Scripts

### 1. compile_with_version_bump.sh

**Location**: `/opt/sentient/hardware/scripts/compile_with_version_bump.sh`

**Purpose**: Main compilation script that handles version bumping and compilation.

**Usage**:
```bash
bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh <firmware_name>
```

**Example**:
```bash
bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh PilotLight_v2.0.1
```

**Output**:
```
╔════════════════════════════════════════════════════════════════╗
║  Teensy Firmware Compiler with Automatic Version Bumping      ║
╚════════════════════════════════════════════════════════════════╝

Firmware: PilotLight_v2.0.1
Directory: /opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1

[1/3] Bumping version...
=== Firmware Version Bumper ===
Current version: 2.0.5
New version: 2.0.6
✓ Version bumped to: 2.0.6

[2/3] Cleaning output directory...
✓ Output directory cleaned

[3/3] Compiling firmware...
Target: teensy:avr:teensy41
Output: /opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1

✓ Compilation successful

═══ Memory Usage ═══
Memory Usage on Teensy 4.1:
  FLASH: code:326580, data:85688, headers:9076   free for files:7705120
   RAM1: variables:45508, code:187812, padding:8796   free for local variables:282172

═══ Output Files ═══
-rw-rw-r-- 1 techadmin techadmin 1.2M Oct 15 19:59 /opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex

✓ HEX file ready:
  /opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex

═══ Firmware Info ═══
  Name: PilotLight_v2.0.1
  Version: 2.0.6
  Size: 1.2M
  Compiled: 2025-10-15 19:59:29

╔════════════════════════════════════════════════════════════════╗
║  SUCCESS - Firmware v2.0.6 ready for deployment!
╚════════════════════════════════════════════════════════════════╝
```

**Features**:
- Color-coded output for easy reading
- Shows all 3 steps clearly
- Displays memory usage
- Shows HEX file location for easy flashing
- Restores version if compilation fails

---

### 2. bump_version.sh

**Location**: `/opt/sentient/hardware/scripts/bump_version.sh`

**Purpose**: Standalone version bumper (used internally by compile script).

**Usage** (advanced users only):
```bash
bash /opt/sentient/hardware/scripts/bump_version.sh "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1"
```

**What it does**:
1. Extracts current version from `FirmwareMetadata.h`
2. Increments PATCH number
3. Creates backup file
4. Updates version in FirmwareMetadata.h
5. Logs change to version history

---

## Version History Log

**Location**: `/opt/sentient/hardware/logs/version_history.log`

**Format**:
```
YYYY-MM-DD HH:MM:SS | FirmwareName | OldVersion → NewVersion
```

**Example**:
```
2025-10-15 19:59:18 | PilotLight_v2.0.1 | 2.0.1 → 2.0.2
2025-10-15 19:59:34 | LeverBoiler_v2.0.1 | 2.0.1 → 2.0.2
2025-10-15 20:15:22 | PilotLight_v2.0.1 | 2.0.2 → 2.0.3
2025-10-15 20:45:11 | LeverBoiler_v2.0.1 | 2.0.2 → 2.0.3
```

**View history**:
```bash
cat /opt/sentient/hardware/logs/version_history.log
```

**View recent changes**:
```bash
tail -10 /opt/sentient/hardware/logs/version_history.log
```

**Search for specific firmware**:
```bash
grep "PilotLight" /opt/sentient/hardware/logs/version_history.log
```

---

## Workflow

### Standard Compilation Workflow

```bash
# 1. Make code changes (optional)
nano "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1/PilotLight_v2.0.1.ino"

# 2. Compile with auto version bump
bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh PilotLight_v2.0.1

# 3. Flash the HEX file using Teensy Loader
# Load: /opt/sentient/hardware/HEX_UPLOAD_FILES/PilotLight_v2.0.1/PilotLight_v2.0.1.ino.hex

# 4. Verify version in database after Teensy registers
export PGPASSWORD=changeme123
psql -h localhost -U sentient -d sentient -c \
  "SELECT controller_id, firmware_version FROM controllers WHERE controller_id='clockwork-pilotlight';"

# Expected output:
#    controller_id       | firmware_version
# -----------------------+------------------
#  clockwork-pilotlight | 2.0.3
```

---

## Database Integration

After the Teensy registers with Sentient, the firmware version is stored in the database:

```sql
SELECT
  controller_id,
  friendly_name,
  firmware_version,
  ip_address,
  last_heartbeat
FROM controllers
ORDER BY controller_id;
```

**Example Output**:
```
    controller_id       |  friendly_name  | firmware_version |   ip_address    |     last_heartbeat
------------------------+-----------------+------------------+-----------------+-------------------------
 clockwork-leverboiler  | Boiler Lever    | 2.0.3            | 192.168.60.135  | 2025-10-15 20:15:45
 clockwork-pilotlight   | Pilot Light     | 2.0.3            | 192.168.60.10   | 2025-10-15 20:15:43
```

This allows you to:
- Verify which firmware version is running on each Teensy
- Track firmware deployments
- Troubleshoot issues by correlating version with behavior
- Audit firmware changes over time

---

## Backup and Recovery

### Backup Files

Every version bump creates a backup:
- **Location**: `FirmwareMetadata.h.backup` (same directory as FirmwareMetadata.h)
- **Purpose**: Automatic rollback if compilation fails

### Manual Rollback

If you need to manually revert a version:

```bash
# Restore from backup
cd "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1"
cp FirmwareMetadata.h.backup FirmwareMetadata.h
```

### Manual Version Set

If you need to set a specific version (rarely needed):

```bash
# Edit FirmwareMetadata.h manually
nano "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1/FirmwareMetadata.h"

# Change this line:
const char *VERSION = "2.0.15";  // Set to desired version
```

---

## Troubleshooting

### Issue: Script shows "command not found"

**Cause**: Script doesn't have execute permissions

**Fix**:
```bash
chmod +x /opt/sentient/hardware/scripts/compile_with_version_bump.sh
chmod +x /opt/sentient/hardware/scripts/bump_version.sh
```

---

### Issue: Version not incrementing

**Cause**: FirmwareMetadata.h format doesn't match expected pattern

**Expected format in FirmwareMetadata.h**:
```cpp
const char *VERSION = "2.0.5";
```

**Check format**:
```bash
grep VERSION "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1/FirmwareMetadata.h"
```

---

### Issue: Compilation fails but version was bumped

**Fix**: Script automatically restores version from backup if compilation fails.

**Manual check**:
```bash
ls -la "/opt/sentient/hardware/Puzzle Code Teensy/PilotLight_v2.0.1/FirmwareMetadata.h"*
```

---

### Issue: Database shows old version after flashing

**Cause**: Controller hasn't re-registered yet

**Solutions**:
1. **Power cycle Teensy** - Unplug USB, wait 5 seconds, plug back in
2. **Check registration** - Monitor MQTT registration topic:
   ```bash
   mosquitto_sub -h localhost -p 1883 -t 'sentient/system/register' -v
   ```
3. **Manually update database** (temporary workaround):
   ```bash
   export PGPASSWORD=changeme123
   psql -h localhost -U sentient -d sentient -c \
     "UPDATE controllers SET firmware_version='2.0.3' WHERE controller_id='clockwork-pilotlight';"
   ```

---

## Advanced Usage

### Compile All v2.0 Firmwares

```bash
#!/bin/bash
for firmware in PilotLight_v2.0.1 LeverBoiler_v2.0.1; do
  echo "Compiling $firmware..."
  bash /opt/sentient/hardware/scripts/compile_with_version_bump.sh "$firmware"
done
```

### Check All Current Versions

```bash
for dir in /opt/sentient/hardware/Puzzle\ Code\ Teensy/*v2.0*/; do
  firmware=$(basename "$dir")
  version=$(grep 'const char \*VERSION' "$dir/FirmwareMetadata.h" | sed 's/.*"\(.*\)".*/\1/')
  echo "$firmware: v$version"
done
```

### Compare Versions in Database

```bash
export PGPASSWORD=changeme123
psql -h localhost -U sentient -d sentient -c \
  "SELECT controller_id, firmware_version, created_at, last_heartbeat FROM controllers ORDER BY firmware_version, controller_id;"
```

---

## Files

### Script Files
- `/opt/sentient/hardware/scripts/compile_with_version_bump.sh` - Main compilation script
- `/opt/sentient/hardware/scripts/bump_version.sh` - Version increment utility

### Log Files
- `/opt/sentient/hardware/logs/version_history.log` - Complete version change history

### Firmware Files
- `/opt/sentient/hardware/Puzzle Code Teensy/<FirmwareName>/FirmwareMetadata.h` - Version definition
- `/opt/sentient/hardware/Puzzle Code Teensy/<FirmwareName>/FirmwareMetadata.h.backup` - Auto-backup

### Output Files
- `/opt/sentient/hardware/HEX_UPLOAD_FILES/<FirmwareName>/<FirmwareName>.ino.hex` - Compiled firmware

---

## Best Practices

1. **Always use the compile script** - Don't use `arduino-cli compile` directly
2. **Check version history** - Review `/opt/sentient/hardware/logs/version_history.log` regularly
3. **Verify database version** - After flashing, confirm version in database matches
4. **Keep version history log** - Don't delete this file; it's your audit trail
5. **Document major changes** - Add comments in git commits for major version changes
6. **Flash immediately after compile** - To avoid confusion about which HEX matches which version

---

## Migration from Manual Versioning

If you have firmwares that don't use automatic versioning yet:

1. **Ensure FirmwareMetadata.h exists** with correct format
2. **Set starting version** (usually `2.0.1` for v2.0 firmwares)
3. **Use compile script from now on** - Version will auto-increment

---

## Future Enhancements

Planned improvements:
- [ ] Batch compile script for all v2.0 firmwares
- [ ] Version comparison tool (compare filesystem vs database)
- [ ] Automatic git tagging on version bump
- [ ] Web dashboard showing version history
- [ ] Firmware update notification system

---

## Summary

The automatic version bumping system ensures:
- ✅ **Traceability** - Every compilation is uniquely versioned
- ✅ **Simplicity** - One command does everything
- ✅ **Safety** - Auto-backup and rollback on failure
- ✅ **Audit Trail** - Complete version history logged
- ✅ **Database Integration** - Version tracked in Sentient database

**Use this system for all firmware compilations going forward!**

---

**Last Updated**: 2025-10-15
**Version**: 1.0
**Author**: Mythra Sentient Development Team
