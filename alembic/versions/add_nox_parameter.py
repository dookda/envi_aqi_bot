"""add_nox_parameter

Add NOX (Nitrogen Oxides) parameter to aqi_hourly table

Revision ID: add_nox_parameter
Revises: add_air4thai_params
Create Date: 2026-01-14

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_nox_parameter'
down_revision = 'add_air4thai_params'
branch_labels = None
depends_on = None


def upgrade():
    """Add NOX column and imputation flag to aqi_hourly table"""
    
    # Add NOX pollutant column
    op.add_column('aqi_hourly', sa.Column('nox', sa.Float(), nullable=True))
    
    # Add NOX imputation tracking flag
    op.add_column('aqi_hourly', sa.Column('nox_imputed', sa.Boolean(), default=False))
    
    # Add column comment for documentation
    op.execute("COMMENT ON COLUMN aqi_hourly.nox IS 'Nitrogen Oxides (ppb)'")
    
    # Update imputation_log parameter comment to include nox
    op.execute("""
        COMMENT ON COLUMN imputation_log.parameter IS 
        'Parameter name: pm25, pm10, o3, co, no2, so2, nox, ws, wd, temp, rh, bp, rain'
    """)


def downgrade():
    """Remove NOX-related columns"""
    
    # Remove imputation flag
    try:
        op.drop_column('aqi_hourly', 'nox_imputed')
    except:
        pass
    
    # Remove NOX column
    try:
        op.drop_column('aqi_hourly', 'nox')
    except:
        pass
