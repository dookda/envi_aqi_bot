-- Migration: Add all Air4Thai parameters to aqi_hourly table
-- This brings the schema in sync with the SQLAlchemy models

-- =============================================
-- Add new pollutant measurement columns
-- =============================================
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS pm10 DOUBLE PRECISION;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS o3 DOUBLE PRECISION;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS co DOUBLE PRECISION;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS no2 DOUBLE PRECISION;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS so2 DOUBLE PRECISION;

-- =============================================
-- Add weather/meteorological columns
-- =============================================
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS ws DOUBLE PRECISION;   -- Wind Speed (m/s)
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS wd DOUBLE PRECISION;   -- Wind Direction (degrees)
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS temp DOUBLE PRECISION; -- Temperature (°C)
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS rh DOUBLE PRECISION;   -- Relative Humidity (%)
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS bp DOUBLE PRECISION;   -- Barometric Pressure (mmHg)
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS rain DOUBLE PRECISION; -- Rainfall (mm)

-- =============================================
-- Add per-parameter imputation flags
-- =============================================
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS pm25_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS pm10_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS o3_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS co_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS no2_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS so2_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS ws_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS wd_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS temp_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS rh_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS bp_imputed BOOLEAN DEFAULT FALSE;
ALTER TABLE aqi_hourly ADD COLUMN IF NOT EXISTS rain_imputed BOOLEAN DEFAULT FALSE;

-- =============================================
-- Update imputation_log table for multi-parameter support
-- =============================================
ALTER TABLE imputation_log ADD COLUMN IF NOT EXISTS parameter TEXT DEFAULT 'pm25';
ALTER TABLE imputation_log ADD COLUMN IF NOT EXISTS original_value DOUBLE PRECISION;
ALTER TABLE imputation_log ADD COLUMN IF NOT EXISTS imputation_method TEXT DEFAULT 'lstm';
ALTER TABLE imputation_log ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION;

-- =============================================
-- Create indexes for new columns
-- =============================================
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_pm10 ON aqi_hourly(pm10) WHERE pm10 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_o3 ON aqi_hourly(o3) WHERE o3 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aqi_hourly_temp ON aqi_hourly(temp) WHERE temp IS NOT NULL;

-- Confirmation message
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: All Air4Thai parameters added to aqi_hourly table';
END $$;
