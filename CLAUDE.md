# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sentient Engine** is a **LIVE PRODUCTION, INTERNET-ACCESSIBLE** escape room orchestration platform that manages multi-tenant escape room experiences through real-time hardware coordination, scene-based gameplay progression, and safety systems. It runs on Ubuntu as Docker containerized Node.js services with PostgreSQL and Mosquitto MQTT broker. Hardware controllers are Teensy 4.1 microcontrollers on Ethernet.

**⚠️ MIGRATION NOTICE:** The system was migrated from PM2 process management to Docker containerization on November 10, 2025. A backup of the previous PM2-based Sentient Server can be found in the `backups/` folder **for reference only**.

**🎯 DUAL-ENVIRONMENT DEPLOYMENT:** As of November 13, 2025, both production and development environments run simultaneously with complete infrastructure separation via Docker Compose profiles. Production uses ports 3000-3004/5432/1883, development uses ports 4000-4004/5433/1884. Each environment has completely separate databases (postgres-prod/postgres-dev) and MQTT brokers (mosquitto-prod/mosquitto-dev) for zero cross-contamination.

**⚠️ CRITICAL: This is a production system with public internet exposure. All changes must prioritize security, stability, and data integrity.**

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

| Layer                   | Technology                         | Production Port             | Development Port           | Purpose                                   |
| ----------------------- | ---------------------------------- | --------------------------- | -------------------------- | ----------------------------------------- |
| Frontend                | Vite 5.4 + React 19.1 + TypeScript | 3002                        | 4002                       | Configuration web interface               |
| API                     | Node.js/Express                    | 3000                        | 4000                       | REST API (2 clustered instances)          |
| Scene Executor          | Node.js/TypeScript                 | 3004                        | 4004                       | Scene orchestration engine                |
| Device Monitor          | Node.js/MQTT                       | 3003                        | 4003                       | Real-time device telemetry                |
| Database                | PostgreSQL 16                      | 5432 (postgres-prod)        | 5433 (postgres-dev)        | Relational data (separate instances)      |
| Message Broker          | Mosquitto MQTT                     | 1883, 9001 (mosquitto-prod) | 1884, 9002 (mosquitto-dev) | Device communication (separate instances) |
| Reverse Proxy           | Nginx                              | 80, 443                     | 80, 443                    | HTTPS termination (shared)                |
| Container Orchestration | Docker Compose                     | -                           | -                          | Service lifecycle with profiles           |
| Observability           | Prometheus + Grafana + Loki        | 9090, 3200, 3100            | 9190, 4200, 4100           | Metrics, dashboards, logs                 |

## Production Environment & Internet Accessibility

**⚠️ THIS SYSTEM IS LIVE ON THE INTERNET**

### Public Access Information

- **Production Domain:** https://sentientengine.ai (Let's Encrypt SSL)
- **Development Domain:** https://dev.sentientengine.ai (same SSL certificate)
- **Public IP:** 63.224.145.234
- **Network:** Behind Ubiquiti Dream Machine Pro with port forwarding
- **Ports Exposed:** 80 (HTTP), 443 (HTTPS) only
- **SSL Certificate:** Let's Encrypt (auto-renews, expires Feb 4, 2026)
- **Status:** PRODUCTION - Real escape rooms depend on this system

### Security Posture

- ✅ **SSL/TLS:** Valid Let's Encrypt certificate with HTTP/2
- ✅ **Firewall:** UFW active - only HTTP/HTTPS exposed to internet
- ✅ **MQTT Isolation:** Port 1883 restricted to internal network only (192.168.20.0/24)
- ✅ **Database Security:** PostgreSQL restricted to local network, strong passwords rotated
- ✅ **fail2ban:** Active protection against brute force (5 attempts = 2-hour ban)
- ✅ **Password Policy:** 12+ chars with complexity requirements (uppercase, lowercase, number, special char)
- ✅ **Authentication:** JWT tokens, bcrypt hashing (12 rounds), audit logging
- ✅ **Rate Limiting:** 2000 requests per 15 minutes on API

### Network Architecture & VLAN Configuration

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

### CRITICAL PRODUCTION RULES

**NEVER DO THESE:**

1. ❌ Expose database passwords in code or logs
2. ❌ Open MQTT port (1883) to the internet
3. ❌ Disable SSL certificate validation
4. ❌ Push code with hardcoded credentials
5. ❌ Make breaking changes without testing
6. ❌ Restart services during active escape room sessions
7. ❌ Modify database schema without migration scripts
8. ❌ Configure Teensy controllers to use public domain for MQTT (must use local IP 192.168.2.3)
9. ❌ Run containers with privileged mode unless absolutely necessary

**ALWAYS DO THESE:**

1. ✅ Test changes in development before production
2. ✅ Use Docker Compose commands for service management (`docker-compose up -d`, `docker-compose restart`)
3. ✅ Verify services restart successfully after changes (`docker-compose ps`)
4. ✅ Check logs after deployments (`docker-compose logs [service]`)
5. ✅ Maintain audit trail in git commits
6. ✅ Update documentation when changing architecture
7. ✅ Prioritize security over convenience
8. ✅ Use the provided scripts in `scripts/` for common operations

## Critical Documentation

**SYSTEM_ARCHITECTURE.md is the single source of truth for all architectural decisions.**

- `Documentation/SYSTEM_ARCHITECTURE.md` - Complete system architecture
- `Documentation/INTERNET_EXPOSURE_SECURITY_PLAN.md` - Security hardening checklist
- `Documentation/PASSWORD_POLICY.md` - Password requirements and policy
- `BUILD_PROCESS.md` - Build scripts and version management
- `MQTT_TOPIC_FIX.md` - MQTT topic standardization
- `.github/copilot-instructions.md` - Development workflow and conventions
- `Documentation/TEENSY_V2_COMPLETE_GUIDE.md` - Teensy firmware standards

## Development Workflow

### Documentation-First Approach

**All system changes MUST follow this workflow:**

1. **Document First** - Update SYSTEM_ARCHITECTURE.md with proposed changes
2. **Review & Approve** - Discuss implications and get user approval
3. **Implement** - Write code that matches documented design
4. **Verify** - Confirm implementation matches documentation

**Never implement without explicit approval.** Present proposals, explain implications, and wait for user approval before making changes.

### Building and Deploying

**ALWAYS use the Docker Compose deployment workflow. NEVER bypass Docker containerization.**

**DUAL-ENVIRONMENT ARCHITECTURE:** Production and development run simultaneously with complete isolation via Docker Compose profiles.

#### Production Deployment

```bash
# Start production environment only
docker compose --profile production up -d

# Or use convenience script
sudo ./scripts/start-production.sh
```

This starts:

- All production services (sentient-\*-prod containers)
- Uses sentient database
- Ports 3000-3004, 3200, 9090
- Optimized builds without debug ports

#### Development Environment

```bash
# Start development environment only
docker compose --profile development up -d

# Or use convenience script
./scripts/start-development.sh
```

This enables:

- All development services (sentient-\*-dev containers)
- Uses sentient_dev database
- Ports 4000-4004, 4200, 9190
- Hot Module Replacement (HMR) for instant code changes
- Debug ports exposed (9229-9232) for IDE debugger attachment
- Volume mounts for real-time code updates

#### Both Environments

```bash
# Start both production and development
docker compose --profile production --profile development up -d

# Stop specific environment
docker compose --profile production down    # Stop production only
docker compose --profile development down   # Stop development only
docker compose down                         # Stop everything
```

#### Service Management

```bash
# Check service health
sudo ./scripts/health-check.sh

# View logs (production)
docker compose logs -f sentient-api-prod-1
docker compose logs --tail=100 sentient-executor-prod

# View logs (development)
docker compose logs -f sentient-api-dev-1
docker compose logs --tail=100 sentient-executor-dev

# Restart specific service
docker compose restart sentient-api-prod-1    # Production
docker compose restart sentient-api-dev-1     # Development

# Rebuild after code changes
docker compose up -d --build sentient-api-prod-1   # Production
docker compose up -d --build sentient-api-dev-1    # Development
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

### Container Services

Check service health:

```bash
sudo ./scripts/health-check.sh
```

**Production Containers** (ports 3000-3004, 3200, 9090):

- `sentient-api-prod-1`, `sentient-api-prod-2` - REST API (2 clustered instances, port 3000)
- `sentient-executor-prod` - Scene execution engine (port 3004)
- `sentient-web-prod` - Vite frontend (port 3002)
- `sentient-monitor-prod` - MQTT telemetry (port 3003)
- `sentient-prometheus-prod` - Metrics collection (port 9090)
- `sentient-grafana-prod` - Monitoring dashboards (port 3200)
- `sentient-loki-prod` - Log aggregation (port 3100)
- `sentient-promtail-prod` - Log shipping

**Development Containers** (ports 4000-4004, 4200, 9190):

- `sentient-api-dev-1`, `sentient-api-dev-2` - REST API with debug ports (port 4000)
- `sentient-executor-dev` - Scene execution engine with HMR (port 4004)
- `sentient-web-dev` - Vite frontend with HMR (port 4002)
- `sentient-monitor-dev` - MQTT telemetry (port 4003)
- `sentient-prometheus-dev` - Metrics collection (port 9190)
- `sentient-grafana-dev` - Monitoring dashboards (port 4200)
- `sentient-loki-dev` - Log aggregation (port 4100)
- `sentient-promtail-dev` - Log shipping

**Infrastructure Services:**

_Production:_

- `sentient-postgres-prod` - PostgreSQL database (port 5432, database: sentient)
- `sentient-mosquitto-prod` - MQTT broker (ports 1883/9001)

_Development:_

- `sentient-postgres-dev` - PostgreSQL database (port 5433, database: sentient_dev)
- `sentient-mosquitto-dev` - MQTT broker (ports 1884/9002)

_Shared:_

- `sentient-nginx` - Reverse proxy (ports 80, 443, routes both domains)

View logs:

```bash
sudo ./scripts/logs.sh sentient-api-1
docker-compose logs -f --tail=100 [service_name]
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
docker-compose exec postgres psql -U sentient_prod -d sentient
```

Apply migration:

```bash
docker-compose exec postgres psql -U sentient_prod -d sentient -f /docker-entrypoint-initdb.d/migrations/004_something.sql
```

Query production schema:

```bash
docker-compose exec postgres psql -U sentient_prod -d sentient -c "\d devices"
```

Backup database:

```bash
sudo ./scripts/backup-database.sh
```

Restore database:

```bash
sudo ./scripts/restore-database.sh backups/sentient_db_YYYYMMDD_HHMMSS.sql.gz
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

## File System Layout

```
/opt/sentient/
├── docker-compose.yml                 # Production orchestration
├── docker-compose.dev.yml             # Development overrides
├── .env.production                    # Production secrets (gitignored)
├── .env.development                   # Development defaults
├── DOCKER_DEPLOYMENT.md               # Complete deployment guide
├── README.md                          # Quick reference
├── CLAUDE.md                          # This file
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md         # Single source of truth
│   └── ...
├── config/
│   ├── nginx/                         # Nginx reverse proxy config
│   ├── mosquitto/                     # MQTT broker config
│   ├── postgres/init/                 # Database initialization
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
│   ├── setup-production.sh            # Initial setup
│   ├── start-production.sh            # Start production
│   ├── start-development.sh           # Start development
│   ├── stop-production.sh             # Stop services
│   ├── health-check.sh                # Health check
│   ├── logs.sh                        # View logs
│   ├── backup-database.sh             # Database backup
│   └── restore-database.sh            # Database restore
├── services/
│   ├── api/                           # REST API
│   ├── device-monitor/                # MQTT monitoring
│   ├── executor-engine/               # Scene execution
│   └── sentient-web/                  # Vite frontend
├── volumes/                           # Persistent data (gitignored)
│   ├── postgres-data/
│   ├── mosquitto-data/
│   ├── prometheus-data/
│   ├── grafana-data/
│   └── loki-data/
└── backups/                           # Database backups & PM2 archive
```

## Critical Reminders

1. **🌐 INTERNET-ACCESSIBLE PRODUCTION SYSTEM** - This site is live at https://sentientengine.ai with real users and escape rooms
2. **Documentation-First** - Update SYSTEM_ARCHITECTURE.md BEFORE architectural changes
3. **Ask for Approval** - Present proposals and wait for user approval before implementing
4. **Security First** - Never expose credentials, database passwords, or MQTT port to internet
5. **Verify Production** - Query actual database schema; don't assume based on schema.sql
6. **Use Identifiers, Not Names** - MQTT topics use snake_case IDs from database, never display names
7. **One Device = One Row** - Physical devices are aggregates; don't split into subcomponents
8. **Docker Workflow** - Always use Docker Compose commands and deployment scripts
9. **Multi-Tenant Safety** - Every query must filter by client_id
10. **Lowercase Categories** - commands/, sensors/, status/, events/ (never capitalized)
11. **Puzzle Terminology** - Use escape room industry standard: State (major stages), Step (sub-stages), NOT Phase
12. **Never Skip Verification** - Always verify assumptions by querying production database or reading code
13. **Test Before Deploy** - Changes affect live escape room operations; accuracy and stability over speed
14. **Monitor After Changes** - Always check `docker-compose logs [service]` after deployments to verify services are healthy
15. **PM2 Backup Reference** - The PM2-based system backup is in `backups/` folder for reference only
