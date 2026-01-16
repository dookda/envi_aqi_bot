"""
LINE LIFF Router

Handles LINE LIFF user registration and profile binding for notifications
"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from backend_model.logger import logger
from backend_model.database import get_db_context

router = APIRouter(prefix="/api/liff", tags=["LINE LIFF"])


# ============== Schemas ==============

class LiffUserProfile(BaseModel):
    """LINE LIFF user profile from LINE SDK"""
    user_id: str  # LINE User ID (starts with 'U')
    display_name: str
    picture_url: Optional[str] = None
    status_message: Optional[str] = None


class LiffRegistration(BaseModel):
    """LIFF registration request"""
    line_user_id: str
    display_name: str
    picture_url: Optional[str] = None
    email: Optional[str] = None
    receive_notifications: bool = True


class LiffUserResponse(BaseModel):
    """LIFF user response"""
    id: int
    line_user_id: str
    display_name: str
    email: Optional[str]
    receive_notifications: bool
    created_at: Optional[datetime]
    is_new: bool = False


class NotificationSettings(BaseModel):
    """Notification settings update"""
    receive_notifications: bool


# ============== Endpoints ==============

@router.get("/user/{line_user_id}", response_model=LiffUserResponse)
async def get_liff_user(line_user_id: str):
    """
    Get user profile by LINE User ID
    Returns 404 if user not registered
    """
    try:
        with get_db_context() as db:
            result = db.execute(
                text("""
                    SELECT id, line_user_id, full_name, email, receive_notifications, created_at
                    FROM users WHERE line_user_id = :line_id
                """),
                {"line_id": line_user_id}
            )
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="User not registered")
            
            return LiffUserResponse(
                id=row[0],
                line_user_id=row[1],
                display_name=row[2] or "LINE User",
                email=row[3],
                receive_notifications=row[4] if row[4] is not None else True,
                created_at=row[5],
                is_new=False
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting LIFF user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register", response_model=LiffUserResponse)
async def register_liff_user(registration: LiffRegistration):
    """
    Register a new LINE LIFF user or update existing
    
    This is called when a user opens the LIFF app and grants access.
    If the LINE User ID already exists, updates the profile.
    """
    try:
        with get_db_context() as db:
            # Check if user already exists
            existing = db.execute(
                text("SELECT id, created_at FROM users WHERE line_user_id = :line_id"),
                {"line_id": registration.line_user_id}
            ).fetchone()
            
            if existing:
                # Update existing user's display name
                db.execute(
                    text("""
                        UPDATE users 
                        SET full_name = :display_name,
                            receive_notifications = :receive_notifications
                        WHERE line_user_id = :line_id
                    """),
                    {
                        "line_id": registration.line_user_id,
                        "display_name": registration.display_name,
                        "receive_notifications": registration.receive_notifications
                    }
                )
                db.commit()
                
                logger.info(f"Updated LIFF user: {registration.line_user_id[:10]}...")
                
                return LiffUserResponse(
                    id=existing[0],
                    line_user_id=registration.line_user_id,
                    display_name=registration.display_name,
                    email=registration.email,
                    receive_notifications=registration.receive_notifications,
                    created_at=existing[1],
                    is_new=False
                )
            
            # Create new user
            # Generate unique username from LINE User ID
            username = f"line_{registration.line_user_id[-8:]}"
            email = registration.email or f"{registration.line_user_id[-8:]}@line.local"
            
            # Check if username/email exists and modify if needed
            check = db.execute(
                text("SELECT COUNT(*) FROM users WHERE username = :username OR email = :email"),
                {"username": username, "email": email}
            ).scalar()
            
            if check > 0:
                # Add timestamp to make unique
                import time
                suffix = str(int(time.time()))[-4:]
                username = f"line_{registration.line_user_id[-8:]}_{suffix}"
                if not registration.email:
                    email = f"{registration.line_user_id[-8:]}_{suffix}@line.local"
            
            result = db.execute(
                text("""
                    INSERT INTO users (
                        email, username, hashed_password, full_name, role,
                        is_active, line_user_id, receive_notifications
                    )
                    VALUES (
                        :email, :username, :password, :display_name, 'user',
                        true, :line_user_id, :receive_notifications
                    )
                    RETURNING id, created_at
                """),
                {
                    "email": email,
                    "username": username,
                    "password": "liff_user_no_password",  # LIFF users don't use password
                    "display_name": registration.display_name,
                    "line_user_id": registration.line_user_id,
                    "receive_notifications": registration.receive_notifications
                }
            )
            row = result.fetchone()
            db.commit()
            
            logger.info(f"Created new LIFF user: {registration.display_name} ({registration.line_user_id[:10]}...)")
            
            return LiffUserResponse(
                id=row[0],
                line_user_id=registration.line_user_id,
                display_name=registration.display_name,
                email=email,
                receive_notifications=registration.receive_notifications,
                created_at=row[1],
                is_new=True
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering LIFF user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/{line_user_id}/notifications", response_model=LiffUserResponse)
async def update_notification_settings(line_user_id: str, settings: NotificationSettings):
    """
    Update notification settings for a LINE user
    """
    try:
        with get_db_context() as db:
            # Check if user exists
            existing = db.execute(
                text("SELECT id FROM users WHERE line_user_id = :line_id"),
                {"line_id": line_user_id}
            ).fetchone()
            
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Update settings
            db.execute(
                text("""
                    UPDATE users 
                    SET receive_notifications = :receive_notifications
                    WHERE line_user_id = :line_id
                """),
                {
                    "line_id": line_user_id,
                    "receive_notifications": settings.receive_notifications
                }
            )
            db.commit()
            
            logger.info(f"Updated notification settings for {line_user_id[:10]}...: {settings.receive_notifications}")
            
            # Return updated user
            return await get_liff_user(line_user_id)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/{line_user_id}")
async def unregister_liff_user(line_user_id: str):
    """
    Unregister a LINE user (remove LINE binding, keep user record)
    """
    try:
        with get_db_context() as db:
            result = db.execute(
                text("""
                    UPDATE users 
                    SET line_user_id = NULL, receive_notifications = false
                    WHERE line_user_id = :line_id
                    RETURNING id
                """),
                {"line_id": line_user_id}
            )
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            
            db.commit()
            logger.info(f"Unregistered LINE user: {line_user_id[:10]}...")
            
            return {"status": "success", "message": "LINE binding removed"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unregistering LIFF user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
