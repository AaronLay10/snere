# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

In this workspace, **Sentient Engine** is treated as a local development environment for an escape room orchestration platform. It runs as Docker containerized Node.js services with PostgreSQL and Mosquitto MQTT broker. Hardware controllers are Teensy 4.1 microcontrollers on Ethernet.

There is no separate production environment or dual-environment support described here; treat this repo as the single source of truth for the local stack.

### Core Philosophy

**Sentient = Brain (makes decisions), Teensy = Hands (executes commands)**

Controllers are stateless peripheral executors. The backend makes all decisions about game state, scene progression, and puzzle logic. Hardware simply executes commands and reports sensor data.

## Architecture Overview

```
Web UI (sentient-web) ↔ API (sentient-api) ↔ PostgreSQL
                              ↓
                    scene-executor (v0.1.18+)
                              ↓
                    Mosquitto MQTT Broker
                              ↓
                    Teensy 4.1 Controllers (v2.0.1)
                              ↓
Device-Monitor ← MQTT sensors/heartbeat
```

### Technology Stack

| Layer                   | Technology                         | Local Port(s)        | Purpose                                   |
| ----------------------- | ---------------------------------- | -------------------- | ----------------------------------------- |
| Frontend                | Vite 5.4 + React 19.1 + TypeScript | 3002                 | Configuration web interface               |
| API                     | Node.js/Express                    | 3000                 | REST API                                  |
| Scene Executor          | Node.js/TypeScript                 | 3004                 | Scene orchestration engine                |
| Device Monitor          | Node.js/MQTT                       | 3003                 | Real-time device telemetry                |
| Database                | PostgreSQL 16                      | internal (5432)      | Relational data (`sentient_dev`)         |
| Message Broker          | Mosquitto MQTT                     | 1883, 9001           | Device communication                      |
| Reverse Proxy           | Nginx (optional)                   | 80, 443              | Local HTTPS termination (if used)        |
| Container Orchestration | Docker Compose                     | -                    | Service lifecycle (single environment)    |
| Observability           | Prometheus + Grafana + Loki        | 9090, 3200, 3100     | Metrics, dashboards, logs                 |

## Environment & Accessibility

For this repository, assume you are working against a **local Docker-based development environment**.

Historical notes about public domains, IPs, or specific hosting providers in this file are for reference only and should not be treated as live operational details.

### Security Posture

- ✅ **SSL/TLS:** Valid Let's Encrypt certificate with HTTP/2
- ✅ **Firewall:** UFW active - only HTTP/HTTPS exposed to internet
- ✅ **MQTT Isolation:** Port 1883 restricted to internal network only (192.168.20.0/24)
- ✅ **Database Security:** PostgreSQL restricted to local network, strong passwords rotated
- ✅ **fail2ban:** Active protection against brute force (5 attempts = 2-hour ban)
- ✅ **Password Policy:** 12+ chars with complexity requirements (uppercase, lowercase, number, special char)
- ✅ **Authentication:** JWT tokens, bcrypt hashing (12 rounds), audit logging
- ✅ **Rate Limiting:** 2000 requests per 15 minutes on API

### Network Architecture & VLAN Configuration (Reference)

**CRITICAL:** The system uses **multiple VLANs with cross-VLAN routing enabled** via the Ubiquiti Dream Machine Pro. Traffic can cross VLANs freely for internal communication.

**Known VLANs:**

- `192.168.2.0/24` - Server VLAN (main server at 192.168.2.3)
- `192.168.60.0/24` - Controller VLAN (Teensy controllers)

**Controller Communication Rule:**
⚠️ **Teensy controllers MUST connect to MQTT broker using local IP address (192.168.2.3), NOT the public domain (sentientengine.ai).**

**Why this matters:**

1. Using the public domain routes traffic out to the internet and back unnecessarily
2. Slower performance and increased latency
3. Potential DNS resolution failures from controller subnets
4. Unnecessary exposure of internal traffic to external networks

**Firmware Configuration Standard:**

```cpp
const IPAddress mqtt_broker_ip(192, 168, 2, 3);
const char *mqtt_host = nullptr;  // MUST be null to use IP address only
const int mqtt_port = 1883;
```

**Never use:**

```cpp
const char *mqtt_host = "sentientengine.ai";  // ❌ WRONG - routes through internet
```

### CRITICAL SAFETY RULES (LOCAL)

**NEVER DO THESE:**

1. ❌ Expose database passwords in code or logs
2. ❌ Open MQTT port (1883) to the public internet
3. ❌ Disable SSL certificate validation if you enable TLS locally
4. ❌ Push code with hardcoded credentials
5. ❌ Modify database schema without migration scripts
6. ❌ Configure Teensy controllers to use public domains for MQTT (use local IP)
7. ❌ Run containers with privileged mode unless absolutely necessary

**ALWAYS DO THESE:**

1. ✅ Test changes in this local environment before using them elsewhere
2. ✅ Use Docker Compose commands for service management (`docker compose up -d`, `docker compose restart`)
3. ✅ Verify services restart successfully after changes (`docker compose ps`)
4. ✅ Check logs after changes (`docker compose logs [service]`)
5. ✅ Maintain audit trail in git commits
6. ✅ Update documentation when changing architecture
7. ✅ Use the provided scripts in `scripts/` for common operations

## Critical Documentation

**SYSTEM_ARCHITECTURE.md is the single source of truth for all architectural decisions.**

- `Documentation/SYSTEM_ARCHITECTURE.md` - Complete system architecture
- `Documentation/INTERNET_EXPOSURE_SECURITY_PLAN.md` - Security hardening checklist
- `Documentation/PASSWORD_POLICY.md` - Password requirements and policy
- `BUILD_PROCESS.md` - Build scripts and version management
- `MQTT_TOPIC_FIX.md` - MQTT topic standardization
- `.github/copilot-instructions.md` - Development workflow and conventions
- `Documentation/TEENSY_V2_COMPLETE_GUIDE.md` - Teensy firmware standards

## Development Workflow (Local)

### Documentation-First Approach

**All system changes MUST follow this workflow:**

1. **Document First** - Update SYSTEM_ARCHITECTURE.md with proposed changes
2. **Review & Approve** - Discuss implications and get user approval
3. **Implement** - Write code that matches documented design
4. **Verify** - Confirm implementation matches documentation

**Never implement without explicit approval.** Present proposals, explain implications, and wait for user approval before making changes.

### Building and Deploying

**ALWAYS use the Docker Compose-based development workflow for this workspace.**

#### Local Development Environment

```bash
# Start local development stack
npm run dev
```

#### Service Management (Local)

```bash
# Check service health
sudo ./scripts/health-check.sh

```bash
# View logs
docker compose logs -f sentient-api

# Restart specific service
docker compose restart sentient-api

# Rebuild after code changes
docker compose up -d --build sentient-api
```
```

#### Teensy Firmware

From VS Code, use the task: **"Compile Current Teensy"**

Or manually:

```bash
/opt/sentient/scripts/compile_current.sh ${file}
```

- Target: `teensy:avr:teensy41`
- Toolchain: bundled arduino-cli at `bin/`
- Output: `hardware/HEX_UPLOAD_FILES/<Controller>/`

### Container Services (Local)

Check service health:

```bash
./scripts/health-check.sh
```

For local development you will typically see containers for:

- `sentient-api`
- `sentient-web`
- `executor-engine`
- `device-monitor`
- `postgres`
- `mosquitto`

View logs:

```bash
./scripts/logs.sh sentient-api
docker compose logs -f --tail=100 [service_name]
```

## MQTT Topic Standard (CRITICAL)

**Template:**

```
[client]/[room]/[category]/[controller]/[device]/[item]
```

**Rules:**

- snake_case only (lowercase letters, digits, underscore)
- NO spaces or hyphens
- Categories always lowercase: `commands/`, `sensors/`, `status/`, `events/`
- Device = physical unit (aggregate), not subcomponents
- Topics built from database identifiers, **never display names**

**Example (Clockwork Corridor):**

```
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_on
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_off
paragon/clockwork/sensors/boiler_room_subpanel/intro_tv/ir_code
paragon/clockwork/status/boiler_room_subpanel/intro_tv/heartbeat
```

### Hardware Hierarchy Terms

- **client_id** - Business entity (tenant). Example: `paragon`
- **room_id** - Specific escape room. Example: `clockwork`
- **controller_id** - Hardware controller identifier. Example: `boiler_room_subpanel`
- **device_id** - Single physical device. Example: `intro_tv`, `fog_machine`
- **command** - Device action. Example: `power_tv_on`, `move_tvlift_up`

## Database Architecture

### Schema Management

**Production schema has drift from schema.sql.** Always verify production:

```bash
sudo -u postgres psql -d sentient -c "\d table_name"
```

- `database/schema.sql` - Outdated baseline (reference only)
- `database/migrations/` - Incremental changes (authoritative)
- `schema_version` table tracks applied migrations

### Primary Key Strategy

All tables use **UUID primary keys** for global uniqueness, security, and scalability.

**Dual-identifier pattern:**

- `id` (UUID) - Database identity and foreign key references
- `slug` or `device_id` (VARCHAR) - Human-readable, used in MQTT topics
- `friendly_name` (VARCHAR) - UI display only, never used in topics or queries

Example:

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(100) NOT NULL,      -- MQTT topic segment
  friendly_name VARCHAR(255),            -- UI display only
  ...
);
```

### Multi-Tenant Safety

**Every query MUST filter by client_id:**

```sql
SELECT d.* FROM devices d
JOIN rooms r ON d.room_id = r.id
WHERE r.client_id = $1;  -- REQUIRED
```

### Key Tables

- `clients` - Tenant organizations
- `users` - System users with RBAC
- `rooms` - Escape room experiences (UUID PK + slug)
- `controllers` - Hardware controllers (Teensy, etc.)
- `devices` - Physical hardware units (one row per physical device)
- `device_commands` - One-to-many: device → commands
- `scenes` - Puzzles and cutscenes
- `scene_steps` - Timeline actions with loop support
- `device_heartbeats` - Health monitoring telemetry

### Device Modeling Standard

**One physical device = one database row**

✅ Correct:

- Device: `intro_tv` (one row)
- Commands: `power_tv_on`, `power_tv_off`, `move_tv_up`, `move_tv_down` (via device_commands table)

❌ Incorrect (anti-pattern):

- Device: `tv_power` (separate row)
- Device: `tv_lift` (separate row)

Never split a single physical unit into multiple device rows for subcomponents.

## Puzzle System Architecture

**Terminology (Escape Room Industry Standard):**

Sentient uses industry-standard escape room terminology for puzzle configuration:

- **State** - Major stage of a puzzle (e.g., State 1, State 2, State 3)
- **Step** - Sub-stage within a state (e.g., "Boiler Valve Setup", "Gate Valve Calibration")
- **Sensor Watch** - If-then monitoring rule that triggers actions based on sensor values
- **Win Condition** - Criteria that must be met to complete a state or puzzle
- **Conditional Action** - Action triggered when conditions are met

**Backend Components:**

- `PuzzleStateManager` - Manages multi-state puzzle progression and transitions
- `ConditionEvaluator` - Evaluates win conditions from sensor data
- `PuzzleWatcher` - Monitors sensors and triggers watches
- `ActionExecutor` - Executes conditional actions (MQTT commands, scene control)

**Frontend Pages:**

- `/dashboard/puzzles` - Lists all puzzle-type scenes across rooms
- `/dashboard/puzzles/:puzzleId` - Configure puzzle logic with tabs:
  - **Win Conditions** - Define when puzzle is solved
  - **Sensor Watches** - If-then monitoring (can watch ANY device in room)
  - **States** - Multi-state progression (optional)
  - **Actions** - onStart, onSolve, onFail, onReset

**Puzzle Configuration Storage:**

Puzzles are scenes with `scene_type = 'puzzle'`. Configuration stored in `scenes.config` JSON field:

```json
{
  "puzzleName": "Pilot Light",
  "states": [
    {
      "id": "state_1",
      "name": "State 1 - Initial Calibration",
      "winConditions": {
        "logic": "AND",
        "conditions": [
          {
            "deviceId": "gauge_1_3_4",
            "sensorName": "valve_1_psi",
            "field": "value",
            "operator": "==",
            "value": 100,
            "tolerance": 5
          }
        ]
      },
      "onComplete": {
        "actions": [
          {
            "type": "mqtt.publish",
            "target": "paragon/clockwork/commands/boiler_lights/pulse_green",
            "payload": { "duration": 2000 }
          }
        ]
      }
    }
  ],
  "sensorWatches": [
    {
      "id": "reset_watch",
      "name": "Boiler Valve Changed - Reset",
      "conditions": {
        "logic": "OR",
        "conditions": [
          {
            "deviceId": "gauge_6_leds",
            "sensorName": "lever_1_red",
            "field": "state",
            "operator": "==",
            "value": "CLOSED"
          }
        ]
      },
      "onTrigger": {
        "actions": [{ "type": "puzzle.reset" }]
      }
    }
  ]
}
```

**Key Features:**

- **Cross-Controller Monitoring** - Sensor watches can monitor sensors from ANY device in the room
- **State Transitions** - Automatic progression through puzzle states
- **Reset Logic** - Conditional resets based on sensor changes (e.g., if boiler valves change, reset to previous state)
- **Puzzle Step Names** - Automatically pulled from timeline step name (type='puzzle')

## Service Architecture

### sentient-web (Frontend)

**Location:** `services/sentient-web/`

Key directories:

- `src/pages/` - Page components (Dashboard, RoomsList, ScenesList, TimelineEditor)
- `src/components/` - React components (auth, layout, timeline)
- `src/hooks/` - Custom React hooks (useExecutorSocket)
- `src/lib/api.ts` - Axios API client
- `src/store/` - Zustand state management

Development:

```bash
cd services/sentient-web
npm run dev  # Port 3002
```

### scene-executor (Scene Execution Engine)

**Location:** `services/executor-engine/`

Responsibilities:

- Execute scene timelines with sub-second precision
- Loop execution support (ambient effects, repeating actions)
- Safety verification before scene activation
- Director controls (start, stop, reset, override)
- WebSocket state broadcasting
- MQTT command publishing

Key components:

- `SceneRegistry` - In-memory scene catalog with state machine
- `CutsceneExecutor` - Timeline execution with loop support
- `SafetyVerifier` - Pre-execution safety checks (device health, heartbeats)
- `ConditionEvaluator` - Puzzle win condition logic
- `MQTTClientManager` - Sensor monitoring and command publishing

Loop execution:

```json
{
  "action": "mqtt.publish",
  "target": "paragon/clockwork/boiler_room_subpanel/fog_machine/pulse",
  "payload": { "duration": 3000 },
  "delayMs": 0,
  "execution": {
    "mode": "loop",
    "loopId": "ambient_fog",
    "interval": 30000
  }
}
```

### sentient-api (REST API)

**Location:** `services/api/`

Responsibilities:

- REST API endpoints
- JWT authentication + RBAC
- Multi-tenant data isolation
- Session management
- Audit logging

Key endpoints:

- `POST /api/auth/login` - Authentication
- `GET /api/sentient/rooms` - List rooms
- `GET /api/sentient/devices` - List devices
- `POST /api/sentient/scenes/:id/start` - Start scene

### sentient-device-monitor (MQTT Monitor)

**Location:** `services/device-monitor/`

Responsibilities:

- Subscribe to device sensors, status, and heartbeats
- Track device online/offline status (source of truth)
- In-memory sensor cache for real-time dashboards
- WebSocket broadcasts to UI
- Batch-persist telemetry to PostgreSQL (~10s intervals)
- Ingest Teensy capability manifests for auto-registration

MQTT subscriptions:

```
+/+/+/+/sensors/#           # All sensor data
+/+/+/+/state/#             # Device state
+/+/+/+/events/heartbeat    # Heartbeat events
```

## Teensy Firmware Standards (v2.0.1)

**Three-loop architecture:**

```cpp
void loop() {
  sentient.loop();        // MQTT maintenance
  monitor_sensors();      // Sensor publishing
  safety_checks();        // Hardware interlocks
}
```

**Capability manifest:**

- Device IDs must match database exactly
- Register all commands via manifest
- Topics use lowercase categories (`commands/`, `sensors/`, `status/`, `events/`)

**Compilation:**

- VS Code task: "Compile Current Teensy"
- Target: `teensy:avr:teensy41`
- Output: `hardware/HEX_UPLOAD_FILES/<Controller>/`

## Configuration Management

Scene configurations use a dual-source model:

**Files (Authoritative):**

- `config/rooms/{room}/scenes/*.json`
- Checked into git, human-readable, reviewable

**Database (Runtime):**

- Loaded from files via Scene Executor
- Runtime queries favor database for performance

**Operations:**

- `POST /configuration/reload` - Load files → DB
- `POST /configuration/export` - Export DB → files
- `POST /configuration/rooms/:roomId/load` - Load single room

Scene IDs must remain stable across file/DB sync.

## MQTT Testing

Subscribe to all topics:

```bash
mosquitto_sub -h localhost -p 1883 -u paragon_devices -P password -t 'paragon/#' -v
```

Publish command:

```bash
mosquitto_pub -h localhost -p 1883 -u paragon_devices -P password \
  -t 'paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_on' \
  -m '{"params":{},"timestamp":'$(date +%s%3N)'}'
```

## Database Operations

Access database (via Docker):

```bash
docker compose exec sentient-postgres psql -U sentient_dev -d sentient_dev
```

Backup database:

```bash
./scripts/backup-database.sh
```

Restore database:

```bash
./scripts/restore-database.sh backups/sentient_db_YYYYMMDD_HHMMSS.sql.gz
```

## Director Controls (Game Master Interface)

Scene-level:

- `POST /director/scenes/:sceneId/reset` - Reset scene to initial state
- `POST /director/scenes/:sceneId/override` - Mark as solved (counts toward progression)
- `POST /director/scenes/:sceneId/skip` - Bypass without credit
- `POST /director/scenes/:sceneId/stop` - Stop running scene

Room-level:

- `GET /director/rooms/:roomId/status` - Room state snapshot
- `POST /director/rooms/:roomId/power` - Set power: on/off/emergency_off
- `POST /director/rooms/:roomId/reset` - Reset entire room
- `POST /director/rooms/:roomId/jump` - Jump to specific scene

All commands are audited and broadcast via WebSocket.

## File System Layout (This Repo)

```
./
├── docker-compose.yml                 # Local orchestration (single env)
├── .env.development                   # Local development defaults
├── DOCKER_DEPLOYMENT.md               # Local deployment guide
├── README.md                          # Quick reference
├── CLAUDE.md                          # This file
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md         # Single source of truth
│   └── ...
├── config/
│   ├── nginx/                         # (optional) Nginx reverse proxy
│   ├── mosquitto-dev/                 # MQTT broker config (local)
│   ├── postgres-dev/                  # Database initialization (local)
│   ├── prometheus/                    # Metrics collection config
│   ├── grafana/                       # Dashboard provisioning
│   ├── loki/                          # Log aggregation config
│   └── promtail/                      # Log shipping config
├── docker/
│   ├── api/Dockerfile                 # API container image
│   ├── executor-engine/Dockerfile     # Scene executor image
│   ├── device-monitor/Dockerfile      # Device monitor image
│   └── web/Dockerfile                 # Frontend image
├── scripts/
│   ├── start-development.sh           # Start local stack
│   ├── health-check.sh                # Health check
│   ├── logs.sh                        # View logs
│   ├── backup-database.sh             # Database backup
│   └── restore-database.sh            # Database restore
├── services/
│   ├── api/                           # REST API
│   ├── device-monitor/                # MQTT monitoring
│   ├── executor-engine/               # Scene execution
│   └── sentient-web/                  # Vite frontend
└── volumes/                           # Persistent data (gitignored)
  ├── postgres-data-dev/
  ├── mosquitto-data-dev/
  ├── prometheus-data-dev/
  ├── grafana-data-dev/
  └── loki-data-dev/
```

## Critical Reminders

1. **Local-Only System** - Treat this repo as a local development environment, not a live production system.
2. **Documentation-First** - Update `SYSTEM_ARCHITECTURE.md` BEFORE architectural changes.
3. **Ask for Approval** - Present proposals and wait for user approval before implementing large changes.
4. **Security First** - Never expose credentials, database passwords, or MQTT port to the internet.
5. **Use Identifiers, Not Names** - MQTT topics use snake_case IDs from database, never display names.
6. **One Device = One Row** - Physical devices are aggregates; don't split into subcomponents.
7. **Docker Workflow** - Always use `docker compose` commands and the provided scripts.
8. **Multi-Tenant Safety** - Every query must filter by `client_id`.
9. **Lowercase Categories** - `commands/`, `sensors/`, `status/`, `events/` (never capitalized).
10. **Puzzle Terminology** - Use escape room industry standard: State (major stages), Step (sub-stages), NOT Phase.
11. **Never Skip Verification** - Verify assumptions by reading code or querying the local database.
