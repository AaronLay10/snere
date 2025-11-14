# Sentient Engine - System Architecture

**Version:** 2.1.0
**Last Updated:** November 10, 2025
**Status:** Local Development Reference for Sentient Engine (Single Environment)

---

## 🎯 NOTE: Local Development Reference

Use this document as the primary architectural reference while working in this local development workspace.

**Schema Notes:**

- This document describes the architecture and data model as used locally.
- `database/schema.sql` may lag behind; `database/migrations/` show incremental changes.
- When you adapt this system to a real deployment, verify the target database schema separately.

---

## Current State Update — January 14, 2025

**Local Development Environment Modernization**

- **Architecture Clarification:** This workspace is a **LOCAL DEVELOPMENT** environment where code is written and tested.
- **Docker Orchestration:** Docker Compose manages all services locally with single development profile
- **TypeScript Migration:** Complete migration of API service from JavaScript/CommonJS to TypeScript/ESM (28 files)
- **Testing Infrastructure:** Jest + ts-jest for backend, Vitest + React Testing Library for frontend
- **Code Quality:** Prettier, ESLint, Husky pre-commit hooks, EditorConfig
- **Database Automation:** node-pg-migrate for migrations, seeding, and reset scripts
- **VS Code Integration:** Complete debugging configuration, 22 tasks for common operations
- **Documentation:** Developer onboarding, contributing guide, deployment procedures
- **CI/CD:** GitHub Actions workflow for lint, type-check, test, build
- **MQTT Standardization:** All services use MQTT_URL + MQTT_USERNAME (removed MQTT_BROKER_URL)
- MQTT topics standardized: `[client]/[room]/[category]/[controller]/[device]/[item]` with lowercase categories (commands, sensors, status, events)
- All identifiers are snake_case and sourced from database (never display names)
- Controller v2 (Teensy 4.1) with single MQTT dispatch path parsing device/command from topic
- Command acknowledgements published on events channel: `.../events/[controller]/[device]/command_ack`
- Web UI: Controllers List, Controller Detail, and Device Detail pages operational
- **Touchscreen Lighting Interface:** Touch-optimized wall panel for Clockwork room lighting control (deployed at `/touchscreen`)
- **Process Management:** PM2 removed; all services now run in dedicated Docker containers
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

**Sentient Engine** is an escape room orchestration platform managing multi-tenant experiences through real-time hardware coordination, scene-based gameplay progression, and comprehensive safety systems.

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

## Infrastructure Architecture (Local Only)

All services run as Docker containers managed by Docker Compose on your Mac.

**Containerized Services (Local):**

| Container Name     | Port(s)    | Purpose                   |
| ------------------ | ---------- | ------------------------- |
| sentient-postgres  | internal   | PostgreSQL database (dev) |
| sentient-mosquitto | 1883, 9001 | MQTT broker               |
| sentient-api       | 3000       | REST API                  |
| executor-engine    | 3004       | Scene orchestration       |
| device-monitor     | 3003       | MQTT monitoring           |
| sentient-web       | 3002       | React frontend            |
| nginx (optional)   | 80, 443    | Local reverse proxy       |
| prometheus         | 9090       | Metrics collection        |
| grafana            | 3200       | Dashboards                |
| loki               | 3100       | Log aggregation           |
| promtail           | internal   | Log shipping              |

**Docker Network (Local):**

- Single bridge network: `sentient-local`
- Service-to-service communication via Docker DNS
- Only required ports are published to `localhost`

### Repository File Structure (Local)

At the root of this repo:

```
./
├── .github/copilot-instructions.md    # Development guidelines
├── SYSTEM_ARCHITECTURE.md             # This document
├── DOCKER_DEPLOYMENT.md               # Local Docker guide
├── MQTT_TOPIC_FIX.md                  # Topic standardization guide
├── config/
│   ├── rooms/{room}/scenes/*.json     # Scene configurations
│   ├── mosquitto-dev/                 # MQTT broker config (local)
│   ├── postgres-dev/                  # Database init (local)
│   ├── grafana/                       # Dashboards (local)
│   ├── prometheus/                    # Metrics (local)
│   ├── loki/                          # Logging (local)
│   └── promtail/                      # Log shipping (local)
├── database/
│   ├── schema.sql                     # Baseline (may lag)
│   ├── seed.sql                       # Initial data
│   └── migrations/                    # Incremental changes (authoritative)
├── hardware/
│   ├── Controller Code Teensy/        # Teensy firmware
│   └── HEX_UPLOAD_FILES/             # Compiled firmware
├── scripts/
│   ├── start-development.sh          # Start local stack
│   ├── health-check.sh               # Health check
│   ├── backup-database.sh            # Database backup
│   └── restore-database.sh           # Database restore
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

## Deployment Architecture (Local Only)

### Local Development Model

This workspace is your **LOCAL DEVELOPMENT ENVIRONMENT** where you write and test code. Any deployment to remote servers should be designed and documented separately.

**This Workspace (Your Mac):**

| Aspect          | Configuration                          |
| --------------- | -------------------------------------- |
| **Purpose**     | Write, test, and debug code locally    |
| **Ports**       | 3000-3004, 3200, 9090                  |
| **Database**    | `sentient_dev` on postgres (5432)      |
| **MQTT Broker** | mosquitto (1883/9001)                  |
| **Network**     | Docker bridge network `sentient-local` |
| **Access**      | http://localhost:3002                  |
| **Debug Ports** | 9229-9232 exposed for VS Code          |
| **NODE_ENV**    | `development`                          |

**Local Development Workflow:**

```bash
# Start all services locally
npm run dev

# Seed test data
npm run db:seed

# Run tests
npm test

# Open frontend
open http://localhost:3002
```

Docker commands are simplified to the single local stack:

```bash
# Service status
docker compose ps

# View logs
docker compose logs -f sentient-api

# Restart a service
docker compose restart sentient-api

# Rebuild and restart everything
docker compose up -d --build
```

Database backup and maintenance for local dev should use the scripts in `scripts/` and standard PostgreSQL tooling, but there is no separate production database described here.

---

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

### Local Development Model

**Status:** Modernized January 14, 2025

**Architecture:** This workspace is your **LOCAL DEVELOPMENT ENVIRONMENT** where you write and test code. Any deployment to remote servers should be designed and documented separately.

**Key Benefits (local):**

- ✅ Develop locally on your Mac with full Docker environment
- ✅ Hot-reload with volume mounts for rapid iteration
- ✅ VS Code debugging with breakpoints and source maps

### Local Development Environment

**This Workspace (Your Mac):**

| Aspect           | Configuration                         |
| ---------------- | ------------------------------------- |
| **Purpose**      | Write, test, and debug code locally   |
| **Ports**        | 3000-3004, 3200, 9090                 |
| **Database**     | `sentient_dev` on postgres (5432)     |
| **MQTT Broker**  | mosquitto-dev (1883/9001)             |
| **Network**      | Docker bridge network                 |
| **Access**       | http://localhost:3002                 |
| **Optimization** | Volume mounts, source maps, debugging |
| **Debug Ports**  | 9229-9232 exposed for VS Code         |
| **NODE_ENV**     | `development`                         |

**Local Service Names:**

| Service        | Container Name    | Port | Debug Port |
| -------------- | ----------------- | ---- | ---------- |
| API            | `sentient-api`    | 3000 | 9229       |
| Web UI         | `sentient-web`    | 3002 | N/A        |
| Scene Executor | `executor-engine` | 3004 | 9231       |
| Device Monitor | `device-monitor`  | 3003 | 9232       |
| Grafana        | `grafana`         | 3200 | N/A        |
| Prometheus     | `prometheus`      | 9090 | N/A        |
| PostgreSQL     | `postgres`        | 5432 | N/A        |
| MQTT           | `mosquitto`       | 1883 | N/A        |

### Historical Server Environment (Reference Only)

The original system ran on a remote host with similar containers and ports. Those details are no longer authoritative for this workspace and should only be used as inspiration if you stand up your own server.

### Development Workflow

**Local Development:**

```bash
# Start all services locally
npm run dev

# Seed test data
npm run db:seed

# Run tests
npm test

# Open frontend
open http://localhost:3002
```

**Deploy to Production:**

```bash
# On production server (sentientengine.ai)
cd /opt/sentient
git pull origin main
npm install
npm run db:migrate
docker compose down
docker compose build
docker compose up -d
./scripts/health-check.sh
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment procedures.

# Stop only development

docker compose --profile development down

# Stop everything

docker compose down

````

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
````

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

**Local Development Access:** `http://localhost:3002`

- Direct access to services running on your Mac
- API: `http://localhost:3000`
- Executor: `http://localhost:3004`
- Monitor: `http://localhost:3003`
- Grafana: `http://localhost:3200` (admin/admin)

**Production Access:** `https://sentientengine.ai`

- Public internet access via HTTPS (Let's Encrypt SSL)
- API: `https://sentientengine.ai/api`
- Executor: `https://sentientengine.ai/executor`
- Monitor: `https://sentientengine.ai/monitor`
- Grafana: `https://sentientengine.ai:3200`

### Database Architecture

**Local Development Database:**

- Container: `postgres`
- Port: 5432
- Database: `sentient_dev`
- User: `sentient`
- Used by: All local services
- Contains: Test data for development (seeded with `npm run db:seed`)
- Volume: `postgres-data` (Docker volume, gitignored)
- Migrations: Managed by node-pg-migrate

**Production Database:**

- Container: `postgres` (on production server)
- Port: 5432 (internal only)
- Database: `sentient`
- User: `sentient`
- Used by: All production services
- Contains: Live client data, room configurations, device registrations
- Volume: `/opt/sentient/volumes/postgres-data`
- Migrations: Applied during deployment with `npm run db:migrate`

**Separation Benefits:**

- Develop and test schema changes locally before production deployment
- Test data doesn't corrupt production database
- Independent backup and restore procedures
- Local database can be reset anytime with `npm run db:reset`

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
