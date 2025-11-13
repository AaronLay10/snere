# PostgreSQL Initialization

## Overview

SQL scripts in this directory are automatically executed when the PostgreSQL container is first created, in alphabetical order.

## Initialization Scripts

1. `01-init-database.sql` - Creates extensions, schema version table, and basic functions
2. Add your schema files here (e.g., `02-schema.sql`, `03-seed-data.sql`)

## Important Notes

- Scripts only run on **first container creation** when data volume is empty
- To re-run initialization:
  ```bash
  docker-compose down -v  # Remove volumes
  docker-compose up -d postgres
  ```

## Adding Your Schema

### Option 1: Copy existing schema

If you have an existing schema file:

```bash
# Copy your schema.sql file
cp /path/to/your/schema.sql /opt/sentient/config/postgres/init/02-schema.sql

# Copy seed data if you have it
cp /path/to/your/seed.sql /opt/sentient/config/postgres/init/03-seed-data.sql
```

### Option 2: Import from existing database

```bash
# Export from existing PostgreSQL database
pg_dump -U sentient -d sentient --schema-only > /opt/sentient/config/postgres/init/02-schema.sql
pg_dump -U sentient -d sentient --data-only > /opt/sentient/config/postgres/init/03-seed-data.sql
```

### Option 3: Apply migrations

If you have migration files:

```bash
# Copy all migration files
cp /path/to/migrations/*.sql /opt/sentient/config/postgres/init/

# Rename them to ensure proper order
cd /opt/sentient/config/postgres/init/
for i in 0*.sql; do mv "$i" "migration_$i"; done
```

## Manual Schema Application

If you need to apply schema after container is running:

```bash
# Copy SQL file into running container
docker cp /path/to/schema.sql sentient-postgres:/tmp/schema.sql

# Execute it
docker-compose exec postgres psql -U sentient_prod -d sentient -f /tmp/schema.sql
```

## Database Access

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U sentient_prod -d sentient

# Run query from host
docker-compose exec postgres psql -U sentient_prod -d sentient -c "SELECT version();"

# Backup database
docker-compose exec postgres pg_dump -U sentient_prod sentient > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U sentient_prod -d sentient
```

## Environment Variables

Database connection parameters are defined in `.env.production`:

- `POSTGRES_DB` - Database name (default: sentient)
- `POSTGRES_USER` - Database user (default: sentient_prod)
- `POSTGRES_PASSWORD` - Database password (REQUIRED)

## Migrations

For production systems, consider using a migration tool like:
- node-pg-migrate
- Flyway
- Liquibase

This ensures controlled, versioned schema changes.