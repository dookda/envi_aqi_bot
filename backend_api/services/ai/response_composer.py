"""
Response Composer for AI Chatbot

Generates rich, human-friendly responses with:
- Health recommendations based on AQI
- Formatted messages with emojis
- Bilingual support (Thai/English)
- Context-aware suggestions
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from backend_model.logger import logger


# Parameter Standard Thresholds (WHO & Thailand PCD Guidelines)
PARAMETER_THRESHOLDS = {
    "pm25": {
        "unit": "μg/m³",
        "levels": [
            {"max": 25, "level": "excellent", "label_en": "Excellent", "label_th": "ดีมาก"},
            {"max": 50, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 100, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 200, "level": "unhealthy_sensitive", "label_en": "Unhealthy for Sensitive", "label_th": "มีผลต่อกลุ่มเสี่ยง"},
        ],
        "critical": 200,  # Above this is critical
    },
    "pm10": {
        "unit": "μg/m³",
        "levels": [
            {"max": 50, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 80, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 120, "level": "unhealthy_sensitive", "label_en": "Unhealthy", "label_th": "มีผลต่อสุขภาพ"},
        ],
        "critical": 120,
    },
    "o3": {
        "unit": "ppb",
        "levels": [
            {"max": 70, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 120, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 200, "level": "unhealthy", "label_en": "Unhealthy", "label_th": "มีผลต่อสุขภาพ"},
        ],
        "critical": 200,
    },
    "co": {
        "unit": "ppm",
        "levels": [
            {"max": 6.4, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 9.0, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 15, "level": "unhealthy", "label_en": "Unhealthy", "label_th": "มีผลต่อสุขภาพ"},
        ],
        "critical": 15,
    },
    "no2": {
        "unit": "ppb",
        "levels": [
            {"max": 106, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 170, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 340, "level": "unhealthy", "label_en": "Unhealthy", "label_th": "มีผลต่อสุขภาพ"},
        ],
        "critical": 340,
    },
    "so2": {
        "unit": "ppb",
        "levels": [
            {"max": 200, "level": "good", "label_en": "Good", "label_th": "ดี"},
            {"max": 350, "level": "moderate", "label_en": "Moderate", "label_th": "ปานกลาง"},
            {"max": 500, "level": "unhealthy", "label_en": "Unhealthy", "label_th": "มีผลต่อสุขภาพ"},
        ],
        "critical": 500,
    },
}


# AQI Level Definitions with Health Advice (Thailand PCD Standard Colors)
AQI_LEVELS = {
    "excellent": {
        "range": (0, 25),
        "label_en": "Excellent",
        "label_th": "ดีมาก",
        "color": "#00BFFF",  # Blue - Thailand PCD
        "hex": "#00BFFF",
        "emoji": "🔵",
        "advice_en": "Air quality is ideal for all activities. Enjoy the outdoors!",
        "advice_th": "คุณภาพอากาศดีเยี่ยม เหมาะสำหรับกิจกรรมกลางแจ้งทุกประเภท",
        "sensitive_advice_en": "No precautions needed.",
        "sensitive_advice_th": "ไม่จำเป็นต้องระวังเป็นพิเศษ",
    },
    "good": {
        "range": (26, 50),
        "label_en": "Good",
        "label_th": "ดี",
        "color": "#00E400",  # Green - Thailand PCD
        "hex": "#00E400",
        "emoji": "🟢",
        "advice_en": "Air quality is satisfactory. Safe for outdoor activities.",
        "advice_th": "คุณภาพอากาศดี ปลอดภัยสำหรับกิจกรรมกลางแจ้ง",
        "sensitive_advice_en": "Unusually sensitive people should consider reducing prolonged outdoor exertion.",
        "sensitive_advice_th": "ผู้ที่มีความไวต่อมลพิษเป็นพิเศษควรพิจารณาลดกิจกรรมกลางแจ้งที่ใช้เวลานาน",
    },
    "moderate": {
        "range": (51, 100),
        "label_en": "Moderate",
        "label_th": "ปานกลาง",
        "color": "#FFFF00",  # Yellow - Thailand PCD
        "hex": "#FFFF00",
        "emoji": "🟡",
        "advice_en": "Some pollutants may pose a moderate health concern. Consider limiting prolonged outdoor exertion.",
        "advice_th": "มลพิษบางส่วนอาจส่งผลต่อสุขภาพเล็กน้อย ควรพิจารณาจำกัดกิจกรรมกลางแจ้งที่ใช้เวลานาน",
        "sensitive_advice_en": "Sensitive groups should limit prolonged outdoor exertion. Consider wearing a mask.",
        "sensitive_advice_th": "กลุ่มเสี่ยงควรจำกัดกิจกรรมกลางแจ้ง พิจารณาสวมหน้ากากอนามัย",
    },
    "unhealthy_sensitive": {
        "range": (101, 200),
        "label_en": "Unhealthy for Sensitive Groups",
        "label_th": "เริ่มมีผลกระทบต่อสุขภาพ",
        "color": "#FF7E00",  # Orange - Thailand PCD
        "hex": "#FF7E00",
        "emoji": "🟠",
        "advice_en": "General public may begin to experience health effects. Reduce prolonged outdoor exertion.",
        "advice_th": "ประชาชนทั่วไปอาจเริ่มได้รับผลกระทบต่อสุขภาพ ควรลดกิจกรรมกลางแจ้ง",
        "sensitive_advice_en": "Children, elderly, and people with respiratory conditions should avoid outdoor activities. Wear N95 mask if going outside.",
        "sensitive_advice_th": "เด็ก ผู้สูงอายุ และผู้มีโรคระบบทางเดินหายใจ ควรหลีกเลี่ยงกิจกรรมกลางแจ้ง สวมหน้ากาก N95 หากต้องออกนอกบ้าน",
    },
    "unhealthy": {
        "range": (201, 300),
        "label_en": "Unhealthy",
        "label_th": "มีผลกระทบต่อสุขภาพ",
        "color": "#FF0000",  # Red - Thailand PCD
        "hex": "#FF0000",
        "emoji": "🔴",
        "advice_en": "Everyone may experience health effects. Limit all outdoor activities.",
        "advice_th": "ทุกคนอาจได้รับผลกระทบต่อสุขภาพ ควรจำกัดกิจกรรมกลางแจ้งทั้งหมด",
        "sensitive_advice_en": "Everyone should avoid outdoor activities. Stay indoors with air purifier.",
        "sensitive_advice_th": "ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง อยู่ในอาคารพร้อมเครื่องฟอกอากาศ",
    },
    "hazardous": {
        "range": (301, 999),
        "label_en": "Hazardous",
        "label_th": "อันตราย",
        "color": "#7E0023",  # Dark Red/Maroon - Severe
        "hex": "#7E0023",
        "emoji": "⚫",
        "advice_en": "Health emergency! Everyone should avoid all outdoor activities.",
        "advice_th": "ฉุกเฉินด้านสุขภาพ! ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้งทั้งหมด",
        "sensitive_advice_en": "Stay indoors. Close windows. Use air purifier. Seek medical attention if experiencing symptoms.",
        "sensitive_advice_th": "อยู่ในอาคาร ปิดหน้าต่าง ใช้เครื่องฟอกอากาศ พบแพทย์หากมีอาการผิดปกติ",
    },
}



def get_aqi_level_from_pm25(pm25_value: float) -> str:
    """Determine AQI level from PM2.5 value"""
    if pm25_value is None:
        return "unknown"

    for level, config in AQI_LEVELS.items():
        min_val, max_val = config["range"]
        if min_val <= pm25_value <= max_val:
            return level

    return "hazardous" if pm25_value > 300 else "unknown"


def check_parameter_threshold(parameter: str, value: float) -> Dict[str, Any]:
    """
    Check if a parameter value exceeds safety thresholds

    Args:
        parameter: Parameter name (pm25, pm10, o3, co, no2, so2)
        value: Parameter value

    Returns:
        Dictionary with threshold info, warnings, and status
    """
    if value is None or parameter not in PARAMETER_THRESHOLDS:
        return {"exceeds_standard": False, "level": "unknown"}

    threshold_config = PARAMETER_THRESHOLDS[parameter]
    unit = threshold_config["unit"]
    critical = threshold_config["critical"]

    # Determine level
    current_level = "good"
    level_label_en = "Good"
    level_label_th = "ดี"

    for level_info in threshold_config["levels"]:
        if value <= level_info["max"]:
            current_level = level_info["level"]
            level_label_en = level_info["label_en"]
            level_label_th = level_info["label_th"]
            break
        else:
            current_level = "critical"
            level_label_en = "Critical"
            level_label_th = "วิกฤติ"

    exceeds_standard = value > threshold_config["levels"][0]["max"]  # Exceeds "good" level
    is_critical = value > critical

    return {
        "exceeds_standard": exceeds_standard,
        "is_critical": is_critical,
        "level": current_level,
        "label_en": level_label_en,
        "label_th": level_label_th,
        "value": value,
        "unit": unit,
        "critical_threshold": critical,
    }


def generate_threshold_warnings(
    data: List[Dict[str, Any]],
    intent: Dict[str, Any],
    language: str = "en"
) -> Optional[str]:
    """
    Generate warnings for parameters that exceed safety thresholds

    Args:
        data: Time series data with all parameters
        intent: Query intent with pollutant info
        language: Response language (en/th)

    Returns:
        Warning message string if any parameters exceed thresholds, else None
    """
    if not data:
        return None

    # Get latest data point
    latest = data[0] if isinstance(data, list) else data

    # Check all tracked parameters
    warnings = []
    critical_warnings = []

    for param in ["pm25", "pm10", "o3", "co", "no2", "so2"]:
        value = latest.get(param)
        if value is None:
            continue

        check = check_parameter_threshold(param, value)

        if check["is_critical"]:
            param_name = param.upper().replace("PM", "PM") if "pm" in param else param.upper()
            if language == "th":
                critical_warnings.append(
                    f"⚠️ **{param_name}: {value:.1f} {check['unit']}** (วิกฤติ! เกินมาตรฐาน)"
                )
            else:
                critical_warnings.append(
                    f"⚠️ **{param_name}: {value:.1f} {check['unit']}** (CRITICAL! Exceeds safe levels)"
                )
        elif check["exceeds_standard"]:
            param_name = param.upper().replace("PM", "PM") if "pm" in param else param.upper()
            if language == "th":
                warnings.append(
                    f"⚠️ {param_name}: {value:.1f} {check['unit']} ({check['label_th']})"
                )
            else:
                warnings.append(
                    f"⚠️ {param_name}: {value:.1f} {check['unit']} ({check['label_en']})"
                )

    # Compose warning message
    if critical_warnings:
        if language == "th":
            header = "🚨 **คำเตือนสำคัญ!**\n\n"
            message = header + "\n".join(critical_warnings)
            message += "\n\n⚠️ **ระวัง:** ค่ามลพิษอยู่ในระดับอันตราย! หลีกเลี่ยงกิจกรรมกลางแจ้ง อยู่ในอาคารและปิดหน้าต่าง สวมหน้ากาก N95 หากจำเป็นต้องออกนอกบ้าน"
        else:
            header = "🚨 **CRITICAL WARNING!**\n\n"
            message = header + "\n".join(critical_warnings)
            message += "\n\n⚠️ **CAUTION:** Pollution levels are dangerous! Avoid outdoor activities. Stay indoors with windows closed. Wear N95 mask if you must go outside."
        return message
    elif warnings:
        if language == "th":
            header = "⚠️ **คำเตือน: ค่ามลพิษเกินมาตรฐาน**\n\n"
            message = header + "\n".join(warnings)
            message += "\n\n💡 **คำแนะนำ:** ลดกิจกรรมกลางแจ้ง กลุ่มเสี่ยงควรสวมหน้ากากเมื่อออกนอกบ้าน"
        else:
            header = "⚠️ **Warning: Elevated Pollution Levels**\n\n"
            message = header + "\n".join(warnings)
            message += "\n\n💡 **Advice:** Limit outdoor activities. Sensitive groups should wear masks when outdoors."
        return message

    return None


def compose_search_response(
    search_query: str,
    search_result: Dict[str, Any],
    language: str = "en"
) -> Dict[str, Any]:
    """
    Compose rich response for station search queries
    
    Args:
        search_query: Original search query
        search_result: Results from orchestrator.search_stations_with_summary
        language: Response language (en/th)
        
    Returns:
        Formatted response dict
    """
    stations = search_result.get("stations", [])
    total_found = search_result.get("total_found", 0)
    
    if total_found == 0:
        if language == "th":
            tip1 = "ลองใช้ชื่อภาษาอังกฤษ เช่น Chiang Mai"
            tip2 = "ลองใช้ชื่อจังหวัด ไม่ใช่อำเภอ"
            message = (
                f"🔍 **ไม่พบสถานี**\n\n"
                f"ไม่พบสถานีตรวจวัดที่ตรงกับ '{search_query}'.\n\n"
                f"💡 **คำแนะนำ:**\n"
                f"• {tip1}\n"
                f"• {tip2}\n"
            )
        else:
            tip1 = "Try English names like Chiang Mai"
            tip2 = "Try province names instead of districts"
            message = (
                f"🔍 **No stations found**\n\n"
                f"No monitoring stations found matching '{search_query}'.\n\n"
                f"💡 **Suggestions:**\n"
                f"• {tip1}\n"
                f"• {tip2}\n"
            )
        return {
            "message": message,
            "summary": {
                "query": search_query,
                "total_found": 0,
                "stations": [],
                "search_summary": ""
            }
        }
    
    # Calculate overall statistics
    avg_values = [s.get("avg_pm25_7d") for s in stations if s.get("avg_pm25_7d")]
    overall_avg = round(sum(avg_values) / len(avg_values), 1) if avg_values else None
    overall_level = get_aqi_level_from_pm25(overall_avg) if overall_avg else "unknown"
    level_config = AQI_LEVELS.get(overall_level, {})
    
    # Build station list
    station_names = [
        s.get("name_en") or s.get("name_th") or s.get("station_id") 
        for s in stations[:5]
    ]
    
    # Compose message
    if language == "th":
        message = (
            f"🔍 **พบ {total_found} สถานีใน {search_query}**\n\n"
            f"📍 **สถานี:** {', '.join(station_names)}\n"
        )
        if overall_avg:
            message += (
                f"\n📊 **ค่าเฉลี่ย PM2.5 (7 วัน):** {overall_avg} μg/m³\n"
                f"{level_config.get('emoji', '')} **ระดับคุณภาพอากาศ:** {level_config.get('label_th', 'ไม่ทราบ')}\n"
            )
            message += f"\n💡 **คำแนะนำ:** {level_config.get('advice_th', '')}"
    else:
        message = (
            f"🔍 **Found {total_found} station(s) in {search_query}**\n\n"
            f"📍 **Stations:** {', '.join(station_names)}\n"
        )
        if overall_avg:
            message += (
                f"\n📊 **7-day Average PM2.5:** {overall_avg} μg/m³\n"
                f"{level_config.get('emoji', '')} **Air Quality Level:** {level_config.get('label_en', 'Unknown')}\n"
            )
            message += f"\n💡 **Advice:** {level_config.get('advice_en', '')}"
    
    if len(stations) > 5:
        more_count = len(stations) - 5
        message += f"\n\n{'และอีก' if language == 'th' else '... and'} {more_count} {'สถานี' if language == 'th' else 'more stations'}"
    
    return {
        "message": message,
        "summary": {
            "query": search_query,
            "total_found": total_found,
            "search_summary": search_result.get("search_summary", ""),
            "stations": stations,
            "overall_avg_pm25": overall_avg,
            "overall_aqi_level": overall_level
        }
    }


def compose_data_response(
    station_id: str,
    data: List[Dict[str, Any]],
    intent: Dict[str, Any],
    summary: Dict[str, Any],
    language: str = "en",
    station_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Compose rich response for data retrieval queries
    
    Args:
        station_id: Station identifier
        data: Time series data
        intent: Parsed intent
        summary: Data summary statistics
        language: Response language (en/th)
        station_name: Optional station name (Thai/English) for display
        
    Returns:
        Formatted response dict with message and enhanced summary
    """
    # Use station_name if provided, otherwise fall back to station_id
    display_name = station_name or station_id
    
    if not data:
        if language == "th":
            message = (
                f"❌ **ไม่พบข้อมูล**\n\n"
                f"ไม่พบข้อมูลสำหรับสถานี '{display_name}' ในช่วงเวลาที่ระบุ\n\n"
                f"💡 ลองเปลี่ยนช่วงเวลาหรือสถานี"
            )
        else:
            message = (
                f"❌ **No Data Found**\n\n"
                f"No data available for station '{display_name}' in the specified period.\n\n"
                f"💡 Try a different time range or station."
            )
        return {"message": message, "summary": summary}
    
    # Get AQI level from average
    avg_pm25 = summary.get("mean")
    aqi_level = get_aqi_level_from_pm25(avg_pm25) if avg_pm25 else "unknown"
    level_config = AQI_LEVELS.get(aqi_level, {})

    # Get the actual pollutant from intent
    pollutant = intent.get("pollutant", "pm25")
    
    # Map pollutant to display name and unit
    pollutant_display = {
        "pm25": {"name": "PM2.5", "unit": "μg/m³"},
        "pm10": {"name": "PM10", "unit": "μg/m³"},
        "o3": {"name": "O₃", "unit": "ppb"},
        "co": {"name": "CO", "unit": "ppm"},
        "no2": {"name": "NO₂", "unit": "ppb"},
        "so2": {"name": "SO₂", "unit": "ppb"},
        "nox": {"name": "NOₓ", "unit": "ppb"},
    }
    
    pollutant_info = pollutant_display.get(pollutant, {"name": pollutant.upper(), "unit": ""})
    pollutant_name = pollutant_info["name"]
    pollutant_unit = pollutant_info["unit"]

    # Generate threshold warnings for all parameters
    threshold_warning = generate_threshold_warnings(data, intent, language)

    # Determine trend description
    trend = summary.get("trend", "unknown")
    if language == "th":
        trend_desc = {
            "increasing": "📈 เพิ่มขึ้น (ควรระวัง)",
            "decreasing": "📉 ลดลง (ดีขึ้น)",
            "stable": "➡️ คงที่",
        }.get(trend, "❓ ข้อมูลไม่เพียงพอ")
    else:
        trend_desc = {
            "increasing": "📈 Increasing (be cautious)",
            "decreasing": "📉 Decreasing (improving)",
            "stable": "➡️ Stable",
        }.get(trend, "❓ Insufficient data")

    # Determine if this is an Executive Report request
    is_report = intent.get("output_type") == "report" or "policy" in str(intent).lower()

    # Policy Recommendations (TOR 16.7)
    policy_recs_th = ""
    policy_recs_en = ""
    
    # Check if policy recommendations should be shown
    is_critical = aqi_level in ["unhealthy", "hazardous", "unhealthy_sensitive"]
    exceeds_standard = avg_pm25 is not None and avg_pm25 > 50  # Thailand standard
    
    if is_report or is_critical or exceeds_standard:
        if aqi_level in ["unhealthy", "hazardous", "unhealthy_sensitive"]:
            policy_recs_th = (
                "\n📋 **ข้อเสนอแนะเชิงนโยบาย (Policy Recommendations):**\n"
                "1. **มาตรการเร่งด่วน:** ประกาศงดกิจกรรมกลางแจ้งในโรงเรียนและศูนย์เด็กเล็ก\n"
                "2. **การควบคุม:** เพิ่มความเข้มงวดในการตรวจสอบการเผาในที่โล่งและการจราจร\n"
                "3. **สาธารณสุข:** แจกหน้ากาก N95 ให้กับประชาชนกลุ่มเปราะบาง"
            )
            policy_recs_en = (
                "\n📋 **Policy Recommendations:**\n"
                "1. **Urgent Measure:** Suspend outdoor activities in schools and daycare centers.\n"
                "2. **Control:** Intensify inspections on open burning and traffic.\n"
                "3. **Public Health:** Distribute N95 masks to vulnerable groups."
            )
        elif aqi_level in ["moderate", "good"]:
            policy_recs_th = (
                "\n📋 **ข้อเสนอแนะเชิงนโยบาย (Policy Recommendations):**\n"
                "1. **การเฝ้าระวัง:** ติดตามสถานการณ์อย่างต่อเนื่องและแจ้งเตือนเมื่อค่าฝุ่นเริ่มสูงขึ้น\n"
                "2. **การรณรงค์:** ประชาสัมพันธ์ให้ประชาชนบำรุงรักษายานพาหนะเพื่อลดมลพิษ"
            )
            policy_recs_en = (
                "\n📋 **Policy Recommendations:**\n"
                "1. **Surveillance:** Continuously monitor and alert when levels begin to rise.\n"
                "2. **Campaign:** Encourage vehicle maintenance to reduce emissions."
            )

    # Build response message
    warning_prefix = f"{threshold_warning}\n\n{'─' * 40}\n\n" if threshold_warning else ""

    if language == "th":
        message_title = f"📑 **รายงานสรุปผู้บริหาร: สถานี {display_name}**" if is_report else f"📊 **ข้อมูล PM2.5 สถานี {display_name}**"
        
        message = (
            f"{warning_prefix}"
            f"{message_title}\n\n"
            f"{level_config.get('emoji', '')} **ระดับคุณภาพอากาศ:** {level_config.get('label_th', 'ไม่ทราบ')}\n\n"
            f"📈 **สถิติช่วงเวลาที่เลือก:**\n"
            f"• ค่าเฉลี่ย: **{summary.get('mean', 'N/A')}** μg/m³\n"
            f"• ค่าต่ำสุด: {summary.get('min', 'N/A')} μg/m³\n"
            f"• ค่าสูงสุด: {summary.get('max', 'N/A')} μg/m³\n"
            f"• แนวโน้ม: {trend_desc}\n\n"
            f"🏥 **คำแนะนำสุขภาพ:**\n{level_config.get('advice_th', 'ไม่มีข้อมูล')}\n\n"
            f"😷 **สำหรับกลุ่มเสี่ยง:**\n{level_config.get('sensitive_advice_th', 'ไม่มีข้อมูล')}"
            f"{policy_recs_th if is_report or exceeds_standard else ''}"
        )
    else:
        message_title = f"📑 **Executive Summary: {display_name}**" if is_report else f"📊 **PM2.5 Data for {display_name}**"

        message = (
            f"{warning_prefix}"
            f"{message_title}\n\n"
            f"{level_config.get('emoji', '')} **Air Quality Level:** {level_config.get('label_en', 'Unknown')}\n\n"
            f"📈 **Statistics for Selected Period:**\n"
            f"• Average: **{summary.get('mean', 'N/A')}** μg/m³\n"
            f"• Minimum: {summary.get('min', 'N/A')} μg/m³\n"
            f"• Maximum: {summary.get('max', 'N/A')} μg/m³\n"
            f"• Trend: {trend_desc}\n\n"
            f"🏥 **Health Advice:**\n{level_config.get('advice_en', 'N/A')}\n\n"
            f"😷 **For Sensitive Groups:**\n{level_config.get('sensitive_advice_en', 'N/A')}"
            f"{policy_recs_en if is_report or exceeds_standard else ''}"
        )
    
    # Enhance summary with AQI level
    enhanced_summary = {
        **summary,
        "aqi_level": aqi_level,
        "health_advice": level_config.get(f"advice_{language}", level_config.get("advice_en", "")),
        "sensitive_advice": level_config.get(f"sensitive_advice_{language}", level_config.get("sensitive_advice_en", "")),
    }
    
    return {
        "message": message,
        "summary": enhanced_summary
    }


def compose_error_response(
    error_type: str,
    details: str = "",
    language: str = "en"
) -> Dict[str, Any]:
    """
    Compose user-friendly error response
    
    Args:
        error_type: Type of error (invalid_station, no_data, service_error, etc.)
        details: Additional error details
        language: Response language
        
    Returns:
        Formatted error response
    """
    error_messages = {
        "invalid_station": {
            "en": f"❌ **Station Not Found**\n\nCouldn't find station '{details}'. Please check the station name and try again.\n\n💡 **Tip:** Try searching for stations first using 'Search stations in [location]'",
            "th": f"❌ **ไม่พบสถานี**\n\nไม่พบสถานี '{details}' กรุณาตรวจสอบชื่อสถานีแล้วลองใหม่\n\n💡 **คำแนะนำ:** ลองค้นหาสถานีก่อนโดยพิมพ์ 'ค้นหาสถานีใน [จังหวัด]'"
        },
        "no_data": {
            "en": f"📭 **No Data Available**\n\nNo data found for the specified query.\n\n💡 Try a different time period or station.",
            "th": f"📭 **ไม่มีข้อมูล**\n\nไม่พบข้อมูลตามที่ระบุ\n\n💡 ลองเปลี่ยนช่วงเวลาหรือสถานี"
        },
        "service_error": {
            "en": "⚠️ **Service Temporarily Unavailable**\n\nThe AI service is currently unavailable. Please try again in a moment.",
            "th": "⚠️ **บริการไม่พร้อมใช้งานชั่วคราว**\n\nบริการ AI ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่ในอีกสักครู่"
        },
        "out_of_scope": {
            "en": "🤖 **Air Quality Questions Only**\n\nI can only answer questions about air quality, PM2.5 levels, and monitoring stations in Thailand.\n\n💡 **Try asking:**\n• 'Show PM2.5 for Bangkok last week'\n• 'Search stations in Chiang Mai'\n• 'Air quality today in Phuket'",
            "th": "🤖 **ตอบเฉพาะคำถามเรื่องคุณภาพอากาศ**\n\nฉันตอบได้เฉพาะคำถามเกี่ยวกับคุณภาพอากาศ ค่า PM2.5 และสถานีตรวจวัดในประเทศไทย\n\n💡 **ลองถามว่า:**\n• 'ขอดูค่า PM2.5 กรุงเทพย้อนหลัง 7 วัน'\n• 'ค้นหาสถานีเชียงใหม่'\n• 'คุณภาพอากาศวันนี้ที่ภูเก็ต'"
        },
        "invalid_request": {
            "en": f"🔄 **Please Clarify Your Request**\n\n{details or 'I need more information to help you.'}\n\n💡 **Example queries:**\n• 'PM2.5 in Bangkok for last 7 days'\n• 'Search stations in Chiang Mai'",
            "th": f"🔄 **กรุณาระบุรายละเอียดเพิ่มเติม**\n\n{details or 'ต้องการข้อมูลเพิ่มเติมเพื่อช่วยคุณ'}\n\n💡 **ตัวอย่างคำถาม:**\n• 'ค่า PM2.5 กรุงเทพ ย้อนหลัง 7 วัน'\n• 'ค้นหาสถานีเชียงใหม่'"
        }
    }
    
    error_config = error_messages.get(error_type, error_messages["service_error"])
    message = error_config.get(language, error_config.get("en"))
    
    return {
        "message": message,
        "status": error_type
    }


def compose_clarification_response(
    clarification_question: str,
    missing_info: str = "",
    language: str = "en"
) -> Dict[str, Any]:
    """
    Compose a friendly clarification request when query is unclear
    
    Args:
        clarification_question: The question to ask the user
        missing_info: Description of what information is missing
        language: Response language (en/th)
        
    Returns:
        Formatted clarification response
    """
    # Add friendly prefix and examples based on what's missing
    if language == "th":
        prefix = "🤔 **ขอข้อมูลเพิ่มเติม**\n\n"
        question = clarification_question
        
        # Add helpful examples based on missing info
        examples = "\n\n📝 **ตัวอย่างคำถาม:**"
        if "location" in missing_info.lower() or "จังหวัด" in missing_info or "สถานี" in missing_info:
            examples += "\n• 'ค่า PM2.5 เชียงใหม่ วันนี้'"
            examples += "\n• 'ค้นหาสถานีใน กรุงเทพ'"
        if "time" in missing_info.lower() or "เวลา" in missing_info or "วัน" in missing_info:
            examples += "\n• 'PM2.5 เชียงใหม่ ย้อนหลัง 7 วัน'"
            examples += "\n• 'คุณภาพอากาศ กทม วันนี้'"
        if not examples.endswith(":"):
            pass
        else:
            examples += "\n• 'ค่าฝุ่น เชียงใหม่ ย้อนหลัง 7 วัน'"
            examples += "\n• 'ค้นหาสถานีภูเก็ต'"
        
        message = prefix + question + examples
    else:
        prefix = "🤔 **Need More Information**\n\n"
        question = clarification_question
        
        # Add helpful examples based on missing info
        examples = "\n\n📝 **Example queries:**"
        if "location" in missing_info.lower() or "station" in missing_info.lower():
            examples += "\n• 'PM2.5 in Chiang Mai today'"
            examples += "\n• 'Search stations in Bangkok'"
        if "time" in missing_info.lower() or "period" in missing_info.lower() or "date" in missing_info.lower():
            examples += "\n• 'PM2.5 in Bangkok for last 7 days'"
            examples += "\n• 'Air quality in Phuket today'"
        if examples.endswith(":"):
            examples += "\n• 'Show PM2.5 for Chiang Mai last week'"
            examples += "\n• 'Find stations in Phuket'"
        
        message = prefix + question + examples
    
    return {
        "message": message,
        "status": "needs_clarification",
        "missing_info": missing_info
    }

