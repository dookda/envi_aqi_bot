-- Drop backup if parent needs to be recreated
DROP TABLE IF EXISTS aqi_hourly CASCADE;

-- Recreate the parent table with all columns including nox
CREATE TABLE aqi_hourly (
    station_id TEXT NOT NULL,
    datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    pm25 DOUBLE PRECISION,
    pm10 DOUBLE PRECISION,
    o3 DOUBLE PRECISION,
    co DOUBLE PRECISION,
    no2 DOUBLE PRECISION,
    so2 DOUBLE PRECISION,
    nox DOUBLE PRECISION,
    ws DOUBLE PRECISION,
    wd DOUBLE PRECISION,
    temp DOUBLE PRECISION,
    rh DOUBLE PRECISION,
    bp DOUBLE PRECISION,
    rain DOUBLE PRECISION,
    is_imputed BOOLEAN DEFAULT FALSE,
    pm25_imputed BOOLEAN DEFAULT FALSE,
    pm10_imputed BOOLEAN DEFAULT FALSE,
    o3_imputed BOOLEAN DEFAULT FALSE,
    co_imputed BOOLEAN DEFAULT FALSE,
    no2_imputed BOOLEAN DEFAULT FALSE,
    so2_imputed BOOLEAN DEFAULT FALSE,
    nox_imputed BOOLEAN DEFAULT FALSE,
    ws_imputed BOOLEAN DEFAULT FALSE,
    wd_imputed BOOLEAN DEFAULT FALSE,
    temp_imputed BOOLEAN DEFAULT FALSE,
    rh_imputed BOOLEAN DEFAULT FALSE,
    bp_imputed BOOLEAN DEFAULT FALSE,
    rain_imputed BOOLEAN DEFAULT FALSE,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (station_id, datetime)
) PARTITION BY RANGE (datetime);

-- Create partitions for 2024-2026
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR year IN 2024..2026 LOOP
        FOR month IN 1..12 LOOP
            start_date := make_date(year, month, 1);
            end_date := start_date + INTERVAL '1 month';
            partition_name := 'aqi_hourly_' || to_char(start_date, 'YYYY_MM');
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF aqi_hourly
                FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
        END LOOP;
    END LOOP;
END $$;

-- Restore data from backup if it exists
INSERT INTO aqi_hourly (station_id, datetime, pm25, pm10, o3, co, no2, so2, ws, wd, temp, rh, bp, rain, is_imputed, pm25_imputed, pm10_imputed, o3_imputed, co_imputed, no2_imputed, so2_imputed, ws_imputed, wd_imputed, temp_imputed, rh_imputed, bp_imputed, rain_imputed, model_version, created_at)
SELECT station_id, datetime, pm25, pm10, o3, co, no2, so2, ws, wd, temp, rh, bp, rain, is_imputed, pm25_imputed, pm10_imputed, o3_imputed, co_imputed, no2_imputed, so2_imputed, ws_imputed, wd_imputed, temp_imputed, rh_imputed, bp_imputed, rain_imputed, model_version, created_at
FROM aqi_hourly_backup
ON CONFLICT (station_id, datetime) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_station ON aqi_hourly(station_id);
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_datetime ON aqi_hourly(datetime DESC);
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_imputed ON aqi_hourly(is_imputed) WHERE is_imputed = TRUE;

-- Drop backup table
DROP TABLE IF EXISTS aqi_hourly_backup;
