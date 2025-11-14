# Archived Services

**Archive Date:** November 14, 2025  
**Reason:** Services deprecated during development environment modernization

## Archived Services

### scs-bridge

- **Purpose:** MQTT to OSC bridge for Show Cue Systems
- **Status:** Not integrated into current Docker architecture
- **Reason:** Not actively used, no clear integration path

### effects-controller

- **Purpose:** Effects coordination service
- **Status:** Not integrated into current Docker architecture
- **Reason:** Not actively used, functionality may be merged into executor-engine if needed

### api-gateway

- **Purpose:** API gateway service
- **Status:** Not integrated into current Docker architecture
- **Reason:** Redundant with Nginx reverse proxy

### dashboard

- **Purpose:** Next.js dashboard application
- **Status:** Fully replaced by sentient-web (Vite + React)
- **Migration:** Completed October 27, 2025
- **Reason:** Vite provides superior development experience and resolved caching issues

### sentient-web-backup-20251027_082036

- **Purpose:** Backup of sentient-web before Vite migration
- **Status:** Historical backup
- **Reason:** Migration successful, backup no longer needed for rollback

## Restoration

If any archived service needs to be restored:

1. Move service directory back to `services/`
2. Review and update dependencies
3. Add to `docker-compose.yml` with appropriate profile
4. Update documentation

## Deletion Policy

These archived services may be permanently deleted after 90 days (February 12, 2026) if no restoration is requested.
