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
from app.logger import logger
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
        4. API orchestration for data retrieval
        5. Response composition

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
        values = [point["value"] for point in data if point["value"] is not None]

        if not values:
            return {
                "data_points": len(data),
                "valid_points": 0,
                "missing_points": len(data),
                "min": None,
                "max": None,
                "mean": None,
                "trend": "no_data"
            }

        summary = {
            "data_points": len(data),
            "valid_points": len(values),
            "missing_points": len(data) - len(values),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "mean": round(sum(values) / len(values), 2),
        }

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
