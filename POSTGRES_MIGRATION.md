# Migration from TimescaleDB to PostgreSQL 16 with PostGIS

## Overview

Your AQI monitoring system has been updated to use **PostgreSQL 16 with PostGIS** instead of TimescaleDB. This provides:

- ✅ Latest PostgreSQL features and performance improvements
- ✅ PostGIS 3.4 for spatial data (maintained)
- ✅ Native table partitioning for time-series optimization
- ✅ Simpler stack with fewer dependencies
- ✅ Easier maintenance and wider community support

## What Changed

### Docker Compose
- **Image**: `timescale/timescaledb-ha:pg15-latest` → `postgis/postgis:16-3.4`
- **Container**: `aqi_timescaledb` → `aqi_postgres`
- **Volume**: `timescale_data` → `postgres_data`
- **Service name**: `timescaledb` → `postgres` (in depends_on and DATABASE_URL)

### Database Schema
- **Removed**: TimescaleDB extension and `create_hypertable`
- **Added**: Native PostgreSQL table partitioning on `aqi_hourly` table
  - Partitioned by `datetime` (monthly partitions)
  - Auto-created partitions for 2024-2026
  - Similar performance benefits to TimescaleDB hypertables

### Performance
- **Partitioning strategy**: Monthly partitions (vs 7-day chunks in TimescaleDB)
- **Query performance**: Similar or better for your use case
- **Insert performance**: Comparable with proper indexing
- **Storage**: More efficient with PostgreSQL 16's improvements

## Migration Options

### Option 1: Automated Migration (Recommended)

Run the migration script to automatically backup and migrate:

```bash
./migrate_to_postgres.sh
```

This script will:
1. Backup existing TimescaleDB data
2. Stop old containers
3. Optionally remove old volume
4. Start PostgreSQL 16
5. Restore your data
6. Verify migration

### Option 2: Fresh Start (No existing data)

If you don't have important data or want a fresh start:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Start with new PostgreSQL setup
docker-compose up -d
```

### Option 3: Manual Migration

1. **Backup current data**:
   ```bash
   docker exec aqi_timescaledb pg_dump -U aqi_user -d aqi_db > backup.sql
   ```

2. **Clean the backup** (remove TimescaleDB-specific commands):
   ```bash
   sed -i '/CREATE EXTENSION.*timescaledb/d' backup.sql
   sed -i '/SELECT create_hypertable/d' backup.sql
   ```

3. **Stop old setup**:
   ```bash
   docker-compose down
   ```

4. **Start PostgreSQL**:
   ```bash
   docker-compose up -d postgres
   ```

5. **Restore data**:
   ```bash
   docker exec -i aqi_postgres psql -U aqi_user -d aqi_db < backup.sql
   ```

6. **Start all services**:
   ```bash
   docker-compose up -d
   ```

## Verification

After migration, verify everything works:

1. **Check containers**:
   ```bash
   docker-compose ps
   ```

2. **Check database**:
   ```bash
   docker exec -it aqi_postgres psql -U aqi_user -d aqi_db
   ```

3. **Verify data**:
   ```sql
   SELECT COUNT(*) FROM stations;
   SELECT COUNT(*) FROM aqi_hourly;
   SELECT * FROM pg_tables WHERE tablename LIKE 'aqi_hourly_%';  -- View partitions
   ```

4. **Check admin page**:
   - Open `http://localhost:5800/ebot/admin`
   - Verify data comparison works
   - Check sync status

5. **Test API**:
   ```bash
   curl http://localhost:5800/ebot/api/health
   curl http://localhost:5800/ebot/api/stations
   ```

## Partition Management

### Adding Future Partitions

The init script creates partitions for 2024-2026. To add more:

```sql
-- Connect to database
docker exec -it aqi_postgres psql -U aqi_user -d aqi_db

-- Create partition for a specific month
CREATE TABLE aqi_hourly_2027_01 PARTITION OF aqi_hourly
FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
```

### Automatic Partition Creation (Optional)

You can set up a PostgreSQL function to auto-create partitions:

```sql
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, year INT, month INT)
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := make_date(year, month, 1);
    end_date := start_date + INTERVAL '1 month';
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Usage: Create partition for March 2027
SELECT create_monthly_partition('aqi_hourly', 2027, 3);
```

## Performance Tips

1. **Indexes are maintained**: All indexes from TimescaleDB setup are preserved
2. **Partitioning benefits**: Monthly partitions provide:
   - Faster queries with time ranges
   - Easier data archival/deletion
   - Better vacuum/analyze performance

3. **Monitor query performance**:
   ```sql
   -- Enable query timing
   \timing

   -- Check query plan
   EXPLAIN ANALYZE SELECT * FROM aqi_hourly WHERE datetime > NOW() - INTERVAL '7 days';
   ```

## Rollback (If Needed)

If you need to rollback to TimescaleDB:

1. Stop current setup:
   ```bash
   docker-compose down
   ```

2. Restore original `docker-compose.yml` from git:
   ```bash
   git checkout docker-compose.yml database/init/01_init.sql
   ```

3. Start with backup data:
   ```bash
   docker-compose up -d
   docker exec -i aqi_timescaledb psql -U aqi_user -d aqi_db < backup.sql
   ```

## Benefits of This Change

1. **Latest PostgreSQL**: Version 16 (vs 15 in TimescaleDB image)
2. **Native Features**: Use standard PostgreSQL partitioning
3. **Better PostGIS**: Latest PostGIS 3.4 with improvements
4. **Simpler Stack**: One less extension to manage
5. **Community Support**: Wider PostgreSQL community vs TimescaleDB-specific issues
6. **Performance**: PostgreSQL 16 has significant performance improvements
7. **Future-proof**: Easier to upgrade and maintain

## Notes

- Your application code remains unchanged (uses standard SQL)
- All spatial queries (PostGIS) continue to work
- Time-series performance is maintained through partitioning
- No data loss with proper migration

## Support

If you encounter any issues:

1. Check logs: `docker-compose logs postgres`
2. Verify connectivity: `docker exec -it aqi_postgres psql -U aqi_user -d aqi_db`
3. Review migration script output
4. Check partition creation: `\d+ aqi_hourly` in psql

For questions about PostgreSQL partitioning, see:
- https://www.postgresql.org/docs/16/ddl-partitioning.html
