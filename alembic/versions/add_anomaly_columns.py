"""add_anomaly_columns

Add anomaly detection columns to aqi_hourly table (TOR 16.2)

Revision ID: add_anomaly_columns
Revises: add_nox_parameter
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_anomaly_columns'
down_revision = 'add_nox_parameter'
branch_labels = None
depends_on = None


def upgrade():
    """Add anomaly flagging columns to aqi_hourly table"""
    
    # Add is_anomaly flag
    op.add_column('aqi_hourly', sa.Column('is_anomaly', sa.Boolean(), server_default='false', nullable=True))
    
    # Add anomaly_type column for categorizing anomalies
    op.add_column('aqi_hourly', sa.Column('anomaly_type', sa.String(), nullable=True))
    
    # Add model_version for tracking which model processed the data
    op.add_column('aqi_hourly', sa.Column('model_version', sa.String(), nullable=True))
    
    # Add column comments for documentation
    op.execute("COMMENT ON COLUMN aqi_hourly.is_anomaly IS 'True if value is flagged as incorrect/anomalous'")
    op.execute("COMMENT ON COLUMN aqi_hourly.anomaly_type IS 'Type of anomaly: manual_flag, out_of_range, spike, etc.'")
    op.execute("COMMENT ON COLUMN aqi_hourly.model_version IS 'Version of model that processed this record'")


def downgrade():
    """Remove anomaly-related columns"""
    
    try:
        op.drop_column('aqi_hourly', 'model_version')
    except:
        pass
    
    try:
        op.drop_column('aqi_hourly', 'anomaly_type')
    except:
        pass
    
    try:
        op.drop_column('aqi_hourly', 'is_anomaly')
    except:
        pass
