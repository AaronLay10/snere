#!/bin/bash
# Sentient Engine - Database Backup Script

set -e

cd "$(dirname "$0")/.."

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/sentient_db_${TIMESTAMP}.sql"

echo "Creating database backup..."
echo "Backup file: $BACKUP_FILE"
echo ""

# Create backup
docker-compose exec -T postgres pg_dump -U sentient_prod sentient > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "Backup completed: ${BACKUP_FILE}.gz"
echo ""

# Keep only last 7 days of backups
echo "Cleaning up old backups (keeping last 7 days)..."
find backups/ -name "sentient_db_*.sql.gz" -mtime +7 -delete

echo "Backup process complete!"