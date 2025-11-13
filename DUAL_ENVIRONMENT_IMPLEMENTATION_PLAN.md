# Dual-Environment Implementation Plan
**Created:** November 11, 2025
**Status:** Ready for Implementation
**Risk Level:** HIGH - Requires Production Downtime

---

## Executive Summary

This document outlines the complete implementation plan for running both Production and Development environments on the same server (sentientengine.ai at 192.168.20.3).

### Current State
- **Problem:** Hybrid dev/prod configuration (containers running in dev mode with prod credentials)
- **Database:** Two databases already exist:
  - `sentient` (production) - 1 client, 4 users, ready for use
  - `sentient_dev` (development) - 1 client, 4 users, currently in use
- **Containers:** All services currently running in development mode

### Target State
- **Production:** Optimized containers on port 3000-3004, using `sentient` database
- **Development:** Debug-enabled containers on port 4000-4004, using `sentient_dev` database
- **Isolation:** Separate Docker networks, no cross-contamination
- **Control:** Docker Compose profiles for independent start/stop

---

## Architecture Design

### Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│  Sentient Server (192.168.20.3)                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  PRODUCTION NET  │         │ DEVELOPMENT NET  │          │
│  │  172.20.0.0/16   │         │  172.21.0.0/16   │          │
│  │                  │         │                  │          │
│  │  api-prod-1 :3000│         │  api-dev-1  :4000│          │
│  │  api-prod-2 :3000│         │  api-dev-2  :4000│          │
│  │  web-prod   :3002│         │  web-dev    :4002│          │
│  │  executor-p :3004│         │  executor-d :4004│          │
│  │  monitor-p  :3003│         │  monitor-d  :4003│          │
│  │  grafana-p  :3200│         │  grafana-d  :4200│          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
│                   ┌────▼────┐                                │
│                   │ SHARED  │                                │
│                   ├─────────┤                                │
│                   │postgres │  • sentient (prod DB)          │
│                   │:5432    │  • sentient_dev (dev DB)       │
│                   │mosquitto│                                │
│                   │:1883    │                                │
│                   └─────────┘                                │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  NGINX (Port 80/443)                                 │   │
│  │  - sentientengine.ai → Production Services           │   │
│  │  - dev.sentientengine.ai → Development (optional)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Service Naming Convention

| Service Type | Production Name | Development Name |
|--------------|----------------|------------------|
| API Instance 1 | `sentient-api-prod-1` | `sentient-api-dev-1` |
| API Instance 2 | `sentient-api-prod-2` | `sentient-api-dev-2` |
| Web UI | `sentient-web-prod` | `sentient-web-dev` |
| Scene Executor | `sentient-executor-prod` | `sentient-executor-dev` |
| Device Monitor | `sentient-monitor-prod` | `sentient-monitor-dev` |
| Grafana | `sentient-grafana-prod` | `sentient-grafana-dev` |
| Prometheus | `sentient-prometheus-prod` | `sentient-prometheus-dev` |
| Loki | `sentient-loki-prod` | `sentient-loki-dev` |
| Promtail | `sentient-promtail-prod` | `sentient-promtail-dev` |

### Port Allocation

| Service | Production Port | Development Port | Shared |
|---------|----------------|------------------|---------|
| API | 3000 | 4000 | |
| Web | 3002 | 4002 | |
| Executor | 3004 | 4004 | |
| Monitor | 3003 | 4003 | |
| Grafana | 3200 | 4200 | |
| Prometheus | 9090 | 9190 | |
| Loki | 3100 | 4100 | |
| PostgreSQL | 5432 | 5432 | ✓ |
| MQTT | 1883 | 1883 | ✓ |
| Nginx | 80, 443 | 80, 443 | ✓ |

---

## Implementation Steps

### Phase 1: Backup Current State ⚠️
**Duration:** 5 minutes
**Risk:** Low

```bash
# 1. Backup current docker-compose files
cp docker-compose.yml docker-compose.yml.backup
cp docker-compose.dev.yml docker-compose.dev.yml.backup

# 2. Backup .env files
cp .env .env.backup

# 3. Export current container configurations
docker compose config > docker-compose-current-state.yml

# 4. Document running containers
docker compose ps > containers-before-migration.txt
```

### Phase 2: Create New Docker Compose Structure
**Duration:** 30 minutes
**Risk:** Medium (file editing only, no service changes yet)

**Actions:**
1. Create new `docker-compose.prod.yml` for production services
2. Create new `docker-compose.dev.yml` for development services
3. Update main `docker-compose.yml` to use profiles
4. Add network definitions (`sentient-production`, `sentient-development`)
5. Update all service definitions with profiles and renamed containers

**Key Changes:**
- Add `profiles: ["production"]` to all prod services
- Add `profiles: ["development"]` to all dev services
- Rename containers: `sentient-api-1` → `sentient-api-prod-1`
- Update port mappings: dev services use 4000+ range
- Update DATABASE_URL: prod uses `sentient`, dev uses `sentient_dev`
- Create two separate networks with shared services bridge

### Phase 3: Stop Current Services ⚠️
**Duration:** 2 minutes
**Risk:** HIGH - Production Downtime Starts

```bash
# Stop all running containers
docker compose down

# Verify all stopped
docker compose ps
```

**CRITICAL:** This begins production downtime. Escape rooms will be offline.

### Phase 4: Deploy New Configuration
**Duration:** 10 minutes
**Risk:** HIGH - Configuration errors could prevent startup

```bash
# 1. Validate new compose file syntax
docker compose config

# 2. Build production images
docker compose --profile production build --no-cache

# 3. Start production services
docker compose --profile production up -d

# 4. Wait 30 seconds for services to initialize
sleep 30

# 5. Check production service health
docker compose --profile production ps
docker compose logs sentient-api-prod-1
```

### Phase 5: Verify Production
**Duration:** 10 minutes
**Risk:** Medium

**Verification Checklist:**
- [ ] PostgreSQL healthy, connected to `sentient` database
- [ ] API services healthy (both instances)
- [ ] Web UI accessible at https://sentientengine.ai
- [ ] Scene executor healthy
- [ ] Device monitor healthy
- [ ] MQTT broker accessible
- [ ] Grafana accessible at https://sentientengine.ai/grafana
- [ ] No development containers running
- [ ] All prod services on 3000-series ports
- [ ] Test API endpoint: `curl https://sentientengine.ai/api/health`

### Phase 6: Deploy Development Environment
**Duration:** 10 minutes
**Risk:** Low (production already working)

```bash
# 1. Build development images
docker compose --profile development build

# 2. Start development services
docker compose --profile development up -d

# 3. Verify both environments running
docker compose ps
```

### Phase 7: Testing & Validation
**Duration:** 20 minutes
**Risk:** Low

**Production Tests:**
- Access https://sentientengine.ai
- Login with admin account
- View dashboard
- Check device list (should be empty, ready for Teensy registration)
- Verify scene executor WebSocket connection

**Development Tests:**
- Access http://localhost:4002
- Login with admin account
- Verify separate database (sentient_dev)
- Test hot-reload (edit a file, watch auto-restart)
- Verify debug ports accessible (9229-9231)

**Isolation Tests:**
- Prod and dev services cannot access each other's networks
- Prod uses sentient database, dev uses sentient_dev database
- No port conflicts
- Separate Grafana instances with separate data

### Phase 8: Update Scripts & Documentation
**Duration:** 15 minutes
**Risk:** Low

**Scripts to Update:**
1. `scripts/start-production.sh` → use `--profile production`
2. `scripts/start-development.sh` → use `--profile development`
3. `scripts/start-all.sh` → NEW, starts both profiles
4. `scripts/stop-production.sh` → use `--profile production`
5. `scripts/stop-development.sh` → NEW
6. `scripts/health-check.sh` → check both environments

**Documentation to Update:**
1. `SYSTEM_ARCHITECTURE.md` → dual-environment architecture
2. `DOCKER_DEPLOYMENT.md` → new deployment procedures
3. `README.md` → quick reference for both environments
4. `CLAUDE.md` → development guidelines update

---

## Rollback Plan

If something goes wrong during implementation:

### Quick Rollback (Emergency)
```bash
# 1. Stop new services
docker compose down

# 2. Restore old configuration
cp docker-compose.yml.backup docker-compose.yml
cp docker-compose.dev.yml.backup docker-compose.dev.yml
cp .env.backup .env

# 3. Start with old configuration
docker compose up -d

# 4. Verify services
docker compose ps
```

### Data Rollback
- PostgreSQL data is unchanged (both databases still exist)
- If needed, can drop `sentient` production database
- Development database `sentient_dev` remains intact

---

## Risk Mitigation

### Before Starting
- [ ] Notify users of planned maintenance window
- [ ] Ensure no active escape room sessions
- [ ] Backup all configuration files
- [ ] Document current service state
- [ ] Have rollback plan ready

### During Implementation
- [ ] Monitor logs continuously
- [ ] Check health endpoints after each phase
- [ ] Test production before starting development
- [ ] Keep backup files accessible

### After Completion
- [ ] Full system test (production)
- [ ] Full system test (development)
- [ ] Monitor for 24 hours
- [ ] Document any issues encountered

---

## Success Criteria

✅ **Production Environment:**
- All services healthy and accessible via sentientengine.ai
- Using `sentient` database with production credentials
- Optimized Docker images (multi-stage builds)
- No debug ports exposed
- Services run with NODE_ENV=production

✅ **Development Environment:**
- All services healthy and accessible via localhost
- Using `sentient_dev` database with development credentials
- Development Docker images with hot-reload
- Debug ports exposed (9229-9231)
- Services run with NODE_ENV=development

✅ **Isolation:**
- Separate Docker networks (no cross-talk)
- Separate databases (no data mixing)
- Separate ports (no conflicts)
- Independent start/stop via profiles

✅ **Operations:**
- Can start/stop prod and dev independently
- Scripts work correctly for both environments
- Documentation updated and accurate
- Team understands new workflow

---

## Estimated Downtime

**Total Production Downtime:** ~25 minutes
- Backup: 5 min
- Stop services: 2 min
- Deploy new config: 10 min
- Verify production: 8 min

**Note:** Development deployment can happen after production is back online (no additional downtime).

---

## Next Steps

**BEFORE PROCEEDING:**
1. Review this entire plan
2. Schedule maintenance window
3. Notify stakeholders
4. Confirm no active sessions
5. Get explicit approval to proceed

**APPROVAL REQUIRED:**
- [ ] User has reviewed the plan
- [ ] Maintenance window scheduled
- [ ] Backup strategy confirmed
- [ ] Rollback plan understood
- [ ] Ready to proceed with implementation

---

**Do you approve this implementation plan and want me to proceed?**
