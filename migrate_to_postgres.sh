#!/bin/bash
# Migration script from TimescaleDB to PostgreSQL with PostGIS
# This script backs up existing data and migrates to standard PostgreSQL

set -e

echo "================================================"
echo "Migration from TimescaleDB to PostgreSQL 16"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if TimescaleDB container exists
if docker ps -a | grep -q aqi_timescaledb; then
    echo -e "${YELLOW}TimescaleDB container found. Proceeding with migration...${NC}"

    # Step 1: Backup existing data
    echo -e "\n${GREEN}Step 1: Backing up existing data...${NC}"
    BACKUP_FILE="backup_timescale_$(date +%Y%m%d_%H%M%S).sql"

    docker exec aqi_timescaledb pg_dump -U aqi_user -d aqi_db > "$BACKUP_FILE" 2>/dev/null || {
        echo -e "${YELLOW}No existing data to backup or TimescaleDB not running. Continuing...${NC}"
        BACKUP_FILE=""
    }

    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        echo -e "${GREEN}Backup created: $BACKUP_FILE${NC}"

        # Remove TimescaleDB-specific commands from backup
        echo -e "${GREEN}Cleaning backup file (removing TimescaleDB-specific commands)...${NC}"
        sed -i.bak '/CREATE EXTENSION.*timescaledb/d' "$BACKUP_FILE"
        sed -i.bak '/SELECT create_hypertable/d' "$BACKUP_FILE"
        echo -e "${GREEN}Backup cleaned successfully${NC}"
    fi

    # Step 2: Stop and remove old containers
    echo -e "\n${GREEN}Step 2: Stopping existing containers...${NC}"
    docker-compose down

    # Step 3: Remove old volume (optional - comment out to keep data)
    echo -e "\n${YELLOW}Step 3: Removing old TimescaleDB volume...${NC}"
    read -p "Do you want to remove the old TimescaleDB data volume? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume rm envi_aqi_bot_timescale_data 2>/dev/null || echo "Volume not found or already removed"
        echo -e "${GREEN}Old volume removed${NC}"
    else
        echo -e "${YELLOW}Keeping old volume (you can manually remove it later with: docker volume rm envi_aqi_bot_timescale_data)${NC}"
    fi
else
    echo -e "${GREEN}No existing TimescaleDB container found. Starting fresh...${NC}"
    BACKUP_FILE=""
fi

# Step 4: Start new PostgreSQL setup
echo -e "\n${GREEN}Step 4: Starting PostgreSQL 16 with PostGIS...${NC}"
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be healthy...${NC}"
sleep 10

# Step 5: Restore data if backup exists
if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo -e "\n${GREEN}Step 5: Restoring data to new PostgreSQL instance...${NC}"
    docker exec -i aqi_postgres psql -U aqi_user -d aqi_db < "$BACKUP_FILE"
    echo -e "${GREEN}Data restored successfully${NC}"

    # Verify data
    echo -e "\n${GREEN}Verifying data migration...${NC}"
    STATION_COUNT=$(docker exec aqi_postgres psql -U aqi_user -d aqi_db -t -c "SELECT COUNT(*) FROM stations;" | xargs)
    HOURLY_COUNT=$(docker exec aqi_postgres psql -U aqi_user -d aqi_db -t -c "SELECT COUNT(*) FROM aqi_hourly;" | xargs)

    echo -e "${GREEN}Stations: $STATION_COUNT${NC}"
    echo -e "${GREEN}Hourly records: $HOURLY_COUNT${NC}"
else
    echo -e "\n${YELLOW}No backup to restore. Database initialized with empty tables.${NC}"
fi

# Step 6: Start all services
echo -e "\n${GREEN}Step 6: Starting all services...${NC}"
docker-compose up -d

echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}Migration completed successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}Database Details:${NC}"
echo "  - Database: PostgreSQL 16.x with PostGIS 3.4"
echo "  - Container: aqi_postgres"
echo "  - Partitioning: Monthly partitions (2024-2026)"
echo ""

if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}Backup files saved:${NC}"
    echo "  - $BACKUP_FILE"
    echo "  - ${BACKUP_FILE}.bak (original with TimescaleDB commands)"
    echo ""
    echo -e "${YELLOW}You can safely delete these files once you've verified the migration.${NC}"
fi

echo -e "\n${GREEN}Next steps:${NC}"
echo "  1. Verify your application works correctly"
echo "  2. Check admin page for data status"
echo "  3. If everything works, you can remove old backups and volumes"
echo ""
echo -e "${GREEN}To view logs: docker-compose logs -f${NC}"
echo -e "${GREEN}To check database: docker exec -it aqi_postgres psql -U aqi_user -d aqi_db${NC}"
echo ""
