# GitHub Copilot Instructions for Sentient Engine

This file provides context and guidelines for GitHub Copilot when working with the Sentient Engine codebase.

## Project Overview

In this workspace, **Sentient Engine** is treated as a local development environment for an escape room orchestration platform. The same concepts (multi-tenant, MQTT, scenes, safety) apply, but all instructions here are scoped to running locally.

**Technology Stack:**

- **Backend:** Node.js/Express (TypeScript) with PostgreSQL
- **Frontend:** Vite 5.4 + React 19.1 + TypeScript
- **Message Broker:** Eclipse Mosquitto MQTT
- **Hardware:** Teensy 4.1 microcontrollers
- **Deployment:** Docker Compose with profile-based environments
- **Observability:** Prometheus, Grafana, Loki, Promtail

## Architecture Philosophy

**Sentient = Brain (makes decisions), Teensy = Hands (executes commands)**

- Controllers are stateless peripheral executors
- Backend makes all decisions about game state and puzzle logic
- Hardware executes commands and reports sensor data
- Multi-tenant isolation with complete data separation

## Development Architecture

**This workspace is your LOCAL DEVELOPMENT ENVIRONMENT where you build and test Sentient Engine.**

### Development Workflow

1. **Local Development** (This Mac)

- Write and test code in this workspace
- Run Docker Compose locally (`npm run dev`)
- Database: `sentient_dev` on port 5432
- Services exposed on ports 3000-3004
- MQTT broker on ports 1883/9001
- All infrastructure runs in Docker containers

Any real deployment to remote servers should be designed and documented outside of this file.

### Docker Configuration

All services run via `docker-compose.yml`:

- **API:** sentient-api (Node.js/TypeScript/Express)
- **Executor Engine:** executor-engine (TypeScript scene orchestration)
- **Device Monitor:** device-monitor (TypeScript MQTT telemetry)
- **Frontend:** sentient-web (Vite + React 19)
- **Database:** PostgreSQL 16
- **MQTT:** Eclipse Mosquitto
- **Observability:** Prometheus, Grafana, Loki

## Naming Conventions

### snake_case EVERYWHERE

**ALL identifiers across the entire stack MUST use snake_case:**

✅ **Correct:**

```javascript
// API Request/Response
{ room_id: "uuid", scene_number: 1, device_id: "intro_tv" }

// MQTT Topic
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_on

// Database
SELECT room_id, scene_number FROM scenes WHERE scene_id = $1;
```

❌ **Incorrect:**

```javascript
// NO camelCase in data models
{ roomId: "uuid", sceneNumber: 1, deviceId: "intro_tv" }

// NO hyphens in topics
paragon/clockwork/commands/boiler-room-subpanel/intro-tv/power-on
```

### Why snake_case?

- PostgreSQL convention
- MQTT topic standard
- No conversion overhead between layers
- Clear, predictable naming

### Display Names vs Identifiers

- **Identifiers** (snake_case): Used in database, MQTT topics, API parameters
- **Display Names** (friendly): UI only, never in system internals

```javascript
// Database/MQTT uses identifiers
device_id: 'intro_tv'; // System identifier

// UI shows friendly names
friendly_name: 'Introduction TV'; // Display only
```

## MQTT Topic Standard

**Template:**

```
[client]/[room]/[category]/[controller]/[device]/[item]
```

**Rules:**

- snake_case only (lowercase letters, digits, underscore)
- NO spaces, NO hyphens
- Categories always lowercase: `commands/`, `sensors/`, `status/`, `events/`
- Topics built from database identifiers

**Example:**

```
paragon/clockwork/commands/boiler_room_subpanel/intro_tv/power_tv_on
paragon/clockwork/sensors/boiler_room_subpanel/pilot_light/color_sensor
paragon/clockwork/status/boiler_room_subpanel/intro_tv/heartbeat
```

## Database Standards

### Primary Key Strategy

All tables use **UUID primary keys**:

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Database identity
  device_id VARCHAR(100) NOT NULL,                 -- MQTT topic segment
  friendly_name VARCHAR(255),                       -- UI display only
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

### Device Modeling

**One physical device = one database row**

✅ Correct:

- Device: `intro_tv` (one row)
- Commands: `power_tv_on`, `power_tv_off` (via device_commands table)

❌ Incorrect:

- Device: `tv_power` (separate row)
- Device: `tv_lift` (separate row)

## Code Patterns

### API Endpoints

```typescript
// Multi-tenant safety
router.get('/devices', authenticate, async (req, res) => {
  const { client_id } = req.user;

  const devices = await pool.query(
    `
    SELECT d.* FROM devices d
    JOIN rooms r ON d.room_id = r.id
    WHERE r.client_id = $1
  `,
    [client_id]
  );

  res.json(devices.rows);
});
```

### MQTT Publishing

```typescript
// Construct topic from database identifiers
const topic = `${client_id}/${room_id}/commands/${controller_id}/${device_id}/${command}`;

const payload = {
  command,
  device_id,
  timestamp: Date.now(),
  request_id: uuidv4(),
};

await mqttClient.publish(topic, JSON.stringify(payload));
```

### React Components

```tsx
// Use snake_case for data models
interface Device {
  device_id: string; // NOT deviceId
  room_id: string; // NOT roomId
  friendly_name: string; // Display only
}

// API calls use snake_case
const response = await api.get(`/api/sentient/devices`, {
  params: { room_id: roomId }, // snake_case parameter
});
```

## Environment Variables

For this workspace, prefer `.env.development` or service-specific `.env` files for local settings. Keep them gitignored.

**Key Variables:**

```bash
# Database (local)
DATABASE_URL=postgresql://user:pass@postgres:5432/sentient_dev

# MQTT (local)
MQTT_URL=mqtt://mosquitto:1883
MQTT_USERNAME=sentient_api
MQTT_PASSWORD=secret

# Auth (local)
JWT_SECRET=secret
SESSION_SECRET=secret
```

## Docker Commands (Local)

```bash
# Start local dev stack
npm run dev

# View logs
docker compose logs -f sentient-api

# Restart service
docker compose restart sentient-api

# Health check
./scripts/health-check.sh
```

## Common Patterns to Follow

### Error Handling

```typescript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: {
      /* relevant data */
    },
  });
  throw error;
}
```

### Structured Logging

```typescript
logger.info('Scene started', {
  scene_id,
  room_id,
  user_id,
  timestamp: new Date().toISOString(),
});
```

### Async/Await (Not Callbacks)

✅ Use async/await:

```typescript
const data = await fetchData();
const result = await processData(data);
```

❌ Avoid callbacks:

```typescript
fetchData((err, data) => {
  processData(data, (err, result) => { ... });
});
```

## Security Requirements

**IMPORTANT - Even in local development, follow good security practices:**

1. ✅ Never expose credentials in code or logs
2. ✅ Always validate and sanitize user input
3. ✅ Use parameterized queries (prevent SQL injection)
4. ✅ Enforce multi-tenant isolation (filter by client_id)
5. ✅ Implement proper error handling without leaking internals
6. ✅ Use HTTPS for all external communication
7. ✅ Rate limit API endpoints
8. ✅ Audit significant operations where feasible

## Documentation References

- **`SYSTEM_ARCHITECTURE.md`** - Complete system architecture (single source of truth)
- **`CLAUDE.md`** - AI assistant reference guide
- **`MQTT_TOPIC_FIX.md`** - MQTT topic standardization details
- **`BUILD_PROCESS.md`** - Build and deployment procedures
- **`DOCKER_DEPLOYMENT.md`** - Docker deployment guide

## Common Mistakes to Avoid

❌ Using camelCase for API parameters or database columns
❌ Using display names in MQTT topics or queries
❌ Splitting physical devices into multiple database rows
❌ Forgetting client_id filter in multi-tenant queries
❌ Using callbacks instead of async/await
❌ Exposing credentials in logs or error messages
❌ Making production changes without testing in dev environment
❌ Using public domain for Teensy MQTT connections (must use local IP 192.168.2.3)

## Questions or Uncertainties?

When uncertain about implementation details:

1. Check **SYSTEM_ARCHITECTURE.md** first
2. Search codebase for existing patterns
3. Ask the user for clarification before implementing

Treat this repo as a local development environment; any real production deployment should be handled with separate, environment-specific documentation.
