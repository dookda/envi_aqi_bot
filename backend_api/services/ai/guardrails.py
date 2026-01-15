"""
Three-Layer Guardrail System for Air Quality Chatbot

Layer 1: Keyword Filter (Pre-LLM)
Layer 2: Domain-Restricted LLM Prompt
Layer 3: Intent Validation (Post-LLM)
"""

import re
import json
from typing import Dict, Optional, Any
from backend_model.logger import logger


# Layer 1: Keyword Filter - Expanded for flexibility
AIR_QUALITY_KEYWORDS = [
    # === Pollutants (English) ===
    "pm2.5", "pm25", "pm 2.5", "pm2", "pm",
    "pm10", "pm 10",
    "aqi", "air quality index",
    "air quality", "airquality",
    "pollution", "pollutant", "pollutants",
    "ozone", "o3",
    "no2", "nitrogen dioxide", "nitrogen",
    "so2", "sulfur dioxide", "sulfur",
    "nox", "nitrogen oxides",
    "co", "carbon monoxide", "carbon",
    "dust", "particulate", "particle", "particles",
    "smog", "haze", "smoke",
    
    # === Actions/Queries ===
    "station", "stations", "monitoring",
    "search", "find", "list", "show", "display", "view", "get",
    "what", "how", "where", "when", "which",
    "today", "yesterday", "week", "month", "daily", "hourly",
    "average", "avg", "mean", "max", "min", "maximum", "minimum",
    "trend", "trends", "trending", "history", "historical",
    "compare", "comparison",
    "current", "now", "latest", "recent",
    "forecast", "predict", "prediction",
    
    # === Chart/Visualization Keywords ===
    "chart", "charts", "graph", "graphs", "plot",
    "visualization", "visualize", "visual",
    "line chart", "bar chart", "time series",
    "กราฟ", "แผนภูมิ", "กราฟเส้น", "แสดงกราฟ",
    
    # === Locations (Thai Provinces) ===
    "chiang mai", "chiangmai", "เชียงใหม่",
    "bangkok", "กรุงเทพ", "กรุงเทพฯ", "กทม",
    "phuket", "ภูเก็ต",
    "chiang rai", "chiangrai", "เชียงราย",
    "khon kaen", "ขอนแก่น",
    "nakhon ratchasima", "นครราชสีมา", "โคราช",
    "lampang", "ลำปาง",
    "lamphun", "ลำพูน",
    "mae hong son", "แม่ฮ่องสอน",
    "nan", "น่าน",
    "phrae", "แพร่",
    "songkhla", "สงขลา",
    "rayong", "ระยอง",
    "saraburi", "สระบุรี",
    "samut prakan", "สมุทรปราการ",
    "pathum thani", "ปทุมธานี",
    "nonthaburi", "นนทบุรี",
    "udon thani", "อุดรธานี",
    "nakhon sawan", "นครสวรรค์",
    "sukhothai", "สุโขทัย",
    "phitsanulok", "พิษณุโลก",
    "tak", "ตาก", "แม่สอด",
    "phayao", "พะเยา",
    "uttaradit", "อุตรดิตถ์",
    
    # === Thai Common Words ===
    "คุณภาพอากาศ", "คุณภาพ อากาศ",
    "ฝุ่น", "ฝุ่นละออง", "ฝุ่นพิษ",
    "มลพิษ", "มลภาวะ",
    "อากาศ", "อากาศเสีย",
    "ค่าฝุ่น", "ค่า ฝุ่น",
    "ค่า pm", "ค่าpm",
    "พีเอ็ม", "พี เอ็ม",
    "ควัน", "หมอก", "หมอกควัน",
    
    # === Thai Actions ===
    "สถานี", "สถานีตรวจวัด", "ตรวจวัด",
    "ค้นหา", "หา", "หาสถานี",
    "แสดง", "ดู", "ขอดู", "ขอ",
    "ข้อมูล", "รายงาน", "สรุป",
    "ย้อนหลัง", "ที่ผ่านมา",
    "วัน", "วันนี้", "เมื่อวาน", "สัปดาห์", "เดือน",
    "เฉลี่ย", "สูงสุด", "ต่ำสุด",
    "แนวโน้ม", "เปรียบเทียบ",
    "ปัจจุบัน", "ล่าสุด", "ตอนนี้",
    "อันตราย", "ปลอดภัย", "สุขภาพ",
    
    # === General health keywords ===
    "health", "healthy", "safe", "unsafe", "danger", "dangerous",
    "mask", "n95", "indoor", "outdoor",
    "sensitive", "asthma", "allergy",
    "breathe", "breathing", "respiratory",
]


def keyword_filter(query: str) -> Dict[str, Any]:
    """
    Layer 1: Pre-LLM keyword filtering (More flexible version)

    Rejects queries that don't contain air quality related keywords.
    This prevents non-air-quality usage before invoking the LLM.

    Args:
        query: User's natural language query

    Returns:
        Dict with status and optional message
    """
    query_lower = query.lower()

    # Check if any keyword is present
    has_keyword = any(keyword in query_lower for keyword in AIR_QUALITY_KEYWORDS)

    if not has_keyword:
        logger.info(f"Keyword filter rejected: {query[:50]}")
        return {
            "passed": False,
            "status": "out_of_scope",
            "message": "ระบบนี้ตอบคำถามเกี่ยวกับคุณภาพอากาศเท่านั้น / This system answers air quality-related questions only."
        }

    logger.info(f"Keyword filter passed: {query[:50]}")
    return {"passed": True}


# Layer 2: Domain-Restricted LLM System Prompt
SYSTEM_PROMPT = """You are an Air Quality Assistant for Thailand. Parse user queries to JSON.

**IMPORTANT: Determine intent_type FIRST:**

1. **search_stations** - User wants to FIND/LIST stations:
   - Keywords: "ค้นหา", "หา", "แสดงสถานี", "สถานีใน", "search", "find", "list stations", "where"
   - Example: "ค้นหาสถานีเชียงใหม่" → search for Chiang Mai stations
   
   Return:
   {{"intent_type": "search_stations", "search_query": "<location>", "output_type": "text"}}

2. **get_data** - User wants AIR QUALITY DATA over time:
   - Keywords: "PM2.5", "ค่าฝุ่น", "ย้อนหลัง", "วันนี้", "last week", "chart", "กราฟ"
   - Example: "PM2.5 เชียงใหม่ ย้อนหลัง 7 วัน" → get PM2.5 data
   
   Return:
   {{"intent_type": "get_data", "station_id": "<location>", "pollutant": "pm25", "start_date": "<ISO-8601>", "end_date": "<ISO-8601>", "interval": "hour", "output_type": "chart"}}

3. **needs_clarification** - Query is UNCLEAR or AMBIGUOUS:
   - Missing location/station name
   - Missing time period (for data queries)
   - Vague questions like "how is the air?" without location
   - Incomplete requests
   
   Return:
   {{"intent_type": "needs_clarification", "missing_info": "<what's missing>", "clarification_question": "<question to ask user>"}}
   
   Examples of unclear queries:
   - "PM2.5 ย้อนหลัง" → missing location → Ask: "กรุณาระบุจังหวัดหรือสถานีที่ต้องการดูข้อมูล"
   - "Air quality" → missing location → Ask: "Which location would you like to check?"
   - "ค่าฝุ่น" → missing location and time → Ask: "กรุณาระบุจังหวัดและช่วงเวลาที่ต้องการดูข้อมูล เช่น 'ค่าฝุ่น เชียงใหม่ วันนี้'"
   - "เชียงใหม่" → just location, unclear intent → Ask: "ต้องการค้นหาสถานี หรือดูข้อมูลคุณภาพอากาศที่เชียงใหม่?"

**If NOT air quality related:**
{{"status": "out_of_scope"}}

**RULES:**
- "ค้นหาสถานี" = search_stations (NOT get_data)
- "หาสถานี" = search_stations
- output_type="chart" if user wants: chart/graph/กราฟ/trend/ย้อนหลัง
- Date examples: "ย้อนหลัง 7 วัน"=7 days ago to now, "วันนี้"=today
- If query is about air quality BUT missing key info → use needs_clarification
- ALWAYS prefer asking for clarification over making wrong assumptions

Current time: {current_datetime}
Return ONLY valid JSON, no explanations."""


def get_system_prompt(current_datetime: str) -> str:
    """Get system prompt with current datetime injected"""
    return SYSTEM_PROMPT.format(current_datetime=current_datetime)


# Layer 3: Intent Validation
VALID_POLLUTANTS = ["pm25", "pm10", "aqi", "o3", "no2", "so2", "co", "nox"]
VALID_INTERVALS = ["15min", "hour", "day"]
VALID_OUTPUT_TYPES = ["text", "chart", "map", "infographic"]
VALID_INTENT_TYPES = ["search_stations", "get_data", "needs_clarification"]

REQUIRED_DATA_FIELDS = [
    "station_id",
    "pollutant",
    "start_date",
    "end_date",
    "interval",
    "output_type"
]

REQUIRED_SEARCH_FIELDS = [
    "search_query"
]


def validate_intent(llm_output: str) -> Dict[str, Any]:
    """
    Layer 3: Post-LLM intent validation

    Validates LLM output before API invocation to ensure:
    - Valid JSON format
    - Contains only approved fields
    - No SQL, code, or instructions
    - References only air-quality concepts

    Supports two intent types:
    - search_stations: Search for stations by location/name
    - get_data: Get air quality data for a specific station

    Args:
        llm_output: Raw output from LLM

    Returns:
        Dict with validation result and parsed intent (if valid)
    """
    # Log raw output for debugging
    logger.debug(f"Raw LLM output: {llm_output[:200] if llm_output else 'None'}...")
    
    if not llm_output or not llm_output.strip():
        logger.error("Intent validation failed - empty LLM output")
        return {
            "valid": False,
            "status": "error",
            "message": "AI service temporarily unavailable. Please try again."
        }
    
    # Clean up the output
    llm_output = llm_output.strip()
    
    # Remove markdown code blocks if present
    if llm_output.startswith("```"):
        # Extract JSON from markdown code block
        lines = llm_output.split("\n")
        json_lines = []
        in_code_block = False
        for line in lines:
            if line.startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                json_lines.append(line)
        llm_output = "\n".join(json_lines).strip()
    
    # Try to extract JSON from mixed content
    # Look for JSON object pattern
    if not llm_output.startswith("{"):
        # Try to find JSON object in the output
        import re
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', llm_output, re.DOTALL)
        if json_match:
            llm_output = json_match.group()
        else:
            logger.error(f"Intent validation failed - no JSON found in output: {llm_output[:100]}")
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Unable to interpret air quality parameters."
            }

    # Try to parse JSON
    try:
        intent = json.loads(llm_output)
    except json.JSONDecodeError as e:
        logger.error(f"Intent validation failed - invalid JSON: {e}, output: {llm_output[:100]}")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": "Unable to interpret air quality parameters."
        }

    # Check for out_of_scope status
    if isinstance(intent, dict) and intent.get("status") == "out_of_scope":
        logger.info("Intent validation - out of scope")
        return {
            "valid": False,
            "status": "out_of_scope",
            "message": "This system answers air quality-related questions only."
        }

    # Check for SQL injection attempts early
    dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "EXEC", "EXECUTE", "--", ";"]
    intent_str = json.dumps(intent).upper()
    if any(keyword in intent_str for keyword in dangerous_keywords):
        logger.error("Intent validation failed - potential SQL injection detected")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": "Invalid request parameters."
        }

    # Determine intent type (default to get_data for backward compatibility)
    intent_type = intent.get("intent_type", "get_data")
    
    # ============ HANDLE NEEDS_CLARIFICATION INTENT ============
    if intent_type == "needs_clarification":
        clarification_question = intent.get("clarification_question", "")
        missing_info = intent.get("missing_info", "")
        
        if not clarification_question:
            # Generate default clarification question
            clarification_question = "Could you please provide more details? For example, specify a location or time period."
        
        logger.info(f"Intent needs clarification: {missing_info}")
        return {
            "valid": True,
            "intent": {
                "intent_type": "needs_clarification",
                "clarification_question": clarification_question,
                "missing_info": missing_info
            }
        }
    
    # Validate intent_type
    if intent_type not in VALID_INTENT_TYPES:
        # Try to infer intent type from fields
        if "clarification_question" in intent:
            intent_type = "needs_clarification"
            intent["intent_type"] = intent_type
        elif "search_query" in intent:
            intent_type = "search_stations"
            intent["intent_type"] = intent_type
        else:
            intent_type = "get_data"
            intent["intent_type"] = intent_type

    # ============ VALIDATE SEARCH_STATIONS INTENT ============
    if intent_type == "search_stations":
        missing_fields = [field for field in REQUIRED_SEARCH_FIELDS if field not in intent or not intent[field]]
        if missing_fields:
            logger.error(f"Intent validation failed - missing search fields: {missing_fields}")
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Please specify a location to search for stations."
            }
        
        # Validate search_query is not empty
        if not intent["search_query"] or not intent["search_query"].strip():
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Please specify a location to search for stations."
            }
        
        # Set default output_type for search
        if "output_type" not in intent or intent["output_type"] not in VALID_OUTPUT_TYPES:
            intent["output_type"] = "text"
        
        logger.info(f"Intent validation passed (search_stations): {intent}")
        return {
            "valid": True,
            "intent": intent
        }

    # ============ VALIDATE GET_DATA INTENT ============
    # For backward compatibility, if no intent_type, treat as get_data
    
    from datetime import datetime, timezone, timedelta
    
    # Set defaults for optional fields before validation
    if "pollutant" not in intent or not intent["pollutant"]:
        intent["pollutant"] = "pm25"
        logger.info("Defaulting pollutant to pm25")
    
    if "interval" not in intent or not intent["interval"]:
        intent["interval"] = "hour"
        logger.info("Defaulting interval to hour")
    
    if "output_type" not in intent or not intent["output_type"]:
        intent["output_type"] = "chart"
        logger.info("Defaulting output_type to chart")
    
    # Set defaults for dates if missing (default to today)
    now = datetime.now(timezone.utc)
    if "start_date" not in intent or not intent["start_date"] or intent["start_date"] in ["None", "null", ""]:
        # Default to start of today
        intent["start_date"] = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        logger.info(f"Defaulting start_date to today: {intent['start_date']}")
    
    if "end_date" not in intent or not intent["end_date"] or intent["end_date"] in ["None", "null", ""]:
        # Default to now
        intent["end_date"] = now.isoformat()
        logger.info(f"Defaulting end_date to now: {intent['end_date']}")
    
    # Check for truly required field only (station_id)
    if "station_id" not in intent or not intent["station_id"]:
        logger.error("Intent validation failed - missing station_id")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": "Please specify a station for your query. Try adding a location like 'Chiang Mai' or 'Bangkok'."
        }

    # Validate pollutant
    if intent["pollutant"] not in VALID_POLLUTANTS:
        logger.error(f"Intent validation failed - invalid pollutant: {intent['pollutant']}")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": f"Invalid pollutant type. Supported: {', '.join(VALID_POLLUTANTS)}"
        }

    # Validate interval
    if intent["interval"] not in VALID_INTERVALS:
        logger.error(f"Intent validation failed - invalid interval: {intent['interval']}")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": f"Invalid interval. Supported: {', '.join(VALID_INTERVALS)}"
        }

    # Validate output_type
    if intent["output_type"] not in VALID_OUTPUT_TYPES:
        logger.error(f"Intent validation failed - invalid output_type: {intent['output_type']}")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": f"Invalid output type. Supported: {', '.join(VALID_OUTPUT_TYPES)}"
        }

    # Validate and normalize datetime format
    from dateutil import parser as date_parser
    from datetime import datetime, timezone, timedelta

    # Handle missing or null dates by using defaults
    start_date = intent.get("start_date")
    end_date = intent.get("end_date")

    # If start_date is None/null/empty, default to today
    if not start_date or start_date == "None" or (isinstance(start_date, str) and not start_date.strip()):
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        logger.info(f"Defaulting start_date to today: {start_date.isoformat()}")
    else:
        # Handle natural language dates that LLM might return
        start_date_lower = str(start_date).lower().strip()
        now = datetime.now(timezone.utc)
        
        if start_date_lower in ["today", "วันนี้"]:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif start_date_lower in ["yesterday", "เมื่อวาน"]:
            start_date = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        elif "7 days" in start_date_lower or "7 วัน" in start_date_lower or "week" in start_date_lower:
            start_date = now - timedelta(days=7)
        elif "30 days" in start_date_lower or "month" in start_date_lower or "เดือน" in start_date_lower:
            start_date = now - timedelta(days=30)
        elif "3 days" in start_date_lower or "3 วัน" in start_date_lower:
            start_date = now - timedelta(days=3)
        else:
            # Try to parse the datetime string
            try:
                start_date = date_parser.parse(start_date)
                if start_date.tzinfo is None:
                    start_date = start_date.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse start_date '{start_date}', defaulting to today: {e}")
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # If end_date is None/null/empty, default to now
    if not end_date or end_date == "None" or (isinstance(end_date, str) and not end_date.strip()):
        end_date = datetime.now(timezone.utc)
        logger.info(f"Defaulting end_date to now: {end_date.isoformat()}")
    else:
        # Handle natural language dates that LLM might return
        end_date_lower = str(end_date).lower().strip()
        now = datetime.now(timezone.utc)
        
        if end_date_lower in ["now", "today", "วันนี้", "ตอนนี้"]:
            end_date = now
        elif end_date_lower in ["yesterday", "เมื่อวาน"]:
            end_date = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59)
        else:
            # Try to parse the datetime string
            try:
                end_date = date_parser.parse(end_date)
                if end_date.tzinfo is None:
                    end_date = end_date.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse end_date '{end_date}', defaulting to now: {e}")
                end_date = now

    # Update intent with normalized ISO-8601 format
    intent["start_date"] = start_date.isoformat()
    intent["end_date"] = end_date.isoformat()
    intent["intent_type"] = "get_data"

    logger.info(f"Intent validation passed (get_data): {intent}")
    return {
        "valid": True,
        "intent": intent
    }

