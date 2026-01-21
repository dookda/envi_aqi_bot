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
            prompt = f"""วิเคราะห์ข้อมูล AQI และสร้างรายงานสรุป ตอบเป็น JSON ภาษาไทย:

สถิติ: สถานี {request.activeStations} แห่ง, AQI เฉลี่ย {request.avgAqi}, สูงสุด {request.maxAqi}, ต่ำสุด {request.minAqi}, แจ้งเตือน {request.alertCount} ครั้ง

ตอบเป็น JSON เท่านั้น:
{{"insight": "สรุป 1-2 ประโยค", "highlights": ["ข้อ 1", "ข้อ 2", "ข้อ 3"], "executive_brief": "สรุปสั้นๆ 1 ประโยค"}}"""
        else:
            prompt = f"""Analyze AQI data and generate executive summary. Respond in JSON only.

Stats: {request.activeStations} stations, Avg AQI {request.avgAqi}, Max {request.maxAqi}, Min {request.minAqi}, {request.alertCount} alerts

Return JSON only:
{{"insight": "1-2 sentence summary", "highlights": ["point 1", "point 2", "point 3"], "executive_brief": "one short sentence"}}"""

        # Generate response with language-specific system prompt
        response_text = await adapter.generate(
            prompt=prompt,
            system_prompt=get_system_prompt(request.lang),
            temperature=0.3,  # Low temp for consistent JSON
            max_tokens=512  # Reduced for faster response
        )

        if not response_text:
            raise HTTPException(status_code=500, detail="Failed to generate summary")

        # Parse JSON from response
        try:
            # Clean up potential markdown code blocks
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            
            # Try to fix common JSON issues from AI output
            import re
            # Fix missing commas between fields
            clean_text = re.sub(r'"\s*\n\s*"', '",\n"', clean_text)
            clean_text = re.sub(r'(\]|\})\s*\n\s*"', r'\1,\n"', clean_text)
            
            # Try to extract just the JSON object
            json_match = re.search(r'\{[\s\S]*\}', clean_text)
            if json_match:
                clean_text = json_match.group(0)
            
            try:
                data = json.loads(clean_text)
            except json.JSONDecodeError:
                # Try to extract fields manually from truncated JSON
                logger.warning("JSON decode failed, trying manual extraction")
                data = {}
                
                # Extract insight
                insight_match = re.search(r'"insight"\s*:\s*"([^"]*(?:\\"[^"]*)*)"', clean_text)
                if insight_match:
                    data["insight"] = insight_match.group(1).replace('\\"', '"')
                
                # Extract highlights as array
                highlights_match = re.search(r'"highlights"\s*:\s*\[(.*?)\]', clean_text, re.DOTALL)
                if highlights_match:
                    highlights_str = highlights_match.group(1)
                    data["highlights"] = re.findall(r'"([^"]*)"', highlights_str)
                
                # Extract executive_brief
                brief_match = re.search(r'"executive_brief"\s*:\s*"([^"]*(?:\\"[^"]*)*)"', clean_text)
                if brief_match:
                    data["executive_brief"] = brief_match.group(1).replace('\\"', '"')
                
                if not data:
                    raise json.JSONDecodeError("No fields extracted", clean_text, 0)
            
            return ExecutiveSummaryResponse(
                status="success",
                insight=data.get("insight"),
                highlights=data.get("highlights"),
                executive_brief=data.get("executive_brief"),
                action_items=data.get("action_items"),
                policy_recommendations=data.get("policy_recommendations")
            )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {response_text[:500]}... Error: {e}")
            error_msg = "ไม่สามารถแปลงผลลัพธ์จาก AI ได้" if is_thai else "Failed to parse AI response"
            return ExecutiveSummaryResponse(
                status="error",
                error=error_msg,
                insight=clean_text  # Fallback: return raw text as insight
            )

    except Exception as e:
        logger.error(f"Executive summary error: {str(e)}")
        return ExecutiveSummaryResponse(
            status="error",
            error=str(e)
        )
