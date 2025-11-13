# Sentient Engine - System Architecture

**Version:** 2.1.0
**Last Updated:** November 10, 2025
**Status:** Production Operational on SentientMythraS1 (Docker Containerized)

---

## 🎯 CRITICAL: This Document is the Single Source of Truth

**All system changes must follow this workflow:**

1. **Document First** - Analyze and update this document with proposed changes
2. **Review & Approve** - Discuss architecture implications and get approval
3. **Implement** - Write code that matches the documented design
4. **Verify** - Confirm implementation matches documentation

**Production Schema Authority:**

- This document describes the **actual production schema** (what's running now)
- `database/schema.sql` may lag behind (outdated baseline)
- Migrations in `database/migrations/` show incremental changes
- Query production database to verify: `psql -d sentient -c "\d table_name"`

---

## Current State Update — November 13, 2025

**Major Infrastructure Update: Complete Environment Separation**

- **Deployment:** Migrated from PM2-managed processes to Docker containers with docker-compose orchestration (Nov 10, 2025)
- **Dual Environments:** Production and development now run simultaneously with complete isolation (Nov 11, 2025)
- **Infrastructure Separation:** Completed full separation of dev/prod infrastructure (Nov 13, 2025)
  - **Production:** postgres-prod (port 5432), mosquitto-prod (ports 1883/9001)
  - **Development:** postgres-dev (port 5433), mosquitto-dev (ports 1884/9002)
  - **Shared:** nginx only (routes both domains)
- **Process Management:** PM2 removed; all services now run in dedicated Docker containers
- **Orchestration:** Docker Compose manages service lifecycle with profile-based environment separation
- **Environment Isolation:**
  - Three Docker networks (production, development, shared)
  - Separate databases (sentient on postgres-prod, sentient_dev on postgres-dev)
  - Separate MQTT brokers (mosquitto-prod, mosquitto-dev)
  - Independent service naming (sentient-_-prod vs sentient-_-dev)
  - Port segregation (3000-series for prod, 4000-series for dev)
- **Domain Routing:**
  - Production: sentientengine.ai (192.168.7.3:80/443) - public internet access via Let's Encrypt SSL
  - Development: dev.sentientengine.ai (192.168.2.3:4080/4443) - local network only
- **Observability:** Full monitoring stack (Prometheus, Grafana, Loki, Promtail) deployed for both environments
- **MQTT Standardization:** All services now use MQTT_URL + MQTT_USERNAME (removed MQTT_BROKER_URL)
- MQTT topics standardized: `[client]/[room]/[category]/[controller]/[device]/[item]` with lowercase categories (commands, sensors, status, events)
- All identifiers are snake_case and sourced from database (never display names)
- Controller v2 (Teensy 4.1) online with single MQTT dispatch path parsing device/command from topic
- Command acknowledgements published on events channel: `.../events/[controller]/[device]/command_ack`
- Web UI: Controllers List, Controller Detail, and Device Detail pages operational
- **Touchscreen Lighting Interface:** Touch-optimized wall panel for Clockwork room lighting control (deployed at `/touchscreen`)
- Deprecated docs archived to `Documentation/z_archive`

---

## Network Architecture — Paragon-Mesa (Approved)

Rooms no longer require per-room VLANs. Consolidate to role-based segments to simplify ACLs and ensure MQTT reachability.

### VLAN Layout

| Purpose                      | VLAN | CIDR           | Notes                                |
| ---------------------------- | ---- | -------------- | ------------------------------------ |
| Infrastructure.              | 1    | 192.168.1.0/24 | UDM Pro, switches, APs               |
| Core Services                | 2    | 192.168.2.0/24 | Mosquitto, API, DB, web              |
| Controllers (ALL)            | 3    | 192.168.3.0/24 | Teensy, Pi peripherals, TouchScreens |
| Internal WiFi                | 4    | 192.168.4.0/24 | Authenticated staff                  |
| Guest WiFi                   | 5    | 192.168.5.0/24 | Internet only, client isolation      |
| AV/Media Streams             | 6    | 192.168.6.0/24 | Cameras/streams if needed            |
| In-Game Cameras and Security | 7    | 192.168.7.0/24 | Cameras/streams if needed            |

Notes:

- Existing per-room nets (e.g., 192.168.6.0/24, 192.168.60.0/24) are not for controllers going forward.
- All controllers should obtain DHCP on VLAN 30.

### Firewall Rules (UDM Pro — LAN IN order)

1. ACCEPT Controllers → Services: VLAN 30 → 192.168.20.0/24 tcp {1883, 80, 443}
2. ACCEPT Controllers → Services: VLAN 30 → 192.168.20.0/24 icmp (optional diagnostics)
3. DROP Controllers lateral: VLAN 30 → VLAN 30 (allow ESTABLISHED/RELATED only)
4. ACCEPT Staff → Services: VLAN 50 → 192.168.20.0/24 tcp {443, 80}
5. DROP Staff → Controllers: VLAN 50 → 192.168.30.0/24
6. DROP Guest → RFC1918 (isolate guests; Internet only)
7. ACCEPT Mgmt → Any: VLAN 10 → any (admin/monitoring)

Broker requirement:

- Mosquitto must listen on 0.0.0.0:1883 and allow VLAN 30 via host firewall.

### DHCP / IP Strategy

- Static DHCP reservations for core services in VLAN 20.
- Dynamic leases for controllers in VLAN 30 (reserve critical anchors as needed).
- No controllers on Staff or Guest VLANs.

### Migration Plan

1. Create VLAN 30 “Controllers” (Corporate, DHCP on).
2. Update switch ports used by controllers to VLAN 30.
3. Move one controller, verify:

- Gets 192.168.30.x
- `nc -vz 192.168.20.3 1883` succeeds

4. Migrate remaining controllers.
5. Enable MQTT auth in firmware (username/password).
6. Remove temporary firmware network diagnostics once stable.

### Rollback

- Temporarily allow ANY VLAN → 192.168.20.3 tcp/1883 if needed for emergency operation, then tighten rules.

Active docs: SYSTEM_ARCHITECTURE.md, BUILD_PROCESS.md, MQTT_TOPIC_FIX.md, TEENSY_V2_COMPLETE_GUIDE.md, REALTIME_SENSOR_ARCHITECTURE.md, LOOP_EXECUTION_IMPLEMENTATION.md, TOUCHSCREEN_INTERFACE.md

---

## 🔤 Naming Convention Standard (CRITICAL)

**ALL identifiers across the entire stack MUST use snake_case.**

This standard applies to:

- **Database:** All column names, table names (already snake_case)
- **MQTT Topics:** All segments (client, room, controller, device, command)
- **API:** All request parameters (query, body, path), all response fields
- **Frontend:** All data structures when interacting with backend
- **Configuration:** Scene JSON files, config files

### Rules

1. **snake_case ONLY** - lowercase letters, numbers, underscores
2. **NO camelCase** - Not in API layer, not in frontend data models
3. **NO hyphens** - Use underscores, not dashes
4. **Database identifiers** - Never friendly display names in system internals
5. **Consistency** - Same identifier name across all layers (e.g., `room_id` everywhere)

### Examples

✅ **Correct:**

```javascript
// API Request
{ room_id: "uuid", scene_number: 1, device_id: "intro_tv" }

// MQTT Topic
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_on

// Database Query
SELECT room_id, scene_number FROM scenes WHERE scene_id = $1;
```

❌ **Incorrect:**

```javascript
// NO camelCase in API
{ roomId: "uuid", sceneNumber: 1, deviceId: "intro_tv" }

// NO hyphens
paragon/clockwork/commands/boiler-room-subpanel/intro-tv/power-on
```

### Rationale

- **Consistency** - One standard eliminates confusion and bugs
- **Database alignment** - PostgreSQL convention is snake_case
- **MQTT compatibility** - Already established as snake_case
- **No conversion overhead** - Data flows through without transformation
- **Maintainability** - Clear, predictable naming across codebase

---

## Executive Overview

**Sentient Engine** is a production escape room orchestration platform managing multi-tenant experiences through real-time hardware coordination, scene-based gameplay progression, and comprehensive safety systems.

### Key Capabilities

- **Multi-Tenant SaaS Platform** - Isolated client environments with role-based access control
- **Real-Time Hardware Control** - Sub-second MQTT communication with physical devices
- **Scene-Based Orchestration** - Theatrical sequencing of puzzles and scenes
- **Safety-Critical Operations** - Emergency stop systems and health monitoring
- **Director Controls** - Live game master interface for operational oversight

### Technology Stack

| Layer               | Technology            | Port       | Purpose                                   |
| ------------------- | --------------------- | ---------- | ----------------------------------------- |
| **Frontend**        | Vite 5.4 + React 19.1 | 3002       | Configuration web interface               |
| **Backend API**     | Node.js/Express       | 3000       | REST API services (2 clustered instances) |
| **Scene Executor**  | Node.js/TypeScript    | 3004       | Scene & puzzle execution engine           |
| **Device Monitor**  | Node.js/MQTT          | 3003       | Real-time device telemetry                |
| **Database**        | PostgreSQL 16         | 5432       | Configuration and operational data        |
| **Message Broker**  | Mosquitto MQTT        | 1883       | Device communication                      |
| **Metrics**         | Prometheus + Grafana  | 9090, 3200 | Metrics, dashboards, alerting             |
| **Logging**         | Loki + Promtail       | 3100       | Structured log aggregation                |
| **Reverse Proxy**   | Nginx                 | 80, 443    | HTTPS termination and routing             |
| **Process Manager** | PM2                   | -          | Service orchestration                     |
| **Hardware**        | Teensy 4.1            | -          | Microcontroller firmware (v2.0.1)         |

---

## System Identity & Philosophy

### Core Philosophy

**Sentient Engine operates as a theatrical control system** - orchestrating escape room experiences with the precision of Broadway production and the reliability of industrial automation.

**Design Principles:**

1. **Safety First** - All operations prioritize player safety with emergency stop capabilities
2. **Stateless Peripherals** - Hardware devices execute commands but don't make decisions
3. **Multi-Tenant Isolation** - Complete data and operational separation between clients
4. **Real-Time Responsiveness** - Sub-second command execution and telemetry feedback
5. **Observable Operations** - Comprehensive logging, monitoring, and audit trails

### System Responsibilities

```
SENTIENT ENGINE (Brain)          ←→  HARDWARE CONTROLLERS (Hands)
• Game state management               • Execute commands from Sentient
• Decision making and logic            • Monitor sensors and report changes
• Scene orchestration                  • Implement safety interlocks
• Safety enforcement                   • Provide heartbeat telemetry
• Multi-tenant isolation
```

**Key Principle:** Sentient = Brain (makes decisions), Teensy = Hands (executes commands)

---

## Infrastructure Architecture

### Production Environment: SentientMythraS1

Ubuntu 24.04 LTS server running at sentientengine.ai with **Docker Compose orchestration**.

**Container Architecture:**

All services run as Docker containers managed by Docker Compose, providing:

- **Isolation:** Each service runs in its own container with defined resource limits
- **Portability:** Consistent environment across development and production
- **Orchestration:** Automatic dependency management and health checks
- **Scalability:** Easy horizontal scaling (currently 2 API instances)
- **Recovery:** Automatic restart on failure
- **Monitoring:** Built-in health checks and metrics collection

**Containerized Services:**

| Container Name          | Image               | Port(s)    | Instances | Purpose                           |
| ----------------------- | ------------------- | ---------- | --------- | --------------------------------- |
| sentient-postgres-prod  | postgres:16-alpine  | 5432       | 1         | PostgreSQL database (production)  |
| sentient-postgres-dev   | postgres:16-alpine  | 5433       | 1         | PostgreSQL database (development) |
| sentient-mosquitto-prod | eclipse-mosquitto:2 | 1883, 9001 | 1         | MQTT broker (production)          |
| sentient-mosquitto-dev  | eclipse-mosquitto:2 | 1884, 9002 | 1         | MQTT broker (development)         |
| sentient-api-1          | custom (Node.js)    | 3000       | 1         | REST API instance 1               |
| sentient-api-2          | custom (Node.js)    | 3000       | 1         | REST API instance 2               |
| sentient-scene-executor | custom (TypeScript) | 3004       | 1         | Scene orchestration               |
| sentient-device-monitor | custom (Node.js)    | 3003       | 1         | MQTT monitoring                   |
| sentient-web            | custom (Vite/nginx) | 3002       | 1         | React frontend                    |
| sentient-nginx          | nginx:1.25-alpine   | 80, 443    | 1         | Reverse proxy                     |
| sentient-prometheus     | prom/prometheus     | 9090       | 1         | Metrics collection                |
| sentient-grafana        | grafana/grafana     | 3200       | 1         | Dashboards                        |
| sentient-loki           | grafana/loki        | 3100       | 1         | Log aggregation                   |
| sentient-promtail       | grafana/promtail    | 9080       | 1         | Log shipping                      |

**Docker Network:**

- Internal bridge network: `sentient-internal` (172.20.0.0/16)
- Service-to-service communication via Docker DNS
- Only necessary ports exposed to host network
- MQTT and PostgreSQL isolated (internal access only)

**Port Allocation Notes:**

- Port 3000 reserved for sentient-api (load balanced across 2 instances)
- Grafana on port 3200 to avoid conflict with API
- Production infrastructure: postgres-prod (5432), mosquitto-prod (1883/9001)
- Development infrastructure: postgres-dev (5433), mosquitto-dev (1884/9002)
- PostgreSQL and MQTT ports exposed for service access, secured via Docker networks
- All HTTP/HTTPS traffic routes through Nginx reverse proxy

### File System Structure

```
/opt/sentient/
├── .github/copilot-instructions.md    # Development guidelines
├── Documentation/SYSTEM_ARCHITECTURE.md  # This document
├── BUILD_PROCESS.md                   # Build script documentation
├── MQTT_TOPIC_FIX.md                  # Topic standardization guide
├── config/
│   ├── rooms/{room}/scenes/*.json     # Scene configurations
│   ├── mosquitto.conf                 # MQTT broker config
│   ├── mosquitto_passwd               # MQTT authentication
│   └── mosquitto.acl                  # MQTT access control
├── database/
│   ├── schema.sql                     # Outdated baseline
│   ├── seed.sql                       # Initial data
│   └── migrations/                    # Incremental changes (authoritative)
├── hardware/
│   ├── Controller Code Teensy/        # Active v2.0.1 controllers
│   └── HEX_UPLOAD_FILES/             # Compiled firmware
├── scripts/
│   ├── status_services.sh            # Health check
│   ├── bump_and_build_frontend.sh    # Frontend deployment
│   ├── bump_and_build_backend.sh     # Backend deployment
│   └── compile_current.sh            # Teensy compilation
└── services/
    ├── api/                          # REST API
    ├── device-monitor/               # MQTT monitoring
    ├── executor-engine/              # Scene execution
    └── sentient-web/                 # Vite frontend
```

---

## Service Architecture

### Service Interaction Overview

```
User/Game Master → Nginx → sentient-web (Vite + React)
                              ↓
                         sentient-api (Express)
                              ↓
                         PostgreSQL
                              ↓
                    scene-executor (TypeScript)
                              ↓
                    Mosquitto MQTT Broker
                    ↓                    ↑
            Teensy 4.1 Controllers   device-monitor
```

### sentient-web (Frontend)

**Technology:** Vite 5.4.21, React 19.1, TypeScript, Tailwind CSS, React Router v6

**Key Directories:** `services/sentient-web/src/`

- `pages/` - Dashboard, RoomsList, ScenesList, TimelineEditor
- `components/` - React components (auth, layout, timeline)
- `hooks/` - useExecutorSocket, custom hooks
- `lib/api.ts` - Axios API client
- `store/` - Zustand state management

**Development:** `cd services/sentient-web && npm run dev` (port 3002)
**Deploy:** `/opt/sentient/scripts/bump_and_build_frontend.sh`

### scene-executor (Scene Execution Engine)

**Location:** `services/executor-engine/`
**Port:** 3004

**Core Responsibilities:**

- Execute scene timelines with sub-second precision
- Loop execution support (ambient effects, repeating actions)
- Safety verification before scene activation
- Director controls (start, stop, reset, override)
- WebSocket state broadcasting
- MQTT command publishing

**Architecture Components:**

- **SceneRegistry** - In-memory scene catalog with state machine
- **CutsceneExecutor** - Timeline execution with loop support
- **SafetyVerifier** - Pre-execution safety checks (device health, heartbeats)
- **ConditionEvaluator** - Puzzle win condition logic
- **PuzzleStateManager** - Multi-state puzzle progression (State 1, State 2, State 3)
- **PuzzleWatcher** - Sensor monitoring with if-then logic
- **ActionExecutor** - Conditional action execution
- **MQTTClientManager** - Sensor monitoring and command publishing
- **SessionManager/TimerManager** - Game sessions and timers
- **WebSocket Server** - Real-time state broadcasting

**Timeline Loop Execution:**
Actions can specify `execution: { mode: 'loop', loopId: 'id', interval: 30000 }` for repeating behaviors. Loops stopped via `loop.stop` action or automatic cleanup on scene end.

**Puzzle System (Escape Room Industry Terminology):**

The puzzle system supports complex, multi-state puzzles with sensor-driven logic:

- **States** - Major stages of a puzzle (e.g., State 1, State 2, State 3)
- **Steps** - Sub-stages within a state (e.g., "Boiler Valve Setup", "Gate Valve Calibration")
- **Sensor Watches** - If-then monitoring with conditional actions (can monitor ANY device in room)
- **Win Conditions** - Define when a state/puzzle is solved
- **Conditional Actions** - Execute actions when conditions are met (onStart, onSolve, onFail, onReset)

Example: A 3-state puzzle where State 1 has 2 steps, each monitoring different sensor combinations with automatic state transitions and reset logic.

**Director Controls:**

- Scene-level: `/director/scenes/:sceneId/{reset,override,skip,stop}`
- Room-level: `/director/rooms/:roomId/{status,power,reset,jump}`

**Deploy:** `/opt/sentient/scripts/bump_and_build_backend.sh`

### sentient-api (REST API)

**Location:** `services/api/`
**Port:** 3000 (2 clustered instances)

**Responsibilities:**

- REST API endpoints for all system operations
- JWT authentication + RBAC
- Multi-tenant data isolation
- Session management
- Audit logging

**Key Endpoints:**

- `POST /api/auth/login` - Authentication
- `GET /api/sentient/rooms` - List rooms
- `GET /api/sentient/devices` - List devices
- `POST /api/sentient/scenes/:id/start` - Start scene

### sentient-device-monitor (MQTT Monitor)

**Location:** `services/device-monitor/`
**Port:** 3003

**Responsibilities:**

- Subscribe to device sensors, status, and heartbeats
- Track device online/offline status (source of truth)
- In-memory sensor cache for real-time dashboards
- WebSocket broadcasts to UI
- Batch-persist telemetry to PostgreSQL (~10s intervals)
- Ingest Teensy capability manifests for auto-registration

**MQTT Subscriptions:**

- `+/+/+/+/sensors/#` - All sensor data
- `+/+/+/+/state/#` - Device state
- `+/+/+/+/events/heartbeat` - Heartbeat events

**Registration Pipeline:**
Controllers publish capability manifest at startup. Device-monitor ingests and upserts to PostgreSQL: controllers, devices (one row per physical device), device_commands (one-to-many).

### Touchscreen Lighting Interface

**Location:** `services/sentient-web/src/pages/TouchscreenLighting.tsx`
**URL:** `https://192.168.20.3/touchscreen`
**Purpose:** Wall-mounted touchscreen control panel for immediate room lighting control

**Overview:**
The touchscreen interface provides a simplified, touch-optimized interface for staff to control room lighting during build, maintenance, and setup operations. Deployed on a 10" Raspberry Pi touchscreen (1280x800) mounted outside the Clockwork Corridor room.

**Key Features:**

- **Quick Presets** - "All Lights On" and "All Lights Off" buttons for rapid room control
- **Touch-Optimized UI** - Large buttons with hover effects and loading states
- **No Authentication** - Direct access via dedicated route (`/touchscreen`)
- **Real-time Feedback** - Toast notifications for command execution
- **Sentient Branding** - Consistent visual design with Neural Eye logo and gradient animations

**Controlled Devices (Clockwork Corridor):**

- Study Lights (brightness control)
- Boiler Room Lights (brightness control)
- Lab Lights - Ceiling Squares (brightness control)
- Lab Lights - Floor Grates (brightness control)
- Sconce Lights (on/off)
- Crawlspace Lights (on/off)

**Architecture Integration:**

- Routes through existing `sentient-web` React application
- Uses `devices.test()` API for command execution
- Commands flow through scene-executor → MQTT → `main_lighting` controller
- Filters devices by `controller_id: 'main_lighting'` and `room_id: 'clockwork'`

**Deployment Configuration:**

- **Hardware:** Raspberry Pi with 10" touchscreen (1280x800)
- **Browser:** Chromium in kiosk mode (fullscreen, no UI)
- **Launcher:** `/hardware/raspberry-pi-touchscreen-launcher.sh`
- **Autostart:** Configured via `/home/pi/.config/lxsession/LXDE-pi/autostart`
- **Network:** Direct connection to `https://192.168.20.3/touchscreen`

**Security Considerations:**

- Route is publicly accessible (no auth required for operational simplicity)
- Limited to lighting control only (no access to scenes, timelines, or configuration)
- Physical access control via locked room mounting
- Device commands audited via standard audit logging

**Technical Notes:**

- API calls use Nginx proxy path (`https://192.168.20.3/api/`) not direct port 3000
- Frontend environment variable `VITE_API_URL=https://192.168.20.3` ensures proper routing
- Touch targets sized for finger input (minimum 44x44px tap areas)
- Visual feedback for all interactions (loading spinners, hover states, toasts)

See `Documentation/TOUCHSCREEN_INTERFACE.md` for complete deployment guide.

---

## Data Architecture

### PostgreSQL Schema Overview

**Version:** 1.0.0
**Schema File:** `/opt/sentient/database/schema.sql` (outdated baseline)
**Authoritative:** `database/migrations/` (incremental changes)

### Primary Key Strategy

**UUID Primary Keys (Standard):** All tables use UUID for global uniqueness, security, scalability, and frontend compatibility.

**Dual-Identifier Pattern:**

```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Database identity
  slug VARCHAR(100) UNIQUE,                        -- Human-readable identifier
  device_id VARCHAR(100),                          -- MQTT topic segment
  name VARCHAR(255)                                -- Display name (can change)
);
```

**Usage:**

- `id` (UUID) - Database identity and foreign key references
- `slug` or `device_id` - Human-readable, used in MQTT topics
- `friendly_name` - UI display only, never used in topics or routing

### Entity Relationship Model

```
clients (Tenants)
  ├── users
  └── rooms
       ├── scenes → scene_steps
       ├── devices → device_commands
       └── controllers
```

### Core Tables

**Multi-Tenancy:**

- `clients` - Client organizations (escape room businesses)
- `users` - System users with RBAC (admin, editor, viewer, game_master, etc.)
- `user_sessions` - Active sessions with JWT tokens

**Room Configuration:**

- `rooms` - Escape room experiences (UUID PK + slug)
- `controllers` - Hardware controllers (Teensy, etc.)
- `devices` - Physical hardware units (one row per physical device)
- `device_commands` - One-to-many: device → commands (scene-friendly → firmware-specific)
- `scenes` - Puzzles and cutscenes
- `scene_steps` - Timeline actions with loop support

**Operations:**

- `room_sessions` - Game sessions
- `device_heartbeats` - Health monitoring telemetry
- `emergency_stop_events` - Safety events
- `audit_log` - Complete audit trail

### Device Modeling Standard

**One physical device = one database row**

✅ Correct: Device `intro_tv` (one row) with multiple commands via `device_commands`
❌ Incorrect: Splitting `tv_power` and `tv_lift` into separate device rows

### Multi-Tenant Safety

**Every query MUST filter by client_id:**

```sql
SELECT d.* FROM devices d
JOIN rooms r ON d.room_id = r.id
WHERE r.client_id = $1;  -- REQUIRED
```

### Configuration Source of Truth (Files ⇄ Database)

**Authoritative Definitions:** JSON files under `config/rooms/{room}/scenes/*.json` (git-tracked, human-readable)

**Runtime Source:** PostgreSQL (loaded from files, optimized for queries)

**Operations (Scene Executor):**

- `POST /configuration/reload` - Load files → DB
- `POST /configuration/export` - Export DB → files
- `POST /configuration/rooms/:roomId/load` - Load single room

Scene IDs must remain stable across file/DB sync.

### Database Migrations

**Procedure:**

1. Apply migration: `sudo -u postgres psql -d sentient -f database/migrations/XXX_name.sql`
2. Update `schema_version` table with new version and description
3. Keep migrations idempotent and conservative

**Recent Migrations:**

- **007_convert_rooms_to_uuid.sql** (2025-10-27): Converted rooms table from slug-based PK to UUID PK. All foreign keys updated. Slug retained for MQTT topic construction.

---

## Communication Architecture

### MQTT Message Broker (Mosquitto)

**Broker:** Eclipse Mosquitto 2.x
**Port:** 1883 (plaintext, secured via ACL)
**Config:** `/opt/sentient/config/mosquitto.conf`

### MQTT Topic Standard (Authoritative)

**Template:**

```
[client]/[room]/[category]/[controller]/[device]/[item]
```

**Rules:**

- snake_case only (lowercase letters, digits, underscore)
- No spaces or hyphens
- Categories always lowercase: `commands/`, `sensors/`, `status/`, `events/`
- Device = physical unit (aggregate), not subcomponents
- Topics built from database identifiers, **never display names**

**Hardware Hierarchy Terms:**

- **client_id** - Business entity (tenant). Example: `paragon`
- **room_id** - Specific escape room. Example: `clockwork`
- **controller_id** - Hardware controller identifier. Example: `boiler_room_subpanel`
- **device_id** - Single physical device. Example: `intro_tv`, `fog_machine`
- **command** - Device action. Example: `power_tv_on`, `move_tvlift_up`

**Examples (Clockwork Corridor):**

```
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_on
paragon/clockwork/sensors/boiler_room_subpanel/pilot_light/color_sensor
paragon/clockwork/status/boiler_room_subpanel/intro_tv/heartbeat
```

### Database → MQTT Topic Mapping

**Identifier Sources (snake_case, database-sourced):**

- client_id → [client]
- room_id → [room]
- controller_id → [controller]
- device_id → [device]

**Command Resolution:**
`device_commands` table maps:

- `command_name` (scene-friendly) → `specific_command` (firmware)
- `friendly_name` - UI display label only

**Topic Construction:**

```
[client_id]/[room_id]/commands/[controller_id]/[device_id]/[specific_command]
```

### Message Types

| Type          | Direction         | Purpose          | Example Topic            |
| ------------- | ----------------- | ---------------- | ------------------------ |
| **commands/** | Sentient → Device | Control hardware | `*/commands/power_tv_on` |
| **status/**   | Device → Sentient | Status updates   | `*/status/connection`    |
| **sensors/**  | Device → Sentient | Sensor readings  | `*/sensors/pressure`     |
| **events/**   | Device → Sentient | One-off events   | `*/events/alert`         |

### Message Payloads

See MQTT_TOPIC_FIX.md for complete payload specifications. Key formats:

- Command messages include `command`, `device_id`, `parameters`, `timestamp`, `request_id`
- State updates include `device_id`, `state`, `timestamp`, `data`
- Heartbeats include `device_id`, `firmware_version`, `uptime`, `status`, `ip_address`
- Sensor data includes `device_id`, `sensor_type`, `value`, `unit`, `timestamp`

### Authentication & ACL

**Password File:** `/opt/sentient/config/mosquitto_passwd`

```bash
sudo mosquitto_passwd -b /opt/sentient/config/mosquitto_passwd username password
sudo systemctl reload mosquitto
```

**ACL Configuration:** `/opt/sentient/config/mosquitto.acl`

- Client-specific device users (read/write to client topics only)
- Sentient services (full access)
- Admin (monitoring and debugging)

### MQTT Testing

```bash
# Subscribe to all topics
mosquitto_sub -h localhost -p 1883 -u paragon_devices -P password -t 'paragon/#' -v

# Publish command
mosquitto_pub -h localhost -p 1883 -u paragon_devices -P password \
  -t 'paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_on' \
  -m '{"params":{},"timestamp":'$(date +%s%3N)'}'
```

---

## Hardware Integration

### Teensy 4.1 Controller Standard (v2.0.1)

**Microcontroller:** Teensy 4.1 (600MHz ARM Cortex-M7)
**Connectivity:** Ethernet (W5500/W5100)
**Library:** SentientMQTT_v2
**Firmware Location:** `/opt/sentient/hardware/Controller Code Teensy/`

**Hardware Philosophy:** Teensy controllers are stateless peripheral executors. They execute commands and report sensor data but don't make gameplay decisions.

### Firmware Structure

**Three-loop architecture:**

```cpp
void loop() {
  sentient.loop();        // MQTT maintenance
  monitor_sensors();      // Sensor publishing
  safety_checks();        // Hardware interlocks
}
```

**Capability Manifest:**
Every controller registers its capabilities with Sentient Engine on startup, including device IDs (must match database exactly) and available commands. Topics use lowercase categories.

See `Documentation/TEENSY_V2_COMPLETE_GUIDE.md` for complete firmware standards and examples.

### Compilation & Deployment

**VS Code Task:** "Compile Current Teensy"

**Manual:**

```bash
/opt/sentient/scripts/compile_current.sh ${file}
```

- Target: `teensy:avr:teensy41`
- Toolchain: bundled arduino-cli at `bin/`
- Output: `hardware/HEX_UPLOAD_FILES/<Controller>/`

---

## Security Architecture

### Multi-Tenant Isolation

**Principle:** Complete data and operational separation between client organizations.

**Database-Level:** All queries MUST include `client_id` filter via JOIN to `rooms` table.

**API-Level:** Middleware enforces tenant isolation. Non-admin users restricted to their own client. Admins can access all clients.

### Role-Based Access Control (RBAC)

**User Roles:**

- **admin** - Full system access across all clients
- **editor** - Read/write within client
- **viewer** - Read-only within client
- **game_master** - Operational controls during games
- **creative_director** - Content and experience design
- **technician** - Device maintenance and troubleshooting

**Enforcement:** Middleware checks user role against allowed roles for each endpoint.

### Authentication

**Method:** JWT (JSON Web Tokens) with database session tracking

**Token Structure:** Includes `user_id`, `username`, `role`, `client_id`, `session_id`, `iat`, `exp`

**Flow:**

1. User submits credentials to `/api/auth/login`
2. Server validates password (bcrypt), verifies user active, checks client
3. Server generates JWT token, stores session in database
4. Client includes token in requests: `Authorization: Bearer <jwt_token>`
5. Server validates JWT signature, checks session in DB, loads user context

### MQTT Security

**ACL:** Client-specific device users restricted to their topics. Sentient services have full access. See `/opt/sentient/config/mosquitto.acl`.

### Network Security

**Firewall (UFW):**

- 22/tcp - SSH (restricted to admin IPs)
- 80/tcp - HTTP (redirect to HTTPS)
- 443/tcp - HTTPS (public)
- 1883/tcp - MQTT (internal network only)
- 5432/tcp - PostgreSQL (localhost only)

**SSL/TLS:** Nginx configured with TLSv1.2/1.3

**Environment Variables:** Stored in `/opt/sentient/.env` (never committed). Includes DATABASE_URL, MQTT_PASSWORD, JWT_SECRET, etc.

---

## Deployment Architecture

### Dual-Environment Configuration (Production + Development)

**Status:** Deployed November 11, 2025

**Architecture:** Both production and development environments run simultaneously on the same server using Docker Compose profiles for complete isolation.

**Key Benefits:**

- ✅ Production remains stable while testing changes in development
- ✅ Complete environment isolation (separate networks, databases, services)
- ✅ Independent lifecycle management (start/stop environments separately)
- ✅ Development hot-reload with volume mounts for rapid iteration
- ✅ Production optimized with multi-stage builds and security hardening

### Environment Separation

| Aspect           | Production                            | Development                            |
| ---------------- | ------------------------------------- | -------------------------------------- |
| **Profile**      | `production`                          | `development`                          |
| **Ports**        | 3000-3004, 3200, 9090                 | 4000-4004, 4200, 9190                  |
| **Database**     | `sentient` on postgres-prod (5432)    | `sentient_dev` on postgres-dev (5433)  |
| **MQTT Broker**  | mosquitto-prod (1883/9001)            | mosquitto-dev (1884/9002)              |
| **Network**      | `sentient-production` (172.20.0.0/16) | `sentient-development` (172.21.0.0/16) |
| **Domain**       | sentientengine.ai                     | dev.sentientengine.ai                  |
| **Optimization** | Multi-stage builds, minified          | Volume mounts, source maps             |
| **Debug Ports**  | None exposed                          | 9229-9232 exposed                      |
| **NODE_ENV**     | `production`                          | `development`                          |

### Service Naming Convention

| Service Type   | Production Container       | Development Container     |
| -------------- | -------------------------- | ------------------------- |
| API Instance 1 | `sentient-api-prod-1`      | `sentient-api-dev-1`      |
| API Instance 2 | `sentient-api-prod-2`      | `sentient-api-dev-2`      |
| Web UI         | `sentient-web-prod`        | `sentient-web-dev`        |
| Scene Executor | `sentient-executor-prod`   | `sentient-executor-dev`   |
| Device Monitor | `sentient-monitor-prod`    | `sentient-monitor-dev`    |
| Grafana        | `sentient-grafana-prod`    | `sentient-grafana-dev`    |
| Prometheus     | `sentient-prometheus-prod` | `sentient-prometheus-dev` |
| Loki           | `sentient-loki-prod`       | `sentient-loki-dev`       |
| Promtail       | `sentient-promtail-prod`   | `sentient-promtail-dev`   |

**Shared Services** (single instance for both environments):

- `sentient-nginx` - Reverse proxy (routes both domains to appropriate environment)

### Port Allocation

| Service    | Production Port | Development Port | Purpose                                         |
| ---------- | --------------- | ---------------- | ----------------------------------------------- |
| API        | 3000            | 4000             | REST API                                        |
| Web UI     | 3002            | 4002             | Frontend                                        |
| Monitor    | 3003            | 4003             | Device Monitor                                  |
| Executor   | 3004            | 4004             | Scene Executor                                  |
| Grafana    | 3200            | 4200             | Dashboards                                      |
| Prometheus | 9090            | 9190             | Metrics                                         |
| Loki       | 3100            | 4100             | Logs                                            |
| PostgreSQL | 5432            | 5433             | Database (postgres-prod / postgres-dev)         |
| MQTT       | 1883, 9001      | 1884, 9002       | Message Broker (mosquitto-prod / mosquitto-dev) |
| Nginx      | 80, 443         | 80, 443          | Reverse Proxy (shared)                          |

### Version Management & Deployment

**CRITICAL:** All deployments now use Docker Compose with profile-based environment separation.

**Production Deployment:**

```bash
# Start production environment only
docker compose --profile production up -d

# Or use convenience script
sudo ./scripts/start-production.sh
```

Process: Pull images → Build custom images → Start production containers → Health check

**Development Deployment:**

```bash
# Start development environment only
docker compose --profile development up -d

# Or use convenience script
./scripts/start-development.sh
```

Process: Build dev images → Mount volumes → Start with nodemon/Vite HMR

**Start Both Environments:**

```bash
# Start both production and development
docker compose --profile production --profile development up -d
```

**Stop Specific Environment:**

```bash
# Stop only production
docker compose --profile production down

# Stop only development
docker compose --profile development down

# Stop everything
docker compose down
```

**Service-Specific Operations:**

```bash
# Rebuild and restart specific production service
docker compose up -d --build sentient-api-prod-1

# Rebuild and restart specific development service
docker compose up -d --build sentient-api-dev-1

# View production service logs
docker compose logs -f sentient-api-prod-1

# View development service logs
docker compose logs -f sentient-api-dev-1
```

**Legacy Scripts:**

- Old PM2-based `bump_and_build_*.sh` scripts deprecated
- Replaced with Docker-based deployment workflow
- See `DOCKER_DEPLOYMENT.md` for complete procedures

### Network Architecture

**Three Isolated Networks:**

1. **sentient-production** (172.20.0.0/16)

   - Production services only
   - Connects to shared network for PostgreSQL and MQTT access
   - No communication with development network

2. **sentient-development** (172.21.0.0/16)

   - Development services only
   - Connects to shared network for PostgreSQL and MQTT access
   - No communication with production network

3. **sentient-shared** (172.19.0.0/16)
   - PostgreSQL, MQTT broker, Nginx
   - Accessible by both production and development networks
   - Ensures resource sharing without cross-environment contamination

### Domain Routing (Nginx)

**Production Domain:** `sentientengine.ai`

- Routes to production services (sentient-\*-prod containers)
- SSL/TLS with Let's Encrypt certificate
- API: `/api/` → sentient-api-prod-1:3000 (load balanced with prod-2)
- Executor: `/executor/` → sentient-executor-prod:3004
- Monitor: `/monitor/` → sentient-monitor-prod:3003
- Grafana: `/grafana/` → sentient-grafana-prod:3000
- Web: `/` → sentient-web-prod:3002

**Development Domain:** `dev.sentientengine.ai`

- Routes to development services (sentient-\*-dev containers)
- SSL/TLS with Let's Encrypt certificate (same cert as production)
- API: `/api/` → sentient-api-dev-1:4000
- Executor: `/executor/` → sentient-executor-dev:4004
- Monitor: `/monitor/` → sentient-monitor-dev:4003
- Grafana: `/grafana/` → sentient-grafana-dev:3000
- Web: `/` → sentient-web-dev:4002
- Header: `X-Environment: development` added to all responses

### Database Isolation

**Separate PostgreSQL Instances:**

**Production Database (postgres-prod):**

- Container: `sentient-postgres-prod`
- Port: 5432
- Database: `sentient`
- User: `sentient_prod`
- Used by: sentient-api-prod-\*, sentient-executor-prod, sentient-monitor-prod
- Contains: Production client data, room configurations, device registrations
- Volume: `postgres-data-prod`

**Development Database (postgres-dev):**

- Container: `sentient-postgres-dev`
- Port: 5433 (external), 5432 (internal)
- Database: `sentient_dev`
- User: `sentient_dev`
- Used by: sentient-api-dev-\*, sentient-executor-dev, sentient-monitor-dev
- Contains: Test data, experimental configurations, development testing
- Volume: `postgres-data-dev`

**Isolation Benefits:**

- Complete physical separation - development restarts don't affect production
- Schema changes in dev can't break production
- Independent resource allocation and performance tuning
- Development testing cannot corrupt production data
- Production database remains stable during development experiments

### Docker Container Management

**Configuration:** `/opt/sentient/docker-compose.yml` (unified configuration with profiles)

**View All Services:**

```bash
# All containers (both environments)
docker compose ps

# Production containers only
docker compose --profile production ps

# Development containers only
docker compose --profile development ps
```

**Common Commands:**

```bash
# Service status
docker compose ps

# View logs (production)
docker compose logs -f sentient-api-prod-1
docker compose logs --tail=100 sentient-executor-prod

# View logs (development)
docker compose logs -f sentient-api-dev-1
docker compose logs --tail=100 sentient-executor-dev

# Restart service
docker compose restart sentient-api-prod-1
docker compose restart sentient-api-dev-1

# Monitor resources
docker stats

# Health check
./scripts/health-check.sh
```

**Container Health Checks:**

All services include built-in health checks:

- **HTTP services:** wget health endpoint every 30s
- **Database:** pg_isready check every 10s
- **MQTT:** mosquitto_sub test every 30s
- Automatic container restart on health check failure

### Service Health Monitoring

**Health Check Script:** `/opt/sentient/scripts/health-check.sh`

Verifies:

- All Docker containers running
- Health check status for each service
- Disk usage and volume health
- Recent error logs
- Network connectivity between services

**Automated Monitoring:**

- **Prometheus:** Scrapes metrics from all services every 15s
- **Grafana:** Displays real-time dashboards and alerts
- **Loki:** Aggregates logs from all containers
- **Container Health:** Docker automatically restarts unhealthy containers

### Database Backup & Maintenance

**Backup:**

```bash
pg_dump -U sentient -d sentient > /opt/sentient/database/backups/sentient_$(date +%Y%m%d_%H%M%S).sql
```

**Maintenance:**

```sql
DELETE FROM device_heartbeats WHERE received_at < NOW() - INTERVAL '7 days';
VACUUM ANALYZE;
```

---

## Development Workflow

### Documentation-First Approach

**All architectural changes must:**

1. Update SYSTEM_ARCHITECTURE.md first
2. Get user review and approval
3. Implement changes matching documentation
4. Verify implementation matches docs

### Local Development Setup

```bash
# Install dependencies for all services
cd services/sentient-web && npm install
cd ../api && npm install
cd ../device-monitor && npm install
cd ../executor-engine && npm install

# Configure environment
cp .env.example .env
# Edit .env with local credentials

# Start services in development mode
cd services/sentient-web && npm run dev     # Port 3002
cd services/api && npm run dev              # Port 3000
cd services/device-monitor && npm run dev   # Port 3003
cd services/executor-engine && npm run dev  # Port 3004
```

### Testing

**API Testing:**

```bash
curl -X GET http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

**Database Testing:**

```bash
PGPASSWORD=password psql -h localhost -U sentient -d sentient
```

See MQTT Testing section above for MQTT testing commands.

### Code Standards

**Node.js/TypeScript:**

- Use async/await over callbacks
- Implement proper error handling with try/catch
- Use connection pooling for database
- Structured logging for all operations
- Follow RESTful API conventions

**Teensy C++:**

- Always implement safety checks
- Use stateless design patterns
- Handle MQTT disconnections gracefully
- Register all capabilities in manifest
- Follow SentientMQTT_v2 library conventions

---

## Observability Stack

### Architecture

**Components:**

- **Prometheus** (port 9090) - Time-series metrics database
- **Grafana** (port 3200) - Visualization and alerting dashboards
- **Loki** (port 3100) - Log aggregation (structured JSON logs)
- **Promtail** (port 9080) - Log shipper

### Key Metrics to Collect

**Service-level:**

- `http_requests_total{service, method, path, status}`
- `http_request_duration_seconds{service, method, path}`
- `nodejs_memory_usage_bytes{service, type}`
- `nodejs_eventloop_lag_seconds{service}`

**MQTT metrics (device-monitor):**

- `mqtt_messages_received_total{topic_pattern, qos}`
- `device_online_count{client, room}`
- `sensor_reading_age_seconds{device_id, sensor_type}`

**Scene execution (scene-executor):**

- `scene_started_total{scene_id, room_id}`
- `scene_duration_seconds{scene_id, outcome}`
- `puzzle_solved_total{puzzle_id}`
- `safety_check_failures_total{check_type}`

### Log Structure

**Structured JSON logs:**

```json
{
  "timestamp": "2025-10-24T10:30:00.000Z",
  "level": "info",
  "service": "scene-executor",
  "trace_id": "abc123...",
  "message": "Scene started",
  "scene_id": "intro_boiler",
  "room_id": "clockwork"
}
```

**Levels:** error, warn, info, debug

---

## Appendix

### Key System Files

| File                                  | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `/opt/sentient/CLAUDE.md`             | AI assistant reference guide               |
| `/opt/sentient/BUILD_PROCESS.md`      | Build and deployment procedures            |
| `/opt/sentient/MQTT_TOPIC_FIX.md`     | MQTT topic standardization                 |
| `/opt/sentient/database/schema.sql`   | Complete database schema (baseline)        |
| `/opt/sentient/database/migrations/`  | Incremental schema changes (authoritative) |
| `/opt/sentient/config/mosquitto.conf` | MQTT broker configuration                  |
| `/opt/sentient/ecosystem.config.js`   | PM2 service configuration                  |
| `/opt/sentient/.env`                  | Environment variables (secret)             |

### Troubleshooting

**Common Issues:**

- Service won't start → Check PM2 logs: `pm2 logs <service>`
- Database connection errors → Check PostgreSQL: `systemctl status postgresql`
- MQTT authentication failures → Verify ACL: `cat /opt/sentient/config/mosquitto.acl`
- Teensy not connecting → Monitor serial: `screen /dev/ttyACM0 115200`

**Support:**

- Documentation: `/opt/sentient/Documentation/`
- System logs: `pm2 logs` and `/opt/sentient/logs/`
- Health check: `/opt/sentient/scripts/status_services.sh`

### Version History

| Version | Date        | Changes                                             |
| ------- | ----------- | --------------------------------------------------- |
| 2.0.2   | Oct 27 2025 | Migrated frontend from Next.js to Vite + React      |
| 2.0.1   | Oct 2025    | Production architecture with v2.0.1 Teensy standard |
| 2.0.0   | Oct 2025    | Complete system rewrite with scene orchestration    |
| 1.x     | 2024        | Legacy system (archived)                            |

### Frontend Migration History (Next.js → Vite)

**Migration Date:** October 27, 2025

**Rationale:** Resolved persistent development caching issues that hindered rapid iteration on Timeline Editor.

**Key Changes:**

- Build Tool: Next.js App Router → Vite with React Router v6
- Port: 3001 → 3002
- Routing: Server-side → Client-side
- Benefits: Instant HMR, faster builds, simpler deployment, better debugging

**Breaking Changes:**

- Route paths changed: `/rooms` → `/dashboard/rooms`
- Authentication simplified: Single ProtectedRoute wrapper
- `useRouter()` → `useNavigate()`
- Path alias `@/` removed in favor of relative imports

---

**Document Status:** Living Document
**Maintainer:** Sentient Engine Development Team
**Last Review:** October 27, 2025
