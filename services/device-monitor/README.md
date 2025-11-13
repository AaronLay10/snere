# Device Monitor Service

The Device Monitor ingests raw MQTT traffic from escape room controllers, keeps a live registry of device status, and exposes REST endpoints for dashboards and other services. It is written in TypeScript and is designed to run as part of the Sentient Engine stack.

## System Context

- Serves as the ingestion point of the core loop (MQTT → REST/WebSocket); Puzzle Engine consumes its events, while API Gateway mirrors its health and device lists.
- MQTT topics must follow the `{Room}/{Puzzle}/{Device}/{Category}` convention outlined in `docs/system-architecture.md` so downstream routing remains deterministic.
- Writes authoritative device metadata to shared type definitions and will eventually persist into PostgreSQL/InfluxDB—catalog field additions here first.
- Alert Engine subscriptions and Dashboard UI depend on consistent health scoring and heartbeat semantics; document contract changes alongside code updates.

## Features

- Connects to the Mosquitto broker and subscribes to a configurable topic filter (`paragon/#` by default).
- Tracks devices in-memory with heartbeat monitoring, health scoring, and recent sensor/metric samples.
- Raises alert events when devices fall offline (currently logged and exposed for future routing).
- Provides REST endpoints for:
  - `/health` – service health, uptime, and aggregate device summary.
  - `/devices` – list of known devices with recent telemetry.
  - `/devices/:deviceId` – detail view for a specific controller.
  - `/devices/:deviceId/command` – publish commands back to hardware.
- Graceful shutdown support (SIGINT/SIGTERM).

## Configuration

Configuration is read from environment variables (see `src/config.ts`). Key options:

| Variable | Default | Description |
| --- | --- | --- |
| `SERVICE_PORT` | `3003` | HTTP port for the REST API. |
| `MQTT_URL` | `mqtt://localhost:1883` | Broker connection string. |
| `MQTT_TOPIC_FILTER` | `paragon/#` | MQTT subscription pattern. |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | _unset_ | Optional broker credentials. |
| `DEVICE_HEARTBEAT_TIMEOUT_MS` | `30000` | Time before a device is marked offline. |
| `HEALTH_SWEEP_INTERVAL_MS` | `30000` | Interval for sweeping device health. |
| `PUZZLE_ENGINE_URL` | _unset_ | If provided, forwards key device events to Executor Engine (`http://executor-engine:3004` in Docker, `http://sentientengine.ai:3004` on bare metal). |

Create a `.env` file during development if needed:

```env
SERVICE_PORT=3003
MQTT_URL=mqtt://192.168.20.3:1884
MQTT_TOPIC_FILTER=paragon/#
PUZZLE_ENGINE_URL=http://executor-engine:3004
```

> Swap the URLs to `http://sentientengine.ai:3004` (or another external hostname) when running the service directly on the host.

## Scripts

```bash
npm install         # install dependencies
npm run dev         # run with live reload (using tsx)
npm run build       # transpile TypeScript to dist/
npm start           # run compiled code from dist/
```

## Command Publishing Contract

When issuing a `POST /devices/:deviceId/command`, supply a payload:

```json
{
  "command": "triggerAnimation",
  "payload": { "animation": "pilotlight_success" }
}
```

The service automatically constructs the command topic based on known room/puzzle/device identifiers (`paragon/<room>/<puzzle>/<device>/commands/<command>` by default). A `topicOverride` field is also accepted for special cases.

## TODO / Next Steps

- Integrate with the shared type package once it exists (replace in-service definitions).
- Persist device state snapshots to Postgres or another store for resilience.
- Emit alerts via the planned Alert Engine instead of logging only.
- Ingest legacy firmware payloads and map them to the normalized schema as the new firmware rolls out.
