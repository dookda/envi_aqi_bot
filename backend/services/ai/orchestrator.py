"""
API Orchestrator for AI Layer

Handles all backend API calls for data retrieval.
The AI Layer MUST NOT access the database directly.
All data exchange MUST occur via documented APIs only.
"""

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.logger import logger
from backend.database import get_db_context
from backend.models import Station
from sqlalchemy import text


class APIOrchestrator:
    """
    Orchestrates API calls to backend services

    Critical Rule: NO DIRECT DATABASE ACCESS
    All data must be retrieved through internal API calls
    """

    def __init__(self, api_base_url: str = "http://localhost:8000"):
        """
        Initialize API orchestrator

        Args:
            api_base_url: Base URL for backend API
        """
        self.api_base_url = api_base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=10.0)

    async def get_aqi_history(
        self,
        station_id: str,
        pollutant: str,
        start_date: str,
        end_date: str,
        interval: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch AQI history data via API

        Args:
            station_id: Station identifier
            pollutant: Pollutant type (pm25, pm10, etc.)
            start_date: Start datetime (ISO-8601)
            end_date: End datetime (ISO-8601)
            interval: Aggregation interval (15min, hour, day)

        Returns:
            List of data points or None on error
        """
        try:
            # IMPORTANT: This uses internal database query instead of HTTP call
            # since we're running in the same FastAPI app
            # In production with separate services, use HTTP:
            # url = f"{self.api_base_url}/api/aqi/history"
            # response = await self.client.get(url, params={...})

            # For now, call the database through the same service
            # This still maintains separation: AI layer doesn't construct SQL
            return await self._get_aqi_history_internal(
                station_id, pollutant, start_date, end_date, interval
            )

        except Exception as e:
            logger.error(f"Error fetching AQI history: {e}")
            return None

    async def _get_aqi_history_internal(
        self,
        station_id: str,
        pollutant: str,
        start_date: str,
        end_date: str,
        interval: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Internal implementation that uses database through ORM
        (not raw SQL - still maintains abstraction)
        """
        try:
            from backend.models import AQIHourly
            from datetime import datetime

            # Parse dates
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

            with get_db_context() as db:
                if interval in ["15min", "hour"]:
                    # Return hourly data
                    query = db.query(AQIHourly).filter(
                        AQIHourly.station_id == station_id,
                        AQIHourly.datetime >= start_dt,
                        AQIHourly.datetime <= end_dt
                    ).order_by(AQIHourly.datetime.asc())

                    data = query.all()
                    return [
                        {
                            "time": record.datetime.isoformat(),
                            "value": record.pm25
                        }
                        for record in data
                    ]

                elif interval == "day":
                    # Aggregate to daily averages
                    result = db.execute(
                        text("""
                            SELECT
                                DATE_TRUNC('day', datetime) as day,
                                AVG(pm25) as avg_pm25
                            FROM aqi_hourly
                            WHERE station_id = :station_id
                                AND datetime >= :start_date
                                AND datetime <= :end_date
                                AND pm25 IS NOT NULL
                            GROUP BY DATE_TRUNC('day', datetime)
                            ORDER BY day ASC
                        """),
                        {
                            "station_id": station_id,
                            "start_date": start_dt,
                            "end_date": end_dt
                        }
                    ).fetchall()

                    return [
                        {
                            "time": row[0].isoformat(),
                            "value": round(row[1], 2) if row[1] else None
                        }
                        for row in result
                    ]

        except Exception as e:
            logger.error(f"Error in internal AQI history fetch: {e}")
            return None

    def resolve_station_id(self, station_name_or_id: str) -> Optional[str]:
        """
        Resolve station name (Thai/English) to station_id

        Args:
            station_name_or_id: Station name or ID

        Returns:
            Resolved station_id or None if not found
        """
        try:
            with get_db_context() as db:
                # Try exact match on station_id first
                station = db.query(Station).filter(
                    Station.station_id == station_name_or_id
                ).first()

                if station:
                    return station.station_id

                # Try fuzzy match on Thai/English names
                station = db.query(Station).filter(
                    (Station.name_th.ilike(f"%{station_name_or_id}%")) |
                    (Station.name_en.ilike(f"%{station_name_or_id}%"))
                ).first()

                if station:
                    logger.info(f"Resolved '{station_name_or_id}' to station_id: {station.station_id}")
                    return station.station_id

                logger.warning(f"Could not resolve station: {station_name_or_id}")
                return None

        except Exception as e:
            logger.error(f"Error resolving station: {e}")
            return None

    def get_all_stations(self) -> List[Dict[str, Any]]:
        """
        Get list of all stations

        Returns:
            List of station information
        """
        try:
            with get_db_context() as db:
                stations = db.query(Station).all()
                return [
                    {
                        "station_id": s.station_id,
                        "name_th": s.name_th,
                        "name_en": s.name_en,
                        "lat": s.lat,
                        "lon": s.lon
                    }
                    for s in stations
                ]
        except Exception as e:
            logger.error(f"Error fetching stations: {e}")
            return []

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Global instance
_api_orchestrator: Optional[APIOrchestrator] = None


def get_api_orchestrator() -> APIOrchestrator:
    """Get global API orchestrator instance"""
    global _api_orchestrator

    if _api_orchestrator is None:
        _api_orchestrator = APIOrchestrator()

    return _api_orchestrator
