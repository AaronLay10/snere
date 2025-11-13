# Sentient Engine - Docker Deployment Guide

This guide covers deploying Sentient Engine using Docker and Docker Compose for both development and production environments.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Production Deployment](#production-deployment)
- [Development Environment](#development-environment)
- [Configuration](#configuration)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Quick Start

### Production Deployment

```bash
# 1. Run setup script (installs Docker if needed)
sudo ./scripts/setup-production.sh

# 2. Configure environment variables
nano .env.production

# 3. Set up SSL certificates
# See config/nginx/ssl/README.md

# 4. Start services
sudo ./scripts/start-production.sh
```

### Development Environment

```bash
# 1. Copy development environment
cp .env.development .env

# 2. Start development services
./scripts/start-development.sh
```

---

## Architecture Overview

### Docker Services

The Sentient Engine stack includes the following containerized services:

| Service | Container Name | Port(s) | Purpose |
|---------|---------------|---------|---------|
| **sentient-api** | sentient-api-1, sentient-api-2 | 3000 | REST API (2 instances, load balanced) |
| **scene-executor** | sentient-scene-executor | 3004 | Scene orchestration engine |
| **device-monitor** | sentient-device-monitor | 3003 | MQTT device monitoring |
| **sentient-web** | sentient-web | 3002 | React frontend (Vite) |
| **postgres** | sentient-postgres | 5432 | PostgreSQL database |
| **mosquitto** | sentient-mosquitto | 1883, 9001 | MQTT broker |
| **nginx** | sentient-nginx | 80, 443 | Reverse proxy & SSL termination |
| **prometheus** | sentient-prometheus | 9090 | Metrics collection |
| **grafana** | sentient-grafana | 3200 | Monitoring dashboards |
| **loki** | sentient-loki | 3100 | Log aggregation |
| **promtail** | sentient-promtail | 9080 | Log shipping |

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

### System Requirements

**Production:**
- Ubuntu 24.04 LTS (recommended) or Ubuntu 22.04 LTS
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB disk space
- Static IP address or domain name

**Development:**
- Any Linux/macOS/Windows with Docker
- 2+ CPU cores
- 4+ GB RAM
- 20+ GB disk space

### Software Requirements

- Docker 24.x or later
- Docker Compose 2.x or later
- Git (for version control)

The setup script will automatically install Docker and Docker Compose if not present.

---

## Production Deployment

### Step 1: Initial Setup

Run the setup script to prepare your environment:

```bash
sudo ./scripts/setup-production.sh
```

This script will:
- Install Docker and Docker Compose (if needed)
- Create necessary directories
- Set up MQTT password file
- Check for SSL certificates
- Set proper permissions

### Step 2: Configure Environment Variables

Edit `.env.production` with your production credentials:

```bash
nano .env.production
```

**Required variables:**

```bash
# Database
POSTGRES_DB=sentient
POSTGRES_USER=sentient_prod
POSTGRES_PASSWORD=your_strong_password_here

# MQTT
MQTT_USER=paragon_devices
MQTT_PASSWORD=your_mqtt_password_here

# JWT & Session
JWT_SECRET=your_jwt_secret_min_32_chars
SESSION_SECRET=your_session_secret_min_32_chars

# Grafana
GRAFANA_PASSWORD=your_grafana_password

# API URLs
API_URL=https://sentientengine.ai
FRONTEND_URL=https://sentientengine.ai
```

**Security Notes:**
- Use strong, unique passwords (12+ characters, mix of upper/lower/numbers/symbols)
- Never commit `.env.production` to version control
- Rotate secrets regularly

### Step 3: SSL Certificates

#### Option A: Let's Encrypt (Production - Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Stop nginx if running
sudo systemctl stop nginx

# Generate certificate
sudo certbot certonly --standalone \
  -d sentientengine.ai \
  -d www.sentientengine.ai

# Copy certificates to Docker volume
sudo cp /etc/letsencrypt/live/sentientengine.ai/fullchain.pem \
  /opt/sentient/config/nginx/ssl/
sudo cp /etc/letsencrypt/live/sentientengine.ai/privkey.pem \
  /opt/sentient/config/nginx/ssl/

# Set permissions
sudo chmod 644 /opt/sentient/config/nginx/ssl/fullchain.pem
sudo chmod 600 /opt/sentient/config/nginx/ssl/privkey.pem
```

#### Option B: Self-Signed (Testing Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/sentient/config/nginx/ssl/privkey.pem \
  -out /opt/sentient/config/nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Step 4: Database Schema

Copy your database schema and migrations:

```bash
# Option 1: Copy existing schema
cp /path/to/database/schema.sql /opt/sentient/config/postgres/init/02-schema.sql

# Option 2: Copy migrations
cp /path/to/database/migrations/*.sql /opt/sentient/config/postgres/init/
```

### Step 5: Start Services

```bash
sudo ./scripts/start-production.sh
```

This will:
- Pull latest Docker images
- Build custom images for your services
- Start all containers
- Display service status and logs

### Step 6: Verify Deployment

```bash
# Check service health
sudo ./scripts/health-check.sh

# View logs
sudo ./scripts/logs.sh sentient-api-1

# Access services
# Web UI: https://sentientengine.ai
# Grafana: https://sentientengine.ai/grafana
```

---

## Development Environment

### Starting Development Mode

```bash
# Start with hot-reload enabled
./scripts/start-development.sh
```

Development mode features:
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

### Debug Ports

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
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build sentient-api-1

# Rebuild all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

---

## Configuration

### Environment Files

- `.env.production` - Production credentials and settings
- `.env.development` - Development defaults

### Service Configuration

| Service | Config Location |
|---------|----------------|
| Nginx | `/opt/sentient/config/nginx/` |
| Mosquitto | `/opt/sentient/config/mosquitto/` |
| PostgreSQL | `/opt/sentient/config/postgres/init/` |
| Prometheus | `/opt/sentient/config/prometheus/` |
| Grafana | `/opt/sentient/config/grafana/` |
| Loki | `/opt/sentient/config/loki/` |
| Promtail | `/opt/sentient/config/promtail/` |

### Persistent Volumes

Data is stored in `/opt/sentient/volumes/`:

- `postgres-data/` - Database files
- `mosquitto-data/` - MQTT persistence
- `prometheus-data/` - Metrics data
- `grafana-data/` - Dashboards and settings
- `loki-data/` - Log storage
- `nginx-logs/` - Access and error logs

---

## Maintenance

### Daily Operations

```bash
# View service status
docker-compose ps

# View logs (follow mode)
docker-compose logs -f [service_name]

# Restart a service
docker-compose restart [service_name]

# Health check
sudo ./scripts/health-check.sh
```

### Database Backups

```bash
# Create backup
sudo ./scripts/backup-database.sh

# Backups are stored in: /opt/sentient/backups/
# Format: sentient_db_YYYYMMDD_HHMMSS.sql.gz

# Restore from backup
sudo ./scripts/restore-database.sh backups/sentient_db_20250110_120000.sql.gz
```

### Updating Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build

# Or use the start script (does both)
sudo ./scripts/start-production.sh
```

### Log Management

```bash
# View specific service logs
sudo ./scripts/logs.sh sentient-api-1

# View all logs
docker-compose logs --tail=100

# Clean up old logs
docker-compose logs --tail=0 -f  # Truncate logs

# Loki stores logs for 7 days (configured in loki-config.yml)
```

### Monitoring

Access Grafana at `https://sentientengine.ai/grafana`:

- **System Overview** - Service health, uptime
- **API Performance** - Request rates, latency
- **Device Status** - Controller online/offline
- **Resource Usage** - CPU, memory, disk

### Stopping Services

```bash
# Stop all services (data preserved)
docker-compose down

# Stop and remove volumes (DANGER: deletes all data)
docker-compose down -v

# Production stop script
sudo ./scripts/stop-production.sh
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

### Production Hardening

1. **Change all default passwords** in `.env.production`
2. **Enable UFW firewall:**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```

3. **Restrict MQTT to internal network only** (already configured in docker-compose.yml)

4. **Use strong SSL/TLS settings** (already configured in nginx.conf)

5. **Enable fail2ban:**
   ```bash
   sudo apt-get install fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

6. **Regular security updates:**
   ```bash
   sudo apt-get update
   sudo apt-get upgrade
   docker-compose pull  # Update container images
   ```

7. **Monitor logs for suspicious activity:**
   ```bash
   docker-compose logs nginx | grep -E '(40[0-9]|50[0-9])'
   ```

### Network Isolation

The Docker network is isolated (172.20.0.0/16). Only required ports are exposed to host:

- **Public:** 80, 443 (HTTP/HTTPS)
- **Internal only:** 1883 (MQTT), 5432 (PostgreSQL)

### Secrets Management

- Never commit `.env.production` to git
- Use `.gitignore` to exclude sensitive files
- Rotate credentials regularly
- Consider using Docker secrets in production

---

## Additional Resources

- [Sentient Engine Documentation](docs/)
- [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) - Complete architecture reference
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