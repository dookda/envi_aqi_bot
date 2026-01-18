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
        'NOX': 'nox',
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
        'nox': 'nox',
        'ws': 'ws',
        'wd': 'wd',
        'temp': 'temp',
        'rh': 'rh',
        'bp': 'bp',
        'rain': 'rain',
        # Additional variations (with dots, underscores, spaces, etc.)
        'PM2.5': 'pm25',
        'pm2.5': 'pm25',
        'PM 2.5': 'pm25',
        'pm 25': 'pm25',
        'PM_25': 'pm25',
        'pm_25': 'pm25',
        'PM 10': 'pm10',
        'pm 10': 'pm10',
        'PM_10': 'pm10',
        'pm_10': 'pm10',
        # Date/time variations
        'date': 'datetime',
        'DATE': 'datetime',
        'time': 'datetime',
        'TIME': 'datetime',
        'timestamp': 'datetime',
        'TIMESTAMP': 'datetime',
        'date_time': 'datetime',
        'DATE_TIME': 'datetime',
        # Station variations
        'StationID': 'station_id',
        'STATION_ID': 'station_id',
        'station': 'station_id',
        'STATION': 'station_id',
        # Temperature variations
        'temperature': 'temp',
        'TEMPERATURE': 'temp',
        'Temperature': 'temp',
        # Humidity variations
        'humidity': 'rh',
        'HUMIDITY': 'rh',
        'Humidity': 'rh',
        'relative_humidity': 'rh',
        # Wind variations
        'wind_speed': 'ws',
        'WIND_SPEED': 'ws',
        'WindSpeed': 'ws',
        'wind_direction': 'wd',
        'WIND_DIRECTION': 'wd',
        'WindDirection': 'wd',
        # Pressure variations
        'pressure': 'bp',
        'PRESSURE': 'bp',
        'Pressure': 'bp',
        'barometric_pressure': 'bp',
        # Rainfall variations
        'rainfall': 'rain',
        'RAINFALL': 'rain',
        'Rainfall': 'rain',
        'precipitation': 'rain',
        # Note: AQI is calculated from raw measurements, not stored directly
    }

    # Required columns for import
    REQUIRED_COLUMNS = ['station_id', 'datetime']

    # Numeric columns
    NUMERIC_COLUMNS = ['pm25', 'pm10', 'o3', 'co', 'no2',
                       'so2', 'nox', 'ws', 'wd', 'temp', 'rh', 'bp', 'rain']

    # Station required columns
    STATION_REQUIRED_COLUMNS = ['station_id', 'name_en', 'lat', 'lon']

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
            # Strip whitespace from column name
            col_clean = col.strip() if col else ''
            if not col_clean:
                continue
                
            # Try direct mapping
            if col_clean in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col_clean]
            # Try case-insensitive (lowercase)
            elif col_clean.lower() in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col_clean.lower()]
            # Try case-insensitive (uppercase)
            elif col_clean.upper() in self.COLUMN_MAPPINGS:
                mapping[col] = self.COLUMN_MAPPINGS[col_clean.upper()]
            else:
                # Log unmapped columns for debugging
                logger.debug(f"Column '{col}' not found in COLUMN_MAPPINGS")
        return mapping

    def normalize_record(self, record: Dict, column_mapping: Dict, station_id: str = '') -> Optional[Dict]:
        """Normalize a single record for database insertion"""
        # Define NULL-like values to treat as None
        NULL_VALUES = {'', '-', 'N/A', 'n/a', 'NA', 'na', 'null', 'NULL', 'None', 'none', 'NaN', 'nan', '.'}
        
        try:
            normalized = {}

            # Debug logging
            logger.debug(f"Normalizing record with column_mapping: {column_mapping}")
            logger.debug(f"Record keys: {record.keys()}")

            for src_col, db_col in column_mapping.items():
                value = record.get(src_col)
                
                # Strip whitespace from string values
                if isinstance(value, str):
                    value = value.strip()
                
                logger.debug(f"Processing {src_col} -> {db_col}: value={value}")

                if db_col == 'datetime':
                    # Parse datetime
                    if value and value not in NULL_VALUES:
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
                    else:
                        return None  # Skip if no datetime
                elif db_col in self.NUMERIC_COLUMNS:
                    # Parse numeric values - check for NULL-like values
                    if value is not None and value not in NULL_VALUES:
                        try:
                            normalized[db_col] = float(value)
                        except (ValueError, TypeError):
                            normalized[db_col] = None
                    else:
                        normalized[db_col] = None
                elif db_col == 'station_id':
                    # Handle station_id - strip and check for NULL
                    if value and value not in NULL_VALUES:
                        normalized[db_col] = value
                    # Will be handled below if not set
                else:
                    # Handle other string columns
                    if value is not None and value not in NULL_VALUES:
                        normalized[db_col] = value
                    else:
                        normalized[db_col] = None

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

    def import_records(self, records: List[Dict], auto_create_stations: bool = True) -> Tuple[int, int, int, List[str]]:
        """
        Import records to database
        Returns: (inserted, updated, failed, errors)
        
        Args:
            records: List of normalized record dictionaries
            auto_create_stations: If True, auto-create missing stations as placeholders
        """
        inserted = 0
        updated = 0
        failed = 0
        errors = []
        stations_created = []

        if not records:
            return 0, 0, 0, ["No records to import"]

        # Collect unique station_ids from records
        unique_station_ids = set(r.get('station_id') for r in records if r.get('station_id'))
        logger.info(f"Found {len(unique_station_ids)} unique station IDs in upload: {unique_station_ids}")

        with get_db_context() as db:
            # Check which stations exist in the database
            existing_stations = set()
            if unique_station_ids:
                result = db.execute(
                    text("SELECT station_id FROM stations WHERE station_id = ANY(:ids)"),
                    {"ids": list(unique_station_ids)}
                )
                existing_stations = set(row[0] for row in result.fetchall())
            
            missing_stations = unique_station_ids - existing_stations
            
            if missing_stations:
                if auto_create_stations:
                    # Auto-create missing stations as placeholders
                    logger.info(f"Auto-creating {len(missing_stations)} missing stations: {missing_stations}")
                    from sqlalchemy import func
                    
                    for station_id in missing_stations:
                        try:
                            # Create a placeholder station with minimal info
                            # User can update details later via the station upload feature
                            db.execute(
                                text("""
                                    INSERT INTO stations (station_id, name_th, name_en, lat, lon, station_type, location)
                                    VALUES (:station_id, :name_th, :name_en, :lat, :lon, :station_type, 
                                            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
                                    ON CONFLICT (station_id) DO NOTHING
                                """),
                                {
                                    "station_id": station_id,
                                    "name_th": f"Station {station_id}",
                                    "name_en": f"Station {station_id}",
                                    "lat": 13.7563,  # Default to Bangkok coordinates
                                    "lon": 100.5018,
                                    "station_type": "unknown"
                                }
                            )
                            stations_created.append(station_id)
                            logger.info(f"Created placeholder station: {station_id}")
                        except Exception as e:
                            logger.error(f"Failed to create station {station_id}: {e}")
                            errors.append(f"Failed to create station {station_id}: {str(e)}")
                    
                    db.commit()
                    
                    if stations_created:
                        errors.insert(0, f"Auto-created {len(stations_created)} placeholder stations: {', '.join(stations_created)}. Please update station details later.")
                else:
                    # Don't auto-create, just warn about missing stations
                    errors.append(f"Missing stations (records will be skipped): {', '.join(missing_stations)}")
                    logger.warning(f"Missing stations: {missing_stations}")

            # Build SQL for upsert
            insert_sql = text("""
                INSERT INTO aqi_hourly (
                    station_id, datetime, pm25, pm10, o3, co, no2, so2, nox,
                    ws, wd, temp, rh, bp, rain,
                    is_imputed,
                    pm25_imputed, pm10_imputed, o3_imputed, co_imputed, no2_imputed, so2_imputed, nox_imputed,
                    ws_imputed, wd_imputed, temp_imputed, rh_imputed, bp_imputed, rain_imputed
                ) VALUES (
                    :station_id, :datetime, :pm25, :pm10, :o3, :co, :no2, :so2, :nox,
                    :ws, :wd, :temp, :rh, :bp, :rain,
                    false,
                    false, false, false, false, false, false, false,
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
                    nox = COALESCE(EXCLUDED.nox, aqi_hourly.nox),
                    ws = COALESCE(EXCLUDED.ws, aqi_hourly.ws),
                    wd = COALESCE(EXCLUDED.wd, aqi_hourly.wd),
                    temp = COALESCE(EXCLUDED.temp, aqi_hourly.temp),
                    rh = COALESCE(EXCLUDED.rh, aqi_hourly.rh),
                    bp = COALESCE(EXCLUDED.bp, aqi_hourly.bp),
                    rain = COALESCE(EXCLUDED.rain, aqi_hourly.rain),
                    is_imputed = false,
                    pm25_imputed = false,
                    pm10_imputed = false,
                    o3_imputed = false,
                    co_imputed = false,
                    no2_imputed = false,
                    so2_imputed = false,
                    nox_imputed = false,
                    ws_imputed = false,
                    wd_imputed = false,
                    temp_imputed = false,
                    rh_imputed = false,
                    bp_imputed = false,
                    rain_imputed = false
            """)

            # Process records with savepoints for better error handling
            for i, record in enumerate(records):
                station_id = record.get('station_id')
                
                # Skip records for missing stations if auto_create is disabled
                if not auto_create_stations and station_id in missing_stations:
                    failed += 1
                    continue
                
                try:
                    # Create a savepoint for this record
                    savepoint = db.begin_nested()
                    
                    # Ensure all columns exist with None defaults
                    params = {
                        'station_id': station_id,
                        'datetime': record.get('datetime'),
                        'pm25': record.get('pm25'),
                        'pm10': record.get('pm10'),
                        'o3': record.get('o3'),
                        'co': record.get('co'),
                        'no2': record.get('no2'),
                        'so2': record.get('so2'),
                        'nox': record.get('nox'),
                        'ws': record.get('ws'),
                        'wd': record.get('wd'),
                        'temp': record.get('temp'),
                        'rh': record.get('rh'),
                        'bp': record.get('bp'),
                        'rain': record.get('rain'),
                    }

                    # Debug: log first record params
                    if i == 0:
                        logger.info(f"First record params: {params}")
                        logger.info(f"First record object: {record}")

                    result = db.execute(insert_sql, params)
                    savepoint.commit()

                    # Check if it was insert or update (PostgreSQL specific)
                    if result.rowcount > 0:
                        inserted += 1

                except Exception as e:
                    # Rollback only this record's savepoint
                    try:
                        savepoint.rollback()
                    except:
                        pass
                    
                    failed += 1
                    if len(errors) < 10:  # Limit error messages
                        errors.append(f"Row {i+1}: {str(e)}")
                    logger.error(f"Error importing record {i}: {e}")

            # Commit the main transaction
            db.commit()



        # --- AUTO LEARN & FILL GAPS ---
        # Trigger imputation for all affected stations
        imputation_results = {}
        if unique_station_ids:
            try:
                # Import here to avoid potential circular imports
                from backend_model.services.imputation import ImputationService
                imputation_service = ImputationService()
                
                logger.info(f"Starting auto-imputation for {len(unique_station_ids)} uploaded station(s)...")
                for station_id in unique_station_ids:
                    # Use batch mode for performance
                    # This handles "auto learn" (training if needed) and "fill gap" (imputation)
                    result = imputation_service.impute_station_gaps_batch(
                        station_id=station_id
                    )
                    logger.info(f"Auto-imputation result for {station_id}: {result}")
                    imputation_results[station_id] = result
                    
                    if result.get("imputed_count", 0) > 0:
                        msg = f"Auto-filled {result['imputed_count']} missing values for station {station_id}"
                        errors.append(msg)
                    elif result.get("status") == "failed":
                        msg = f"Auto-imputation warning for {station_id}: {result.get('reason', 'unknown error')}"
                        errors.append(msg)
                        
            except Exception as e:
                logger.error(f"Auto-imputation failed: {e}")
                # Don't fail the upload if imputation fails, just warn
                errors.append(f"Warning: Auto-imputation failed: {str(e)}")
        # ------------------------------

        # --- QUALITY ANALYSIS & LINE NOTIFICATION ---
        # Analyze data quality and send LINE alerts if issues found
        try:
            self.analyze_and_notify(
                records=records,
                station_ids=list(unique_station_ids),
                inserted=inserted,
                failed=failed,
                imputation_results=imputation_results
            )
        except Exception as e:
            logger.error(f"Quality analysis/notification failed: {e}")
            # Don't fail upload if notification fails
        # ------------------------------

        # Note: With ON CONFLICT, we can't easily distinguish insert vs update
        # So we'll report all successful as "inserted"
        return inserted, updated, failed, errors

    def analyze_and_notify(
        self,
        records: List[Dict],
        station_ids: List[str],
        inserted: int,
        failed: int,
        imputation_results: Dict[str, Any]
    ) -> None:
        """
        Analyze uploaded data quality and send LINE notifications if issues found
        
        Args:
            records: Uploaded records
            station_ids: List of affected station IDs
            inserted: Number of inserted records
            failed: Number of failed records
            imputation_results: Results from auto-imputation
        """
        from backend_api.services.line_notification import line_notification_service
        from backend_model.services.anomaly import anomaly_service
        
        if not line_notification_service.enabled:
            logger.debug("LINE notifications disabled, skipping quality analysis")
            return
        
        for station_id in station_ids:
            try:
                # Get station name
                station_name = None
                with get_db_context() as db:
                    result = db.execute(
                        text("SELECT name_en, name_th FROM stations WHERE station_id = :id"),
                        {"id": station_id}
                    ).fetchone()
                    if result:
                        station_name = result[0] or result[1]
                
                # Filter records for this station
                station_records = [r for r in records if r.get("station_id") == station_id]
                
                if not station_records:
                    continue
                
                # Get date range
                datetimes = [r.get("datetime") for r in station_records if r.get("datetime")]
                if datetimes:
                    min_dt = min(datetimes)
                    max_dt = max(datetimes)
                    date_range = (
                        min_dt.strftime("%Y-%m-%d") if hasattr(min_dt, 'strftime') else str(min_dt)[:10],
                        max_dt.strftime("%Y-%m-%d") if hasattr(max_dt, 'strftime') else str(max_dt)[:10]
                    )
                else:
                    date_range = (None, None)
                
                # Detect anomalies/spikes
                spike_count = 0
                anomaly_details = []
                
                try:
                    # Analyze with anomaly service
                    anomalies = anomaly_service.detect_anomalies(
                        station_id=station_id,
                        start_datetime=min_dt if datetimes else None,
                        end_datetime=max_dt if datetimes else None,
                        method="all"
                    )
                    
                    if anomalies and isinstance(anomalies, dict):
                        all_anomalies = anomalies.get("anomalies", [])
                        spike_count = len(all_anomalies)
                        
                        # Get top anomalies for details
                        for anomaly in all_anomalies[:5]:
                            anomaly_details.append({
                                "datetime": anomaly.get("timestamp", "").strftime("%Y-%m-%d %H:%M") 
                                    if hasattr(anomaly.get("timestamp"), "strftime") 
                                    else str(anomaly.get("timestamp", ""))[:16],
                                "value": anomaly.get("value", 0),
                                "parameter": "PM2.5",
                                "type": anomaly.get("type", "unknown")
                            })
                except Exception as e:
                    logger.warning(f"Anomaly detection failed for {station_id}: {e}")
                
                # Calculate missing data stats
                imputation_result = imputation_results.get(station_id, {})
                imputed_count = imputation_result.get("imputed_count", 0)
                missing_gaps = imputation_result.get("gaps_found", 0)
                missing_hours = imputation_result.get("missing_hours", 0)
                
                # Calculate coverage
                total_records = len(station_records)
                expected_records = total_records + missing_hours if missing_hours else total_records
                coverage_percent = (total_records / expected_records * 100) if expected_records > 0 else 100
                
                # === DETECT NEGATIVE VALUES ===
                # Define thresholds per parameter (values below these are considered invalid)
                negative_thresholds = {
                    'pm25': -3, 'pm10': -3, 'o3': -3, 'no2': -3, 'so2': -3, 'nox': -3,
                    'co': -0.3,  # CO has smaller threshold
                    'temp': -50,  # Temperature can be negative (valid)
                    'ws': 0,     # Wind speed should be >= 0
                    'rh': 0,     # Humidity should be >= 0
                    'bp': 0,     # Pressure should be >= 0
                    'rain': 0    # Rain should be >= 0
                }
                
                negative_counts = {}
                negative_details = []
                
                for record in station_records:
                    for param, threshold in negative_thresholds.items():
                        value = record.get(param)
                        if value is not None and value < threshold:
                            # Count negatives per parameter
                            if param not in negative_counts:
                                negative_counts[param] = 0
                            negative_counts[param] += 1
                            
                            # Store first 5 negative values for display
                            if len(negative_details) < 5:
                                negative_details.append({
                                    "datetime": record.get("datetime", "").strftime("%Y-%m-%d %H:%M") 
                                        if hasattr(record.get("datetime"), "strftime") 
                                        else str(record.get("datetime", ""))[:16],
                                    "parameter": param.upper(),
                                    "value": value,
                                    "threshold": threshold
                                })
                
                total_negative = sum(negative_counts.values())
                if total_negative > 0:
                    logger.warning(f"Station {station_id}: Found {total_negative} negative values: {negative_counts}")
                # ==============================
                
                # Build summary
                upload_summary = {
                    "total_records": total_records,
                    "inserted": inserted,
                    "failed": failed,
                    "spike_count": spike_count,
                    "missing_gaps": missing_gaps,
                    "missing_hours": missing_hours,
                    "imputed_count": imputed_count,
                    "coverage_percent": coverage_percent,
                    "date_range": date_range,
                    "anomaly_details": anomaly_details,
                    # Negative value detection results
                    "negative_count": total_negative,
                    "negative_by_param": negative_counts,
                    "negative_details": negative_details
                }
                
                # Send notification
                line_notification_service.send_upload_quality_alert(
                    station_id=station_id,
                    station_name=station_name,
                    upload_summary=upload_summary,
                    language="th"  # Default to Thai
                )
                
                logger.info(f"Quality analysis complete for {station_id}: "
                           f"spikes={spike_count}, missing={missing_hours}h, imputed={imputed_count}")
                
            except Exception as e:
                logger.error(f"Error analyzing station {station_id}: {e}")
                import traceback
                traceback.print_exc()

    def parse_station_csv(self, content: bytes) -> Tuple[List[Dict], List[str]]:
        """
        Parse station CSV content
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
            logger.error(f"Error parsing station CSV: {e}")
            raise ValueError(f"Failed to parse CSV: {str(e)}")

    def validate_station_record(self, record: Dict) -> Optional[Dict]:
        """Validate and normalize a single station record"""
        try:
            # Check required fields
            station_id = record.get('station_id', '').strip()
            name_en = record.get('name_en', '').strip()

            if not station_id:
                return None
            if not name_en:
                return None

            # Parse coordinates
            try:
                lat = float(record.get('lat', 0))
                lon = float(record.get('lon', 0))

                # Validate lat/lon ranges
                if not (-90 <= lat <= 90):
                    return None
                if not (-180 <= lon <= 180):
                    return None
            except (ValueError, TypeError):
                return None

            # Build normalized record
            normalized = {
                'station_id': station_id,
                'name_th': record.get('name_th', '').strip() or name_en,
                'name_en': name_en,
                'lat': lat,
                'lon': lon,
                'station_type': record.get('station_type', 'unknown').strip(),
            }

            return normalized

        except Exception as e:
            logger.error(f"Error validating station record: {e}")
            return None

    def import_stations(self, stations: List[Dict]) -> Tuple[int, int, int, List[str]]:
        """
        Import station records to database
        Returns: (inserted, updated, failed, errors)
        """
        from sqlalchemy.dialects.postgresql import insert
        from sqlalchemy import func
        from backend_model.models import Station

        inserted = 0
        updated = 0
        failed = 0
        errors = []

        if not stations:
            return 0, 0, 0, ["No stations to import"]

        with get_db_context() as db:
            for i, station in enumerate(stations):
                try:
                    # Create PostGIS point using func
                    point = func.ST_SetSRID(
                        func.ST_MakePoint(station['lon'], station['lat']),
                        4326
                    )

                    # Use upsert for stations
                    stmt = insert(Station).values(
                        station_id=station['station_id'],
                        name_th=station['name_th'],
                        name_en=station['name_en'],
                        lat=station['lat'],
                        lon=station['lon'],
                        station_type=station['station_type'],
                        location=point
                    )

                    stmt = stmt.on_conflict_do_update(
                        index_elements=['station_id'],
                        set_={
                            'name_th': stmt.excluded.name_th,
                            'name_en': stmt.excluded.name_en,
                            'lat': stmt.excluded.lat,
                            'lon': stmt.excluded.lon,
                            'station_type': stmt.excluded.station_type,
                            'location': stmt.excluded.location,
                            'updated_at': func.now()
                        }
                    )

                    db.execute(stmt)
                    inserted += 1

                except Exception as e:
                    failed += 1
                    if len(errors) < 10:
                        errors.append(f"Row {i+1} ({station.get('station_id', 'unknown')}): {str(e)}")
                    logger.error(f"Error importing station {i}: {e}")

            db.commit()

        return inserted, updated, failed, errors


# Singleton instance
upload_service = DataUploadService()
