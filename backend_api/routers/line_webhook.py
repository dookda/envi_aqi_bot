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


async def auto_register_line_user(user_id: str, display_name: str = None):
    """
    Auto-register LINE user in database for notifications
    Creates a new user or updates existing one with LINE binding
    """
    from backend_model.database import get_db_context
    from sqlalchemy import text
    
    try:
        with get_db_context() as db:
            # Check if user already exists with this LINE ID
            existing = db.execute(
                text("SELECT id FROM users WHERE line_user_id = :line_id"),
                {"line_id": user_id}
            ).fetchone()
            
            if existing:
                logger.debug(f"LINE user {user_id[:10]}... already registered")
                return
            
            # Create new user with notifications enabled by default
            username = f"line_{user_id[-8:]}"
            email = f"{user_id[-8:]}@line.auto"
            name = display_name or f"LINE User {user_id[-6:]}"
            
            # Check for username/email collision
            collision = db.execute(
                text("SELECT COUNT(*) FROM users WHERE username = :username OR email = :email"),
                {"username": username, "email": email}
            ).scalar()
            
            if collision > 0:
                import time
                suffix = str(int(time.time()))[-4:]
                username = f"line_{user_id[-8:]}_{suffix}"
                email = f"{user_id[-8:]}_{suffix}@line.auto"
            
            db.execute(
                text("""
                    INSERT INTO users (
                        email, username, hashed_password, full_name, role,
                        is_active, line_user_id, receive_notifications
                    )
                    VALUES (
                        :email, :username, :password, :name, 'user',
                        true, :line_id, true
                    )
                """),
                {
                    "email": email,
                    "username": username,
                    "password": "line_auto_registered",
                    "name": name,
                    "line_id": user_id
                }
            )
            db.commit()
            
            logger.info(f"Auto-registered LINE user: {user_id[:10]}... for notifications")
            
    except Exception as e:
        logger.error(f"Error auto-registering LINE user: {e}")


async def handle_message(event: MessageEvent):
    """
    Process user message and reply via AI with chart support
    """
    user_message = event.message.text
    user_id = event.source.user_id
    
    logger.info(f"Received LINE message from {user_id}: {user_message}")
    
    # Auto-register user for notifications
    await auto_register_line_user(user_id)
    
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
    from backend_api.services.line_notification import line_notification_service
    
    notification_health = line_notification_service.health_check()
    
    return {
        "status": "ok",
        "channel_configured": bool(CHANNEL_ACCESS_TOKEN and CHANNEL_SECRET),
        "base_url_configured": bool(BASE_URL),
        "cached_charts": len(_chart_cache),
        "push_notifications": notification_health
    }


@router.post("/test-notification")
async def test_line_notification(
    station_id: str = "test_station",
    language: str = "th"
):
    """
    Test LINE push notification (for debugging)
    
    Sends a sample quality alert notification to all configured admin users.
    
    **Parameters:**
    - station_id: Station ID to use in the test message (default: test_station)
    - language: Message language 'th' or 'en' (default: th)
    
    **Requires:** LINE_ADMIN_USER_IDS to be configured in .env
    """
    from backend_api.services.line_notification import line_notification_service
    from datetime import datetime
    
    if not line_notification_service.enabled:
        return {
            "status": "error",
            "message": "LINE notifications not configured. Please set LINE_ADMIN_USER_IDS in .env",
            "help": "To get your LINE user ID: Send a message to the bot and check logs for 'Received LINE message from Uxxxxxx'"
        }
    
    # Create sample test data
    test_summary = {
        "total_records": 168,
        "inserted": 165,
        "failed": 3,
        "spike_count": 2,
        "missing_gaps": 1,
        "missing_hours": 5,
        "imputed_count": 5,
        "coverage_percent": 97.0,
        "date_range": (
            datetime.now().strftime("%Y-%m-%d"),
            datetime.now().strftime("%Y-%m-%d")
        ),
        "anomaly_details": [
            {
                "datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "value": 285.5,
                "parameter": "PM2.5",
                "type": "spike"
            },
            {
                "datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "value": 312.3,
                "parameter": "PM2.5",
                "type": "z_score"
            }
        ]
    }
    
    try:
        success = line_notification_service.send_upload_quality_alert(
            station_id=station_id,
            station_name=f"Test Station ({station_id})",
            upload_summary=test_summary,
            language=language
        )
        
        if success:
            return {
                "status": "success",
                "message": f"Test notification sent to {len(line_notification_service.admin_user_ids)} admin(s)",
                "language": language,
                "station_id": station_id
            }
        else:
            return {
                "status": "warning",
                "message": "Notification may not have been sent to all admins",
                "admin_count": len(line_notification_service.admin_user_ids)
            }
            
    except Exception as e:
        logger.error(f"Test notification failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/test-simple")
async def test_simple_notification(
    title: str = "🔔 ทดสอบการแจ้งเตือน",
    message: str = "นี่คือข้อความทดสอบจากระบบ AQI Bot\n\nThis is a test message from AQI Bot system."
):
    """
    Send a simple text notification (for debugging)
    
    **Parameters:**
    - title: Notification title
    - message: Notification message body
    
    **Requires:** LINE_ADMIN_USER_IDS to be configured in .env
    """
    from backend_api.services.line_notification import line_notification_service
    
    if not line_notification_service.enabled:
        return {
            "status": "error",
            "message": "LINE notifications not configured. Please set LINE_ADMIN_USER_IDS in .env"
        }
    
    try:
        success = line_notification_service.send_simple_alert(
            title=title,
            message=message
        )
        
        return {
            "status": "success" if success else "warning",
            "message": f"Sent to {len(line_notification_service.admin_user_ids)} admin(s)",
            "title": title
        }
        
    except Exception as e:
        logger.error(f"Simple notification failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/my-user-id")
async def get_my_user_id_instructions():
    """
    Instructions to get your LINE user ID
    
    Returns instructions on how to obtain your LINE user ID for receiving push notifications.
    """
    return {
        "instructions": [
            "1. Add the AQI Bot as a friend on LINE",
            "2. Send any message to the bot (e.g., 'Hello')",
            "3. Check the API logs for the message: 'Received LINE message from Uxxxxxxxx...'",
            "4. Copy the user ID (starts with 'U') and add it to .env file",
            "5. Update LINE_ADMIN_USER_IDS in .env (comma-separated for multiple users)",
            "6. Restart the API container: docker restart aqi_api"
        ],
        "example_env": "LINE_ADMIN_USER_IDS=U1234567890abcdef1234567890abcdef",
        "multiple_users_example": "LINE_ADMIN_USER_IDS=U111...,U222...,U333...",
        "current_status": {
            "channel_configured": bool(CHANNEL_ACCESS_TOKEN and CHANNEL_SECRET),
        }
    }
