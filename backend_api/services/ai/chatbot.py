"""
Air Quality Chatbot Service

Main service that orchestrates:
1. Guardrail filtering (3 layers)
2. LLM intent parsing
3. API data retrieval
4. Response composition
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from backend_model.logger import logger
from .guardrails import (
    keyword_filter,
    get_system_prompt,
    validate_intent
)
from .llm_adapter import get_ollama_adapter
from .orchestrator import get_api_orchestrator


class AirQualityChatbotService:
    """
    Air Quality Chatbot Service with Local LLM

    Provides natural language querying for air quality data
    with strict guardrails and API-mediated data access.
    """

    def __init__(self):
        self.llm_adapter = get_ollama_adapter()
        self.orchestrator = get_api_orchestrator()

    async def process_query(self, user_query: str) -> Dict[str, Any]:
        """
        Process natural language query end-to-end

        Flow:
        1. Layer 1: Keyword filter (pre-LLM)
        2. Layer 2: LLM intent parsing with domain-restricted prompt
        3. Layer 3: Intent validation (post-LLM)
        4. Route to appropriate handler (search or data retrieval)
        5. Response composition

        Supports two intent types:
        - search_stations: Search for stations by location/name
        - get_data: Get air quality data for a specific station

        Args:
            user_query: Natural language query (Thai or English)

        Returns:
            Response dictionary with status, message, data, etc.
        """
        logger.info(f"Processing query: {user_query[:100]}")

        # === LAYER 1: KEYWORD FILTER (PRE-LLM) ===
        keyword_result = keyword_filter(user_query)
        if not keyword_result["passed"]:
            return {
                "status": keyword_result["status"],
                "message": keyword_result["message"],
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None
            }

        # === LAYER 2: LLM INTENT PARSING ===
        current_datetime = datetime.now().isoformat()
        system_prompt = get_system_prompt(current_datetime)

        llm_output = await self.llm_adapter.generate(
            prompt=user_query,
            system_prompt=system_prompt,
            temperature=0.1  # Low temperature for deterministic JSON
        )

        if llm_output is None:
            logger.error("LLM failed to generate output")
            return {
                "status": "error",
                "message": "AI service temporarily unavailable. Please try again.",
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None
            }

        # === LAYER 3: INTENT VALIDATION (POST-LLM) ===
        validation_result = validate_intent(llm_output)
        if not validation_result["valid"]:
            return {
                "status": validation_result["status"],
                "message": validation_result["message"],
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None
            }

        intent = validation_result["intent"]
        logger.info(f"Validated intent: {intent}")

        # === ROUTE BASED ON INTENT TYPE ===
        intent_type = intent.get("intent_type", "get_data")
        
        if intent_type == "search_stations":
            return await self._handle_search_stations(intent)
        else:
            return await self._handle_get_data(intent)

    async def _handle_search_stations(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle station search intent
        
        Args:
            intent: Validated search intent with search_query
            
        Returns:
            Response with search results and summary
        """
        search_query = intent.get("search_query", "")
        logger.info(f"Handling search_stations for: {search_query}")
        
        # Search for stations using orchestrator
        search_result = await self.orchestrator.search_stations_with_summary(search_query)
        
        if search_result["total_found"] == 0:
            return {
                "status": "success",
                "message": f"No stations found matching '{search_query}'. Please try a different location name.",
                "intent": intent,
                "data": None,
                "summary": {
                    "query": search_query,
                    "total_found": 0,
                    "stations": []
                },
                "output_type": "text"
            }
        
        # Format station data for response
        stations_data = search_result["stations"]
        
        # Create a comprehensive summary
        summary = {
            "query": search_query,
            "total_found": search_result["total_found"],
            "search_summary": search_result["search_summary"],
            "stations": stations_data
        }
        
        # Generate human-readable message
        station_names = [
            s.get("name_en") or s.get("name_th") or s.get("station_id") 
            for s in stations_data[:5]  # Show first 5
        ]
        station_list = ", ".join(station_names)
        
        avg_values = [s.get("avg_pm25_7d") for s in stations_data if s.get("avg_pm25_7d")]
        overall_avg = round(sum(avg_values) / len(avg_values), 1) if avg_values else None
        
        message = (
            f"🔍 **Found {search_result['total_found']} station(s) in {search_query}:**\n\n"
            f"📍 Stations: {station_list}\n"
        )
        
        if overall_avg:
            message += f"📊 7-day Average PM2.5: {overall_avg} μg/m³\n"
            message += f"💨 {search_result['search_summary']}"
        
        return {
            "status": "success",
            "message": message,
            "intent": intent,
            "data": stations_data,
            "summary": summary,
            "output_type": intent.get("output_type", "text")
        }

    async def _handle_get_data(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle air quality data retrieval intent
        
        Args:
            intent: Validated data intent with station_id, pollutant, dates
            
        Returns:
            Response with AQI data and summary
        """
        # === RESOLVE STATION ID ===
        # Station name might be in Thai, need to resolve to station_id
        resolved_station_id = self.orchestrator.resolve_station_id(intent["station_id"])
        if not resolved_station_id:
            return {
                "status": "invalid_request",
                "message": f"Station '{intent['station_id']}' not found. Please check the station name.",
                "intent": intent,
                "data": None,
                "summary": None,
                "output_type": intent.get("output_type")
            }

        # Update intent with resolved station_id
        intent["station_id"] = resolved_station_id

        # === API DATA RETRIEVAL ===
        data = await self.orchestrator.get_aqi_history(
            station_id=intent["station_id"],
            pollutant=intent["pollutant"],
            start_date=intent["start_date"],
            end_date=intent["end_date"],
            interval=intent["interval"]
        )

        if data is None:
            return {
                "status": "error",
                "message": "Failed to retrieve air quality data. Please try again.",
                "intent": intent,
                "data": None,
                "summary": None,
                "output_type": intent.get("output_type")
            }

        # === RESPONSE COMPOSITION ===
        summary = self._compose_summary(data, intent)

        return {
            "status": "success",
            "message": None,
            "intent": intent,
            "data": data,
            "summary": summary,
            "output_type": intent.get("output_type")
        }

    def _compose_summary(
        self,
        data: List[Dict[str, Any]],
        intent: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compose summary statistics from data

        Args:
            data: List of data points
            intent: Parsed intent

        Returns:
            Summary statistics dictionary
        """
        from dateutil import parser as date_parser

        values = [point["value"] for point in data if point["value"] is not None]

        if not values:
            return {
                "query_time": datetime.now().isoformat(),
                "period_start": intent.get("start_date"),
                "period_end": intent.get("end_date"),
                "data_points": len(data),
                "valid_points": 0,
                "missing_points": len(data),
                "min": None,
                "max": None,
                "mean": None,
                "trend": "no_data"
            }

        summary = {
            "query_time": datetime.now().isoformat(),
            "period_start": intent.get("start_date"),
            "period_end": intent.get("end_date"),
            "data_points": len(data),
            "valid_points": len(values),
            "missing_points": len(data) - len(values),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "mean": round(sum(values) / len(values), 2),
        }

        # Add human-readable period description
        if intent.get("start_date") and intent.get("end_date"):
            try:
                start_dt = date_parser.parse(intent["start_date"])
                end_dt = date_parser.parse(intent["end_date"])
                days_diff = (end_dt - start_dt).days + 1

                if days_diff == 1:
                    summary["period_description"] = f"{start_dt.strftime('%B %d, %Y')}"
                elif days_diff <= 7:
                    summary["period_description"] = f"{days_diff} days ({start_dt.strftime('%b %d')} - {end_dt.strftime('%b %d, %Y')})"
                else:
                    summary["period_description"] = f"{days_diff} days ({start_dt.strftime('%b %d, %Y')} - {end_dt.strftime('%b %d, %Y')})"
            except Exception:
                pass

        # Simple trend analysis
        if len(values) >= 2:
            mid_point = len(values) // 2
            first_half_avg = sum(values[:mid_point]) / mid_point
            second_half_avg = sum(values[mid_point:]) / (len(values) - mid_point)

            if second_half_avg > first_half_avg * 1.1:
                summary["trend"] = "increasing"
            elif second_half_avg < first_half_avg * 0.9:
                summary["trend"] = "decreasing"
            else:
                summary["trend"] = "stable"
        else:
            summary["trend"] = "insufficient_data"

        # AQI level classification (for PM2.5)
        if intent["pollutant"] == "pm25":
            mean_value = summary["mean"]
            if mean_value <= 25:
                summary["aqi_level"] = "excellent"
            elif mean_value <= 50:
                summary["aqi_level"] = "good"
            elif mean_value <= 100:
                summary["aqi_level"] = "moderate"
            elif mean_value <= 200:
                summary["aqi_level"] = "unhealthy_sensitive"
            else:
                summary["aqi_level"] = "unhealthy"

        return summary

    async def health_check(self) -> Dict[str, Any]:
        """
        Check health of AI service components

        Returns:
            Health status dictionary
        """
        llm_healthy = await self.llm_adapter.is_healthy()

        return {
            "llm_service": "healthy" if llm_healthy else "unavailable",
            "orchestrator": "healthy",
            "guardrails": "active"
        }


# Global service instance
_chatbot_service: Optional[AirQualityChatbotService] = None


def get_chatbot_service() -> AirQualityChatbotService:
    """Get global chatbot service instance"""
    global _chatbot_service

    if _chatbot_service is None:
        _chatbot_service = AirQualityChatbotService()

    return _chatbot_service


# Export service instance
chatbot_service = get_chatbot_service()
