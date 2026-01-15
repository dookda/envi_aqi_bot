"""
Data Ingestion Service for Air4Thai APIs

Handles:
- Station metadata retrieval and storage
- Historical PM2.5 data ingestion (30-day rolling window)
- Missing data detection and logging

Performance Optimizations:
- HTTP connection pooling
- Parallel station processing with semaphore
- Batch database operations
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

import httpx
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from backend_model.config import settings
from backend_model.logger import logger
from backend_model.models import Station, AQIHourly, IngestionLog
from backend_model.database import get_db_context


@dataclass
class CircuitBreaker:
    """Circuit breaker to prevent overwhelming the API during failures"""
    failure_threshold: int = 5
    reset_timeout: int = 60  # seconds
    failures: int = 0
    last_failure: Optional[datetime] = None
    is_open: bool = False

    def record_failure(self):
        self.failures += 1
        self.last_failure = datetime.now()
        if self.failures >= self.failure_threshold:
            self.is_open = True
            logger.warning("Circuit breaker OPEN - pausing API calls")

    def record_success(self):
        self.failures = 0
        self.is_open = False

    def can_proceed(self) -> bool:
        if not self.is_open:
            return True
        if self.last_failure and (datetime.now() - self.last_failure).seconds > self.reset_timeout:
            self.is_open = False
            self.failures = 0
            logger.info("Circuit breaker CLOSED - resuming API calls")
            return True
        return False


class IngestionService:
    """Service for ingesting data from Air4Thai APIs with performance optimizations"""

    def __init__(self):
        self.station_api = settings.air4thai_station_api
        self.history_api = settings.air4thai_history_api
        self.timeout = settings.api_request_timeout
        self.retry_attempts = settings.api_retry_attempts
        self.retry_delay = settings.api_retry_delay

        # HTTP client with connection pooling (lazy initialized)
        self._client: Optional[httpx.AsyncClient] = None
        self._client_lock = asyncio.Lock()

        # Circuit breaker for API calls
        self.circuit_breaker = CircuitBreaker()

        # Concurrency control
        self.max_concurrent_requests = 10

    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling"""
        async with self._client_lock:
            if self._client is None or self._client.is_closed:
                self._client = httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout, connect=10.0),
                    limits=httpx.Limits(
                        max_connections=20,
                        max_keepalive_connections=10,
                        keepalive_expiry=30.0
                    ),
                    http2=False  # Use HTTP/1.1 for compatibility
                )
            return self._client

    async def close_client(self):
        """Close the HTTP client (call on shutdown)"""
        async with self._client_lock:
            if self._client and not self._client.is_closed:
                await self._client.aclose()
                self._client = None

    def _fix_malformed_json(self, text: str) -> str:
        """
        Fix malformed JSON from Air4Thai API (missing quotes around property names)
        The API sometimes returns: { result:"Error", error:"..." }
        Instead of valid JSON: { "result":"Error", "error":"..." }
        """
        import re
        # Fix unquoted property names: { result:"..." } -> { "result":"..." }
        fixed = re.sub(r'{\s*(\w+):', r'{ "\1":', text)
        fixed = re.sub(r',\s*(\w+):', r', "\1":', fixed)
        return fixed

    async def fetch_with_retry(self, url: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Fetch URL with retry logic and circuit breaker"""
        import json

        if not self.circuit_breaker.can_proceed():
            logger.warning("Circuit breaker open, skipping request")
            return None

        client = await self.get_client()

        for attempt in range(self.retry_attempts):
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()

                # Try to parse JSON, handling malformed responses from Air4Thai
                text = response.text
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    # Try to fix malformed JSON
                    fixed_text = self._fix_malformed_json(text)
                    try:
                        data = json.loads(fixed_text)
                        logger.debug(f"Fixed malformed JSON response from API")
                    except json.JSONDecodeError as e:
                        logger.warning(
                            f"Could not parse API response: {str(e)[:100]}")
                        return None

                self.circuit_breaker.record_success()
                return data
            except httpx.TimeoutException as e:
                logger.warning(f"Timeout on attempt {attempt + 1}: {e}")
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limited
                    logger.warning("Rate limited by API, waiting 30s")
                    await asyncio.sleep(30)
                else:
                    logger.warning(f"HTTP error on attempt {attempt + 1}: {e}")
                    if attempt < self.retry_attempts - 1:
                        await asyncio.sleep(self.retry_delay * (attempt + 1))
            except Exception as e:
                logger.error(f"Unexpected error fetching {url}: {e}")
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))

        self.circuit_breaker.record_failure()
        return None

    async def fetch_stations(self) -> List[Dict]:
        """
        Fetch all station metadata from Air4Thai API

        Returns:
            List of station dictionaries
        """
        logger.bind(context="ingestion").info(
            "Fetching station metadata from Air4Thai")

        data = await self.fetch_with_retry(self.station_api)

        if not data or "stations" not in data:
            logger.error(
                "Failed to fetch station data or invalid response format")
            return []

        stations = data["stations"]
        logger.bind(context="ingestion").info(
            f"Retrieved {len(stations)} stations")

        return stations

    def save_stations(self, db: Session, stations: List[Dict]) -> int:
        """
        Save or update station metadata in database

        Args:
            db: Database session
            stations: List of station dictionaries from API

        Returns:
            Number of stations upserted
        """
        if not stations:
            return 0

        records = []
        for station in stations:
            record = {
                "station_id": station.get("stationID", ""),
                "name_th": station.get("nameTH", ""),
                "name_en": station.get("nameEN", ""),
                "lat": float(station.get("lat", 0)) if station.get("lat") else None,
                "lon": float(station.get("long", 0)) if station.get("long") else None,
                "station_type": station.get("stationType", ""),
            }
            if record["station_id"]:
                records.append(record)

        if not records:
            return 0

        # Upsert stations (insert or update on conflict)
        stmt = insert(Station).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["station_id"],
            set_={
                "name_th": stmt.excluded.name_th,
                "name_en": stmt.excluded.name_en,
                "lat": stmt.excluded.lat,
                "lon": stmt.excluded.lon,
                "station_type": stmt.excluded.station_type,
                "updated_at": datetime.utcnow(),
            }
        )

        db.execute(stmt)
        db.commit()

        logger.bind(context="ingestion").info(
            f"Upserted {len(records)} stations")
        return len(records)

    async def fetch_historical_data(
        self,
        station_id: str,
        start_date: datetime,
        end_date: datetime,
        all_params: bool = True
    ) -> List[Dict]:
        """
        Fetch historical air quality and weather data for a station

        Args:
            station_id: Station identifier
            start_date: Start date for data fetch
            end_date: End date for data fetch
            all_params: If True, fetch all parameters (PM25, PM10, O3, CO, NO2, SO2, WS, WD, TEMP, RH, BP, RAIN)

        Returns:
            List of hourly measurement dictionaries
        """
        # Define parameter lists - try full list first, fallback to basic if error
        # Removed NOX - not supported by many stations
        full_params = "PM25,PM10,O3,CO,NO2,SO2,WS,WD,TEMP,RH,BP,RAIN"
        basic_params = "PM25,PM10,O3"

        param_list = full_params if all_params else basic_params

        base_params = {
            "stationID": station_id,
            "type": "hr",
            "sdate": start_date.strftime("%Y-%m-%d"),
            "edate": end_date.strftime("%Y-%m-%d"),
            "stime": "00",
            "etime": "23",
        }

        logger.bind(context="ingestion").debug(
            f"Fetching data for station {station_id} from {start_date.date()} to {end_date.date()} (params: {param_list})"
        )

        # Try with full parameters first
        params = {**base_params, "param": param_list}
        data = await self.fetch_with_retry(self.history_api, params)

        # Check if we got an error - fallback to basic params
        if data and data.get("result") == "Error" and all_params:
            logger.debug(
                f"Full params failed for {station_id}, trying basic params")
            params = {**base_params, "param": basic_params}
            data = await self.fetch_with_retry(self.history_api, params)

        if not data:
            logger.warning(f"No data returned for station {station_id}")
            return []

        if data.get("result") != "OK":
            logger.warning(
                f"API error for station {station_id}: {data.get('result')}")
            return []

        stations_data = data.get("stations", [])
        if not stations_data:
            return []

        measurements = stations_data[0].get("data", [])
        return measurements

    def _parse_float_value(self, value: Any, min_val: float = None, max_val: float = None) -> Optional[float]:
        """
        Safely parse a float value from API response

        Args:
            value: Raw value from API (can be None, empty string, "-", or number)
            min_val: Optional minimum valid value
            max_val: Optional maximum valid value

        Returns:
            Parsed float or None if invalid
        """
        if value is None or value == "" or value == "-":
            return None

        try:
            float_val = float(value)

            # Check for negative values (usually invalid for pollutants)
            if min_val is not None and float_val < min_val:
                return None
            if max_val is not None and float_val > max_val:
                return None

            return float_val
        except (ValueError, TypeError):
            return None

    def parse_measurements(
        self,
        station_id: str,
        measurements: List[Dict]
    ) -> List[Dict]:
        """
        Parse API response into database-ready records with all parameters

        Args:
            station_id: Station identifier
            measurements: Raw measurement data from API

        Returns:
            List of parsed measurement records with full Air4Thai data
        """
        records = []

        for m in measurements:
            datetime_str = m.get("DATETIMEDATA")

            if not datetime_str:
                continue

            try:
                # Parse datetime (format: YYYY-MM-DD HH:MM:SS)
                dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")

                # Parse all pollutant values (non-negative)
                pm25 = self._parse_float_value(m.get("PM25"), min_val=0)
                pm10 = self._parse_float_value(m.get("PM10"), min_val=0)
                o3 = self._parse_float_value(m.get("O3"), min_val=0)
                co = self._parse_float_value(m.get("CO"), min_val=0)
                no2 = self._parse_float_value(m.get("NO2"), min_val=0)
                so2 = self._parse_float_value(m.get("SO2"), min_val=0)
                nox = self._parse_float_value(m.get("NOX"), min_val=0)

                # Parse weather values
                ws = self._parse_float_value(
                    m.get("WS"), min_val=0)  # Wind speed >= 0
                wd = self._parse_float_value(
                    m.get("WD"), min_val=0, max_val=360)  # 0-360 degrees
                temp = self._parse_float_value(
                    m.get("TEMP"), min_val=-50, max_val=60)  # -50 to 60°C
                rh = self._parse_float_value(
                    m.get("RH"), min_val=0, max_val=100)  # 0-100%
                bp = self._parse_float_value(
                    m.get("BP"), min_val=600, max_val=900)  # mmHg range
                rain = self._parse_float_value(
                    m.get("RAIN"), min_val=0)  # Rainfall >= 0

                records.append({
                    "station_id": station_id,
                    "datetime": dt,
                    # Pollutants
                    "pm25": pm25,
                    "pm10": pm10,
                    "o3": o3,
                    "co": co,
                    "no2": no2,
                    "so2": so2,
                    "nox": nox,
                    # Weather
                    "ws": ws,
                    "wd": wd,
                    "temp": temp,
                    "rh": rh,
                    "bp": bp,
                    "rain": rain,
                    # Metadata
                    "is_imputed": False,
                })
            except ValueError as e:
                logger.warning(
                    f"Failed to parse datetime '{datetime_str}': {e}")
                continue

        return records

    def ensure_complete_hourly_index(
        self,
        db: Session,
        station_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """
        Ensure all hours in the range have records (insert NULL for missing)

        Args:
            db: Database session
            station_id: Station identifier
            start_date: Start of time range
            end_date: End of time range

        Returns:
            Number of missing hours filled
        """
        # Generate expected hourly timestamps
        expected_hours = pd.date_range(
            start=start_date.replace(minute=0, second=0, microsecond=0),
            end=end_date.replace(minute=0, second=0, microsecond=0),
            freq="h"
        )

        # Get existing timestamps
        result = db.execute(
            text("""
                SELECT datetime FROM aqi_hourly 
                WHERE station_id = :station_id 
                AND datetime >= :start_date 
                AND datetime <= :end_date
            """),
            {"station_id": station_id, "start_date": start_date, "end_date": end_date}
        )
        existing = {row[0] for row in result}

        # Find missing timestamps
        missing_hours = [dt.to_pydatetime()
                         for dt in expected_hours if dt.to_pydatetime() not in existing]

        if not missing_hours:
            return 0

        # Insert records with NULL pm25 for missing hours
        records = [
            {
                "station_id": station_id,
                "datetime": dt,
                "pm25": None,
                "is_imputed": False,
            }
            for dt in missing_hours
        ]

        stmt = insert(AQIHourly).values(records)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["station_id", "datetime"])
        db.execute(stmt)

        logger.bind(context="ingestion").info(
            f"Filled {len(missing_hours)} missing hour slots for station {station_id}"
        )

        return len(missing_hours)

    def save_measurements(
        self,
        db: Session,
        records: List[Dict]
    ) -> Tuple[int, int]:
        """
        Save measurement records to database (upsert) with all Air4Thai parameters

        Args:
            db: Database session
            records: List of measurement records

        Returns:
            Tuple of (inserted, updated) counts
        """
        if not records:
            return 0, 0

        # Use PostgreSQL upsert
        stmt = insert(AQIHourly).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["station_id", "datetime"],
            set_={
                # Pollutants
                "pm25": stmt.excluded.pm25,
                "pm10": stmt.excluded.pm10,
                "o3": stmt.excluded.o3,
                "co": stmt.excluded.co,
                "no2": stmt.excluded.no2,
                "so2": stmt.excluded.so2,
                "nox": stmt.excluded.nox,
                # Weather
                "ws": stmt.excluded.ws,
                "wd": stmt.excluded.wd,
                "temp": stmt.excluded.temp,
                "rh": stmt.excluded.rh,
                "bp": stmt.excluded.bp,
                "rain": stmt.excluded.rain,
                # Don't overwrite imputed data with NULL
                "is_imputed": AQIHourly.is_imputed,
            },
            # Only update non-imputed records
            where=(AQIHourly.is_imputed == False)
        )

        result = db.execute(stmt)
        return len(records), 0

    def detect_missing_data(
        self,
        db: Session,
        station_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Detect and classify missing data for a station

        Args:
            db: Database session
            station_id: Station identifier
            start_date: Start of analysis range
            end_date: End of analysis range

        Returns:
            Dictionary with missing data analysis
        """
        result = db.execute(
            text("""
                SELECT datetime, pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime >= :start_date
                AND datetime <= :end_date
                ORDER BY datetime
            """),
            {"station_id": station_id, "start_date": start_date, "end_date": end_date}
        )

        data = list(result)

        if not data:
            return {
                "total_hours": 0,
                "missing_hours": 0,
                "gaps": [],
                "short_gaps": 0,
                "medium_gaps": 0,
                "long_gaps": 0,
            }

        # Analyze gaps
        gaps = []
        current_gap_start = None

        for dt, pm25 in data:
            if pm25 is None:
                if current_gap_start is None:
                    current_gap_start = dt
            else:
                if current_gap_start is not None:
                    gap_hours = int(
                        (dt - current_gap_start).total_seconds() / 3600)
                    if gap_hours > 0:
                        gap_type = "short" if gap_hours <= 3 else "medium" if gap_hours <= 24 else "long"
                        gaps.append({
                            "start": current_gap_start,
                            "end": dt,
                            "hours": gap_hours,
                            "type": gap_type,
                        })
                    current_gap_start = None

        # Count gap types
        short_gaps = sum(1 for g in gaps if g["type"] == "short")
        medium_gaps = sum(1 for g in gaps if g["type"] == "medium")
        long_gaps = sum(1 for g in gaps if g["type"] == "long")

        missing_hours = sum(1 for _, pm25 in data if pm25 is None)

        return {
            "total_hours": len(data),
            "missing_hours": missing_hours,
            "missing_percentage": round(missing_hours / len(data) * 100, 2) if data else 0,
            "gaps": gaps,
            "short_gaps": short_gaps,
            "medium_gaps": medium_gaps,
            "long_gaps": long_gaps,
        }

    async def ingest_station_data(
        self,
        station_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Ingest historical data for a single station

        Args:
            station_id: Station identifier
            days: Number of days to ingest (max 30)

        Returns:
            Ingestion result summary
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=min(days, 30))

        with get_db_context() as db:
            # Create ingestion log
            log = IngestionLog(
                run_type="batch",
                station_id=station_id,
                start_date=start_date,
                end_date=end_date,
                status="running",
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            log_id = log.id

            try:
                # Fetch data
                measurements = await self.fetch_historical_data(station_id, start_date, end_date)
                records = self.parse_measurements(station_id, measurements)

                # Save measurements
                inserted, _ = self.save_measurements(db, records)

                # Ensure complete hourly index
                missing_filled = self.ensure_complete_hourly_index(
                    db, station_id, start_date, end_date)

                # Detect missing data
                missing_analysis = self.detect_missing_data(
                    db, station_id, start_date, end_date)

                # Update log
                log = db.query(IngestionLog).get(log_id)
                log.records_fetched = len(measurements)
                log.records_inserted = inserted
                log.missing_detected = missing_analysis["missing_hours"]
                log.status = "completed"
                log.completed_at = datetime.utcnow()
                db.commit()

                logger.bind(context="ingestion").info(
                    f"Completed ingestion for {station_id}: "
                    f"{inserted} records, {missing_analysis['missing_hours']} missing"
                )

                return {
                    "station_id": station_id,
                    "records_fetched": len(measurements),
                    "records_inserted": inserted,
                    "missing_hours": missing_analysis["missing_hours"],
                    "gaps": len(missing_analysis["gaps"]),
                    "status": "completed",
                }

            except Exception as e:
                log = db.query(IngestionLog).get(log_id)
                log.status = "failed"
                log.error_message = str(e)
                log.completed_at = datetime.utcnow()
                db.commit()

                logger.error(f"Ingestion failed for {station_id}: {e}")
                return {
                    "station_id": station_id,
                    "status": "failed",
                    "error": str(e),
                }

    async def ingest_all_stations(self, days: int = 30) -> Dict[str, Any]:
        """
        Ingest data for all stations

        Args:
            days: Number of days to ingest

        Returns:
            Summary of all ingestion results
        """
        # First, fetch and save station metadata
        stations = await self.fetch_stations()

        with get_db_context() as db:
            self.save_stations(db, stations)

        # Get station IDs
        with get_db_context() as db:
            station_ids = [s.station_id for s in db.query(Station).all()]

        logger.bind(context="ingestion").info(
            f"Starting ingestion for {len(station_ids)} stations")

        results = []
        for station_id in station_ids:
            result = await self.ingest_station_data(station_id, days)
            results.append(result)
            # Small delay between stations to avoid overwhelming the API
            await asyncio.sleep(0.5)

        # Summary
        completed = sum(1 for r in results if r.get("status") == "completed")
        failed = sum(1 for r in results if r.get("status") == "failed")
        total_records = sum(r.get("records_inserted", 0) for r in results)
        total_missing = sum(r.get("missing_hours", 0) for r in results)

        return {
            "total_stations": len(station_ids),
            "completed": completed,
            "failed": failed,
            "total_records": total_records,
            "total_missing_hours": total_missing,
            "results": results,
        }

    async def ingest_hourly_update(self) -> Dict[str, Any]:
        """
        Perform hourly update for all stations with PARALLEL processing

        Performance: Uses asyncio.Semaphore to limit concurrent API calls
        while processing multiple stations simultaneously for 5-10x faster ingestion.

        Returns:
            Summary of hourly update results
        """
        import time
        start_time = time.time()

        # Fetch last 24 hours of data
        end_date = datetime.now()
        start_date = end_date - timedelta(hours=24)

        with get_db_context() as db:
            station_ids = [s.station_id for s in db.query(Station).all()]

        if not station_ids:
            # No stations yet, do a full initial load
            return await self.ingest_all_stations(days=30)

        logger.bind(context="ingestion").info(
            f"Starting PARALLEL hourly update for {len(station_ids)} stations "
            f"(max {self.max_concurrent_requests} concurrent)"
        )

        # Semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        async def fetch_and_save_station(station_id: str) -> Dict[str, Any]:
            """Fetch and save data for a single station (with semaphore)"""
            async with semaphore:
                try:
                    # Check circuit breaker
                    if not self.circuit_breaker.can_proceed():
                        return {
                            "station_id": station_id,
                            "status": "skipped",
                            "reason": "circuit_breaker_open"
                        }

                    # Fetch data
                    measurements = await self.fetch_historical_data(
                        station_id, start_date, end_date
                    )
                    records = self.parse_measurements(station_id, measurements)

                    # Save to database
                    with get_db_context() as db:
                        inserted, _ = self.save_measurements(db, records)
                        self.ensure_complete_hourly_index(
                            db, station_id, start_date, end_date
                        )

                    return {
                        "station_id": station_id,
                        "records": inserted,
                        "status": "completed"
                    }

                except Exception as e:
                    logger.error(f"Hourly update failed for {station_id}: {e}")
                    return {
                        "station_id": station_id,
                        "status": "failed",
                        "error": str(e)
                    }

        # Run all stations in parallel (limited by semaphore)
        tasks = [fetch_and_save_station(sid) for sid in station_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle any exceptions that weren't caught
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "station_id": station_ids[i],
                    "status": "failed",
                    "error": str(result)
                })
            else:
                processed_results.append(result)

        # Calculate statistics
        completed = sum(1 for r in processed_results if r.get(
            "status") == "completed")
        failed = sum(1 for r in processed_results if r.get(
            "status") == "failed")
        skipped = sum(1 for r in processed_results if r.get(
            "status") == "skipped")
        total_records = sum(r.get("records", 0) for r in processed_results)

        elapsed_time = time.time() - start_time

        logger.bind(context="ingestion").info(
            f"PARALLEL hourly update completed: {completed}/{len(station_ids)} stations "
            f"({total_records} records) in {elapsed_time:.1f}s"
        )

        return {
            "type": "hourly",
            "stations": len(station_ids),
            "completed": completed,
            "failed": failed,
            "skipped": skipped,
            "total_records": total_records,
            "elapsed_seconds": round(elapsed_time, 2),
            "results": processed_results,
        }

    async def ingest_all_stations_parallel(self, days: int = 30) -> Dict[str, Any]:
        """
        Ingest data for all stations with PARALLEL processing

        This is a faster version of ingest_all_stations using concurrent requests.

        Args:
            days: Number of days to ingest

        Returns:
            Summary of all ingestion results
        """
        import time
        start_time = time.time()

        # First, fetch and save station metadata
        stations = await self.fetch_stations()

        with get_db_context() as db:
            self.save_stations(db, stations)

        # Get station IDs
        with get_db_context() as db:
            station_ids = [s.station_id for s in db.query(Station).all()]

        logger.bind(context="ingestion").info(
            f"Starting PARALLEL batch ingestion for {len(station_ids)} stations"
        )

        semaphore = asyncio.Semaphore(self.max_concurrent_requests)

        async def ingest_station(station_id: str) -> Dict[str, Any]:
            async with semaphore:
                return await self.ingest_station_data(station_id, days)

        tasks = [ingest_station(sid) for sid in station_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "station_id": station_ids[i],
                    "status": "failed",
                    "error": str(result)
                })
            else:
                processed_results.append(result)

        # Summary
        completed = sum(1 for r in processed_results if r.get(
            "status") == "completed")
        failed = sum(1 for r in processed_results if r.get(
            "status") == "failed")
        total_records = sum(r.get("records_inserted", 0)
                            for r in processed_results)
        total_missing = sum(r.get("missing_hours", 0)
                            for r in processed_results)

        elapsed_time = time.time() - start_time

        logger.bind(context="ingestion").info(
            f"PARALLEL batch ingestion completed: {completed}/{len(station_ids)} stations "
            f"in {elapsed_time:.1f}s"
        )

        return {
            "total_stations": len(station_ids),
            "completed": completed,
            "failed": failed,
            "total_records": total_records,
            "total_missing_hours": total_missing,
            "elapsed_seconds": round(elapsed_time, 2),
            "results": processed_results,
        }


# Singleton instance
ingestion_service = IngestionService()
