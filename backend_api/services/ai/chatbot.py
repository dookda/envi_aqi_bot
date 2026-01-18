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

        # Pollutant pattern for regex (air quality + weather)
        self._pollutant_pattern = r"(o3|ozone|โอโซน|pm10|pm2\.?5|ฝุ่น|co|no2|so2|nox|temp|temperature|อุณหภูมิ|rh|humidity|ความชื้น|ws|wind|ลม|bp|pressure|ความดัน|rain|ฝน)"

        # Fast patterns that bypass LLM
        self._fast_patterns = [
            # (regex_pattern, intent_template)
            # "[pollutant] [station] ขณะนี้/ในขณะนี้/ในตอนนี้/ตอนนี้" - current value with station
            (r"" + self._pollutant_pattern +
             r"\s+(.+?)\s+(?:ขณะนี้|ในขณะนี้|ในตอนนี้|ตอนนี้|now)$", self._make_now_intent),
            (r"(?:pm2\.?5|ค่าฝุ่น)\s+(.+?)\s+(?:วันนี้|today)", self._make_today_intent),
            (r"(?:ค้นหา|หา|search|find)\s*(?:สถานี)?\s*(.+)", self._make_search_intent),
            # Generic pollutant pattern: "ข้อมูล [pollutant] ใน[location]" or "[pollutant] [location]"
            (r"(?:ข้อมูล\s*)?(o3|ozone|โอโซน|pm10|pm2\.?5|co|no2|so2|nox|temp|temperature|อุณหภูมิ|rh|humidity|ความชื้น)\s+(?:ใน|ที่)?\s*(.+?)(?:\s+(?:วันนี้|today|ย้อนหลัง|สัปดาห์|เดือน))?$", self._make_pollutant_intent),
            # "ค่า x ตอนนี้เท่าไหร่" or "ค่า x ที่ [location]" - current value query
            (r"ค่า\s*" + self._pollutant_pattern +
             r"\s+(?:ตอนนี้|ขณะนี้|ในขณะนี้|ในตอนนี้|ปัจจุบัน|ล่าสุด|เท่าไหร่|ที่|ใน)\s*(.+)?", self._make_current_value_intent),
            # "ขอดูกราฟ x ย้อนหลัง" or "กราฟ x ย้อนหลัง 7 วัน"
            (r"(?:ขอดู|ดู|แสดง)?\s*กราฟ\s*" + self._pollutant_pattern +
             r"\s*(?:ย้อนหลัง|ที่|ใน)?\s*(.+)?", self._make_chart_intent),
            # "chart [pollutant] [location]" or "chart for [location]"
            (r"chart\s+" + self._pollutant_pattern +
             r"\s*(?:for|at|in)?\s*(.+)?", self._make_chart_intent),
            (r"chart\s+(?:for|at|in)\s*(.+)",
             self._make_chart_location_only_intent),
            # "ข้อมูลย้อนหลัง [pollutant] [location]" or "ข้อมูลย้อนหลัง [location]"
            (r"ข้อมูลย้อนหลัง\s*" + self._pollutant_pattern +
             r"?\s*(?:ที่|ใน|ของ)?\s*(.+)?", self._make_historical_data_intent),
            # "ที่ผ่านมา X วัน" pattern - e.g., "ค่า pm2.5 ที่ผ่านมา 7 วัน ที่เชียงใหม่"
            (r"(?:ค่า\s*)?" + self._pollutant_pattern +
             r"\s*(?:ที่ผ่านมา|ในช่วง)\s*(\d+)\s*(?:วัน|day)\s*(?:ที่|ใน|ของ)?\s*(.+)?", self._make_past_days_intent),
            # "กราฟ [location] ย้อนหลัง x วัน" - location first, then time
            (r"กราฟ\s*(.+?)\s*(?:ย้อนหลัง|ที่ผ่านมา)\s*(\d+)?\s*(?:วัน|day|สัปดาห์|week|เดือน|month)?",
             self._make_chart_location_time_intent),
            # "สถานีใดบ้างที่มีข้อมูล x" or "สถานีที่มี x"
            (r"สถานี(?:ใด|ไหน)?(?:บ้าง)?(?:ที่)?(?:มี)?\s*(?:ข้อมูล)?\s*" + self._pollutant_pattern +
             r"\s*(?:ล่าสุด|ใน|ที่)?\s*(.+)?", self._make_station_search_by_param_intent),

            # === INCOMPLETE QUERY PATTERNS - Ask for clarification ===
            # Pollutant only (no location): "pm2.5", "ค่าฝุ่น", "o3" etc.
            (r"^(?:ค่า\s*)?" + self._pollutant_pattern +
             r"(?:\s*(?:ขณะนี้|ในขณะนี้|ในตอนนี้|ตอนนี้|now|วันนี้|today|ย้อนหลัง))?$", self._ask_for_location),
            # Location only with time keywords (no parameter): "เชียงใหม่ วันนี้", "กรุงเทพ ขณะนี้"
            (r"^(.+?)\s+(?:วันนี้|today|ขณะนี้|ในขณะนี้|ในตอนนี้|ตอนนี้|now|ย้อนหลัง|ที่ผ่านมา)$",
             self._ask_for_parameter),
            # Just time keywords: "วันนี้", "ขณะนี้", "ย้อนหลัง 7 วัน"
            (r"^(?:วันนี้|today|ขณะนี้|ในขณะนี้|ในตอนนี้|ตอนนี้|now|ย้อนหลัง|ที่ผ่านมา)\s*(\d+)?\s*(?:วัน|day|สัปดาห์|week)?$",
             self._ask_for_location_and_parameter),
            # "กราฟ" or "chart" alone
            (r"^(?:กราฟ|chart|แผนภูมิ)$", self._ask_for_chart_details),
            # "ข้อมูล" alone
            (r"^(?:ข้อมูล|data|ดูข้อมูล)$", self._ask_for_data_details),
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

    def _make_now_intent(self, match) -> Dict[str, Any]:
        """Create intent for '[pollutant] [station] ขณะนี้/ในขณะนี้/ในตอนนี้/now' queries - current value"""
        from datetime import datetime, timedelta
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip()
        location = match.group(2).strip()

        # Normalize the pollutant name
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        # Get data for last 3 hours for current value display
        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": (now - timedelta(hours=3)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "text"
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

    def _make_current_value_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'ค่า x ตอนนี้เท่าไหร่' or 'ค่า x ที่ [location]' queries"""
        from datetime import datetime, timedelta
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip()
        location = match.group(2).strip() if match.group(2) else None

        # Normalize the pollutant name
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        # If no location specified, ask for clarification
        if not location or location in ["เท่าไหร่", "ตอนนี้", "ปัจจุบัน", "ล่าสุด"]:
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": f"กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูค่า {pollutant_raw} เช่น 'ค่า {pollutant_raw} ที่เชียงใหม่' หรือ 'ค่า {pollutant_raw} กรุงเทพ'"
            }

        # Get data for last 3 hours
        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": (now - timedelta(hours=3)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "text"
        }

    def _make_chart_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'ขอดูกราฟ x ย้อนหลัง' queries"""
        from datetime import datetime, timedelta
        from .guardrails import normalize_pollutant
        import re

        pollutant_raw = match.group(1).strip()
        rest = match.group(2).strip() if match.group(2) else ""

        # Normalize the pollutant name
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        # Parse time period and location from rest
        days = 7  # default
        location = None

        if rest:
            # Check for time period patterns
            time_match = re.search(r"(\d+)\s*(?:วัน|day)", rest)
            if time_match:
                days = int(time_match.group(1))
                rest = re.sub(r"\d+\s*(?:วัน|day)", "", rest).strip()

            week_match = re.search(r"(?:สัปดาห์|week)", rest)
            if week_match:
                days = 7
                rest = re.sub(r"(?:สัปดาห์|week)", "", rest).strip()

            month_match = re.search(r"(?:เดือน|month)", rest)
            if month_match:
                days = 30
                rest = re.sub(r"(?:เดือน|month)", "", rest).strip()

            # Remaining text is location
            location = rest.strip() if rest.strip() else None

        # If no location specified, ask for clarification
        if not location:
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": f"กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูกราฟ {pollutant_raw} เช่น 'กราฟ {pollutant_raw} ย้อนหลัง 7 วัน ที่เชียงใหม่'"
            }

        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": (now - timedelta(days=days)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_chart_location_only_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'chart for [location]' queries without pollutant specified"""
        from datetime import datetime, timedelta

        location = match.group(1).strip() if match.group(1) else None

        if not location:
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": "กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูกราฟ เช่น 'chart pm2.5 for Chiang Mai' หรือ 'กราฟ pm2.5 เชียงใหม่'"
            }

        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": "pm25",  # Default to PM2.5
            "start_date": (now - timedelta(days=7)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_historical_data_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'ข้อมูลย้อนหลัง' queries"""
        from datetime import datetime, timedelta
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip() if match.group(1) else None
        location = match.group(2).strip() if match.group(2) else None

        # Normalize the pollutant name or default to PM2.5
        pollutant = normalize_pollutant(
            pollutant_raw) if pollutant_raw else "pm25"

        if not location:
            pollutant_display = pollutant_raw if pollutant_raw else "PM2.5"
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": f"กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูข้อมูลย้อนหลัง เช่น 'ข้อมูลย้อนหลัง {pollutant_display} ที่เชียงใหม่' หรือ 'ข้อมูลย้อนหลัง กรุงเทพ'"
            }

        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant or "pm25",
            "start_date": (now - timedelta(days=7)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_past_days_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'ที่ผ่านมา X วัน' queries - e.g., 'ค่า pm2.5 ที่ผ่านมา 7 วัน ที่เชียงใหม่'"""
        from datetime import datetime, timedelta
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip() if match.group(1) else None
        days_str = match.group(2)
        location = match.group(3).strip() if match.group(3) else None

        # Normalize the pollutant name
        pollutant = normalize_pollutant(
            pollutant_raw) if pollutant_raw else "pm25"
        days = int(days_str) if days_str else 7

        if not location:
            pollutant_display = pollutant_raw if pollutant_raw else "PM2.5"
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": f"กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูข้อมูล {pollutant_display} ที่ผ่านมา {days} วัน เช่น 'ค่า {pollutant_display} ที่ผ่านมา {days} วัน ที่เชียงใหม่'"
            }

        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": (now - timedelta(days=days)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_chart_location_time_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'กราฟ [location] ย้อนหลัง x วัน' queries"""
        from datetime import datetime, timedelta
        import re

        location = match.group(1).strip() if match.group(1) else None
        days_str = match.group(2)

        # Default to 7 days
        days = int(days_str) if days_str else 7

        # Check if the original query contains time period keywords without number
        # The regex group 2 might not capture if there's no number

        if not location:
            return {
                "intent_type": "needs_clarification",
                "missing_info": "location",
                "clarification_question": "กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูกราฟ เช่น 'กราฟ เชียงใหม่ ย้อนหลัง 7 วัน'"
            }

        # Extract pollutant if mentioned in location string
        pollutant = "pm25"  # Default
        pollutant_match = re.search(
            r"(pm2\.?5|pm10|o3|co|no2|so2|nox|ฝุ่น)", location.lower())
        if pollutant_match:
            from .guardrails import normalize_pollutant
            pollutant = normalize_pollutant(pollutant_match.group(1)) or "pm25"
            # Remove pollutant from location
            location = re.sub(r"(pm2\.?5|pm10|o3|co|no2|so2|nox|ฝุ่น)\s*",
                              "", location, flags=re.IGNORECASE).strip()

        now = datetime.now()
        return {
            "intent_type": "get_data",
            "station_id": location,
            "pollutant": pollutant,
            "start_date": (now - timedelta(days=days)).isoformat(),
            "end_date": now.isoformat(),
            "interval": "hour",
            "output_type": "chart"
        }

    def _make_station_search_by_param_intent(self, match) -> Dict[str, Any]:
        """Create intent for 'สถานีใดบ้างที่มีข้อมูล x' queries"""
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip()
        location = match.group(2).strip() if match.group(2) else None

        # Normalize the pollutant name
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        # Search for stations - if location provided, search in that area
        search_query = location if location else "ทั้งหมด"

        return {
            "intent_type": "search_stations",
            "search_query": search_query,
            "pollutant_filter": pollutant,
            "output_type": "text"
        }

    # === CLARIFICATION HELPER FUNCTIONS ===

    def _ask_for_location(self, match) -> Dict[str, Any]:
        """Ask user to specify location when only pollutant is provided"""
        from .guardrails import normalize_pollutant

        pollutant_raw = match.group(1).strip() if match.group(1) else "PM2.5"
        pollutant = normalize_pollutant(pollutant_raw) or "pm25"

        # Format pollutant name for display
        pollutant_display = {
            "pm25": "PM2.5", "pm10": "PM10", "o3": "O₃", "co": "CO",
            "no2": "NO₂", "so2": "SO₂", "nox": "NOₓ", "temp": "อุณหภูมิ",
            "rh": "ความชื้น", "ws": "ความเร็วลม"
        }.get(pollutant, pollutant_raw.upper())

        return {
            "intent_type": "needs_clarification",
            "missing_info": "location",
            "clarification_question": f"กรุณาระบุสถานีหรือจังหวัดที่ต้องการดูค่า {pollutant_display}\n\nตัวอย่าง:\n• '{pollutant_raw} เชียงใหม่ ขณะนี้'\n• '{pollutant_raw} กรุงเทพ ย้อนหลัง 7 วัน'\n• 'กราฟ {pollutant_raw} ลำปาง'"
        }

    def _ask_for_parameter(self, match) -> Dict[str, Any]:
        """Ask user to specify parameter when only location and time is provided"""
        location = match.group(1).strip() if match.group(1) else ""

        return {
            "intent_type": "needs_clarification",
            "missing_info": "parameter",
            "clarification_question": f"ต้องการดูข้อมูลอะไรที่ {location}?\n\nพารามิเตอร์ที่รองรับ:\n• PM2.5, PM10 (ฝุ่นละออง)\n• O3 (โอโซน)\n• CO, NO2, SO2, NOx (ก๊าซมลพิษ)\n• temp (อุณหภูมิ), rh (ความชื้น)\n\nตัวอย่าง:\n• 'pm2.5 {location} ขณะนี้'\n• 'o3 {location} วันนี้'"
        }

    def _ask_for_location_and_parameter(self, match) -> Dict[str, Any]:
        """Ask user to specify both location and parameter when only time is provided"""
        return {
            "intent_type": "needs_clarification",
            "missing_info": "location and parameter",
            "clarification_question": "กรุณาระบุพารามิเตอร์และสถานที่ที่ต้องการดูข้อมูล\n\nตัวอย่าง:\n• 'pm2.5 เชียงใหม่ ขณะนี้'\n• 'o3 กรุงเทพ ย้อนหลัง 7 วัน'\n• 'กราฟ pm10 ลำปาง'\n• 'ค้นหาสถานี ภูเก็ต'"
        }

    def _ask_for_chart_details(self, match) -> Dict[str, Any]:
        """Ask user to specify details for chart request"""
        return {
            "intent_type": "needs_clarification",
            "missing_info": "chart details (parameter, location, time)",
            "clarification_question": "ต้องการดูกราฟอะไร? กรุณาระบุพารามิเตอร์ สถานที่ และช่วงเวลา\n\nตัวอย่าง:\n• 'กราฟ pm2.5 เชียงใหม่ ย้อนหลัง 7 วัน'\n• 'chart o3 Bangkok last week'\n• 'กราฟ co ลำปาง ที่ผ่านมา 30 วัน'"
        }

    def _ask_for_data_details(self, match) -> Dict[str, Any]:
        """Ask user to specify what data they want"""
        return {
            "intent_type": "needs_clarification",
            "missing_info": "data details (parameter, location)",
            "clarification_question": "ต้องการดูข้อมูลอะไร? กรุณาระบุพารามิเตอร์และสถานที่\n\nตัวอย่าง:\n• 'pm2.5 เชียงใหม่ ขณะนี้' - ดูค่าปัจจุบัน\n• 'กราฟ o3 กรุงเทพ ย้อนหลัง 7 วัน' - ดูกราฟ\n• 'ค้นหาสถานี ภูเก็ต' - ค้นหาสถานีตรวจวัด"
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
            sorted_keys = sorted(self._cache.keys(),
                                 key=lambda k: self._cache[k]["time"])
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
            error_response = compose_error_response(
                "out_of_scope", language=language)
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
                error_response = compose_error_response(
                    "service_error", language=language)
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
        logger.info(
            f"Handling search_stations for: {search_query} (language: {language})")

        # Search for stations using orchestrator
        search_result = await self.orchestrator.search_stations_with_summary(search_query)

        # Compose rich response
        response = compose_search_response(
            search_query, search_result, language)

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
        resolved_station_id = self.orchestrator.resolve_station_id(
            intent["station_id"])
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
        logger.info(
            f"Handling get_data for: {resolved_station_id} (language: {language})")

        # === API DATA RETRIEVAL ===
        data = await self.orchestrator.get_aqi_history(
            station_id=intent["station_id"],
            pollutant=intent["pollutant"],
            start_date=intent["start_date"],
            end_date=intent["end_date"],
            interval=intent["interval"]
        )

        if data is None:
            error_response = compose_error_response(
                "no_data", language=language)
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
        station_name = self.orchestrator.get_station_name(
            resolved_station_id, prefer_thai=True)

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

        values = [point["value"]
                  for point in data if point["value"] is not None]

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
            second_half_avg = sum(
                values[mid_point:]) / (len(values) - mid_point)

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
