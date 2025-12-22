"""Add PostGIS extension and geometry column

Revision ID: 001
Revises:
Create Date: 2025-12-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add PostGIS extension and geometry column to stations table"""

    # Enable PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis CASCADE;')

    # Add geometry column to stations table
    # Using raw SQL for better PostGIS compatibility
    op.execute("""
        ALTER TABLE stations
        ADD COLUMN IF NOT EXISTS location GEOMETRY(POINT, 4326);
    """)

    # Populate geometry column from existing lat/lon data
    op.execute("""
        UPDATE stations
        SET location = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
        WHERE lat IS NOT NULL AND lon IS NOT NULL AND location IS NULL;
    """)

    # Create spatial index
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_stations_location
        ON stations USING GIST(location);
    """)

    # Add trigger to auto-update geometry when lat/lon changes
    op.execute("""
        CREATE OR REPLACE FUNCTION update_station_location()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL) THEN
                NEW.location = ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS trigger_update_station_location ON stations;
        CREATE TRIGGER trigger_update_station_location
        BEFORE INSERT OR UPDATE OF lat, lon ON stations
        FOR EACH ROW
        EXECUTE FUNCTION update_station_location();
    """)


def downgrade() -> None:
    """Remove geometry column and PostGIS extension"""

    # Drop trigger and function
    op.execute('DROP TRIGGER IF EXISTS trigger_update_station_location ON stations;')
    op.execute('DROP FUNCTION IF EXISTS update_station_location();')

    # Drop spatial index
    op.execute('DROP INDEX IF EXISTS idx_stations_location;')

    # Remove geometry column
    op.execute('ALTER TABLE stations DROP COLUMN IF EXISTS location;')

    # Note: We don't drop PostGIS extension as other tables might use it
    # op.execute('DROP EXTENSION IF EXISTS postgis CASCADE;')
