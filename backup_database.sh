#!/bin/bash
# backup_database.sh - Create a backup of the current AQI database
#
# Usage: ./backup_database.sh
#
# This script creates a data-only backup (INSERT statements) that can be
# restored on docker compose up. The backup excludes schema definitions
# since those are handled by the init SQL scripts.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/database/backup"
BACKUP_FILE="${BACKUP_DIR}/backup_data.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AQI Database Backup ===${NC}"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "aqi_postgres"; then
    echo -e "${RED}Error: aqi_postgres container is not running${NC}"
    echo "Start the containers first with: docker compose up -d"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create timestamped backup for safety
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TIMESTAMPED_BACKUP="${BACKUP_DIR}/backup_data_${TIMESTAMP}.sql"

echo -e "${YELLOW}Creating database backup...${NC}"

# Dump data only (--data-only) with INSERT statements (--column-inserts)
# This format works better with partitioned tables
docker exec aqi_postgres pg_dump \
    -U "${POSTGRES_USER:-aqi_user}" \
    -d "${POSTGRES_DB:-aqi_db}" \
    --data-only \
    --column-inserts \
    --disable-triggers \
    --no-owner \
    --no-privileges \
    -t stations \
    -t aqi_hourly \
    -t imputation_log \
    -t model_training_log \
    -t ingestion_log \
    > "${TIMESTAMPED_BACKUP}"

# Check if backup was successful
if [ $? -eq 0 ] && [ -s "${TIMESTAMPED_BACKUP}" ]; then
    # Copy to main backup file (this one will be used on restore)
    cp "${TIMESTAMPED_BACKUP}" "${BACKUP_FILE}"

    # Get some stats
    STATIONS=$(grep -c "INSERT INTO public.stations" "${BACKUP_FILE}" 2>/dev/null || echo "0")
    AQI_RECORDS=$(grep -c "INSERT INTO public.aqi_hourly" "${BACKUP_FILE}" 2>/dev/null || echo "0")
    FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo ""
    echo "Backup details:"
    echo "  - File: ${BACKUP_FILE}"
    echo "  - Size: ${FILE_SIZE}"
    echo "  - Stations: ${STATIONS}"
    echo "  - AQI records: ${AQI_RECORDS}"
    echo "  - Timestamped copy: ${TIMESTAMPED_BACKUP}"
    echo ""
    echo -e "${GREEN}This backup will be automatically restored on next 'docker compose up'${NC}"
    echo -e "${YELLOW}Note: The scheduler will still download new data after startup${NC}"
else
    echo -e "${RED}Backup failed or file is empty${NC}"
    rm -f "${TIMESTAMPED_BACKUP}"
    exit 1
fi
