"""
Claude AI-Powered Air Quality Chatbot Service

Uses Anthropic Claude API for faster performance compared to Ollama.
Shares the same guardrails and orchestrator as the Ollama version.
"""

from typing import Dict, Any, Optional
from datetime import datetime
from backend_model.logger import logger
from .guardrails import (
    keyword_filter,
    get_system_prompt,
    validate_intent
)
from .claude_adapter import get_claude_adapter
from .orchestrator import get_api_orchestrator


class ClaudeChatbotService:
    """
    Claude AI-Powered Air Quality Chatbot Service

    Uses Anthropic Claude API for faster inference while maintaining
    the same guardrails and data access patterns as Ollama version.
    """

    def __init__(self):
        self.llm_adapter = get_claude_adapter()
        self.orchestrator = get_api_orchestrator()

    async def process_query(self, user_query: str) -> Dict[str, Any]:
        """
        Process natural language query using Claude AI

        Same flow as Ollama version but with faster inference.

        Args:
            user_query: Natural language query (Thai or English)

        Returns:
            Response dictionary with status, message, data, etc.
        """
        import time
        start_time = time.time()
        
        logger.info(f"[Claude] Processing query: {user_query[:100]}")

        # === LAYER 1: KEYWORD FILTER (PRE-LLM) ===
        keyword_result = keyword_filter(user_query)
        if not keyword_result["passed"]:
            return {
                "status": keyword_result["status"],
                "message": keyword_result["message"],
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None,
                "llm_provider": "claude",
                "response_time_ms": int((time.time() - start_time) * 1000)
            }

        # === LAYER 2: LLM INTENT PARSING (Claude) ===
        current_datetime = datetime.now().isoformat()
        system_prompt = get_system_prompt(current_datetime)

        llm_output = await self.llm_adapter.generate(
            prompt=user_query,
            system_prompt=system_prompt,
            temperature=0.1
        )

        if llm_output is None:
            return {
                "status": "error",
                "message": "Claude AI service unavailable. Check your ANTHROPIC_API_KEY.",
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None,
                "llm_provider": "claude",
                "response_time_ms": int((time.time() - start_time) * 1000)
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
                "output_type": None,
                "llm_provider": "claude",
                "response_time_ms": int((time.time() - start_time) * 1000)
            }

        intent = validation_result["intent"]
        logger.info(f"[Claude] Validated intent: {intent}")

        # === ROUTE BASED ON INTENT TYPE ===
        intent_type = intent.get("intent_type", "get_data")
        
        if intent_type == "needs_clarification":
            result = await self._handle_needs_clarification(intent)
        elif intent_type == "search_stations":
            result = await self._handle_search_stations(intent)
        else:
            result = await self._handle_get_data(intent)
        
        # Add Claude-specific metadata
        result["llm_provider"] = "claude"
        result["response_time_ms"] = int((time.time() - start_time) * 1000)
        
        return result

    def _detect_language(self, text: str) -> str:
        """Detect if text is primarily Thai or English"""
        thai_chars = sum(1 for c in text if '\u0e00' <= c <= '\u0e7f')
        return "th" if thai_chars > len(text) * 0.2 else "en"

    async def _handle_needs_clarification(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle unclear queries by asking for clarification"""
        clarification_question = intent.get("clarification_question", "")
        missing_info = intent.get("missing_info", "")
        
        logger.info(f"[Claude] Asking for clarification: {missing_info}")
        
        # Detect language from the clarification question
        language = self._detect_language(clarification_question)
        
        # Build friendly message
        if language == "th":
            message = (
                f"🤔 **ขอข้อมูลเพิ่มเติม**\n\n"
                f"{clarification_question}\n\n"
                f"📝 **ตัวอย่างคำถาม:**\n"
                f"• 'ค่า PM2.5 เชียงใหม่ วันนี้'\n"
                f"• 'ค้นหาสถานีใน กรุงเทพ'\n"
                f"• 'PM2.5 ย้อนหลัง 7 วัน ที่ลำปาง'"
            )
        else:
            message = (
                f"🤔 **Need More Information**\n\n"
                f"{clarification_question}\n\n"
                f"📝 **Example queries:**\n"
                f"• 'PM2.5 in Chiang Mai today'\n"
                f"• 'Search stations in Bangkok'\n"
                f"• 'Air quality in Phuket last 7 days'"
            )
        
        return {
            "status": "needs_clarification",
            "message": message,
            "intent": intent,
            "data": None,
            "summary": {"missing_info": missing_info},
            "output_type": "text"
        }

    async def _handle_search_stations(self, intent: Dict[str, Any]) -> Dict[str, Any]:
        """Handle station search intent"""
        search_query = intent.get("search_query", "")
        logger.info(f"[Claude] Handling search_stations for: {search_query}")
        
        search_result = await self.orchestrator.search_stations_with_summary(search_query)
        
        if search_result["total_found"] == 0:
            return {
                "status": "success",
                "message": f"No stations found matching '{search_query}'. Please try a different location.",
                "intent": intent,
                "data": None,
                "summary": {
                    "query": search_query,
                    "total_found": 0,
                    "stations": []
                },
                "output_type": "text"
            }
        
        stations_data = search_result["stations"]
        
        summary = {
            "query": search_query,
            "total_found": search_result["total_found"],
            "search_summary": search_result["search_summary"],
            "stations": stations_data
        }
        
        station_names = [
            s.get("name_en") or s.get("name_th") or s.get("station_id") 
            for s in stations_data[:5]
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
        """Handle data retrieval intent"""
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

        intent["station_id"] = resolved_station_id
        
        # Get Thai station name for display
        station_name = self.orchestrator.get_station_name(resolved_station_id, prefer_thai=True)

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

        summary = self._compose_summary(data, intent)
        # Add station name to summary for display
        summary["station_name"] = station_name

        return {
            "status": "success",
            "message": None,
            "intent": intent,
            "data": data,
            "summary": summary,
            "output_type": intent.get("output_type")
        }

    def _compose_summary(self, data, intent) -> Dict[str, Any]:
        """Compose summary statistics from data"""
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

        # AQI level classification
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
        """Check health of Claude AI service components"""
        llm_healthy = await self.llm_adapter.is_healthy()

        return {
            "llm_service": "healthy" if llm_healthy else "unavailable (check ANTHROPIC_API_KEY)",
            "llm_provider": "claude",
            "model": self.llm_adapter.model,
            "orchestrator": "healthy",
            "guardrails": "active"
        }


# Global service instance
_claude_service: Optional[ClaudeChatbotService] = None


def get_claude_service() -> ClaudeChatbotService:
    """Get global Claude chatbot service instance"""
    global _claude_service

    if _claude_service is None:
        _claude_service = ClaudeChatbotService()

    return _claude_service


# Export service instance
claude_service = get_claude_service()
