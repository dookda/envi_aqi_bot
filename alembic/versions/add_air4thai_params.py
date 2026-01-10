"""add_full_air4thai_parameters

Add all Air4Thai API parameters to aqi_hourly table:
- Pollutants: pm10, o3, co, no2, so2
- Weather: ws, wd, temp, rh, bp, rain

Revision ID: add_air4thai_params
Revises: 
Create Date: 2026-01-10

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_air4thai_params'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Add new columns for full Air4Thai parameters and gap-fill support"""
    
    # Pollutant columns
    op.add_column('aqi_hourly', sa.Column('pm10', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('o3', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('co', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('no2', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('so2', sa.Float(), nullable=True))
    
    # Weather/Meteorological columns
    op.add_column('aqi_hourly', sa.Column('ws', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('wd', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('temp', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('rh', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('bp', sa.Float(), nullable=True))
    op.add_column('aqi_hourly', sa.Column('rain', sa.Float(), nullable=True))
    
    # Per-parameter imputation flags for gap-fill tracking
    op.add_column('aqi_hourly', sa.Column('pm25_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('pm10_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('o3_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('co_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('no2_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('so2_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('ws_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('wd_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('temp_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('rh_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('bp_imputed', sa.Boolean(), default=False))
    op.add_column('aqi_hourly', sa.Column('rain_imputed', sa.Boolean(), default=False))
    
    # ImputationLog new columns for full parameter support
    op.add_column('imputation_log', sa.Column('parameter', sa.String(), nullable=True, server_default='pm25'))
    op.add_column('imputation_log', sa.Column('original_value', sa.Float(), nullable=True))
    op.add_column('imputation_log', sa.Column('imputation_method', sa.String(), nullable=True, server_default='lstm'))
    op.add_column('imputation_log', sa.Column('confidence_score', sa.Float(), nullable=True))
    
    # Add comments for documentation
    op.execute("COMMENT ON COLUMN aqi_hourly.pm10 IS 'PM10 (μg/m³)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.o3 IS 'Ozone (ppb)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.co IS 'Carbon Monoxide (ppm)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.no2 IS 'Nitrogen Dioxide (ppb)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.so2 IS 'Sulfur Dioxide (ppb)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.ws IS 'Wind Speed (m/s)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.wd IS 'Wind Direction (degrees 0-360)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.temp IS 'Temperature (°C)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.rh IS 'Relative Humidity (%)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.bp IS 'Barometric Pressure (mmHg)'")
    op.execute("COMMENT ON COLUMN aqi_hourly.rain IS 'Rainfall (mm)'")
    
    # Index for parameter-based imputation queries
    op.execute("COMMENT ON COLUMN imputation_log.parameter IS 'Parameter name: pm25, pm10, o3, co, no2, so2, ws, wd, temp, rh, bp, rain'")


def downgrade():
    """Remove the additional columns"""
    # Remove imputation tracking columns
    for param in ['pm25', 'pm10', 'o3', 'co', 'no2', 'so2', 'ws', 'wd', 'temp', 'rh', 'bp', 'rain']:
        try:
            op.drop_column('aqi_hourly', f'{param}_imputed')
        except:
            pass
    
    # Remove ImputationLog new columns
    op.drop_column('imputation_log', 'confidence_score')
    op.drop_column('imputation_log', 'imputation_method')
    op.drop_column('imputation_log', 'original_value')
    op.drop_column('imputation_log', 'parameter')
    
    # Remove weather columns
    op.drop_column('aqi_hourly', 'rain')
    op.drop_column('aqi_hourly', 'bp')
    op.drop_column('aqi_hourly', 'rh')
    op.drop_column('aqi_hourly', 'temp')
    op.drop_column('aqi_hourly', 'wd')
    op.drop_column('aqi_hourly', 'ws')
    
    # Remove pollutant columns
    op.drop_column('aqi_hourly', 'so2')
    op.drop_column('aqi_hourly', 'no2')
    op.drop_column('aqi_hourly', 'co')
    op.drop_column('aqi_hourly', 'o3')
    op.drop_column('aqi_hourly', 'pm10')
