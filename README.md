# Sentient Engine - Docker Environment

Production-ready Docker environment for the Sentient Engine escape room orchestration platform.

## Quick Start

### Production

```bash
# 1. Setup (one-time)
sudo ./scripts/setup-production.sh

# 2. Configure
nano .env.production

# 3. Start
sudo ./scripts/start-production.sh
```

### Development

```bash
# Start development environment
./scripts/start-development.sh
```

## What's Included

This Docker environment provides a complete, production-ready deployment of Sentient Engine with:

### Core Services
- **Sentient API** - REST API (2 clustered instances with load balancing)
- **Scene Executor** - Scene orchestration and puzzle logic
- **Device Monitor** - Real-time MQTT device monitoring
- **Sentient Web** - React + Vite frontend

### Infrastructure
- **PostgreSQL 16** - Relational database
- **Mosquitto MQTT** - Message broker for hardware communication
- **Nginx** - Reverse proxy with SSL termination

### Observability Stack
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards
- **Loki** - Log aggregation
- **Promtail** - Log shipping

## Directory Structure

```
/opt/sentient/
├── docker-compose.yml              # Production configuration
├── docker-compose.dev.yml          # Development overrides
├── .env.production                 # Production secrets
├── .env.development                # Development defaults
├── DOCKER_DEPLOYMENT.md            # Complete deployment guide
│
├── config/                         # Service configurations
│   ├── nginx/                      # Nginx reverse proxy
│   ├── mosquitto/                  # MQTT broker
│   ├── postgres/                   # Database initialization
│   ├── prometheus/                 # Metrics collection
│   ├── grafana/                    # Dashboard provisioning
│   ├── loki/                       # Log aggregation
│   └── promtail/                   # Log shipping
│
├── docker/                         # Dockerfiles for services
│   ├── api/                        # API Dockerfiles
│   ├── executor-engine/            # Scene executor Dockerfiles
│   ├── device-monitor/             # Device monitor Dockerfiles
│   └── web/                        # Frontend Dockerfiles
│
├── scripts/                        # Utility scripts
│   ├── setup-production.sh         # Initial setup
│   ├── start-production.sh         # Start production
│   ├── start-development.sh        # Start development
│   ├── stop-production.sh          # Stop services
│   ├── backup-database.sh          # Database backup
│   ├── restore-database.sh         # Database restore
│   ├── logs.sh                     # View logs
│   └── health-check.sh             # Health check
│
├── volumes/                        # Persistent data (gitignored)
│   ├── postgres-data/
│   ├── mosquitto-data/
│   ├── prometheus-data/
│   ├── grafana-data/
│   └── loki-data/
│
└── backups/                        # Database backups
```

## Common Commands

### Service Management

```bash
# Start services
sudo ./scripts/start-production.sh              # Production
./scripts/start-development.sh                  # Development

# Stop services
docker-compose down                              # Keep data
docker-compose down -v                           # Remove all data

# Restart a service
docker-compose restart sentient-api-1

# Rebuild a service
docker-compose up -d --build sentient-api-1
```

### Monitoring

```bash
# View service status
docker-compose ps

# Health check
sudo ./scripts/health-check.sh

# View logs
sudo ./scripts/logs.sh sentient-api-1           # Specific service
docker-compose logs -f                           # All services
docker-compose logs --tail=100 sentient-api-1    # Last 100 lines
```

### Database Operations

```bash
# Backup
sudo ./scripts/backup-database.sh

# Restore
sudo ./scripts/restore-database.sh backups/sentient_db_20250110_120000.sql.gz

# Access database shell
docker-compose exec postgres psql -U sentient_prod -d sentient
```

### Debugging

```bash
# Enter container shell
docker-compose exec sentient-api-1 /bin/sh

# View container resources
docker stats

# Network test
docker-compose exec sentient-api-1 ping postgres
docker-compose exec sentient-api-1 nc -zv mosquitto 1883
```

## Access Points

### Production
- **Web UI:** https://sentientengine.ai
- **API:** https://sentientengine.ai/api
- **Grafana:** https://sentientengine.ai/grafana
- **Prometheus:** http://localhost:9090 (internal only)

### Development
- **Web UI:** http://localhost:3002 (Vite HMR)
- **API:** http://localhost:3000
- **Scene Executor:** http://localhost:3004
- **Device Monitor:** http://localhost:3003
- **Grafana:** http://localhost:3200 (admin/admin)
- **Prometheus:** http://localhost:9090
- **PostgreSQL:** localhost:5432
- **MQTT:** localhost:1883

### Debug Ports (Development)
- API Instance 1: 9229
- API Instance 2: 9228
- Scene Executor: 9230
- Device Monitor: 9231

## Architecture

### Service Communication

```
Internet → Nginx:443
              ↓
    ┌─────────┼─────────────┐
    ↓         ↓             ↓
Web:3002  API:3000    Executor:3004
                            ↓
                      Monitor:3003
                            ↓
                      MQTT:1883
                            ↓
                      Hardware Controllers
                            ↓
                      PostgreSQL:5432
```

### Data Flow

1. **Frontend** (React) → Nginx → API
2. **API** → PostgreSQL (data) + Scene Executor (scenes)
3. **Scene Executor** → MQTT → Teensy Controllers
4. **Controllers** → MQTT → Device Monitor → PostgreSQL
5. **All Services** → Prometheus (metrics) + Loki (logs)

## Configuration

### Environment Variables

Required in `.env.production`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# MQTT
MQTT_PASSWORD=your_mqtt_password

# Security
JWT_SECRET=your_jwt_secret_min_32_chars
SESSION_SECRET=your_session_secret

# Grafana
GRAFANA_PASSWORD=your_grafana_password
```

### SSL Certificates

Production requires SSL certificates at:
- `config/nginx/ssl/fullchain.pem`
- `config/nginx/ssl/privkey.pem`

See [config/nginx/ssl/README.md](config/nginx/ssl/README.md) for setup instructions.

### MQTT Passwords

MQTT users are configured in `config/mosquitto/mosquitto_passwd`.

See [config/mosquitto/README.md](config/mosquitto/README.md) for management commands.

## Security

### Production Hardening

1. ✅ Strong passwords in `.env.production`
2. ✅ SSL/TLS with Let's Encrypt certificates
3. ✅ UFW firewall (ports 22, 80, 443 only)
4. ✅ MQTT restricted to internal network
5. ✅ fail2ban for brute-force protection
6. ✅ Regular security updates
7. ✅ Non-root containers
8. ✅ Multi-tenant data isolation

### Network Isolation

- Docker network: 172.20.0.0/16 (isolated)
- Public ports: 80, 443 only
- MQTT port 1883: Internal only (not exposed)
- PostgreSQL: Internal only (not exposed)

## Maintenance

### Regular Tasks

**Daily:**
- Monitor Grafana dashboards
- Check `./scripts/health-check.sh`

**Weekly:**
- Review logs for errors
- Database backup: `./scripts/backup-database.sh`

**Monthly:**
- Update Docker images: `docker-compose pull && docker-compose up -d`
- System security updates: `sudo apt-get update && sudo apt-get upgrade`
- Review and clean old backups

### Backup Strategy

Automated backups are stored in `/opt/sentient/backups/` with 7-day retention.

Manual backup:
```bash
sudo ./scripts/backup-database.sh
```

Restore:
```bash
sudo ./scripts/restore-database.sh backups/sentient_db_YYYYMMDD_HHMMSS.sql.gz
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs [service_name]

# Check port conflicts
sudo netstat -tulpn | grep -E ':(80|443|3000|5432|1883)'

# Verify Docker is running
sudo systemctl status docker
```

### Database connection errors
```bash
# Test connection
docker-compose exec postgres psql -U sentient_prod -d sentient

# Check environment
docker-compose exec sentient-api-1 env | grep DATABASE
```

### MQTT issues
```bash
# Test broker
mosquitto_sub -h localhost -p 1883 -u paragon_devices -P password -t '#'

# Check logs
docker-compose logs mosquitto
```

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for complete troubleshooting guide.

## Documentation

- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Complete deployment guide
- **[docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)** - System architecture
- **[docs/CLAUDE.md](docs/CLAUDE.md)** - Development guidelines
- **[config/nginx/ssl/README.md](config/nginx/ssl/README.md)** - SSL setup
- **[config/mosquitto/README.md](config/mosquitto/README.md)** - MQTT configuration
- **[config/postgres/init/README.md](config/postgres/init/README.md)** - Database setup

## System Requirements

### Production
- Ubuntu 24.04 LTS (recommended)
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB disk space
- Static IP or domain name

### Development
- Any OS with Docker
- 2+ CPU cores
- 4+ GB RAM
- 20+ GB disk space

## Support

1. Check [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) troubleshooting section
2. Run `./scripts/health-check.sh`
3. Review logs: `docker-compose logs [service]`
4. Check service status: `docker-compose ps`

---

**Sentient Engine** - Escape Room Orchestration Platform
**Version:** 2.0.1
**Last Updated:** November 10, 2025