# Manual Deployment Steps - Sentient Server

Since automated deployment requires sudo access, follow these manual steps while logged into the server.

---

## Step-by-Step Deployment

### 1. SSH to Server

```bash
ssh techadmin@192.168.2.3
```

### 2. Clean and Prepare Directory

```bash
# Remove old files
cd /opt
sudo rm -rf sentient

# Recreate and take ownership
sudo mkdir -p sentient
sudo chown techadmin:techadmin sentient
cd sentient
```

### 3. Clone Repository

```bash
git clone https://github.com/AaronLay10/snere.git .
```

### 4. Transfer .env.production

On your Mac (in a new terminal):

```bash
scp .env.production techadmin@192.168.2.3:/opt/sentient/
```

Back on the server:

```bash
chmod 600 /opt/sentient/.env.production
```

### 5. Start MQTT Broker

```bash
cd /opt/sentient

# Create volumes
mkdir -p volumes/mosquitto-data-shared
mkdir -p volumes/mosquitto-logs-shared

# Start MQTT
docker compose -f docker-compose.mqtt.yml up -d

# Wait and verify
sleep 10
docker ps | grep mosquitto

# Test
docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t test -W 2 || true
```

### 6. Authenticate with GHCR

```bash
cd /opt/sentient
source .env.production

# Login to GitHub Container Registry
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
```

### 7. Deploy Production Services

```bash
cd /opt/sentient
chmod +x ./scripts/deploy-production.sh
./scripts/deploy-production.sh
```

This will:

- Pull Docker images
- Start all services
- Wait for health checks
- Show service status

### 8. Monitor Deployment

Watch the logs:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Wait for all services to show as healthy. Press Ctrl+C when done.

### 9. Verify Deployment

Check service status:

```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show "healthy".

Test endpoints:

```bash
curl http://localhost:3000/health    # API
curl http://localhost:3002           # Web UI
curl http://localhost:3003/health    # Device Monitor
curl http://localhost:3004/health    # Executor
```

### 10. Test Web UI

On your Mac, open in browser:

```
http://192.168.2.3:3002
```

Login:

- Username: `admin@paragon.local`
- Password: `password`

---

## Expected Output

### MQTT Broker Status

```bash
$ docker ps | grep mosquitto
CONTAINER ID   IMAGE                  STATUS          NAMES
xxxxx          eclipse-mosquitto:2    Up 2 minutes    mosquitto-shared
```

### Production Services Status

```bash
$ docker compose -f docker-compose.prod.yml ps
NAME                     STATUS
executor-engine-prod     Up (healthy)
device-monitor-prod      Up (healthy)
sentient-api-prod        Up (healthy)
sentient-postgres-prod   Up (healthy)
sentient-web-prod        Up (healthy)
```

### Health Check Output

```bash
$ curl http://localhost:3000/health
{"status":"ok","timestamp":"2025-01-19T..."}

$ curl http://localhost:3002
<!DOCTYPE html>... (HTML content)

$ curl http://localhost:3003/health
{"status":"ok","timestamp":"2025-01-19T..."}

$ curl http://localhost:3004/health
{"status":"ok","timestamp":"2025-01-19T..."}
```

---

## Troubleshooting

### MQTT Won't Start

```bash
# Check logs
docker compose -f docker-compose.mqtt.yml logs

# Check ports
sudo netstat -tulpn | grep -E ':(1883|9001)'

# Fix permissions
sudo chown -R 1883:1883 volumes/mosquitto-data-shared
sudo chown -R 1883:1883 volumes/mosquitto-logs-shared

# Restart
docker compose -f docker-compose.mqtt.yml restart
```

### Services Won't Start

```bash
# Check individual service logs
docker compose -f docker-compose.prod.yml logs sentient-api
docker compose -f docker-compose.prod.yml logs executor-engine
docker compose -f docker-compose.prod.yml logs device-monitor

# Common issues:
# 1. MQTT not running - start it first
# 2. Database not ready - wait longer
# 3. Image pull failed - check GHCR login
```

### Image Pull Fails

```bash
# Verify GHCR login
docker login ghcr.io -u AaronLay10

# Or make packages public:
# Go to https://github.com/AaronLay10?tab=packages
# Change each package visibility to Public
```

### Health Checks Fail

```bash
# Wait longer - services take 30-60 seconds to be healthy
sleep 60
docker compose -f docker-compose.prod.yml ps

# If still unhealthy, check logs
docker compose -f docker-compose.prod.yml logs
```

---

## Post-Deployment

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f sentient-api
```

### Restart Service

```bash
docker compose -f docker-compose.prod.yml restart sentient-api
```

### Stop All Services

```bash
docker compose -f docker-compose.prod.yml down
```

### Database Backup

```bash
docker exec sentient-postgres-prod pg_dump -U sentient_prod sentient_prod > backup_$(date +%Y%m%d).sql
```

---

## Optional: Configure Passwordless Sudo

To enable automated deployments in the future:

```bash
sudo visudo

# Add this line at the end:
techadmin ALL=(ALL) NOPASSWD: ALL
```

Save and exit. Then the automated script will work.

---

## Success Criteria

✅ mosquitto-shared container running
✅ All 5 production containers healthy
✅ Web UI accessible at http://192.168.2.3:3002
✅ Login works
✅ API health check returns OK
✅ No errors in logs

---

**Deployment Time:** ~10-15 minutes

**Next Steps:** After successful deployment, you can access your Sentient Engine at http://192.168.2.3:3002
