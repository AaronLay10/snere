# Production Deployment Guide

This guide walks you through deploying Sentient Engine v1.2.0 to production.

## Prerequisites

- ✅ Docker and Docker Compose installed
- ✅ MQTT broker running at `mqtt.sentientengine.ai:1883`
- ✅ GitHub Container Registry access
- ✅ Production server with sufficient resources

## Step 1: Configure Production Environment

1. **Copy the `.env.production` file to your production server:**

```bash
scp .env.production user@production-server:/path/to/sentient/
```

2. **Update all credentials in `.env.production`:**

```bash
# Generate secure passwords
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For MQTT passwords
```

3. **Edit `.env.production` and replace all `CHANGE_ME` values:**

```bash
nano .env.production
```

**Required changes:**
- `POSTGRES_PASSWORD` - Secure PostgreSQL password
- `MQTT_PASSWORD` - MQTT API service password
- `MQTT_EXECUTOR_PASSWORD` - MQTT executor service password
- `MQTT_MONITOR_PASSWORD` - MQTT monitor service password
- `JWT_SECRET` - JWT signing secret (32+ characters)
- `SESSION_SECRET` - Session encryption secret (32+ characters)
- `GRAFANA_PASSWORD` - Grafana admin password (if using observability)

**Optional changes:**
- `VITE_API_URL` - Your production API URL
- `CORS_ORIGIN` - Your production domains

## Step 2: Deploy to Production

### Option A: Using the Deployment Script (Recommended)

```bash
# Basic deployment (core services only)
./scripts/deploy-production.sh

# With observability stack (Prometheus, Grafana, Loki)
./scripts/deploy-production.sh --with-observability

# Skip database backup
./scripts/deploy-production.sh --skip-backup
```

### Option B: Manual Deployment

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Start services
docker compose -f docker-compose.prod.yml up -d

# With observability
docker compose -f docker-compose.prod.yml --profile observability up -d
```

## Step 3: Initialize Database

**First-time deployment only:**

```bash
# Run database migrations
docker exec -it sentient-api-prod npm run migrate

# Seed initial data (optional)
docker exec -it sentient-api-prod npm run seed
```

## Step 4: Verify Deployment

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Health checks
curl http://localhost:3000/health    # API
curl http://localhost:3002           # Web
curl http://localhost:3003/health    # Device Monitor
curl http://localhost:3004/health    # Executor Engine
```

## Step 5: Configure Reverse Proxy (Optional)

If using Nginx or another reverse proxy:

```nginx
# API
server {
    listen 443 ssl;
    server_name api.sentientengine.ai;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Web UI
server {
    listen 443 ssl;
    server_name sentientengine.ai;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring Services (If Enabled)

- **Grafana:** http://localhost:3200 (admin / your-password)
- **Prometheus:** http://localhost:9090

## Common Operations

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f sentient-api
```

### Restart Services
```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart sentient-api
```

### Update to New Version
```bash
# Pull new images
docker compose -f docker-compose.prod.yml pull

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### Backup Database
```bash
docker exec sentient-postgres-prod pg_dump -U sentient_prod sentient_prod > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
docker exec -i sentient-postgres-prod psql -U sentient_prod sentient_prod < backup.sql
```

### Stop All Services
```bash
docker compose -f docker-compose.prod.yml down
```

## Troubleshooting

### Services Won't Start

1. **Check logs:**
   ```bash
   docker compose -f docker-compose.prod.yml logs
   ```

2. **Verify .env.production:**
   ```bash
   cat .env.production | grep CHANGE_ME
   # Should return nothing
   ```

3. **Check MQTT connectivity:**
   ```bash
   docker exec -it sentient-api-prod ping mqtt.sentientengine.ai
   ```

### Database Connection Issues

1. **Check PostgreSQL is running:**
   ```bash
   docker compose -f docker-compose.prod.yml ps postgres
   ```

2. **Test database connection:**
   ```bash
   docker exec -it sentient-postgres-prod psql -U sentient_prod -d sentient_prod -c "SELECT 1;"
   ```

### Image Pull Issues

1. **Login to GitHub Container Registry:**
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```

2. **Verify images exist:**
   - https://github.com/AaronLay10/sentient/pkgs/container/sentient-api
   - https://github.com/AaronLay10/sentient/pkgs/container/executor-engine
   - https://github.com/AaronLay10/sentient/pkgs/container/device-monitor
   - https://github.com/AaronLay10/sentient/pkgs/container/sentient-web

## Security Checklist

- [ ] All `CHANGE_ME` values replaced in `.env.production`
- [ ] Strong passwords used (32+ characters)
- [ ] `.env.production` file permissions set to 600
- [ ] MQTT broker secured with authentication
- [ ] Firewall configured (only expose necessary ports)
- [ ] SSL/TLS certificates configured
- [ ] Regular database backups scheduled
- [ ] Log rotation configured

## Support

For issues or questions:
- Check logs: `docker compose -f docker-compose.prod.yml logs -f`
- Review system architecture: `SYSTEM_ARCHITECTURE.md`
- Check deployment docs: `docs/DEPLOYMENT.md`
