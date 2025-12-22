-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable PostGIS extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis CASCADE;

-- Stations table for storing station metadata
CREATE TABLE IF NOT EXISTS stations (
    station_id TEXT PRIMARY KEY,
    name_th TEXT,
    name_en TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    location GEOMETRY(POINT, 4326),  -- WGS84 coordinate system
    station_type TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AQI hourly measurements table
CREATE TABLE IF NOT EXISTS aqi_hourly (
    station_id TEXT REFERENCES stations(station_id) ON DELETE CASCADE,
    datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    pm25 DOUBLE PRECISION,
    is_imputed BOOLEAN DEFAULT FALSE,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (station_id, datetime)
);

-- Convert aqi_hourly to TimescaleDB hypertable
SELECT create_hypertable('aqi_hourly', 'datetime', 
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Imputation log table for auditability
CREATE TABLE IF NOT EXISTS imputation_log (
    id SERIAL PRIMARY KEY,
    station_id TEXT REFERENCES stations(station_id) ON DELETE CASCADE,
    datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    imputed_value DOUBLE PRECISION NOT NULL,
    input_window_start TIMESTAMP NOT NULL,
    input_window_end TIMESTAMP NOT NULL,
    model_version TEXT NOT NULL,
    rmse_score DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Model training log table
CREATE TABLE IF NOT EXISTS model_training_log (
    id SERIAL PRIMARY KEY,
    station_id TEXT REFERENCES stations(station_id) ON DELETE CASCADE,
    model_version TEXT NOT NULL,
    training_samples INTEGER,
    validation_samples INTEGER,
    train_rmse DOUBLE PRECISION,
    val_rmse DOUBLE PRECISION,
    train_mae DOUBLE PRECISION,
    val_mae DOUBLE PRECISION,
    epochs_completed INTEGER,
    training_duration_seconds DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ingestion run log for tracking batch/hourly ingestion
CREATE TABLE IF NOT EXISTS ingestion_log (
    id SERIAL PRIMARY KEY,
    run_type TEXT NOT NULL CHECK (run_type IN ('batch', 'hourly')),
    station_id TEXT,
    start_date DATE,
    end_date DATE,
    records_fetched INTEGER,
    records_inserted INTEGER,
    missing_detected INTEGER,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_station ON aqi_hourly(station_id);
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_datetime ON aqi_hourly(datetime DESC);
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_imputed ON aqi_hourly(is_imputed) WHERE is_imputed = TRUE;
CREATE INDEX IF NOT EXISTS idx_imputation_log_station ON imputation_log(station_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON ingestion_log(status);

-- Spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST(location);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for stations table updated_at
CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update geometry from lat/lon
CREATE OR REPLACE FUNCTION update_station_location()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL) THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update location when lat/lon changes
CREATE TRIGGER trigger_update_station_location
    BEFORE INSERT OR UPDATE OF lat, lon ON stations
    FOR EACH ROW
    EXECUTE FUNCTION update_station_location();

-- View for missing data summary
CREATE OR REPLACE VIEW missing_data_summary AS
SELECT 
    station_id,
    COUNT(*) FILTER (WHERE pm25 IS NULL) as missing_count,
    COUNT(*) FILTER (WHERE pm25 IS NOT NULL) as present_count,
    COUNT(*) as total_count,
    ROUND(
        (COUNT(*) FILTER (WHERE pm25 IS NULL)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2
    ) as missing_percentage
FROM aqi_hourly
GROUP BY station_id;

-- View for station completeness
CREATE OR REPLACE VIEW station_data_completeness AS
SELECT 
    s.station_id,
    s.name_en,
    s.name_th,
    s.station_type,
    COALESCE(mds.total_count, 0) as total_records,
    COALESCE(mds.missing_count, 0) as missing_records,
    COALESCE(mds.present_count, 0) as present_records,
    COALESCE(mds.missing_percentage, 0) as missing_percentage,
    COUNT(*) FILTER (WHERE ah.is_imputed = TRUE) as imputed_records
FROM stations s
LEFT JOIN missing_data_summary mds ON s.station_id = mds.station_id
LEFT JOIN aqi_hourly ah ON s.station_id = ah.station_id
GROUP BY s.station_id, s.name_en, s.name_th, s.station_type,
         mds.total_count, mds.missing_count, mds.present_count, mds.missing_percentage;
