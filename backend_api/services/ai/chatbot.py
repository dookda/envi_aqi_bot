"""
Air Quality Chatbot Service (v2.0)

Enhanced chatbot with:
1. Guardrail filtering (3 layers)
2. LLM intent parsing
3. API data retrieval
4. Rich response composition with health recommendations
5. Bilingual support (Thai/English)
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
from .response_composer import (
    compose_search_response,
    compose_data_response,
    compose_error_response,
    compose_clarification_response
)


class AirQualityChatbotService:
    """
    Air Quality Chatbot Service with Local LLM (v2.0)

    Provides natural language querying for air quality data
    with strict guardrails, API-mediated data access, and
    rich bilingual responses with health recommendations.
    """

    def __init__(self):
        self.llm_adapter = get_ollama_adapter()
        self.orchestrator = get_api_orchestrator()
        
        # Response cache for faster repeated queries
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes
        
        # Fast patterns that bypass LLM
        self._fast_patterns = [
            # (regex_pattern, intent_template)
            (r"(?:pm2\.?5|ค่าฝุ่น)\s+(.+?)\s+(?:วันนี้|today)", self._make_today_intent),
            (r"(?:ค้นหา|หา|search|find)\s*(?:สถานี)?\s*(.+)", self._make_search_intent),
            # Generic pollutant pattern: "ข้อมูล [pollutant] ใน[location]" or "[pollutant] [location]"
            (r"(?:ข้อมูล\s*)?(o3|ozone|โอโซน|pm10|pm2\.?5|co|no2|so2|nox)\s+(?:ใน|ที่)?\s*(.+?)(?:\s+(?:วันนี้|today|ย้อนหลัง|สัปดาห์|เดือน))?$", self._make_pollutant_intent),
        ]

    def _make_today_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'PM2.5 [location] today' queries"""
        from datetime import datetime, timedelta
        location = match.group(1).strip()
        today = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": "pm25",
            "start_date": today.replace(hour=0, minute=0).isoformat(),
            "end_date": today.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_search_intent(self, match) -> Dict[str, Any]:
        """Create intent for search queries"""
        location = match.group(1).strip()
        return {
            "intent_type": "search_stations",
            "search_query": location,
            "output_type": "text"
        }

    def _make_pollutant_intent(self, match) -> Dict[str, Any]:
        """Create intent for generic pollutant queries like 'ข้อมูล o3 ในกรุงเทพ'"""
        from datetime import datetime
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip()
        location = match.group(2).strip()

        # Normalize the pollutant name
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        today = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": today.replace(hour=0, minute=0).isoformat(),
            "end_date": today.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        import hashlib
        return hashlib.md5(query.lower().strip().encode()).hexdigest()

    def _get_cached(self, query: str) -> Optional[Dict[str, Any]]:
        """Get cached response if valid"""
        import time
        key = self._get_cache_key(query)
        if key in self._cache:
            cached = self._cache[key]
            if time.time() - cached["time"] < self._cache_ttl:
                logger.info(f"Cache hit for query: {query[:50]}")
                return cached["response"]
        return None

    def _set_cache(self, query: str, response: Dict[str, Any]):
        """Cache a response"""
        import time
        key = self._get_cache_key(query)
        self._cache[key] = {"response": response, "time": time.time()}
        
        # Cleanup old entries (keep max 100)
        if len(self._cache) > 100:
            sorted_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k]["time"])
            for k in sorted_keys[:20]:
                del self._cache[k]

    def _try_fast_pattern(self, query: str) -> Optional[Dict[str, Any]]:
        """Try to match query against fast patterns (bypass LLM)"""
        import re
        query_lower = query.lower()
        for pattern, intent_builder in self._fast_patterns:
            match = re.search(pattern, query_lower)
            if match:
                logger.info(f"Fast pattern match: {pattern}")
                return intent_builder(match)
        return None

    def _detect_language(self, text: str) -> str:
        """Detect if text is primarily Thai or English"""
        thai_chars = sum(1 for c in text if '\u0e00' <= c <= '\u0e7f')
        return "th" if thai_chars > len(text) * 0.2 else "en"

    async def process_query(self, user_query: str) -> Dict[str, Any]:
        """
        Process natural language query end-to-end

        Flow:
        1. Layer 1: Keyword filter (pre-LLM)
        2. Layer 2: LLM intent parsing with domain-restricted prompt
        3. Layer 3: Intent validation (post-LLM)
        4. Route to appropriate handler (search or data retrieval)
        5. Rich response composition with health advice

        Supports two intent types:
        - search_stations: Search for stations by location/name
        - get_data: Get air quality data for a specific station

        Args:
            user_query: Natural language query (Thai or English)

        Returns:
            Response dictionary with status, message, data, summary
        """
        logger.info(f"Processing query: {user_query[:100]}")
        
        # Detect user language for response
        language = self._detect_language(user_query)
        logger.info(f"Detected language: {language}")

        # === CHECK CACHE FIRST (FAST PATH) ===
        cached_response = self._get_cached(user_query)
        if cached_response:
            return cached_response

        # === LAYER 1: KEYWORD FILTER (PRE-LLM) ===
        keyword_result = keyword_filter(user_query)
        if not keyword_result["passed"]:
            error_response = compose_error_response("out_of_scope", language=language)
            return {
                "status": keyword_result["status"],
                "message": error_response["message"],
                "intent": None,
                "data": None,
                "summary": None,
                "output_type": None
            }

        # === TRY FAST PATTERN MATCHING (BYPASS LLM) ===
        fast_intent = self._try_fast_pattern(user_query)
        if fast_intent:
            logger.info("Using fast pattern match - skipping LLM")
            intent = fast_intent
        else:
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
                error_response = compose_error_response("service_error", language=language)
                return {
                    "status": "error",
                    "message": error_response["message"],
                    "intent": None,
                    "data": None,
                    "summary": None,
                    "output_type": None
                }

            # === LAYER 3: INTENT VALIDATION (POST-LLM) ===
            validation_result = validate_intent(llm_output)
            if not validation_result["valid"]:
                error_response = compose_error_response(
                    validation_result["status"],
                    details=validation_result.get("message", ""),
                    language=language
                )
                return {
                    "status": validation_result["status"],
                    "message": error_response["message"],
                    "intent": None,
                    "data": None,
                    "summary": None,
                    "output_type": None
                }

            intent = validation_result["intent"]
            logger.info(f"Validated intent: {intent}")

        # === ROUTE BASED ON INTENT TYPE ===
        intent_type = intent.get("intent_type", "get_data")

        
        if intent_type == "needs_clarification":
            response = await self._handle_needs_clarification(intent, language)
        elif intent_type == "search_stations":
            response = await self._handle_search_stations(intent, language)
        else:
            response = await self._handle_get_data(intent, language)
        
        # Cache successful responses
        if response.get("status") in ["success", "no_results"]:
            self._set_cache(user_query, response)
        
        return response

    async def _handle_needs_clarification(
        self,
        intent: Dict[str, Any],
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Handle unclear queries by asking for clarification
        
        Args:
            intent: Intent with clarification question
            language: Response language (th/en)
            
        Returns:
            Response asking user for more information
        """
        clarification_question = intent.get("clarification_question", "")
        missing_info = intent.get("missing_info", "")
        
        logger.info(f"Asking for clarification: {missing_info}")
        
        # Compose friendly clarification response
        response = compose_clarification_response(
            clarification_question=clarification_question,
            missing_info=missing_info,
            language=language
        )
        
        return {
            "status": "needs_clarification",
            "message": response["message"],
            "intent": intent,
            "data": None,
            "summary": {"missing_info": missing_info},
            "output_type": "text"
        }

    async def _handle_search_stations(
        self, 
        intent: Dict[str, Any],
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Handle station search intent with rich response
        
        Args:
            intent: Validated search intent with search_query
            language: Response language (th/en)
            
        Returns:
            Response with search results, summary, and health advice
        """
        search_query = intent.get("search_query", "")
        logger.info(f"Handling search_stations for: {search_query} (language: {language})")
        
        # Search for stations using orchestrator
        search_result = await self.orchestrator.search_stations_with_summary(search_query)
        
        # Compose rich response
        response = compose_search_response(search_query, search_result, language)
        
        return {
            "status": "success" if search_result["total_found"] > 0 else "no_results",
            "message": response["message"],
            "intent": intent,
            "data": search_result.get("stations", []),
            "summary": response["summary"],
            "output_type": intent.get("output_type", "text")
        }

    async def _handle_get_data(
        self,
        intent: Dict[str, Any],
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Handle air quality data retrieval intent with rich response
        
        Args:
            intent: Validated data intent with station_id, pollutant, dates
            language: Response language (th/en)
            
        Returns:
            Response with AQI data, summary, health advice, and visualization data
        """
        # === RESOLVE STATION ID ===
        resolved_station_id = self.orchestrator.resolve_station_id(intent["station_id"])
        if not resolved_station_id:
            error_response = compose_error_response(
                "invalid_station", 
                details=intent["station_id"],
                language=language
            )
            return {
                "status": "invalid_request",
                "message": error_response["message"],
                "intent": intent,
                "data": None,
                "summary": None,
                "output_type": intent.get("output_type")
            }

        # Update intent with resolved station_id
        intent["station_id"] = resolved_station_id
        logger.info(f"Handling get_data for: {resolved_station_id} (language: {language})")

        # === API DATA RETRIEVAL ===
        data = await self.orchestrator.get_aqi_history(
            station_id=intent["station_id"],
            pollutant=intent["pollutant"],
            start_date=intent["start_date"],
            end_date=intent["end_date"],
            interval=intent["interval"]
        )

        if data is None:
            error_response = compose_error_response("no_data", language=language)
            return {
                "status": "error",
                "message": error_response["message"],
                "intent": intent,
                "data": None,
                "summary": None,
                "output_type": intent.get("output_type")
            }

        # === COMPOSE SUMMARY ===
        summary = self._compose_summary(data, intent)

        # === GET STATION NAME (Thai preferred) ===
        station_name = self.orchestrator.get_station_name(resolved_station_id, prefer_thai=True)

        # === COMPOSE RICH RESPONSE ===
        response = compose_data_response(
            station_id=resolved_station_id,
            data=data,
            intent=intent,
            summary=summary,
            language=language,
            station_name=station_name
        )

        return {
            "status": "success",
            "message": response["message"],
            "intent": intent,
            "data": data,
            "summary": response["summary"],
            "output_type": intent.get("output_type", "chart")
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
            "guardrails": "active",
            "response_composer": "active"
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
