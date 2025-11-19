# MQTT Standalone Broker Setup

## Overview

The Sentient Engine MQTT broker runs as a **standalone Docker container** that is accessible by both development and production environments. This design allows:

- ✅ Single MQTT broker shared between dev and prod
- ✅ Teensy controllers can connect directly via host IP (192.168.2.3:1883)
- ✅ Simplified network architecture
- ✅ Independent scaling and management

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Sentient Server (192.168.2.3)                      │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Standalone MQTT Broker (Port 1883/9001)     │  │
│  │  Container: mosquitto-shared                  │  │
│  └──────────────────────────────────────────────┘  │
│           ▲                           ▲             │
│           │                           │             │
│  ┌────────┴────────┐      ┌──────────┴──────────┐  │
│  │ Production Env  │      │ Development Env     │  │
│  │ (docker-compose │      │ (docker-compose     │  │
│  │  .prod.yml)     │      │  .yml)              │  │
│  └─────────────────┘      └─────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
           ▲
           │
    ┌──────┴──────┐
    │ Teensy 4.1  │
    │ Controllers │
    └─────────────┘
```

---

## Quick Start

### 1. Start MQTT Broker

```bash
# Navigate to repository root
cd /opt/sentient

# Start MQTT broker
docker compose -f docker-compose.mqtt.yml up -d

# Verify it's running
docker ps | grep mosquitto-shared
```

### 2. Verify Connectivity

```bash
# Test MQTT subscription (should connect without errors)
docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t test

# Test from host network
mosquitto_sub -h 192.168.2.3 -p 1883 -t test
```

### 3. Test Authentication

```bash
# Subscribe with credentials
mosquitto_sub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password_from_.env.production> \
  -t 'paragon/#' -v
```

---

## Configuration

### Location

```
/opt/sentient/config/mosquitto-prod/
├── mosquitto.conf          # Main configuration
├── mosquitto_passwd        # User credentials (hashed)
└── mosquitto.acl           # Access control rules
```

### Ports

| Port | Protocol  | Purpose                         |
| ---- | --------- | ------------------------------- |
| 1883 | MQTT      | Standard MQTT protocol          |
| 9001 | WebSocket | WebSocket protocol for browsers |

### Volumes

| Host Path                          | Container Path      | Purpose       |
| ---------------------------------- | ------------------- | ------------- |
| `./config/mosquitto-prod/`         | `/mosquitto/config` | Configuration |
| `./volumes/mosquitto-data-shared/` | `/mosquitto/data`   | Persistence   |
| `./volumes/mosquitto-logs-shared/` | `/mosquitto/log`    | Logs          |

---

## User Management

### View Existing Users

```bash
# Users are stored in mosquitto_passwd file
cat /opt/sentient/config/mosquitto-prod/mosquitto_passwd
```

### Add New User

```bash
# Create password file if it doesn't exist
touch /opt/sentient/config/mosquitto-prod/mosquitto_passwd

# Add user (interactive password prompt)
docker exec -it mosquitto-shared mosquitto_passwd -b /mosquitto/config/mosquitto_passwd username password

# Reload broker to apply changes
docker compose -f docker-compose.mqtt.yml restart
```

### Update Existing User Password

```bash
# Same command as adding (overwrites existing)
docker exec -it mosquitto-shared mosquitto_passwd -b /mosquitto/config/mosquitto_passwd username new_password

# Reload broker
docker compose -f docker-compose.mqtt.yml restart
```

### Delete User

```bash
# Remove from password file
docker exec -it mosquitto-shared mosquitto_passwd -D /mosquitto/config/mosquitto_passwd username

# Reload broker
docker compose -f docker-compose.mqtt.yml restart
```

---

## Access Control (ACL)

### ACL File Location

```
/opt/sentient/config/mosquitto-prod/mosquitto.acl
```

### Example ACL Rules

```
# Admin user (full access)
user admin
topic readwrite #

# Production API service
user sentient_api_prod
topic readwrite paragon/#

# Production executor service
user sentient_executor_prod
topic readwrite paragon/#

# Production monitor service
user sentient_monitor_prod
topic readwrite paragon/#

# Teensy controllers (read commands, write sensors/status)
user paragon_devices
topic read paragon/+/commands/#
topic write paragon/+/sensors/#
topic write paragon/+/status/#
topic write paragon/+/events/#
```

### Apply ACL Changes

```bash
# Edit ACL file
nano /opt/sentient/config/mosquitto-prod/mosquitto.acl

# Reload broker
docker compose -f docker-compose.mqtt.yml restart
```

---

## Testing & Debugging

### Subscribe to All Topics

```bash
# From host
mosquitto_sub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password> \
  -t '#' -v

# From inside container
docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t '#' -v
```

### Publish Test Message

```bash
mosquitto_pub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password> \
  -t 'paragon/clockwork/commands/test' \
  -m '{"test":true,"timestamp":'$(date +%s)'}'
```

### View Broker Logs

```bash
# Live logs
docker compose -f docker-compose.mqtt.yml logs -f

# Last 100 lines
docker compose -f docker-compose.mqtt.yml logs --tail=100

# Log file on disk
tail -f /opt/sentient/volumes/mosquitto-logs-shared/mosquitto.log
```

### Check System Topics

```bash
# Broker statistics
mosquitto_sub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password> \
  -t '$SYS/#' -v
```

---

## Service Management

### Start/Stop/Restart

```bash
# Start
docker compose -f docker-compose.mqtt.yml up -d

# Stop
docker compose -f docker-compose.mqtt.yml down

# Restart (reload config)
docker compose -f docker-compose.mqtt.yml restart

# Stop and remove volumes (CAUTION: deletes data)
docker compose -f docker-compose.mqtt.yml down -v
```

### Check Status

```bash
# Container status
docker compose -f docker-compose.mqtt.yml ps

# Health check
docker inspect mosquitto-shared | grep -A 10 Health

# Resource usage
docker stats mosquitto-shared
```

---

## Troubleshooting

### MQTT Broker Won't Start

**Check logs:**

```bash
docker compose -f docker-compose.mqtt.yml logs
```

**Common issues:**

- Port 1883 or 9001 already in use
- Configuration file syntax errors
- Volume permission issues

**Solution:**

```bash
# Check port conflicts
sudo netstat -tulpn | grep -E ':(1883|9001)'

# Fix volume permissions
sudo chown -R 1883:1883 /opt/sentient/volumes/mosquitto-data-shared
sudo chown -R 1883:1883 /opt/sentient/volumes/mosquitto-logs-shared
```

### Authentication Failures

**Symptoms:**

```
Connection Refused: not authorized
```

**Verification:**

```bash
# Test with correct credentials
mosquitto_sub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password_from_.env.production> \
  -t test

# Check password file exists
docker exec mosquitto-shared ls -la /mosquitto/config/mosquitto_passwd
```

### ACL Permission Denied

**Symptoms:**

```
Publish denied
Subscribe denied
```

**Check ACL rules:**

```bash
cat /opt/sentient/config/mosquitto-prod/mosquitto.acl

# Verify user has access to topic
# Format: topic readwrite pattern
```

### Services Can't Connect

**Verify MQTT URL in .env.production:**

```bash
grep MQTT_URL /opt/sentient/.env.production
# Should be: MQTT_URL=mqtt://192.168.2.3:1883
```

**Test from production containers:**

```bash
# Test from API container
docker exec sentient-api mosquitto_sub -h 192.168.2.3 -p 1883 \
  -u sentient_api_prod \
  -P <password> \
  -t test
```

### Network Connectivity Issues

**Verify broker is listening:**

```bash
# On Sentient Server
nc -zv 192.168.2.3 1883

# Should output: Connection to 192.168.2.3 1883 port [tcp/*] succeeded!
```

**Check firewall:**

```bash
# UFW status
sudo ufw status

# Allow MQTT from local network
sudo ufw allow from 192.168.0.0/16 to any port 1883
```

---

## Backup & Recovery

### Backup MQTT Data

```bash
# Create backup directory
mkdir -p /opt/sentient/backups/mqtt

# Backup data volume
sudo tar czf /opt/sentient/backups/mqtt/mosquitto-data-$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /opt/sentient/volumes mosquitto-data-shared

# Backup configuration
sudo tar czf /opt/sentient/backups/mqtt/mosquitto-config-$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /opt/sentient/config mosquitto-prod
```

### Restore MQTT Data

```bash
# Stop broker
docker compose -f docker-compose.mqtt.yml down

# Restore data
sudo tar xzf /opt/sentient/backups/mqtt/mosquitto-data-YYYYMMDD_HHMMSS.tar.gz \
  -C /opt/sentient/volumes

# Restore config
sudo tar xzf /opt/sentient/backups/mqtt/mosquitto-config-YYYYMMDD_HHMMSS.tar.gz \
  -C /opt/sentient/config

# Start broker
docker compose -f docker-compose.mqtt.yml up -d
```

---

## Production Deployment Checklist

- [ ] MQTT broker container is running
- [ ] Ports 1883 and 9001 are accessible
- [ ] Authentication is enabled (`allow_anonymous false`)
- [ ] Password file exists and contains hashed passwords
- [ ] ACL rules are configured for all users
- [ ] Production services can connect (test with mosquitto_sub)
- [ ] Teensy controllers can connect from 192.168.3.0/24 network
- [ ] Firewall allows MQTT traffic from internal networks only
- [ ] Logs are being written to volume
- [ ] Persistence is enabled and working
- [ ] Health check is passing

---

## Security Best Practices

1. **Never allow anonymous access** - Always require authentication
2. **Use strong passwords** - Minimum 16 characters with complexity
3. **Restrict ACL rules** - Grant minimum required permissions
4. **Internal network only** - Don't expose port 1883 to internet
5. **Regular password rotation** - Change credentials periodically
6. **Monitor logs** - Watch for unauthorized access attempts
7. **Enable persistence** - Ensure messages survive restarts
8. **Backup regularly** - Automated daily backups recommended

---

## Performance Tuning

### High-Traffic Configuration

Edit `/opt/sentient/config/mosquitto-prod/mosquitto.conf`:

```
# Increase connection limits
max_connections 10000
max_queued_messages 10000

# Increase packet size for large payloads
max_packet_size 268435456

# Tune persistence
autosave_interval 300

# Increase inflight messages
max_inflight_messages 100
```

Restart broker after changes:

```bash
docker compose -f docker-compose.mqtt.yml restart
```

---

## Related Documentation

- [MQTT Topic Standards](../MQTT_TOPIC_FIX.md)
- [System Architecture](../SYSTEM_ARCHITECTURE.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Teensy Controller Guide](../hardware/TEENSY_V2_COMPLETE_GUIDE.md)

---

**Last Updated:** January 2025
**Maintainer:** Sentient Engine Team
