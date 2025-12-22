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

    # Thai
    "คุณภาพอากาศ",
    "ฝุ่น",
    "มลพิษ",
    "อากาศ",
    "ค่าฝุ่น",
    "ค่า pm",
    "พีเอ็ม",
    "สถานี",
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

Your task is to parse the user's natural language query into a structured JSON format.

If the query is not related to air quality, return ONLY:
{
  "status": "out_of_scope"
}

If the query is related to air quality, extract the following information and return as JSON:
{
  "station_id": "<station_id or station name>",
  "pollutant": "<pm25|pm10|aqi|o3|no2|so2|co>",
  "start_date": "<ISO-8601 datetime>",
  "end_date": "<ISO-8601 datetime>",
  "interval": "<15min|hour|day>",
  "output_type": "<text|chart|map|infographic>"
}

IMPORTANT RULES:
1. Convert relative time expressions to absolute ISO-8601 datetimes
   - "ย้อนหลัง 7 วัน" = last 7 days from now
   - "เมื่อวาน" = yesterday
   - "วันนี้" = today

2. For Thai station names, try to identify the station_id:
   - "เชียงใหม่" = try to find Chiang Mai station
   - If unsure, use the Thai name as station_id

3. Select appropriate interval based on time range:
   - ≤ 24 hours: use "15min"
   - 1-7 days: use "hour"
   - > 7 days: use "day"

4. Default pollutant is "pm25" if not specified

5. Default output_type is "chart" for time-series queries, "text" for summary queries

6. DO NOT add explanations or additional text. Return ONLY valid JSON.

Current datetime: {current_datetime}
"""


def get_system_prompt(current_datetime: str) -> str:
    """Get system prompt with current datetime injected"""
    return SYSTEM_PROMPT.format(current_datetime=current_datetime)


# Layer 3: Intent Validation
VALID_POLLUTANTS = ["pm25", "pm10", "aqi", "o3", "no2", "so2", "co"]
VALID_INTERVALS = ["15min", "hour", "day"]
VALID_OUTPUT_TYPES = ["text", "chart", "map", "infographic"]

REQUIRED_INTENT_FIELDS = [
    "station_id",
    "pollutant",
    "start_date",
    "end_date",
    "interval",
    "output_type"
]


def validate_intent(llm_output: str) -> Dict[str, Any]:
    """
    Layer 3: Post-LLM intent validation

    Validates LLM output before API invocation to ensure:
    - Valid JSON format
    - Contains only approved fields
    - No SQL, code, or instructions
    - References only air-quality concepts

    Args:
        llm_output: Raw output from LLM

    Returns:
        Dict with validation result and parsed intent (if valid)
    """
    # Remove markdown code blocks if present
    llm_output = llm_output.strip()
    if llm_output.startswith("```"):
        # Extract JSON from markdown code block
        lines = llm_output.split("\n")
        json_lines = []
        in_code_block = False
        for line in lines:
            if line.startswith("```"):
                in_code_block = not in_code_block
                continue
            if in_code_block or (not line.startswith("```")):
                json_lines.append(line)
        llm_output = "\n".join(json_lines).strip()

    # Try to parse JSON
    try:
        intent = json.loads(llm_output)
    except json.JSONDecodeError as e:
        logger.error(f"Intent validation failed - invalid JSON: {e}")
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

    # Validate required fields
    missing_fields = [field for field in REQUIRED_INTENT_FIELDS if field not in intent]
    if missing_fields:
        logger.error(f"Intent validation failed - missing fields: {missing_fields}")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": "Unable to interpret air quality parameters."
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

    # Check for SQL injection attempts
    dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "EXEC", "EXECUTE", "--", ";"]
    intent_str = json.dumps(intent).upper()
    if any(keyword in intent_str for keyword in dangerous_keywords):
        logger.error("Intent validation failed - potential SQL injection detected")
        return {
            "valid": False,
            "status": "invalid_request",
            "message": "Invalid request parameters."
        }

    # Validate datetime format (basic check)
    for date_field in ["start_date", "end_date"]:
        date_value = intent.get(date_field, "")
        # Check if it looks like ISO-8601 (contains T and has reasonable length)
        if not isinstance(date_value, str) or "T" not in date_value:
            logger.error(f"Intent validation failed - invalid datetime format: {date_field}={date_value}")
            return {
                "valid": False,
                "status": "invalid_request",
                "message": "Invalid datetime format. Expected ISO-8601."
            }

    logger.info(f"Intent validation passed: {intent}")
    return {
        "valid": True,
        "intent": intent
    }
