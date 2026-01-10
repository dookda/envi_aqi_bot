"""
Script to add new Air4Thai columns and load mockup data

This script:
1. Adds new columns to aqi_hourly table (PM10, O3, CO, NO2, SO2, WS, WD, TEMP, RH, BP, RAIN)
2. Loads sample mockup data from Air4Thai API structure

Run with: python -m backend_api.scripts.add_air4thai_columns
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import text
from backend_model.database import get_db_context, engine
from backend_model.logger import logger


# Sample mockup data mimicking Air4Thai API response
MOCKUP_DATA = [
    {"DATETIMEDATA": "2026-01-09 00:00:00", "PM25": 27.4, "PM10": 53, "O3": 22, "CO": 1.79, "NO2": 6, "SO2": 2, "WS": 0, "WD": 73, "TEMP": 19, "RH": 76, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 01:00:00", "PM25": 27.6, "PM10": 48, "O3": 18, "CO": 1.77, "NO2": 6, "SO2": 2, "WS": 0, "WD": 89, "TEMP": 18, "RH": 82, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 02:00:00", "PM25": 27.3, "PM10": 45, "O3": 17, "CO": 1.68, "NO2": 7, "SO2": 2, "WS": 0, "WD": 18, "TEMP": 17, "RH": 81, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 03:00:00", "PM25": 25.8, "PM10": 37, "O3": 16, "CO": 1.64, "NO2": 6, "SO2": 2, "WS": 0, "WD": 30, "TEMP": 16, "RH": 85, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 04:00:00", "PM25": 25.8, "PM10": 33, "O3": 12, "CO": 1.64, "NO2": 8, "SO2": 2, "WS": 0, "WD": 336, "TEMP": 16, "RH": 88, "BP": 759, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 05:00:00", "PM25": 25.4, "PM10": 30, "O3": 14, "CO": 1.63, "NO2": 7, "SO2": 2, "WS": 1, "WD": 346, "TEMP": 16, "RH": 88, "BP": 759, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 06:00:00", "PM25": 25.8, "PM10": 31, "O3": 13, "CO": 1.69, "NO2": 6, "SO2": 2, "WS": 0, "WD": 208, "TEMP": 15, "RH": 90, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 07:00:00", "PM25": 24.7, "PM10": 33, "O3": 11, "CO": 1.75, "NO2": 6, "SO2": 2, "WS": 0, "WD": 207, "TEMP": 14, "RH": 93, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 08:00:00", "PM25": 23.4, "PM10": 39, "O3": 14, "CO": 1.73, "NO2": 9, "SO2": 2, "WS": 0, "WD": 197, "TEMP": 15, "RH": 89, "BP": 761, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 09:00:00", "PM25": 23.6, "PM10": 43, "O3": 12, "CO": 1.72, "NO2": 7, "SO2": 2, "WS": 1, "WD": 302, "TEMP": 20, "RH": 59, "BP": 761, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 10:00:00", "PM25": 23.7, "PM10": 44, "O3": 6, "CO": 1.76, "NO2": 5, "SO2": 2, "WS": 1, "WD": 220, "TEMP": 22, "RH": 49, "BP": 761, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 11:00:00", "PM25": 18.0, "PM10": 35, "O3": 6, "CO": 1.77, "NO2": 3, "SO2": 2, "WS": 2, "WD": 212, "TEMP": 23, "RH": 46, "BP": 761, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 12:00:00", "PM25": 15.5, "PM10": 30, "O3": 6, "CO": 1.78, "NO2": 3, "SO2": 2, "WS": 2, "WD": 227, "TEMP": 24, "RH": 43, "BP": 761, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 13:00:00", "PM25": 10.5, "PM10": 22, "O3": 6, "CO": 1.75, "NO2": 3, "SO2": 2, "WS": 1, "WD": 241, "TEMP": 26, "RH": 38, "BP": 760, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 14:00:00", "PM25": 16.1, "PM10": 21, "O3": 8, "CO": 1.79, "NO2": 3, "SO2": 2, "WS": 2, "WD": 291, "TEMP": 27, "RH": 34, "BP": 758, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 15:00:00", "PM25": 18.2, "PM10": 25, "O3": 8, "CO": 1.79, "NO2": 3, "SO2": 2, "WS": 2, "WD": 280, "TEMP": 28, "RH": 31, "BP": 758, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 16:00:00", "PM25": 18.3, "PM10": 28, "O3": 6, "CO": 1.77, "NO2": 3, "SO2": 2, "WS": 1, "WD": 240, "TEMP": 27, "RH": 33, "BP": 757, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 17:00:00", "PM25": 18.4, "PM10": 30, "O3": 7, "CO": 1.76, "NO2": 3, "SO2": 2, "WS": 1, "WD": 268, "TEMP": 27, "RH": 33, "BP": 757, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 18:00:00", "PM25": 17.2, "PM10": 33, "O3": 8, "CO": 1.87, "NO2": 5, "SO2": 2, "WS": 1, "WD": 271, "TEMP": 26, "RH": 39, "BP": 757, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 19:00:00", "PM25": 17.3, "PM10": 34, "O3": 9, "CO": 1.95, "NO2": 13, "SO2": 2, "WS": 1, "WD": 3, "TEMP": 23, "RH": 54, "BP": 758, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 20:00:00", "PM25": 23.6, "PM10": 51, "O3": 24, "CO": 1.95, "NO2": 15, "SO2": 2, "WS": 1, "WD": 12, "TEMP": 21, "RH": 65, "BP": 758, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 21:00:00", "PM25": 27.7, "PM10": 58, "O3": 20, "CO": 1.97, "NO2": 12, "SO2": 2, "WS": 0, "WD": 338, "TEMP": 19, "RH": 76, "BP": 758, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 22:00:00", "PM25": 29.2, "PM10": 66, "O3": 13, "CO": 2.0, "NO2": 13, "SO2": 2, "WS": 0, "WD": 129, "TEMP": 19, "RH": 85, "BP": 759, "RAIN": 0},
    {"DATETIMEDATA": "2026-01-09 23:00:00", "PM25": 35.8, "PM10": 65, "O3": 16, "CO": 1.92, "NO2": 9, "SO2": 2, "WS": 0, "WD": 128, "TEMP": 18, "RH": 86, "BP": 759, "RAIN": 0},
]


def add_columns_if_not_exist():
    """Add new columns to aqi_hourly and imputation_log tables for full gap-fill support"""
    
    # Pollutant and weather columns
    aqi_columns = [
        ("pm10", "FLOAT"),
        ("o3", "FLOAT"),
        ("co", "FLOAT"),
        ("no2", "FLOAT"),
        ("so2", "FLOAT"),
        ("ws", "FLOAT"),
        ("wd", "FLOAT"),
        ("temp", "FLOAT"),
        ("rh", "FLOAT"),
        ("bp", "FLOAT"),
        ("rain", "FLOAT"),
        # Per-parameter imputation flags
        ("pm25_imputed", "BOOLEAN DEFAULT FALSE"),
        ("pm10_imputed", "BOOLEAN DEFAULT FALSE"),
        ("o3_imputed", "BOOLEAN DEFAULT FALSE"),
        ("co_imputed", "BOOLEAN DEFAULT FALSE"),
        ("no2_imputed", "BOOLEAN DEFAULT FALSE"),
        ("so2_imputed", "BOOLEAN DEFAULT FALSE"),
        ("ws_imputed", "BOOLEAN DEFAULT FALSE"),
        ("wd_imputed", "BOOLEAN DEFAULT FALSE"),
        ("temp_imputed", "BOOLEAN DEFAULT FALSE"),
        ("rh_imputed", "BOOLEAN DEFAULT FALSE"),
        ("bp_imputed", "BOOLEAN DEFAULT FALSE"),
        ("rain_imputed", "BOOLEAN DEFAULT FALSE"),
    ]
    
    # ImputationLog columns for multi-parameter support
    imputation_log_columns = [
        ("parameter", "VARCHAR DEFAULT 'pm25'"),
        ("original_value", "FLOAT"),
        ("imputation_method", "VARCHAR DEFAULT 'lstm'"),
        ("confidence_score", "FLOAT"),
    ]
    
    with get_db_context() as db:
        # Check which columns already exist in aqi_hourly
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'aqi_hourly'
        """))
        existing_aqi_columns = {row[0] for row in result}
        
        logger.info(f"Existing aqi_hourly columns: {len(existing_aqi_columns)}")
        
        # Add missing aqi_hourly columns
        for col_name, col_type in aqi_columns:
            if col_name not in existing_aqi_columns:
                logger.info(f"Adding aqi_hourly column: {col_name}")
                db.execute(text(f"ALTER TABLE aqi_hourly ADD COLUMN {col_name} {col_type}"))
            else:
                logger.info(f"Column {col_name} already exists")
        
        # Check imputation_log columns
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'imputation_log'
        """))
        existing_imputation_columns = {row[0] for row in result}
        
        logger.info(f"Existing imputation_log columns: {len(existing_imputation_columns)}")
        
        # Add missing imputation_log columns
        for col_name, col_type in imputation_log_columns:
            if col_name not in existing_imputation_columns:
                logger.info(f"Adding imputation_log column: {col_name}")
                db.execute(text(f"ALTER TABLE imputation_log ADD COLUMN {col_name} {col_type}"))
            else:
                logger.info(f"Column {col_name} already exists")
        
        db.commit()
        logger.info("Column migration completed!")


def insert_mockup_data(station_id: str = "95t"):
    """Insert mockup data for testing"""
    
    with get_db_context() as db:
        # Ensure station exists
        result = db.execute(text(
            "SELECT station_id FROM stations WHERE station_id = :sid"
        ), {"sid": station_id})
        
        if not result.fetchone():
            logger.warning(f"Station {station_id} not found, creating it...")
            db.execute(text("""
                INSERT INTO stations (station_id, name_th, name_en, lat, lon, station_type)
                VALUES (:sid, 'กรมควบคุมมลพิษ', 'PCD Headquarters', 13.7612, 100.5677, 'general')
                ON CONFLICT (station_id) DO NOTHING
            """), {"sid": station_id})
        
        # Insert mockup data
        for record in MOCKUP_DATA:
            dt = datetime.strptime(record["DATETIMEDATA"], "%Y-%m-%d %H:%M:%S")
            
            db.execute(text("""
                INSERT INTO aqi_hourly (
                    station_id, datetime, 
                    pm25, pm10, o3, co, no2, so2,
                    ws, wd, temp, rh, bp, rain,
                    is_imputed, created_at
                ) VALUES (
                    :station_id, :datetime,
                    :pm25, :pm10, :o3, :co, :no2, :so2,
                    :ws, :wd, :temp, :rh, :bp, :rain,
                    false, NOW()
                )
                ON CONFLICT (station_id, datetime) DO UPDATE SET
                    pm25 = EXCLUDED.pm25,
                    pm10 = EXCLUDED.pm10,
                    o3 = EXCLUDED.o3,
                    co = EXCLUDED.co,
                    no2 = EXCLUDED.no2,
                    so2 = EXCLUDED.so2,
                    ws = EXCLUDED.ws,
                    wd = EXCLUDED.wd,
                    temp = EXCLUDED.temp,
                    rh = EXCLUDED.rh,
                    bp = EXCLUDED.bp,
                    rain = EXCLUDED.rain
            """), {
                "station_id": station_id,
                "datetime": dt,
                "pm25": record.get("PM25"),
                "pm10": record.get("PM10"),
                "o3": record.get("O3"),
                "co": record.get("CO"),
                "no2": record.get("NO2"),
                "so2": record.get("SO2"),
                "ws": record.get("WS"),
                "wd": record.get("WD"),
                "temp": record.get("TEMP"),
                "rh": record.get("RH"),
                "bp": record.get("BP"),
                "rain": record.get("RAIN"),
            })
        
        db.commit()
        logger.info(f"Inserted {len(MOCKUP_DATA)} mockup records for station {station_id}")


def verify_data(station_id: str = "95t"):
    """Verify the inserted data"""
    
    with get_db_context() as db:
        result = db.execute(text("""
            SELECT datetime, pm25, pm10, o3, co, no2, so2, ws, wd, temp, rh, bp, rain
            FROM aqi_hourly
            WHERE station_id = :sid
            ORDER BY datetime DESC
            LIMIT 5
        """), {"sid": station_id})
        
        rows = result.fetchall()
        if rows:
            logger.info(f"\n=== Sample data for station {station_id} ===")
            for row in rows:
                logger.info(f"  {row[0]}: PM2.5={row[1]}, PM10={row[2]}, O3={row[3]}, CO={row[4]}, NO2={row[5]}, SO2={row[6]}")
                logger.info(f"           WS={row[7]}, WD={row[8]}, TEMP={row[9]}°C, RH={row[10]}%, BP={row[11]}, RAIN={row[12]}")
        else:
            logger.warning(f"No data found for station {station_id}")


def main():
    """Run the migration and insert mockup data"""
    logger.info("=" * 60)
    logger.info("Air4Thai Full Parameters Migration")
    logger.info("=" * 60)
    
    # Step 1: Add columns
    logger.info("\n[Step 1] Adding new columns to aqi_hourly table...")
    add_columns_if_not_exist()
    
    # Step 2: Insert mockup data
    logger.info("\n[Step 2] Inserting mockup data...")
    insert_mockup_data()
    
    # Step 3: Verify
    logger.info("\n[Step 3] Verifying data...")
    verify_data()
    
    logger.info("\n" + "=" * 60)
    logger.info("Migration completed successfully!")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
