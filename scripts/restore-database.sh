#!/bin/bash
# Sentient Engine - Database Restore Script

set -e

cd "$(dirname "$0")/.."

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/sentient_db_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=========================================="
echo "WARNING: This will replace the current database!"
echo "=========================================="
echo ""
read -p "Are you sure you want to restore from $BACKUP_FILE? (yes/NO): " -r
echo ""

if [ "$REPLY" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Restoring database from $BACKUP_FILE..."
echo ""

# Decompress and restore
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql -U sentient_prod -d sentient
else
    cat "$BACKUP_FILE" | docker-compose exec -T postgres psql -U sentient_prod -d sentient
fi

echo ""
echo "Database restored successfully!"