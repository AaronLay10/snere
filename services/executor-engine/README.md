# Puzzle Engine Service

The Puzzle Engine orchestrates room logic, manages puzzle state machines, tracks game sessions, and issues commands to downstream devices/effects. This is the central “brain” replacing the logic previously embedded in Node-RED and firmware.

## System Context (Local Dev)

- Receives device telemetry relayed by Device Monitor and responds by issuing commands through Effects Controller or back to devices via Device Monitor proxy routes.
- Exposes REST/WebSocket state for the dashboard web application—align event payloads with the shared `@paragon/shared` types to keep clients synchronized.
- Persists configuration and session outcomes into PostgreSQL.
- Any change to puzzle contracts should be reflected in `docs/system-architecture.md` before implementation to maintain a consistent domain model.

## Features

- Registers puzzle definitions (currently seeded with Clockwork examples) and maintains runtime state.
- Handles session lifecycle (create → start → complete) with hooks for scoring and progression.
- Timer manager to enforce puzzle/session time limits.
- Event bus for ingesting device events (`POST /events`) so puzzles can react to real hardware.
- Emits WebSocket events (`puzzle-updated`, `session-updated`) for dashboards or other services.
- Optional integrations:
  - Device Monitor (issue device commands through REST).
  - Effects Controller (trigger lighting/audio sequences).

## Configuration

Environment variables (`src/config.ts`):

| Variable                 | Default | Description                                              |
| ------------------------ | ------- | -------------------------------------------------------- |
| `SERVICE_PORT`           | `3004`  | HTTP/WebSocket port.                                     |
| `CORS_ORIGIN`            | `*`     | Allowed origins for REST and Socket.IO in local dev.     |
| `TICK_INTERVAL_MS`       | `1000`  | Tick interval for timer manager.                         |
| `DEVICE_MONITOR_URL`     | _unset_ | If set, enables command relays via Device Monitor.       |
| `EFFECTS_CONTROLLER_URL` | _unset_ | If set, enables firing sequences via Effects Controller. |

Example local `.env`:

```env
SERVICE_PORT=3004
CORS_ORIGIN=http://localhost:3002
DEVICE_MONITOR_URL=http://device-monitor:3003
```

## Scripts

```bash
npm install     # install dependencies
npm run dev     # hot reload with tsx
npm run build   # transpile to dist/
npm start       # run compiled code
```

## REST Endpoints

- `GET /health` – service health snapshot, puzzle/session counts.
- `GET /puzzles` / `GET /puzzles/:id` – view puzzle runtime state.
- `POST /puzzles/:id/start` – manually activate a puzzle.
- `POST /puzzles/:id/complete` – mark puzzle solved.
- `PATCH /puzzles/:id` – update puzzle state (temporary manual controls).
- `GET /sessions` – list sessions.
- `POST /sessions` – create session (`{roomId, teamName, players, timeLimitMs}`).
- `POST /sessions/:id/start` – start a session.
- `POST /sessions/:id/end` – end/abort with optional state.
- `POST /events` – ingest device events (`{ roomId, puzzleId, deviceId, type, payload }`).

## WebSocket Events

- `puzzle-updated` – puzzle runtime changes.
- `session-updated` – session lifecycle updates.

## TODO / Next Steps

- Replace inline types with shared `@paragon/shared` package once available.
- Persist session/puzzle state to Postgres for durability.
- Flesh out event handling rules (map hardware events to puzzle transitions).
- Integrate scoring and progression logic, including prerequisites and dependencies.
- Coordinate with Effects Controller to publish rich sequence metadata.
