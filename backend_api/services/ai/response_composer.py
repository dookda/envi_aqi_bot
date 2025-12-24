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


# AQI Level Definitions with Health Advice
AQI_LEVELS = {
    "excellent": {
        "range": (0, 25),
        "label_en": "Excellent",
        "label_th": "ดีมาก",
        "color": "green",
        "emoji": "🟢",
        "advice_en": "Air quality is ideal for all activities. Enjoy the outdoors!",
        "advice_th": "คุณภาพอากาศดีเยี่ยม เหมาะสำหรับกิจกรรมกลางแจ้งทุกประเภท",
        "sensitive_advice_en": "No precautions needed.",
        "sensitive_advice_th": "ไม่จำเป็นต้องระวังเป็นพิเศษ",
    },
    "good": {
        "range": (26, 50),
        "label_en": "Good",
        "label_th": "ดี",
        "color": "lime",
        "emoji": "🟡",
        "advice_en": "Air quality is satisfactory. Safe for outdoor activities.",
        "advice_th": "คุณภาพอากาศดี ปลอดภัยสำหรับกิจกรรมกลางแจ้ง",
        "sensitive_advice_en": "Unusually sensitive people should consider reducing prolonged outdoor exertion.",
        "sensitive_advice_th": "ผู้ที่มีความไวต่อมลพิษเป็นพิเศษควรพิจารณาลดกิจกรรมกลางแจ้งที่ใช้เวลานาน",
    },
    "moderate": {
        "range": (51, 100),
        "label_en": "Moderate",
        "label_th": "ปานกลาง",
        "color": "yellow",
        "emoji": "🟠",
        "advice_en": "Some pollutants may pose a moderate health concern. Consider limiting prolonged outdoor exertion.",
        "advice_th": "มลพิษบางส่วนอาจส่งผลต่อสุขภาพเล็กน้อย ควรพิจารณาจำกัดกิจกรรมกลางแจ้งที่ใช้เวลานาน",
        "sensitive_advice_en": "Sensitive groups should limit prolonged outdoor exertion. Consider wearing a mask.",
        "sensitive_advice_th": "กลุ่มเสี่ยงควรจำกัดกิจกรรมกลางแจ้ง พิจารณาสวมหน้ากากอนามัย",
    },
    "unhealthy_sensitive": {
        "range": (101, 200),
        "label_en": "Unhealthy for Sensitive Groups",
        "label_th": "มีผลต่อสุขภาพกลุ่มเสี่ยง",
        "color": "orange",
        "emoji": "🔴",
        "advice_en": "General public may begin to experience health effects. Reduce prolonged outdoor exertion.",
        "advice_th": "ประชาชนทั่วไปอาจเริ่มได้รับผลกระทบต่อสุขภาพ ควรลดกิจกรรมกลางแจ้ง",
        "sensitive_advice_en": "Children, elderly, and people with respiratory conditions should avoid outdoor activities. Wear N95 mask if going outside.",
        "sensitive_advice_th": "เด็ก ผู้สูงอายุ และผู้มีโรคระบบทางเดินหายใจ ควรหลีกเลี่ยงกิจกรรมกลางแจ้ง สวมหน้ากาก N95 หากต้องออกนอกบ้าน",
    },
    "unhealthy": {
        "range": (201, 300),
        "label_en": "Unhealthy",
        "label_th": "มีผลต่อสุขภาพ",
        "color": "red",
        "emoji": "🟣",
        "advice_en": "Everyone may experience health effects. Limit all outdoor activities.",
        "advice_th": "ทุกคนอาจได้รับผลกระทบต่อสุขภาพ ควรจำกัดกิจกรรมกลางแจ้งทั้งหมด",
        "sensitive_advice_en": "Everyone should avoid outdoor activities. Stay indoors with air purifier.",
        "sensitive_advice_th": "ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง อยู่ในอาคารพร้อมเครื่องฟอกอากาศ",
    },
    "hazardous": {
        "range": (301, 999),
        "label_en": "Hazardous",
        "label_th": "อันตราย",
        "color": "purple",
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
    language: str = "en"
) -> Dict[str, Any]:
    """
    Compose rich response for data retrieval queries
    
    Args:
        station_id: Station identifier
        data: Time series data
        intent: Parsed intent
        summary: Data summary statistics
        language: Response language (en/th)
        
    Returns:
        Formatted response dict with message and enhanced summary
    """
    if not data:
        if language == "th":
            message = (
                f"❌ **ไม่พบข้อมูล**\n\n"
                f"ไม่พบข้อมูลสำหรับสถานี '{station_id}' ในช่วงเวลาที่ระบุ\n\n"
                f"💡 ลองเปลี่ยนช่วงเวลาหรือสถานี"
            )
        else:
            message = (
                f"❌ **No Data Found**\n\n"
                f"No data available for station '{station_id}' in the specified period.\n\n"
                f"💡 Try a different time range or station."
            )
        return {"message": message, "summary": summary}
    
    # Get AQI level from average
    avg_pm25 = summary.get("mean")
    aqi_level = get_aqi_level_from_pm25(avg_pm25) if avg_pm25 else "unknown"
    level_config = AQI_LEVELS.get(aqi_level, {})
    
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
    
    # Build response message
    if language == "th":
        message = (
            f"📊 **ข้อมูล PM2.5 สถานี {station_id}**\n\n"
            f"{level_config.get('emoji', '')} **ระดับคุณภาพอากาศ:** {level_config.get('label_th', 'ไม่ทราบ')}\n\n"
            f"📈 **สถิติช่วงเวลาที่เลือก:**\n"
            f"• ค่าเฉลี่ย: **{summary.get('mean', 'N/A')}** μg/m³\n"
            f"• ค่าต่ำสุด: {summary.get('min', 'N/A')} μg/m³\n"
            f"• ค่าสูงสุด: {summary.get('max', 'N/A')} μg/m³\n"
            f"• แนวโน้ม: {trend_desc}\n\n"
            f"🏥 **คำแนะนำสุขภาพ:**\n{level_config.get('advice_th', 'ไม่มีข้อมูล')}\n\n"
            f"😷 **สำหรับกลุ่มเสี่ยง:**\n{level_config.get('sensitive_advice_th', 'ไม่มีข้อมูล')}"
        )
    else:
        message = (
            f"📊 **PM2.5 Data for {station_id}**\n\n"
            f"{level_config.get('emoji', '')} **Air Quality Level:** {level_config.get('label_en', 'Unknown')}\n\n"
            f"📈 **Statistics for Selected Period:**\n"
            f"• Average: **{summary.get('mean', 'N/A')}** μg/m³\n"
            f"• Minimum: {summary.get('min', 'N/A')} μg/m³\n"
            f"• Maximum: {summary.get('max', 'N/A')} μg/m³\n"
            f"• Trend: {trend_desc}\n\n"
            f"🏥 **Health Advice:**\n{level_config.get('advice_en', 'N/A')}\n\n"
            f"😷 **For Sensitive Groups:**\n{level_config.get('sensitive_advice_en', 'N/A')}"
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

