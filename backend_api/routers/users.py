"""
User Management Router

CRUD operations for users with LINE notification settings
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from backend_model.logger import logger
from backend_model.database import get_db_context

router = APIRouter(prefix="/api/users", tags=["User Management"])


# ============== Schemas ==============

class UserBase(BaseModel):
    """Base user schema"""
    email: str
    username: str
    full_name: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    line_user_id: Optional[str] = Field(None, description="LINE User ID (starts with 'U')")
    receive_notifications: bool = True


class UserCreate(UserBase):
    """Schema for creating a user"""
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    line_user_id: Optional[str] = None
    receive_notifications: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: str
    is_active: bool
    line_user_id: Optional[str]
    receive_notifications: bool
    created_at: Optional[datetime]
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Schema for user list response"""
    users: List[UserResponse]
    total: int


# ============== Helper Functions ==============

def hash_password(password: str) -> str:
    """Simple password hashing (in production, use bcrypt)"""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()


# ============== Endpoints ==============

@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    has_line_id: Optional[bool] = None
):
    """
    List all users with optional filtering
    
    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum records to return
    - **search**: Search in username, email, full_name
    - **role**: Filter by role (user, admin)
    - **has_line_id**: Filter users with/without LINE ID
    """
    try:
        with get_db_context() as db:
            # Build query
            query = """
                SELECT id, email, username, full_name, role, is_active, 
                       line_user_id, receive_notifications, created_at, last_login
                FROM users
                WHERE 1=1
            """
            params = {}
            
            if search:
                query += """ AND (
                    username ILIKE :search 
                    OR email ILIKE :search 
                    OR full_name ILIKE :search
                )"""
                params["search"] = f"%{search}%"
            
            if role:
                query += " AND role = :role"
                params["role"] = role
            
            if has_line_id is not None:
                if has_line_id:
                    query += " AND line_user_id IS NOT NULL"
                else:
                    query += " AND line_user_id IS NULL"
            
            # Get total count
            count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
            total = db.execute(text(count_query), params).scalar()
            
            # Add pagination and ordering
            query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
            params["limit"] = limit
            params["skip"] = skip
            
            result = db.execute(text(query), params)
            rows = result.fetchall()
            
            users = []
            for row in rows:
                users.append(UserResponse(
                    id=row[0],
                    email=row[1],
                    username=row[2],
                    full_name=row[3],
                    role=row[4],
                    is_active=row[5],
                    line_user_id=row[6],
                    receive_notifications=row[7] if row[7] is not None else True,
                    created_at=row[8],
                    last_login=row[9]
                ))
            
            return UserListResponse(users=users, total=total or 0)
            
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Get a specific user by ID"""
    try:
        with get_db_context() as db:
            result = db.execute(
                text("""
                    SELECT id, email, username, full_name, role, is_active,
                           line_user_id, receive_notifications, created_at, last_login
                    FROM users WHERE id = :id
                """),
                {"id": user_id}
            )
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            
            return UserResponse(
                id=row[0],
                email=row[1],
                username=row[2],
                full_name=row[3],
                role=row[4],
                is_active=row[5],
                line_user_id=row[6],
                receive_notifications=row[7] if row[7] is not None else True,
                created_at=row[8],
                last_login=row[9]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Create a new user"""
    try:
        with get_db_context() as db:
            # Check if email or username already exists
            existing = db.execute(
                text("SELECT id FROM users WHERE email = :email OR username = :username"),
                {"email": user.email, "username": user.username}
            ).fetchone()
            
            if existing:
                raise HTTPException(status_code=400, detail="Email or username already exists")
            
            # Validate LINE user ID format
            if user.line_user_id and not user.line_user_id.startswith("U"):
                raise HTTPException(status_code=400, detail="LINE User ID must start with 'U'")
            
            # Check if LINE user ID is already assigned
            if user.line_user_id:
                existing_line = db.execute(
                    text("SELECT id FROM users WHERE line_user_id = :line_id"),
                    {"line_id": user.line_user_id}
                ).fetchone()
                if existing_line:
                    raise HTTPException(status_code=400, detail="LINE User ID already assigned to another user")
            
            # Insert user
            result = db.execute(
                text("""
                    INSERT INTO users (email, username, hashed_password, full_name, role, 
                                       is_active, line_user_id, receive_notifications)
                    VALUES (:email, :username, :password, :full_name, :role,
                            :is_active, :line_user_id, :receive_notifications)
                    RETURNING id, created_at
                """),
                {
                    "email": user.email,
                    "username": user.username,
                    "password": hash_password(user.password),
                    "full_name": user.full_name,
                    "role": user.role,
                    "is_active": user.is_active,
                    "line_user_id": user.line_user_id,
                    "receive_notifications": user.receive_notifications
                }
            )
            row = result.fetchone()
            db.commit()
            
            logger.info(f"Created user: {user.username}")
            
            return UserResponse(
                id=row[0],
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
                line_user_id=user.line_user_id,
                receive_notifications=user.receive_notifications,
                created_at=row[1],
                last_login=None
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user: UserUpdate):
    """Update an existing user"""
    try:
        with get_db_context() as db:
            # Check if user exists
            existing = db.execute(
                text("SELECT id FROM users WHERE id = :id"),
                {"id": user_id}
            ).fetchone()
            
            if not existing:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Build update query dynamically
            updates = []
            params = {"id": user_id}
            
            if user.email is not None:
                # Check uniqueness
                dup = db.execute(
                    text("SELECT id FROM users WHERE email = :email AND id != :id"),
                    {"email": user.email, "id": user_id}
                ).fetchone()
                if dup:
                    raise HTTPException(status_code=400, detail="Email already exists")
                updates.append("email = :email")
                params["email"] = user.email
            
            if user.username is not None:
                # Check uniqueness
                dup = db.execute(
                    text("SELECT id FROM users WHERE username = :username AND id != :id"),
                    {"username": user.username, "id": user_id}
                ).fetchone()
                if dup:
                    raise HTTPException(status_code=400, detail="Username already exists")
                updates.append("username = :username")
                params["username"] = user.username
            
            if user.full_name is not None:
                updates.append("full_name = :full_name")
                params["full_name"] = user.full_name
            
            if user.role is not None:
                updates.append("role = :role")
                params["role"] = user.role
            
            if user.is_active is not None:
                updates.append("is_active = :is_active")
                params["is_active"] = user.is_active
            
            if user.line_user_id is not None:
                # Validate format
                if user.line_user_id and not user.line_user_id.startswith("U"):
                    raise HTTPException(status_code=400, detail="LINE User ID must start with 'U'")
                # Check uniqueness
                if user.line_user_id:
                    dup = db.execute(
                        text("SELECT id FROM users WHERE line_user_id = :line_id AND id != :id"),
                        {"line_id": user.line_user_id, "id": user_id}
                    ).fetchone()
                    if dup:
                        raise HTTPException(status_code=400, detail="LINE User ID already assigned")
                updates.append("line_user_id = :line_user_id")
                params["line_user_id"] = user.line_user_id if user.line_user_id else None
            
            if user.receive_notifications is not None:
                updates.append("receive_notifications = :receive_notifications")
                params["receive_notifications"] = user.receive_notifications
            
            if user.password is not None:
                updates.append("hashed_password = :password")
                params["password"] = hash_password(user.password)
            
            if not updates:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            # Execute update
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = :id"
            db.execute(text(query), params)
            db.commit()
            
            logger.info(f"Updated user {user_id}")
            
            # Return updated user
            return await get_user(user_id)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
async def delete_user(user_id: int):
    """Delete a user"""
    try:
        with get_db_context() as db:
            result = db.execute(
                text("DELETE FROM users WHERE id = :id RETURNING id"),
                {"id": user_id}
            )
            deleted = result.fetchone()
            
            if not deleted:
                raise HTTPException(status_code=404, detail="User not found")
            
            db.commit()
            logger.info(f"Deleted user {user_id}")
            
            return {"status": "success", "message": f"User {user_id} deleted"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/line/admins", response_model=List[str])
async def get_line_admin_ids():
    """
    Get list of LINE user IDs for users who should receive notifications
    (Admin role + receive_notifications=True + has LINE ID)
    """
    try:
        with get_db_context() as db:
            result = db.execute(
                text("""
                    SELECT line_user_id FROM users 
                    WHERE line_user_id IS NOT NULL 
                    AND receive_notifications = true 
                    AND is_active = true
                    AND role = 'admin'
                """)
            )
            rows = result.fetchall()
            return [row[0] for row in rows]
            
    except Exception as e:
        logger.error(f"Error getting LINE admin IDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/test-notification")
async def test_user_notification(user_id: int):
    """Send a test LINE notification to a specific user"""
    try:
        with get_db_context() as db:
            result = db.execute(
                text("SELECT line_user_id, username FROM users WHERE id = :id"),
                {"id": user_id}
            )
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            
            line_user_id = row[0]
            username = row[1]
            
            if not line_user_id:
                raise HTTPException(status_code=400, detail="User has no LINE User ID configured")
            
            # Send test notification
            from backend_api.services.line_notification import line_notification_service
            
            success = line_notification_service.send_simple_alert(
                title="🔔 ทดสอบการแจ้งเตือน / Test Notification",
                message=f"สวัสดี {username}!\n\nนี่คือข้อความทดสอบจากระบบ AQI Bot\n\nHello {username}!\n\nThis is a test message from AQI Bot system.",
                user_ids=[line_user_id]
            )
            
            if success:
                return {"status": "success", "message": f"Test notification sent to {username}"}
            else:
                return {"status": "warning", "message": "Notification may not have been sent"}
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test notification to user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
