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


# Layer 1: Keyword Filter
AIR_QUALITY_KEYWORDS = [
    # English
    "pm2.5", "pm25", "pm 2.5",
    "pm10", "pm 10",
    "aqi",
    "air quality",
    "pollution",
    "ozone", "o3",
    "no2", "nitrogen dioxide",
    "so2", "sulfur dioxide",
    "co", "carbon monoxide",
    "dust",
    "particulate",
    "pollutant",
    # Search/info related
    "station", "stations",
    "search", "find", "list", "show",
    "chiang mai", "เชียงใหม่",
    "bangkok", "กรุงเทพ",
    "information", "info", "summary",

    # Thai
    "คุณภาพอากาศ",
    "ฝุ่น",
    "มลพิษ",
    "อากาศ",
    "ค่าฝุ่น",
    "ค่า pm",
    "พีเอ็ม",
    "สถานี",
    "ค้นหา",
    "แสดง",
    "ข้อมูล",
]


def keyword_filter(query: str) -> Dict[str, Any]:
    """
    Layer 1: Pre-LLM keyword filtering

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
            "message": "This system answers air quality-related questions only."
        }

    logger.info(f"Keyword filter passed: {query[:50]}")
    return {"passed": True}


# Layer 2: Domain-Restricted LLM System Prompt
SYSTEM_PROMPT = """You are an Air Quality Assistant.

You are allowed to handle ONLY:
- Air quality data
- Air pollutants (PM2.5, PM10, AQI, O3, NO2, SO2, CO)
- Monitoring stations
- Historical or aggregated air quality information
- Data intended for charts, maps, or infographics
- Searching for stations by location (e.g., "Chiang Mai", "Bangkok")

Your task is to parse the user's natural language query into a structured JSON format.

If the query is not related to air quality, return ONLY:
{{
  "status": "out_of_scope"
}}

**For STATION SEARCH queries** (e.g., "search for Chiang Mai stations", "list stations in Bangkok", "show me stations"):
{{
  "intent_type": "search_stations",
  "search_query": "<location name or station keyword>",
  "output_type": "text"
}}

**For AIR QUALITY DATA queries** (e.g., "PM2.5 in Chiang Mai", "air quality last week"):
{{
  "intent_type": "get_data",
  "station_id": "<station_id or station name>",
  "pollutant": "<pm25|pm10|aqi|o3|no2|so2|co>",
  "start_date": "<ISO-8601 datetime>",
  "end_date": "<ISO-8601 datetime>",
  "interval": "<15min|hour|day>",
  "output_type": "<text|chart|map|infographic>"
}}

IMPORTANT RULES:
1. Determine the intent_type first:
   - If user asks to "search", "find", "list", "show stations", use "search_stations"
   - If user asks for specific data (PM2.5, AQI, etc.) over time, use "get_data"

2. For search_stations intent:
   - Extract the location from the query (e.g., "Chiang Mai", "เชียงใหม่")
   - search_query can be Thai or English

3. For get_data intent:
   - Convert relative time expressions to absolute ISO-8601 datetimes
     - "ย้อนหลัง 7 วัน" = last 7 days from now
     - "เมื่อวาน" = yesterday
     - "วันนี้" = today
   - Default pollutant is "pm25" if not specified
   - Select appropriate interval based on time range:
     - ≤ 24 hours: use "15min"
     - 1-7 days: use "hour"
     - > 7 days: use "day"

4. Default output_type is "chart" for time-series queries, "text" for search/summary queries

5. DO NOT add explanations or additional text. Return ONLY valid JSON.

Current datetime: {current_datetime}
"""


def get_system_prompt(current_datetime: str) -> str:
    """Get system prompt with current datetime injected"""
    return SYSTEM_PROMPT.format(current_datetime=current_datetime)


# Layer 3: Intent Validation
VALID_POLLUTANTS = ["pm25", "pm10", "aqi", "o3", "no2", "so2", "co"]
VALID_INTERVALS = ["15min", "hour", "day"]
VALID_OUTPUT_TYPES = ["text", "chart", "map", "infographic"]
VALID_INTENT_TYPES = ["search_stations", "get_data"]

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
    
    # Validate intent_type
    if intent_type not in VALID_INTENT_TYPES:
        # Try to infer intent type from fields
        if "search_query" in intent:
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
        # Try to parse the datetime string
        try:
            start_date = date_parser.parse(start_date)
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid start_date: {start_date}, error: {e}")
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Invalid datetime format. Expected ISO-8601."
            }

    # If end_date is None/null/empty, default to start_date (same day query)
    if not end_date or end_date == "None" or (isinstance(end_date, str) and not end_date.strip()):
        end_date = start_date
        logger.info(f"Defaulting end_date to start_date: {end_date.isoformat()}")
    else:
        # Try to parse the datetime string
        try:
            end_date = date_parser.parse(end_date)
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid end_date: {end_date}, error: {e}")
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Invalid datetime format. Expected ISO-8601."
            }

    # Update intent with normalized ISO-8601 format
    intent["start_date"] = start_date.isoformat()
    intent["end_date"] = end_date.isoformat()
    intent["intent_type"] = "get_data"

    logger.info(f"Intent validation passed (get_data): {intent}")
    return {
        "valid": True,
        "intent": intent
    }

