# Deployment Guide (Local Only)

This guide covers building and running Sentient Engine from your local development environment. It no longer describes deployment to any remote production server.

## 🎯 Pre-Deployment Checklist

Before sharing builds or changes with others:

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Database migrations tested locally
- [ ] Breaking changes documented

## 🚀 Deployment Process

### Step 1: Prepare Local Build

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Verify everything works locally
npm install
npm run build
npm test

# Optional: run local health checks
./scripts/health-check.sh
```

### Step 2: Test Database Migrations Locally

```bash
# Test migrations on development database
npm run db:reset  # Full reset to verify from scratch
npm run db:migrate
npm run db:seed

# Verify schema
./scripts/validate-schema.sh
```

### Step 3: Build Docker Images Locally

```bash
# Build all services locally
docker compose build
```

### Step 4: Run Locally and Verify

```bash
# Start local stack
npm run dev

# View logs
docker compose logs -f --tail=100

# Check for errors
docker compose logs | grep -i error
```

## 🔄 Rollback Procedure

If a local build or migration fails, fix the code or configuration and repeat the steps above. There is no separate production rollback in this workspace.

## 📦 Environment Configuration

### Local Environment Variables

Create/update `services/api/.env`:

```bash
# Database
DATABASE_URL=postgresql://sentient_dev:PASSWORD@localhost:5432/sentient_dev
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sentient_dev
DB_USER=sentient_dev
DB_PASSWORD=<development-password>

# API
NODE_ENV=development
PORT=3000
JWT_SECRET=<production-jwt-secret>
SESSION_SECRET=<production-session-secret>

# MQTT
MQTT_URL=mqtt://mosquitto:1883
MQTT_USERNAME=sentient_api
MQTT_PASSWORD=<production-mqtt-password>

# Security
CORS_ORIGIN=http://localhost:3002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/sentient-api.log
```

### Security Checklist

- [ ] All passwords are strong and unique
- [ ] JWT_SECRET is cryptographically random
- [ ] CORS_ORIGIN is set to production domain
- [ ] Database has strong password
- [ ] MQTT has authentication enabled
- [ ] SSL/TLS certificates are valid
- [ ] Firewall rules are configured

## 🔧 Database Migrations

### Creating a Migration

```bash
# On local machine
cd services/api
npm run migrate:create add_new_feature

# Edit the generated migration file in migrations/
# Add up() and down() functions

# Test locally
npm run db:reset
npm run db:migrate
```

### Migration Best Practices

1. **Always test locally first**
2. **Write reversible migrations** (implement `down()`)
3. **Use transactions** for data migrations
4. **Don't drop columns immediately** (deprecate first)
5. **Add indexes before foreign keys**
6. **Test with production-like data volume**

### Example Migration

```javascript
export async function up(pgm) {
  pgm.createTable('new_table', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('new_table', 'name');
}

export async function down(pgm) {
  pgm.dropTable('new_table');
}
```

## 🔍 Monitoring

### Key Metrics to Watch

**Grafana Dashboards:**

- System Overview (CPU, Memory, Disk)
- API Performance (Request rate, Latency, Errors)
- Device Status (Online/Offline counts)
- Database Performance (Connections, Query time)

**Access:** https://sentientengine.ai:3200

### Log Locations

```bash
# Application logs
docker compose logs -f sentient-api
docker compose logs -f executor-engine
docker compose logs -f device-monitor

# System logs
sudo journalctl -u docker -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🚨 Troubleshooting Deployments

### Services Won't Start

```bash
# Check Docker status
docker compose ps

# View specific service logs
docker compose logs sentient-api

# Check for port conflicts
sudo lsof -i :3000
```

### Database Connection Issues

```bash
# Test connection
docker exec -it sentient-postgres-1 psql -U sentient_prod -d sentient

# Check connection pool
docker exec -it sentient-api-1 cat /app/logs/sentient-api.log | grep "pool error"
```

### MQTT Connection Issues

```bash
# Test MQTT broker
docker exec -it mosquitto-1 mosquitto_sub -h localhost -t '#' -u admin -P password

# Check ACL permissions
docker exec -it mosquitto-1 cat /mosquitto/config/mosquitto.acl
```

## 📝 Deployment Checklist

Print this checklist for each deployment:

```markdown
## Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Production backup created

## Deployment

- [ ] Code pulled/transferred to production
- [ ] Dependencies installed
- [ ] Migrations run
- [ ] Services rebuilt
- [ ] Services restarted
- [ ] Health check passed

## Post-Deployment

- [ ] Frontend loads correctly
- [ ] API responds correctly
- [ ] Devices connecting via MQTT
- [ ] No errors in logs
- [ ] Grafana metrics normal
- [ ] Team notified of completion

## Rollback (if needed)

- [ ] Previous version restored
- [ ] Database restored from backup
- [ ] Services restarted
- [ ] Health check passed
- [ ] Incident documented
```

## 🔐 Security Considerations

### Local Security

1. **Keep secrets out of git**
   - Use `.env` files (in .gitignore)
   - Never commit passwords or keys

2. **Regular updates**
   - Update dependencies monthly
   - Apply security patches promptly

3. **Access control**
   - Limit SSH access
   - Use SSH keys (not passwords)
   - Enable firewall

4. **Backups**
   - Automated daily backups
   - Test restore procedures
   - Off-site backup storage

## 📊 Notes

This workspace is intended for local development and testing of the web application and its supporting services only. Any real production deployment should be documented separately.

## 📚 Additional Resources

- [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) - Complete architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guidelines
- [Docker Deployment Guide](../DOCKER_DEPLOYMENT.md) - Docker specifics

---

**Last Updated:** November 14, 2025
**Version:** 2.1.0
