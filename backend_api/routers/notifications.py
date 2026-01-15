from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend_api.services.notification import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/")
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = False
):
    """Get system notifications"""
    return NotificationService.get_notifications(limit, unread_only)

@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: int):
    """Mark a notification as read"""
    success = NotificationService.mark_as_read(notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}

@router.put("/read-all")
async def mark_all_as_read():
    """Mark all notifications as read"""
    NotificationService.mark_all_as_read()
    return {"status": "success"}
