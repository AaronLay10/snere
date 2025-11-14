# Sentient Engine - Local Dev Environment Guide

This guide covers running the Sentient Engine stack locally using Docker and Docker Compose as a development environment for the web application.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Development Environment](#local-development-environment)
- [Configuration](#configuration)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Quick Start

### Local Environment

```bash
# 1. Copy local environment defaults if needed
cp .env.development .env

# 2. Start local services for development
./scripts/start-development.sh
```

---

## Architecture Overview

### Docker Services

The Sentient Engine stack includes the following containerized services in a single local environment:

| Service            | Container Name     | Port(s)    | Purpose                              |
| ------------------ | ------------------ | ---------- | ------------------------------------ |
| **sentient-api**   | sentient-api       | 3000       | REST API                             |
| **scene-executor** | executor-engine    | 3004       | Scene orchestration engine           |
| **device-monitor** | device-monitor     | 3003       | MQTT device monitoring               |
| **sentient-web**   | sentient-web       | 3002       | React frontend (Vite)                |
| **postgres**       | sentient-postgres  | internal   | PostgreSQL database (`sentient_dev`) |
| **mosquitto**      | sentient-mosquitto | 1883, 9001 | MQTT broker                          |
| **nginx**          | nginx              | 80, 443    | Optional local reverse proxy         |
| **prometheus**     | prometheus         | 9090       | Metrics collection                   |
| **grafana**        | grafana            | 3200       | Monitoring dashboards                |
| **loki**           | loki               | 3100       | Log aggregation                      |
| **promtail**       | promtail           | internal   | Log shipping                         |

### Network Architecture

```
Internet
    ↓
[Nginx Reverse Proxy] :80, :443
    ↓
    ├─→ [Sentient Web] :3002 (Frontend)
    ├─→ [Sentient API] :3000 (Load balanced across 2 instances)
    ├─→ [Scene Executor] :3004 (WebSocket + HTTP)
    ├─→ [Device Monitor] :3003 (WebSocket + HTTP)
    └─→ [Grafana] :3200 (Monitoring)
         ↓
    [Prometheus] :9090 ← [All Services]
         ↓
    [Loki] :3100 ← [Promtail] (Logs)
         ↓
    [PostgreSQL] :5432
         ↓
    [Mosquitto MQTT] :1883
         ↓
    [Teensy Controllers] (Hardware)
```

---

## Prerequisites

### System Requirements (Local Development)

- macOS (primary target) or any system with Docker
- 2+ CPU cores
- 4+ GB RAM
- 20+ GB disk space

### Software Requirements

- Docker 24.x or later
- Docker Compose 2.x or later
- Git (for version control)

The setup script will automatically install Docker and Docker Compose if not present.

---

## Local Development Environment

### Starting Local Development Mode

```bash
# Start with hot-reload enabled
./scripts/start-development.sh
```

Local development mode features:

- **Hot Module Replacement (HMR)** - Instant code changes without rebuild
- **Debug ports exposed** - Attach debugger to any service
- **Volume mounts** - Code changes reflect immediately
- **Relaxed security** - Simple passwords, exposed ports

### Development Access Points

- Frontend: [http://localhost:3002](http://localhost:3002) (Vite HMR)
- API: [http://localhost:3000](http://localhost:3000)
- Scene Executor: [http://localhost:3004](http://localhost:3004)
- Device Monitor: [http://localhost:3003](http://localhost:3003)
- Grafana: [http://localhost:3200](http://localhost:3200) (admin/admin)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- PostgreSQL: localhost:5432 (sentient_dev/dev_password)
- MQTT: localhost:1883 (paragon_devices/dev_password)

### Debug Ports (Local)

Attach your IDE debugger to these ports:

- API Instance 1: 9229
- API Instance 2: 9228
- Scene Executor: 9230
- Device Monitor: 9231

**VS Code Example:**

```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to API",
  "port": 9229,
  "restart": true,
  "protocol": "inspector"
}
```

### Rebuilding After Code Changes

```bash
# Rebuild specific service
docker compose up -d --build sentient-api

# Rebuild all services
docker compose up -d --build
```

---

## Configuration

### Environment Files

- `.env.development` - Local development defaults

### Service Configuration

| Service    | Config Location             |
| ---------- | --------------------------- |
| Nginx      | `config/nginx/`             |
| Mosquitto  | `config/mosquitto-dev/`     |
| PostgreSQL | `config/postgres-dev/init/` |
| Prometheus | `config/prometheus/`        |
| Grafana    | `config/grafana/`           |
| Loki       | `config/loki/`              |
| Promtail   | `config/promtail/`          |

### Persistent Volumes

Data is stored in the `volumes/` directory in this repo (mounted as Docker volumes):

- `postgres-data-dev/` - Database files
- `mosquitto-data-dev/` - MQTT persistence
- `prometheus-data-dev/` - Metrics data
- `grafana-data-dev/` - Dashboards and settings
- `loki-data-dev/` - Log storage

---

## Maintenance

### Daily Operations

```bash
# View service status
docker compose ps

# View logs (follow mode)
docker compose logs -f [service_name]

# Restart a service
docker compose restart [service_name]

# Health check
./scripts/health-check.sh
```

### Updating Services Locally

```bash
# Rebuild and restart all containers locally
docker compose up -d --build
```

### Stopping Services

```bash
# Stop all services (data preserved)
docker compose down

# Stop and remove volumes (DANGER: deletes all data)
docker compose down -v
```

---

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker status
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tulpn | grep -E ':(80|443|1883|3000|3002|3003|3004|5432)'

# View container logs
docker-compose logs [service_name]
```

#### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Verify connection from inside container
docker-compose exec postgres psql -U sentient_prod -d sentient -c "SELECT version();"

# Check environment variables
docker-compose exec sentient-api-1 env | grep DATABASE
```

#### MQTT Connection Issues

```bash
# Test MQTT broker
mosquitto_sub -h localhost -p 1883 -u paragon_devices -P your_password -t '#' -v

# Check MQTT logs
docker-compose logs mosquitto

# Verify password file
docker-compose exec mosquitto cat /mosquitto/config/mosquitto_passwd
```

#### SSL Certificate Issues

```bash
# Verify certificates exist
ls -lh /opt/sentient/config/nginx/ssl/

# Test nginx configuration
docker-compose exec nginx nginx -t

# Check certificate expiry
openssl x509 -in /opt/sentient/config/nginx/ssl/fullchain.pem -noout -dates
```

#### High Memory Usage

```bash
# Check container resource usage
docker stats

# Limit container memory in docker-compose.yml
services:
  sentient-api-1:
    deploy:
      resources:
        limits:
          memory: 512M
```

### Performance Tuning

#### PostgreSQL

Edit `config/postgres/init/99-performance.sql`:

```sql
-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '256MB';

-- Increase work memory
ALTER SYSTEM SET work_mem = '16MB';

-- Increase max connections
ALTER SYSTEM SET max_connections = '200';
```

#### Nginx

Edit `config/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 2048;

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;
```

### Debugging

```bash
# Enter container shell
docker-compose exec sentient-api-1 /bin/sh

# View container filesystem
docker-compose exec sentient-api-1 ls -la /app

# Check running processes
docker-compose exec sentient-api-1 ps aux

# Network diagnostics
docker-compose exec sentient-api-1 ping postgres
docker-compose exec sentient-api-1 nc -zv mosquitto 1883
```

---

## Security Considerations

### Local Security Tips

- Keep your `.env` files out of version control
- Use strong local passwords even for dev services

---

## Additional Resources

- [Sentient Engine Documentation](docs/)
- [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) - Architecture reference
- [CLAUDE.md](docs/CLAUDE.md) - Development guidelines
- Docker Documentation: https://docs.docker.com
- Docker Compose Reference: https://docs.docker.com/compose/

---

## Support

For issues or questions:

1. Check this guide and troubleshooting section
2. Review container logs: `docker-compose logs [service]`
3. Run health check: `./scripts/health-check.sh`
4. Check service status: `docker-compose ps`

---

**Last Updated:** November 10, 2025
**Version:** 1.0.0
