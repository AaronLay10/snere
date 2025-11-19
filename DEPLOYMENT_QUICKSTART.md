# Deployment Quick Start Guide

## 🚀 Deploy to Production Server in One Command

This guide shows you how to deploy Sentient Engine to your production server at **192.168.2.3** using the automated deployment script.

---

## Prerequisites Checklist

Before running the deployment script, ensure:

- ✅ You can SSH to the server: `ssh techadmin@192.168.2.3`
- ✅ `.env.production` file exists in this repository
- ✅ No `CHANGE_ME` placeholders in `.env.production`
- ✅ GHCR token is valid (or packages are public)
- ✅ All local changes committed and pushed to GitHub

---

## Quick Deployment

### Standard Deployment (Recommended for First Time)

```bash
./scripts/deploy-to-sentient-server.sh
```

This will:

1. ✅ Verify SSH access to server
2. ✅ Check .env.production configuration
3. ✅ Sync repository to server
4. ✅ Install Docker (if needed)
5. ✅ Deploy standalone MQTT broker
6. ✅ Authenticate with GitHub Container Registry
7. ✅ Pull Docker images from GHCR
8. ✅ Deploy production services
9. ✅ Verify all services are healthy
10. ✅ Display service URLs

**Estimated time:** 5-10 minutes

---

## Deployment Options

### Clean Deployment (Fresh Start)

Removes all old containers and volumes before deploying:

```bash
./scripts/deploy-to-sentient-server.sh --clean-deploy
```

⚠️ **WARNING:** This will delete all existing data! Use only for fresh installations.

### With Observability Stack

Deploy with Prometheus, Grafana, and Loki monitoring:

```bash
./scripts/deploy-to-sentient-server.sh --with-observability
```

### Skip MQTT Setup

If MQTT broker is already running:

```bash
./scripts/deploy-to-sentient-server.sh --skip-mqtt
```

### Skip Image Build

If images are already in GHCR (from GitHub Actions):

```bash
./scripts/deploy-to-sentient-server.sh --skip-build
```

### Combined Options

```bash
# Clean deployment with observability, skip building images
./scripts/deploy-to-sentient-server.sh --clean-deploy --with-observability --skip-build
```

---

## What the Script Does

### Phase 1: Prerequisites

- Checks SSH connectivity
- Verifies .env.production exists and is configured
- Checks for uncommitted git changes

### Phase 2: Server Setup

- Creates deployment directory (`/opt/sentient`)
- Clones/updates repository from GitHub
- Transfers .env.production securely
- Installs Docker (if not present)

### Phase 3: MQTT Broker

- Starts standalone MQTT container
- Waits for health check to pass
- Verifies connectivity

### Phase 4: Image Registry

- Authenticates with GitHub Container Registry
- Optionally builds images locally and pushes to GHCR

### Phase 5: Service Deployment

- Pulls latest images
- Starts production services
- Waits for all health checks
- Verifies endpoints

### Phase 6: Verification

- Tests API health endpoint
- Tests Web UI
- Tests Device Monitor
- Tests Executor Engine
- Displays service status

---

## After Deployment

### Access Services

| Service         | URL                     | Credentials                    |
| --------------- | ----------------------- | ------------------------------ |
| Web UI          | http://192.168.2.3:3002 | admin@paragon.local / password |
| API             | http://192.168.2.3:3000 | -                              |
| Device Monitor  | http://192.168.2.3:3003 | -                              |
| Executor Engine | http://192.168.2.3:3004 | -                              |
| MQTT Broker     | mqtt://192.168.2.3:1883 | (see .env.production)          |
| Grafana         | http://192.168.2.3:3200 | admin / (see .env.production)  |
| Prometheus      | http://192.168.2.3:9090 | -                              |

### Verify Deployment

1. **Test Web UI Login:**

   ```bash
   open http://192.168.2.3:3002
   ```

   Login: `admin@paragon.local` / `password`

2. **Check Service Health:**

   ```bash
   ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml ps'
   ```

3. **View Logs:**

   ```bash
   ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml logs -f'
   ```

4. **Test MQTT:**

   ```bash
   ssh techadmin@192.168.2.3 'docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t test'
   ```

---

## Troubleshooting

### SSH Connection Fails

```bash
# Test SSH
ssh techadmin@192.168.2.3

# If fails, check:
# 1. Server is online
# 2. SSH keys are configured
# 3. Firewall allows SSH (port 22)
```

### .env.production Errors

```bash
# Check for CHANGE_ME placeholders
grep CHANGE_ME .env.production

# Should return nothing
```

### Image Pull Fails

**Option 1: Make packages public**

1. Go to https://github.com/AaronLay10?tab=packages
2. For each package, change visibility to Public

**Option 2: Verify GHCR token**

```bash
# Check token in .env.production
grep GHCR_TOKEN .env.production

# Test authentication
echo $GHCR_TOKEN | docker login ghcr.io -u AaronLay10 --password-stdin
```

### Services Unhealthy

```bash
# SSH to server
ssh techadmin@192.168.2.3

# Check logs
cd /opt/sentient
docker compose -f docker-compose.prod.yml logs

# Check specific service
docker compose -f docker-compose.prod.yml logs sentient-api

# Restart unhealthy service
docker compose -f docker-compose.prod.yml restart sentient-api
```

### MQTT Connection Issues

```bash
# Verify MQTT is running
ssh techadmin@192.168.2.3 'docker ps | grep mosquitto'

# Test connectivity
ssh techadmin@192.168.2.3 'nc -zv 192.168.2.3 1883'

# Check MQTT logs
ssh techadmin@192.168.2.3 'docker logs mosquitto-shared'
```

---

## Manual Deployment (If Script Fails)

If the automated script fails, you can deploy manually:

```bash
# 1. SSH to server
ssh techadmin@192.168.2.3

# 2. Clone repository
sudo mkdir -p /opt/sentient
sudo chown techadmin:techadmin /opt/sentient
cd /opt/sentient
git clone https://github.com/AaronLay10/snere.git .

# 3. Copy .env.production from your Mac
# (In new terminal on Mac)
scp .env.production techadmin@192.168.2.3:/opt/sentient/

# 4. Back on server, start MQTT
cd /opt/sentient
docker compose -f docker-compose.mqtt.yml up -d

# 5. Deploy production services
./scripts/deploy-production.sh

# 6. Verify
docker compose -f docker-compose.prod.yml ps
```

---

## Updating Deployment

To update with new code:

```bash
# From your Mac
git pull origin main
git push origin main

# Deploy updates
./scripts/deploy-to-sentient-server.sh --skip-mqtt
```

---

## Rollback

If deployment fails and you need to rollback:

```bash
ssh techadmin@192.168.2.3

cd /opt/sentient

# Stop services
docker compose -f docker-compose.prod.yml down

# Checkout previous commit
git log --oneline -10  # Find previous commit hash
git checkout <previous-commit-hash>

# Redeploy
./scripts/deploy-production.sh
```

---

## Common Operations

### Restart All Services

```bash
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml restart'
```

### Restart Specific Service

```bash
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml restart sentient-api'
```

### View Logs

```bash
# All services
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml logs -f'

# Specific service
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml logs -f sentient-api'
```

### Database Backup

```bash
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker exec sentient-postgres-prod pg_dump -U sentient_prod sentient_prod > backup_$(date +%Y%m%d).sql'
```

### Stop All Services

```bash
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml down'
```

---

## Help & Support

**View script help:**

```bash
./scripts/deploy-to-sentient-server.sh --help
```

**Documentation:**

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [MQTT Standalone Setup](docs/MQTT_STANDALONE_SETUP.md)

**Service Logs:**

```bash
ssh techadmin@192.168.2.3 'cd /opt/sentient && docker compose -f docker-compose.prod.yml logs -f'
```

---

## Success Criteria

✅ All containers running and healthy
✅ Web UI accessible at http://192.168.2.3:3002
✅ Login works with admin@paragon.local
✅ API health endpoint returns OK
✅ MQTT broker accepting connections
✅ Database contains seed data (Paragon client)

---

**Ready to deploy?**

```bash
./scripts/deploy-to-sentient-server.sh
```

🎉 That's it! Your Sentient Engine will be running in production.
