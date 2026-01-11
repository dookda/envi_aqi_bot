"""
Data Upload Service
Handles importing data from API URLs (JSON) and CSV files
"""
import io
import csv
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend_model.logger import logger
from backend_model.database import get_db_context


class DataUploadService:
    """Service for handling data uploads from API and CSV"""

    # Column mappings from various formats to our database schema
    COLUMN_MAPPINGS = {
        # Air4Thai API format
        'DATETIMEDATA': 'datetime',
        'stationID': 'station_id',
        'PM25': 'pm25',
        'PM10': 'pm10',
        'O3': 'o3',
        'CO': 'co',
        'NO2': 'no2',
        'SO2': 'so2',
        'WS': 'ws',
        'WD': 'wd',
        'TEMP': 'temp',
        'RH': 'rh',
        'BP': 'bp',
        'RAIN': 'rain',
        # Standard CSV format (lowercase)
        'station_id': 'station_id',
        'datetime': 'datetime',
        'pm25': 'pm25',
        'pm10': 'pm10',
        'o3': 'o3',
        'co': 'co',
        'no2': 'no2',
        'so2': 'so2',
        'ws': 'ws',
        'wd': 'wd',
        'temp': 'temp',
        'rh': 'rh',
        'bp': 'bp',
        'rain': 'rain',
        'aqi': 'aqi',
    }

    # Required columns for import
    REQUIRED_COLUMNS = ['station_id', 'datetime']

    # Numeric columns
    NUMERIC_COLUMNS = ['pm25', 'pm10', 'o3', 'co', 'no2',
                       'so2', 'ws', 'wd', 'temp', 'rh', 'bp', 'rain', 'aqi']

    async def fetch_api_data(self, url: str) -> Tuple[List[Dict], List[str], str]:
        """
        Fetch data from API URL
        Returns: (data_list, columns, station_id)
        """
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                # Handle Air4Thai format
                if isinstance(data, dict):
                    if data.get('result') == 'OK' and 'stations' in data:
                        stations = data['stations']
                        if stations:
                            station = stations[0]
                            station_id = station.get('stationID', '')
                            records = station.get('data', [])
                            if records:
                                columns = list(records[0].keys())
                                return records, columns, station_id
                    raise ValueError("Invalid API response format")
                elif isinstance(data, list):
                    if data:
                        columns = list(data[0].keys())
                        return data, columns, ''
                    raise ValueError("Empty data from API")
                else:
                    raise ValueError("Unexpected data format")

        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching API: {e}")
            raise ValueError(f"HTTP error: {str(e)}")
        except Exception as e:
            logger.error(f"Error fetching API data: {e}")
            raise

    def parse_csv_data(self, content: bytes) -> Tuple[List[Dict], List[str]]:
        """
        Parse CSV content
        Returns: (data_list, columns)
        """
        try:
            # Try different encodings
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1']:
                try:
                    text_content = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Could not decode CSV file")

            reader = csv.DictReader(io.StringIO(text_content))
            columns = reader.fieldnames or []
            data = list(reader)

            return data, columns

        except Exception as e:
            logger.error(f"Error parsing CSV: {e}")
            raise ValueError(f"Failed to parse CSV: {str(e)}")

    def normalize_columns(self, columns: List[str]) -> Dict[str, str]:
        """Map source columns to database columns"""
        mapping = {}
        for col in columns:
            # Try direct mapping
            if col in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col]
            # Try case-insensitive
            elif col.lower() in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col.lower()]
            elif col.upper() in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col.upper()]
        return mapping

    def normalize_record(self, record: Dict, column_mapping: Dict, station_id: str = '') -> Optional[Dict]:
        """Normalize a single record for database insertion"""
        try:
            normalized = {}

            for src_col, db_col in column_mapping.items():
                value = record.get(src_col)

                if db_col == 'datetime':
                    # Parse datetime
                    if value:
                        if isinstance(value, str):
                            # Try multiple formats
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                                try:
                                    normalized[db_col] = datetime.strptime(
                                        value, fmt)
                                    break
                                except ValueError:
                                    continue
                            else:
                                return None  # Skip if datetime can't be parsed
                elif db_col in self.NUMERIC_COLUMNS:
                    # Parse numeric values
                    if value is not None and value != '' and value != '-':
                        try:
                            normalized[db_col] = float(value)
                        except (ValueError, TypeError):
                            normalized[db_col] = None
                    else:
                        normalized[db_col] = None
                else:
                    normalized[db_col] = value

            # Use provided station_id if not in record
            if 'station_id' not in normalized or not normalized['station_id']:
                if station_id:
                    normalized['station_id'] = station_id
                else:
                    return None  # Skip if no station_id

            # Must have datetime
            if 'datetime' not in normalized or normalized['datetime'] is None:
                return None

            return normalized

        except Exception as e:
            logger.error(f"Error normalizing record: {e}")
            return None

    def import_records(self, records: List[Dict]) -> Tuple[int, int, int, List[str]]:
        """
        Import records to database
        Returns: (inserted, updated, failed, errors)
        """
        inserted = 0
        updated = 0
        failed = 0
        errors = []

        if not records:
            return 0, 0, 0, ["No records to import"]

        # Build SQL for upsert
        insert_sql = text("""
            INSERT INTO aqi_hourly (
                station_id, datetime, pm25, pm10, o3, co, no2, so2,
                ws, wd, temp, rh, bp, rain, aqi,
                pm25_imputed, pm10_imputed, o3_imputed, co_imputed, no2_imputed, so2_imputed,
                ws_imputed, wd_imputed, temp_imputed, rh_imputed, bp_imputed, rain_imputed
            ) VALUES (
                :station_id, :datetime, :pm25, :pm10, :o3, :co, :no2, :so2,
                :ws, :wd, :temp, :rh, :bp, :rain, :aqi,
                false, false, false, false, false, false,
                false, false, false, false, false, false
            )
            ON CONFLICT (station_id, datetime) 
            DO UPDATE SET
                pm25 = COALESCE(EXCLUDED.pm25, aqi_hourly.pm25),
                pm10 = COALESCE(EXCLUDED.pm10, aqi_hourly.pm10),
                o3 = COALESCE(EXCLUDED.o3, aqi_hourly.o3),
                co = COALESCE(EXCLUDED.co, aqi_hourly.co),
                no2 = COALESCE(EXCLUDED.no2, aqi_hourly.no2),
                so2 = COALESCE(EXCLUDED.so2, aqi_hourly.so2),
                ws = COALESCE(EXCLUDED.ws, aqi_hourly.ws),
                wd = COALESCE(EXCLUDED.wd, aqi_hourly.wd),
                temp = COALESCE(EXCLUDED.temp, aqi_hourly.temp),
                rh = COALESCE(EXCLUDED.rh, aqi_hourly.rh),
                bp = COALESCE(EXCLUDED.bp, aqi_hourly.bp),
                rain = COALESCE(EXCLUDED.rain, aqi_hourly.rain),
                aqi = COALESCE(EXCLUDED.aqi, aqi_hourly.aqi),
                updated_at = NOW()
        """)

        with get_db_context() as db:
            for i, record in enumerate(records):
                try:
                    # Ensure all columns exist with None defaults
                    params = {
                        'station_id': record.get('station_id'),
                        'datetime': record.get('datetime'),
                        'pm25': record.get('pm25'),
                        'pm10': record.get('pm10'),
                        'o3': record.get('o3'),
                        'co': record.get('co'),
                        'no2': record.get('no2'),
                        'so2': record.get('so2'),
                        'ws': record.get('ws'),
                        'wd': record.get('wd'),
                        'temp': record.get('temp'),
                        'rh': record.get('rh'),
                        'bp': record.get('bp'),
                        'rain': record.get('rain'),
                        'aqi': record.get('aqi'),
                    }

                    result = db.execute(insert_sql, params)

                    # Check if it was insert or update (PostgreSQL specific)
                    if result.rowcount > 0:
                        inserted += 1

                except Exception as e:
                    failed += 1
                    if len(errors) < 10:  # Limit error messages
                        errors.append(f"Row {i+1}: {str(e)}")
                    logger.error(f"Error importing record {i}: {e}")

            db.commit()

        # Note: With ON CONFLICT, we can't easily distinguish insert vs update
        # So we'll report all successful as "inserted"
        return inserted, updated, failed, errors


# Singleton instance
upload_service = DataUploadService()
