"""
LINE Webhook Router

Handles incoming webhooks from LINE Messaging API,
processes messages through the AI chatbot, and sends responses.
"""

from fastapi import APIRouter, Request, HTTPException, Header
from linebot.v3 import WebhookParser
from linebot.v3.messaging import (
    Configuration, ApiClient, MessagingApi,
    ReplyMessageRequest, TextMessage, ImageMessage
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from backend_api.services.ai.chatbot import chatbot_service
from backend_api.services.chart_generator import generate_timeseries_chart
from backend_model.logger import logger
import os
import hashlib
import time

router = APIRouter(prefix="/api/line", tags=["LINE Integration"])

# Config
CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")

# Base URL for chart images (ngrok or production URL)
# This should be set to your public-facing URL
BASE_URL = os.getenv("LINE_WEBHOOK_BASE_URL", "")

configuration = Configuration(access_token=CHANNEL_ACCESS_TOKEN)
parser = WebhookParser(CHANNEL_SECRET)

# Simple in-memory cache for generated charts
_chart_cache = {}


def cache_chart(chart_bytes: bytes, station_id: str, pollutant: str) -> str:
    """Cache chart and return cache key"""
    cache_key = f"{station_id}_{pollutant}_{int(time.time())}"
    _chart_cache[cache_key] = {
        "data": chart_bytes,
        "created": time.time()
    }
    # Cleanup old entries (older than 10 minutes)
    current_time = time.time()
    expired_keys = [k for k, v in _chart_cache.items() if current_time - v["created"] > 600]
    for k in expired_keys:
        del _chart_cache[k]
    return cache_key


@router.get("/chart/{cache_key}")
async def get_cached_chart(cache_key: str):
    """Serve cached chart image"""
    from fastapi.responses import Response
    
    if cache_key not in _chart_cache:
        raise HTTPException(status_code=404, detail="Chart not found or expired")
    
    chart_data = _chart_cache[cache_key]["data"]
    return Response(
        content=chart_data,
        media_type="image/png"
    )


@router.post("/callback")
async def line_callback(request: Request, x_line_signature: str = Header(None)):
    """
    Receive webhook from LINE
    """
    body = await request.body()
    body_str = body.decode("utf-8")
    
    try:
        events = parser.parse(body_str, x_line_signature)
    except Exception as e:
        logger.error(f"Invalid LINE signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        if not isinstance(event, MessageEvent):
            continue
            
        if not isinstance(event.message, TextMessageContent):
            continue

        await handle_message(event)

    return "OK"


async def handle_message(event: MessageEvent):
    """
    Process user message and reply via AI with chart support
    """
    user_message = event.message.text
    user_id = event.source.user_id
    
    logger.info(f"Received LINE message from {user_id}: {user_message}")
    
    try:
        # 1. Call existing AI Service
        ai_result = await chatbot_service.process_query(user_message)
        
        reply_text = ai_result.get("message", "Request processed.")
        output_type = ai_result.get("output_type", "text")
        data = ai_result.get("data")
        intent = ai_result.get("intent", {})
        
        messages = []
        
        # 2. Generate chart if we have time series data
        if output_type == "chart" and data and len(data) > 1:
            logger.info(f"Generating chart for LINE response with {len(data)} points")
            
            pollutant = intent.get("pollutant", "pm25") if intent else "pm25"
            station_id = intent.get("station_id", "Unknown") if intent else "Unknown"
            
            # Detect language
            thai_chars = sum(1 for c in user_message if '\u0e00' <= c <= '\u0e7f')
            language = "th" if thai_chars > len(user_message) * 0.2 else "en"
            
            chart_bytes = generate_timeseries_chart(
                data=data,
                station_id=station_id,
                pollutant=pollutant,
                language=language
            )
            
            if chart_bytes and BASE_URL:
                # Cache chart and get URL
                cache_key = cache_chart(chart_bytes, station_id, pollutant)
                chart_url = f"{BASE_URL}/api/line/chart/{cache_key}"
                
                logger.info(f"Chart URL: {chart_url}")
                
                # Add image message
                messages.append(ImageMessage(
                    originalContentUrl=chart_url,
                    previewImageUrl=chart_url
                ))
            elif chart_bytes:
                # No BASE_URL configured, add note about chart
                if language == "th":
                    chart_note = "\n\n📈 *กราฟแสดงแนวโน้มพร้อมแถบสี AQI*"
                else:
                    chart_note = "\n\n📈 *Chart with AQI color bands available*"
                reply_text += chart_note
        
        # 3. Truncate message if too long (LINE limit: 5000 chars)
        if len(reply_text) > 4900:
            reply_text = reply_text[:4900] + "\n\n... (ข้อความถูกตัดทอน)"
        
        # 4. Add text message
        messages.append(TextMessage(text=reply_text))
        
        # 5. Send Reply
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message(
                ReplyMessageRequest(
                    replyToken=event.reply_token,
                    messages=messages
                )
            )
            
        logger.info(f"Sent LINE reply to {user_id} with {len(messages)} message(s)")
            
    except Exception as e:
        logger.error(f"Error handling LINE message: {e}")
        import traceback
        traceback.print_exc()
        
        # Send error message
        try:
            with ApiClient(configuration) as api_client:
                line_bot_api = MessagingApi(api_client)
                line_bot_api.reply_message(
                    ReplyMessageRequest(
                        replyToken=event.reply_token,
                        messages=[TextMessage(text="ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง")]
                    )
                )
        except:
            pass


@router.get("/health")
async def line_health():
    """Health check for LINE integration"""
    return {
        "status": "ok",
        "channel_configured": bool(CHANNEL_ACCESS_TOKEN and CHANNEL_SECRET),
        "base_url_configured": bool(BASE_URL),
        "cached_charts": len(_chart_cache)
    }
