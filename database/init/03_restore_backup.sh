#!/bin/bash
# 03_restore_backup.sh - Restore database from backup on docker init
#
# This script runs automatically when the postgres container initializes
# (only on first startup when volume is empty).
#
# It restores data from the backup file if it exists, giving you a
# pre-populated database instead of starting empty.

set -e

BACKUP_FILE="/backup/backup_data.sql"

echo "=== Checking for database backup ==="

if [ -f "${BACKUP_FILE}" ]; then
    FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "Found backup file: ${BACKUP_FILE} (${FILE_SIZE})"
    echo "Restoring database from backup..."

    # Restore the backup data
    # Using PGPASSWORD to avoid password prompt
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -f "${BACKUP_FILE}" \
        --quiet \
        2>&1 | grep -v "^$" || true

    # Verify restore
    STATION_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -t -c "SELECT COUNT(*) FROM stations;" | tr -d ' ')

    AQI_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -t -c "SELECT COUNT(*) FROM aqi_hourly;" | tr -d ' ')

    echo ""
    echo "=== Backup restore completed ==="
    echo "  - Stations restored: ${STATION_COUNT}"
    echo "  - AQI records restored: ${AQI_COUNT}"
    echo ""
    echo "Note: The scheduler will still download new data after startup"
else
    echo "No backup file found at ${BACKUP_FILE}"
    echo "Database will start empty. The scheduler will download initial data."
    echo ""
    echo "To use a backup next time:"
    echo "  1. Run: ./backup_database.sh (while containers are running)"
    echo "  2. Then: docker compose down -v && docker compose up"
fi

echo "=== Database initialization complete ==="
