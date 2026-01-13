-- Insert test stations with location data
-- Run this before uploading the AQI data CSV

INSERT INTO stations (station_id, name_th, name_en, lat, lon, location, station_type, created_at, updated_at)
VALUES
    ('TEST01', 'สถานีทดสอบ 1', 'Test Station 1', 13.7563, 100.5018, ST_SetSRID(ST_MakePoint(100.5018, 13.7563), 4326), 'industrial', NOW(), NOW()),
    ('TEST02', 'สถานีทดสอบ 2', 'Test Station 2', 18.7883, 98.9853, ST_SetSRID(ST_MakePoint(98.9853, 18.7883), 4326), 'urban', NOW(), NOW())
ON CONFLICT (station_id)
DO UPDATE SET
    name_th = EXCLUDED.name_th,
    name_en = EXCLUDED.name_en,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    location = EXCLUDED.location,
    station_type = EXCLUDED.station_type,
    updated_at = NOW();
