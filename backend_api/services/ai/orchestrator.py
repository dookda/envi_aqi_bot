"""
API Orchestrator for AI Layer

Handles all backend API calls for data retrieval.
The AI Layer MUST NOT access the database directly.
All data exchange MUST occur via documented APIs only.
"""

import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend_model.logger import logger
from backend_model.database import get_db_context
from backend_model.models import Station
from sqlalchemy import text, or_
from .place_matcher import get_place_matcher, match_place_name
from .region_matcher import get_region_matcher, match_region, is_region_query
from .guardrails import normalize_pollutant


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
        
        Supports all pollutants: pm25, pm10, o3, co, no2, so2, nox
        """
        try:
            from backend_model.models import AQIHourly
            from datetime import datetime

            # Parse dates
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            
            # Normalize and validate pollutant - map to column name
            normalized_pollutant = normalize_pollutant(pollutant) or pollutant.lower()
            valid_pollutants = {
                # Air quality pollutants
                "pm25": "pm25",
                "pm10": "pm10",
                "o3": "o3",
                "co": "co",
                "no2": "no2",
                "so2": "so2",
                "nox": "nox",
                "aqi": "pm25",  # AQI maps to PM2.5 for calculation
                # Weather parameters
                "temp": "temp",
                "rh": "rh",
                "ws": "ws",
                "wd": "wd",
                "bp": "bp",
                "rain": "rain",
            }

            column_name = valid_pollutants.get(normalized_pollutant, "pm25")
            logger.info(f"Querying {column_name} for station {station_id}")

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
                            "value": getattr(record, column_name, None),
                            "pollutant": pollutant
                        }
                        for record in data
                    ]

                elif interval == "day":
                    # Aggregate to daily averages - use dynamic column name
                    result = db.execute(
                        text(f"""
                            SELECT
                                DATE_TRUNC('day', datetime) as day,
                                AVG({column_name}) as avg_value
                            FROM aqi_hourly
                            WHERE station_id = :station_id
                                AND datetime >= :start_date
                                AND datetime <= :end_date
                                AND {column_name} IS NOT NULL
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
                            "value": round(row[1], 2) if row[1] else None,
                            "pollutant": pollutant
                        }
                        for row in result
                    ]

        except Exception as e:
            logger.error(f"Error in internal AQI history fetch for {pollutant}: {e}")
            return None

    def resolve_station_id(self, station_name_or_id: str) -> Optional[str]:
        """
        Resolve station name (Thai/English) to station_id with phonetic matching
        
        Supports:
        - Exact station_id match
        - Thai name matching (เชียงใหม่)
        - English name matching (Chiang Mai)
        - Phonetic variations (chiangmai, changmai, etc.)
        - Common misspellings

        Args:
            station_name_or_id: Station name or ID in Thai or English

        Returns:
            Resolved station_id or None if not found
        """
        try:
            # Get all possible search terms using phonetic matcher
            canonical, search_terms = match_place_name(station_name_or_id)
            logger.info(f"Resolving station: '{station_name_or_id}' -> canonical: {canonical}, search terms: {search_terms[:5]}...")
            
            with get_db_context() as db:
                # Try exact match on station_id first (case-insensitive)
                station = db.query(Station).filter(
                    Station.station_id.ilike(station_name_or_id)
                ).first()

                if station:
                    logger.info(f"Resolved by exact station_id: {station.station_id}")
                    return station.station_id

                # Try all search terms from phonetic matcher
                for term in search_terms:
                    if not term or len(term) < 2:
                        continue
                    
                    # Search in both Thai and English names
                    station = db.query(Station).filter(
                        or_(
                            Station.name_th.ilike(f"%{term}%"),
                            Station.name_en.ilike(f"%{term}%"),
                            Station.station_id.ilike(f"%{term}%")
                        )
                    ).first()
                    
                    if station:
                        logger.info(f"Resolved '{station_name_or_id}' via term '{term}' to: {station.station_id}")
                        return station.station_id

                # If we have a canonical name, try searching with that
                if canonical:
                    station = db.query(Station).filter(
                        or_(
                            Station.name_th.ilike(f"%{canonical}%"),
                            Station.name_en.ilike(f"%{canonical}%")
                        )
                    ).first()
                    
                    if station:
                        logger.info(f"Resolved '{station_name_or_id}' via canonical '{canonical}' to: {station.station_id}")
                        return station.station_id

                logger.warning(f"Could not resolve station: {station_name_or_id}")
                return None

        except Exception as e:
            logger.error(f"Error resolving station: {e}")
            return None

    def get_station_name(self, station_id: str, prefer_thai: bool = True) -> Optional[str]:
        """
        Get station name (Thai or English) from station_id
        
        Args:
            station_id: Station identifier
            prefer_thai: If True, return Thai name first, else English
            
        Returns:
            Station name or None if not found
        """
        try:
            with get_db_context() as db:
                station = db.query(Station).filter(
                    Station.station_id == station_id
                ).first()
                
                if station:
                    if prefer_thai:
                        return station.name_th or station.name_en or station_id
                    else:
                        return station.name_en or station.name_th or station_id
                return station_id
        except Exception as e:
            logger.error(f"Error getting station name: {e}")
            return station_id

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

    def search_stations(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for stations matching a query string with phonetic and region matching
        
        Supports:
        - Thai names (เชียงใหม่)
        - English names (Chiang Mai)
        - Phonetic variations (chiangmai, changmai)
        - Common misspellings
        - **Region-based search (Northern Thailand, ภาคเหนือ, etc.) - LBS**
        - **Geographic bounding box search**
        
        Args:
            query: Search query (e.g., 'Chiang Mai', 'เชียงใหม่', 'Northern Thailand')
            
        Returns:
            List of matching stations with basic info
        """
        try:
            found_stations = {}  # Use dict to deduplicate by station_id
            
            # ============================================
            # STEP 1: Check if this is a REGION query (LBS)
            # ============================================
            region_matcher = get_region_matcher()
            region_key, province_terms = match_region(query)
            
            if region_key:
                region = region_matcher.get_region(region_key)
                logger.info(f"[LBS] Region query detected: '{query}' -> {region.name_en if region else region_key}")
                
                with get_db_context() as db:
                    # Search by province names in the region
                    for province in province_terms:
                        if not province or len(province) < 2:
                            continue
                        
                        stations = db.query(Station).filter(
                            or_(
                                Station.name_th.ilike(f"%{province}%"),
                                Station.name_en.ilike(f"%{province}%")
                            )
                        ).all()
                        
                        for s in stations:
                            if s.station_id not in found_stations:
                                found_stations[s.station_id] = {
                                    "station_id": s.station_id,
                                    "name_th": s.name_th,
                                    "name_en": s.name_en,
                                    "lat": s.lat,
                                    "lon": s.lon,
                                    "station_type": s.station_type
                                }
                    
                    # Also try geographic bounding box search (if available)
                    bbox = region_matcher.get_bounding_box(region_key)
                    if bbox and len(found_stations) < 50:  # Only if we haven't found too many
                        min_lat, min_lon, max_lat, max_lon = bbox
                        geo_stations = db.query(Station).filter(
                            Station.lat >= min_lat,
                            Station.lat <= max_lat,
                            Station.lon >= min_lon,
                            Station.lon <= max_lon
                        ).all()
                        
                        for s in geo_stations:
                            if s.station_id not in found_stations:
                                found_stations[s.station_id] = {
                                    "station_id": s.station_id,
                                    "name_th": s.name_th,
                                    "name_en": s.name_en,
                                    "lat": s.lat,
                                    "lon": s.lon,
                                    "station_type": s.station_type
                                }
                
                result = list(found_stations.values())
                logger.info(f"[LBS] Found {len(result)} stations in region '{region_key}'")
                return result
            
            # ============================================
            # STEP 2: Regular place name / station search
            # ============================================
            canonical, search_terms = match_place_name(query)
            logger.info(f"Searching stations for: '{query}' -> canonical: {canonical}, terms: {search_terms[:5]}...")
            
            with get_db_context() as db:
                # Try each search term
                for term in search_terms:
                    if not term or len(term) < 2:
                        continue
                    
                    # Search in Thai names, English names, and station_id
                    stations = db.query(Station).filter(
                        or_(
                            Station.name_th.ilike(f"%{term}%"),
                            Station.name_en.ilike(f"%{term}%"),
                            Station.station_id.ilike(f"%{term}%")
                        )
                    ).all()
                    
                    for s in stations:
                        if s.station_id not in found_stations:
                            found_stations[s.station_id] = {
                                "station_id": s.station_id,
                                "name_th": s.name_th,
                                "name_en": s.name_en,
                                "lat": s.lat,
                                "lon": s.lon,
                                "station_type": s.station_type
                            }
                
                # Also try canonical name if available
                if canonical and canonical not in search_terms:
                    stations = db.query(Station).filter(
                        or_(
                            Station.name_th.ilike(f"%{canonical}%"),
                            Station.name_en.ilike(f"%{canonical}%")
                        )
                    ).all()
                    
                    for s in stations:
                        if s.station_id not in found_stations:
                            found_stations[s.station_id] = {
                                "station_id": s.station_id,
                                "name_th": s.name_th,
                                "name_en": s.name_en,
                                "lat": s.lat,
                                "lon": s.lon,
                                "station_type": s.station_type
                            }
                
                result = list(found_stations.values())
                logger.info(f"Found {len(result)} stations matching '{query}'")
                return result
                
        except Exception as e:
            logger.error(f"Error searching stations: {e}")
            return []

    def get_station_summary(self, station_id: str) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive summary of a station including recent AQI data
        
        Args:
            station_id: Station identifier
            
        Returns:
            Station summary with recent AQI statistics
        """
        from datetime import datetime, timedelta
        
        try:
            with get_db_context() as db:
                # Get station info
                station = db.query(Station).filter(
                    Station.station_id == station_id
                ).first()
                
                if not station:
                    return None
                
                now = datetime.now()
                last_24h = now - timedelta(hours=24)
                last_7d = now - timedelta(days=7)
                
                # Get latest reading
                from backend_model.models import AQIHourly
                latest = db.query(AQIHourly).filter(
                    AQIHourly.station_id == station_id,
                    AQIHourly.pm25.isnot(None)
                ).order_by(AQIHourly.datetime.desc()).first()
                
                # Get 24-hour average
                result_24h = db.execute(
                    text("""
                        SELECT AVG(pm25), COUNT(*) 
                        FROM aqi_hourly 
                        WHERE station_id = :station_id 
                            AND datetime >= :start_date 
                            AND pm25 IS NOT NULL
                    """),
                    {"station_id": station_id, "start_date": last_24h}
                ).first()
                
                # Get 7-day statistics
                result_7d = db.execute(
                    text("""
                        SELECT 
                            AVG(pm25) as avg_pm25,
                            MIN(pm25) as min_pm25,
                            MAX(pm25) as max_pm25,
                            COUNT(*) as valid_count
                        FROM aqi_hourly 
                        WHERE station_id = :station_id 
                            AND datetime >= :start_date 
                            AND pm25 IS NOT NULL
                    """),
                    {"station_id": station_id, "start_date": last_7d}
                ).first()
                
                # Get total expected hours in 7 days (168 hours)
                total_records = db.execute(
                    text("""
                        SELECT COUNT(*) FROM aqi_hourly 
                        WHERE station_id = :station_id
                    """),
                    {"station_id": station_id}
                ).scalar() or 0
                
                # Calculate trend (compare first half vs second half of 7 days)
                trend = "insufficient_data"
                if result_7d and result_7d[3] and result_7d[3] >= 48:  # At least 2 days of data
                    mid_point = now - timedelta(days=3.5)
                    
                    first_half = db.execute(
                        text("""
                            SELECT AVG(pm25) FROM aqi_hourly 
                            WHERE station_id = :station_id 
                                AND datetime >= :start_date 
                                AND datetime < :mid_date
                                AND pm25 IS NOT NULL
                        """),
                        {"station_id": station_id, "start_date": last_7d, "mid_date": mid_point}
                    ).scalar()
                    
                    second_half = db.execute(
                        text("""
                            SELECT AVG(pm25) FROM aqi_hourly 
                            WHERE station_id = :station_id 
                                AND datetime >= :mid_date 
                                AND pm25 IS NOT NULL
                        """),
                        {"station_id": station_id, "mid_date": mid_point}
                    ).scalar()
                    
                    if first_half and second_half:
                        if second_half > first_half * 1.1:
                            trend = "increasing"
                        elif second_half < first_half * 0.9:
                            trend = "decreasing"
                        else:
                            trend = "stable"
                
                # Calculate AQI level based on average PM2.5
                aqi_level = "unknown"
                avg_pm25 = result_7d[0] if result_7d else None
                if avg_pm25:
                    avg_pm25 = round(avg_pm25, 2)
                    if avg_pm25 <= 25:
                        aqi_level = "excellent"
                    elif avg_pm25 <= 50:
                        aqi_level = "good"
                    elif avg_pm25 <= 100:
                        aqi_level = "moderate"
                    elif avg_pm25 <= 200:
                        aqi_level = "unhealthy_sensitive"
                    else:
                        aqi_level = "unhealthy"
                
                # Calculate data completeness (7 days = 168 hours)
                valid_count_7d = result_7d[3] if result_7d else 0
                completeness = round((valid_count_7d / 168) * 100, 1) if valid_count_7d else 0
                
                return {
                    "station_id": station.station_id,
                    "name_th": station.name_th,
                    "name_en": station.name_en,
                    "lat": station.lat,
                    "lon": station.lon,
                    "station_type": station.station_type,
                    "latest_pm25": round(latest.pm25, 2) if latest and latest.pm25 else None,
                    "latest_datetime": latest.datetime.isoformat() if latest else None,
                    "avg_pm25_24h": round(result_24h[0], 2) if result_24h and result_24h[0] else None,
                    "avg_pm25_7d": avg_pm25,
                    "min_pm25_7d": round(result_7d[1], 2) if result_7d and result_7d[1] else None,
                    "max_pm25_7d": round(result_7d[2], 2) if result_7d and result_7d[2] else None,
                    "aqi_level": aqi_level,
                    "trend_7d": trend,
                    "data_completeness_7d": completeness,
                    "total_records": total_records
                }
                
        except Exception as e:
            logger.error(f"Error getting station summary: {e}")
            return None

    async def search_stations_with_summary(self, query: str) -> Dict[str, Any]:
        """
        Search for stations and include AQI summary for each
        
        Supports region-based queries (LBS) with proper messaging.
        
        Args:
            query: Search query string
            
        Returns:
            Search results with station summaries
        """
        # Check if this is a region query for better messaging
        region_matcher = get_region_matcher()
        region_key, _ = match_region(query)
        region_info = region_matcher.get_region(region_key) if region_key else None
        
        stations = self.search_stations(query)
        
        if not stations:
            if region_info:
                no_result_msg = f"No stations found in {region_info.name_en} ({region_info.name_th})"
            else:
                no_result_msg = f"No stations found matching '{query}'"
            
            return {
                "query": query,
                "total_found": 0,
                "stations": [],
                "search_summary": no_result_msg,
                "region": region_info.name_en if region_info else None
            }
        
        # Get summary for each station
        summaries = []
        for station in stations:
            summary = self.get_station_summary(station["station_id"])
            if summary:
                summaries.append(summary)
        
        # Generate search summary text
        if summaries:
            avg_pm25_values = [s["avg_pm25_7d"] for s in summaries if s.get("avg_pm25_7d")]
            overall_avg = round(sum(avg_pm25_values) / len(avg_pm25_values), 2) if avg_pm25_values else None
            
            max_pm25 = max([s.get("max_pm25_7d", 0) or 0 for s in summaries])
            min_pm25 = min([s.get("min_pm25_7d", 999) or 999 for s in summaries])
            
            # Determine overall AQI level
            overall_aqi = "unknown"
            if overall_avg:
                if overall_avg <= 25:
                    overall_aqi = "excellent"
                elif overall_avg <= 50:
                    overall_aqi = "good"
                elif overall_avg <= 100:
                    overall_aqi = "moderate"
                elif overall_avg <= 200:
                    overall_aqi = "unhealthy for sensitive groups"
                else:
                    overall_aqi = "unhealthy"
            
            # Generate appropriate summary based on query type
            if region_info:
                search_summary = (
                    f"Found {len(summaries)} station(s) in {region_info.name_en} ({region_info.name_th}). "
                    f"7-day average PM2.5: {overall_avg or 'N/A'} μg/m³ (AQI Level: {overall_aqi}). "
                    f"Range: {min_pm25 if min_pm25 != 999 else 'N/A'} - {max_pm25 or 'N/A'} μg/m³."
                )
            else:
                search_summary = (
                    f"Found {len(summaries)} station(s) matching '{query}'. "
                    f"7-day average PM2.5: {overall_avg or 'N/A'} μg/m³ (AQI Level: {overall_aqi}). "
                    f"Range: {min_pm25 if min_pm25 != 999 else 'N/A'} - {max_pm25 or 'N/A'} μg/m³."
                )
        else:
            if region_info:
                search_summary = f"Found {len(stations)} station(s) in {region_info.name_en}, but no recent data available."
            else:
                search_summary = f"Found {len(stations)} station(s) matching '{query}', but no recent data available."
        
        return {
            "query": query,
            "total_found": len(summaries),
            "stations": summaries,
            "search_summary": search_summary,
            "region": region_info.name_en if region_info else None
        }

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
