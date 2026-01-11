#!/usr/bin/env python3
"""
Bulk download historical data from Air4Thai API for all stations.

This script downloads hourly data for all parameters:
PM25, PM10, O3, CO, NO2, SO2, WS, WD, TEMP, RH, BP, RAIN

Usage:
    python bulk_download_air4thai.py --start-date 2025-10-01 --end-date 2026-01-10

Or run via Docker:
    docker compose exec api python -m backend_api.scripts.bulk_download_air4thai --start-date 2025-10-01 --end-date 2026-01-10
"""

from backend_model.logger import logger
from backend_model.models import Station, AQIHourly
from backend_model.database import get_db_context, engine
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import text
import asyncio
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import httpx
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))


# Air4Thai API Configuration
AIR4THAI_HISTORY_API = "http://air4thai.com/forweb/getHistoryData.php"
PARAMS = "PM25,PM10,O3,CO,NO2,SO2,WS,WD,TEMP,RH,BP,RAIN"
MAX_CONCURRENT_REQUESTS = 5  # Limit concurrent requests to avoid overwhelming the API
REQUEST_TIMEOUT = 60  # Seconds
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2  # Seconds


class BulkDownloader:
    """Downloads historical data from Air4Thai API for all stations"""

    def __init__(self, start_date: datetime, end_date: datetime):
        self.start_date = start_date
        self.end_date = end_date
        self.client: Optional[httpx.AsyncClient] = None
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        # Statistics
        self.total_records = 0
        self.successful_stations = 0
        self.failed_stations = []

    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(REQUEST_TIMEOUT, connect=10.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30.0
            ),
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    def get_stations(self) -> List[str]:
        """Get all station IDs from database (excluding bkp* stations which don't support history API)"""
        with get_db_context() as db:
            stations = db.query(Station.station_id).all()
            # Filter out bkp* stations (Bangkok Park) - they don't support the history API
            station_ids = [
                s.station_id for s in stations if not s.station_id.startswith('bkp')]
            logger.info(
                f"Found {len(station_ids)} stations (excluding {len(stations) - len(station_ids)} bkp* stations)")
            return station_ids

    async def fetch_station_data(self, station_id: str) -> Optional[List[Dict]]:
        """Fetch historical data for a single station with retry logic"""
        params = {
            "stationID": station_id,
            "param": PARAMS,
            "type": "hr",
            "sdate": self.start_date.strftime("%Y-%m-%d"),
            "edate": self.end_date.strftime("%Y-%m-%d"),
            "stime": "00",
            "etime": "23",
        }

        for attempt in range(RETRY_ATTEMPTS):
            try:
                async with self.semaphore:
                    response = await self.client.get(AIR4THAI_HISTORY_API, params=params)
                    response.raise_for_status()
                    data = response.json()

                    if data.get("result") != "OK":
                        logger.warning(
                            f"Station {station_id}: API returned {data.get('result')}")
                        return None

                    stations_data = data.get("stations", [])
                    if not stations_data:
                        logger.warning(
                            f"Station {station_id}: No station data in response")
                        return None

                    measurements = stations_data[0].get("data", [])
                    return measurements

            except httpx.TimeoutException:
                logger.warning(
                    f"Station {station_id}: Timeout on attempt {attempt + 1}")
                if attempt < RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    logger.warning(
                        f"Station {station_id}: Rate limited, waiting 30s")
                    await asyncio.sleep(30)
                else:
                    logger.warning(
                        f"Station {station_id}: HTTP error {e.response.status_code}")
                    if attempt < RETRY_ATTEMPTS - 1:
                        await asyncio.sleep(RETRY_DELAY * (attempt + 1))
            except Exception as e:
                logger.error(f"Station {station_id}: Error - {e}")
                if attempt < RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))

        return None

    def _parse_float(self, value: Any, min_val: float = None, max_val: float = None) -> Optional[float]:
        """Safely parse a float value from API response"""
        if value is None or value == "" or value == "-":
            return None

        try:
            float_val = float(value)
            if min_val is not None and float_val < min_val:
                return None
            if max_val is not None and float_val > max_val:
                return None
            return float_val
        except (ValueError, TypeError):
            return None

    def parse_measurements(self, station_id: str, measurements: List[Dict]) -> List[Dict]:
        """Parse API response into database-ready records"""
        records = []

        for m in measurements:
            try:
                # Use DATETIMEDATA field (API response format)
                datetime_str = m.get(
                    "DATETIMEDATA", "") or m.get("DATEFROM", "")
                if not datetime_str:
                    continue

                # Parse datetime (format: 2026-01-05 00:00:00)
                try:
                    dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    try:
                        dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
                    except ValueError:
                        continue

                record = {
                    "station_id": station_id,
                    "datetime": dt,
                    # Pollutants
                    "pm25": self._parse_float(m.get("PM25"), min_val=0, max_val=999),
                    "pm10": self._parse_float(m.get("PM10"), min_val=0, max_val=999),
                    "o3": self._parse_float(m.get("O3"), min_val=0, max_val=500),
                    "co": self._parse_float(m.get("CO"), min_val=0, max_val=50),
                    "no2": self._parse_float(m.get("NO2"), min_val=0, max_val=500),
                    "so2": self._parse_float(m.get("SO2"), min_val=0, max_val=500),
                    # Meteorological
                    "ws": self._parse_float(m.get("WS"), min_val=0, max_val=50),
                    "wd": self._parse_float(m.get("WD"), min_val=0, max_val=360),
                    "temp": self._parse_float(m.get("TEMP"), min_val=-10, max_val=60),
                    "rh": self._parse_float(m.get("RH"), min_val=0, max_val=100),
                    "bp": self._parse_float(m.get("BP"), min_val=900, max_val=1100),
                    "rain": self._parse_float(m.get("RAIN"), min_val=0, max_val=500),
                    # Set all imputed flags to False (this is measured data)
                    "is_imputed": False,
                    "pm25_imputed": False,
                    "pm10_imputed": False,
                    "o3_imputed": False,
                    "co_imputed": False,
                    "no2_imputed": False,
                    "so2_imputed": False,
                    "ws_imputed": False,
                    "wd_imputed": False,
                    "temp_imputed": False,
                    "rh_imputed": False,
                    "bp_imputed": False,
                    "rain_imputed": False,
                }

                records.append(record)

            except Exception as e:
                logger.debug(f"Error parsing measurement: {e}")
                continue

        return records

    def save_records(self, records: List[Dict]) -> int:
        """Save records to database using raw SQL for better control"""
        if not records:
            return 0

        with get_db_context() as db:
            # Use raw SQL INSERT with ON CONFLICT for upsert
            sql = text("""
                INSERT INTO aqi_hourly (
                    station_id, datetime, pm25, pm10, o3, co, no2, so2,
                    ws, wd, temp, rh, bp, rain,
                    is_imputed, pm25_imputed, pm10_imputed, o3_imputed,
                    co_imputed, no2_imputed, so2_imputed, ws_imputed,
                    wd_imputed, temp_imputed, rh_imputed, bp_imputed, rain_imputed
                ) VALUES (
                    :station_id, :datetime, :pm25, :pm10, :o3, :co, :no2, :so2,
                    :ws, :wd, :temp, :rh, :bp, :rain,
                    :is_imputed, :pm25_imputed, :pm10_imputed, :o3_imputed,
                    :co_imputed, :no2_imputed, :so2_imputed, :ws_imputed,
                    :wd_imputed, :temp_imputed, :rh_imputed, :bp_imputed, :rain_imputed
                )
                ON CONFLICT (station_id, datetime) DO UPDATE SET
                    pm25 = EXCLUDED.pm25,
                    pm10 = EXCLUDED.pm10,
                    o3 = EXCLUDED.o3,
                    co = EXCLUDED.co,
                    no2 = EXCLUDED.no2,
                    so2 = EXCLUDED.so2,
                    ws = EXCLUDED.ws,
                    wd = EXCLUDED.wd,
                    temp = EXCLUDED.temp,
                    rh = EXCLUDED.rh,
                    bp = EXCLUDED.bp,
                    rain = EXCLUDED.rain
            """)

            # Execute in batches for performance
            batch_size = 500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                for record in batch:
                    db.execute(sql, record)

            db.commit()

        return len(records)

    async def process_station(self, station_id: str) -> int:
        """Process a single station: fetch data and save to database"""
        logger.info(f"📥 Downloading data for station {station_id}...")

        measurements = await self.fetch_station_data(station_id)

        if not measurements:
            self.failed_stations.append(station_id)
            return 0

        records = self.parse_measurements(station_id, measurements)

        if not records:
            logger.warning(f"Station {station_id}: No valid records parsed")
            self.failed_stations.append(station_id)
            return 0

        saved_count = self.save_records(records)
        self.successful_stations += 1
        self.total_records += saved_count

        logger.info(f"✅ Station {station_id}: Saved {saved_count} records")
        return saved_count

    async def run(self):
        """Run the bulk download process"""
        stations = self.get_stations()
        total_stations = len(stations)

        logger.info("=" * 60)
        logger.info("🚀 BULK DOWNLOAD FROM AIR4THAI API")
        logger.info("=" * 60)
        logger.info(
            f"📅 Date Range: {self.start_date.date()} to {self.end_date.date()}")
        logger.info(f"🏭 Total Stations: {total_stations}")
        logger.info(f"📊 Parameters: {PARAMS}")
        logger.info("=" * 60)

        # Process stations with progress
        for i, station_id in enumerate(stations, 1):
            logger.info(
                f"\n[{i}/{total_stations}] Processing station {station_id}")
            await self.process_station(station_id)

            # Small delay between stations to be nice to the API
            await asyncio.sleep(0.5)

        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("📊 DOWNLOAD SUMMARY")
        logger.info("=" * 60)
        logger.info(
            f"✅ Successful Stations: {self.successful_stations}/{total_stations}")
        logger.info(f"❌ Failed Stations: {len(self.failed_stations)}")
        logger.info(f"📝 Total Records Saved: {self.total_records:,}")

        if self.failed_stations:
            logger.info(
                f"\n❌ Failed Stations: {', '.join(self.failed_stations)}")

        logger.info("=" * 60)


async def main():
    parser = argparse.ArgumentParser(
        description="Bulk download historical data from Air4Thai API"
    )
    parser.add_argument(
        "--start-date",
        type=str,
        required=True,
        help="Start date (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end-date",
        type=str,
        required=True,
        help="End date (YYYY-MM-DD)"
    )

    args = parser.parse_args()

    try:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d")
    except ValueError as e:
        logger.error(f"Invalid date format: {e}")
        sys.exit(1)

    if start_date > end_date:
        logger.error("Start date must be before end date")
        sys.exit(1)

    async with BulkDownloader(start_date, end_date) as downloader:
        await downloader.run()


if __name__ == "__main__":
    asyncio.run(main())
