from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import re

from backend_model.logger import logger
from backend_api.services.ai.llm_adapter import get_ollama_adapter

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Insights"]
)

class SummaryStatsRequest(BaseModel):
    totalStations: int
    activeStations: int
    avgAqi: int
    maxAqi: int
    minAqi: int
    alertCount: int
    statusDistribution: dict
    lang: str = "en"

class ExecutiveSummaryResponse(BaseModel):
    status: str
    insight: Optional[str] = None
    highlights: Optional[List[str]] = None
    executive_brief: Optional[str] = None
    action_items: Optional[List[str]] = None
    policy_recommendations: Optional[List[str]] = None
    error: Optional[str] = None

def get_system_prompt(lang: str) -> str:
    """Get system prompt based on language"""
    if lang == "th":
        return """คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์ข้อมูลคุณภาพอากาศสำหรับกรมควบคุมมลพิษของประเทศไทย
หน้าที่ของคุณคือสร้างรายงานสรุปสำหรับผู้บริหารจากข้อมูลคุณภาพอากาศแบบเรียลไทม์
คุณต้องตอบเป็นภาษาไทยเท่านั้น และต้องเป็น JSON ที่ถูกต้องเท่านั้น"""
    return """You are an expert Air Quality Data Analyst for the Pollution Control Department of Thailand.
Your job is to generate high-level executive summaries based on real-time air quality data.
You must respond in English only and output ONLY valid JSON."""


@router.post("/executive-summary", response_model=ExecutiveSummaryResponse)
async def generate_executive_summary(request: SummaryStatsRequest):
    """
    Generate an AI-powered executive summary using Ollama.
    """
    try:
        adapter = get_ollama_adapter()

        # Check health
        if not await adapter.is_healthy():
            return ExecutiveSummaryResponse(
                status="error",
                error="AI Service Unavailable"
            )

        # Construct prompt based on language
        is_thai = request.lang == "th"
        logger.info(f"Generating executive summary - lang={request.lang}, is_thai={is_thai}")

        if is_thai:
            prompt = f"""
วิเคราะห์ข้อมูลดัชนีคุณภาพอากาศ (AQI) ต่อไปนี้ และสร้างรายงานสรุปสำหรับผู้บริหาร เป็นภาษาไทยทั้งหมด

ข้อมูลสถิติ:
- จำนวนสถานีทั้งหมด: {request.totalStations}
- สถานีที่ทำงานอยู่: {request.activeStations}
- ค่า AQI เฉลี่ย: {request.avgAqi}
- ค่า AQI สูงสุด: {request.maxAqi}
- ค่า AQI ต่ำสุด: {request.minAqi}
- จำนวนการแจ้งเตือน (AQI > 100): {request.alertCount}
- การกระจายตัวของสถานะ: {json.dumps(request.statusDistribution)}

ข้อกำหนด (ตอบเป็นภาษาไทยทั้งหมด):
1. "insight": สรุปสถานการณ์ 2-3 ย่อหน้า ใช้ **ตัวหนา** สำหรับตัวเลขสำคัญ
2. "highlights": 3-4 ข้อสังเกตสำคัญสั้นๆ
3. "executive_brief": ประโยคเดียวสรุปสถานะโดยรวมสำหรับแดชบอร์ด
4. "action_items": 3-4 ข้อเสนอแนะเชิงปฏิบัติการสำหรับเจ้าหน้าที่
5. "policy_recommendations": 2-3 ข้อเสนอแนะเชิงนโยบายตามระดับความรุนแรง

รูปแบบ JSON (ตอบเป็น JSON เท่านั้น):
{{
    "insight": "...",
    "highlights": ["...", "..."],
    "executive_brief": "...",
    "action_items": ["...", "..."],
    "policy_recommendations": ["...", "..."]
}}
"""
        else:
            prompt = f"""
Analyze the following Air Quality Index (AQI) data and generate an executive summary in English.

DATA STATISTICS:
- Total Stations: {request.totalStations}
- Active Stations: {request.activeStations}
- Average AQI: {request.avgAqi}
- Max AQI: {request.maxAqi}
- Min AQI: {request.minAqi}
- Alert Count (AQI > 100): {request.alertCount}
- Status Distribution: {json.dumps(request.statusDistribution)}

REQUIREMENTS (respond in English only):
1. "insight": A detailed 2-3 paragraph summary of the situation. Use formatting like **bold** for key metrics.
2. "highlights": 3-4 short, bullet-point key observations.
3. "executive_brief": A single, punchy sentence summarizing the overall status for a dashboard header.
4. "action_items": 3-4 specific operational recommendations for officials.
5. "policy_recommendations": 2-3 high-level policy suggestions based on the severity.

OUTPUT FORMAT (return ONLY valid JSON):
{{
    "insight": "...",
    "highlights": ["...", "..."],
    "executive_brief": "...",
    "action_items": ["...", "..."],
    "policy_recommendations": ["...", "..."]
}}
"""

        # Generate response with language-specific system prompt
        response_text = await adapter.generate(
            prompt=prompt,
            system_prompt=get_system_prompt(request.lang),
            temperature=0.3,  # Low temp for consistent JSON
            max_tokens=1024
        )

        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to generate summary")

        # Parse JSON from response
        try:
            # Clean up potential markdown code blocks
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_text)
            
            return ExecutiveSummaryResponse(
                status="success",
                insight=data.get("insight"),
                highlights=data.get("highlights"),
                executive_brief=data.get("executive_brief"),
                action_items=data.get("action_items"),
                policy_recommendations=data.get("policy_recommendations")
            )
        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI response: {response_text}")
            error_msg = "ไม่สามารถแปลงผลลัพธ์จาก AI ได้" if is_thai else "Failed to parse AI response"
            return ExecutiveSummaryResponse(
                status="error",
                error=error_msg,
                insight=clean_text  # Fallback: return raw text as insight if slightly malformed
            )

    except Exception as e:
        logger.error(f"Executive summary error: {str(e)}")
        return ExecutiveSummaryResponse(
            status="error",
            error=str(e)
        )
