from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from backend_model.models import Notification
from backend_model.database import get_db_context
from backend_model.logger import logger

class NotificationService:
    @staticmethod
    def create_notification(
        title: str,
        message: str,
        type: str = "info",
        station_id: Optional[str] = None
    ) -> Optional[Notification]:
        """Create a new notification"""
        try:
            with get_db_context() as db:
                notification = Notification(
                    title=title,
                    message=message,
                    type=type,
                    station_id=station_id
                )
                db.add(notification)
                db.commit()
                logger.info(f"Notification created: {title}")
                return notification
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None

    @staticmethod
    def get_notifications(limit: int = 50, unread_only: bool = False) -> List[Dict]:
        """Get recent notifications"""
        try:
            with get_db_context() as db:
                query = db.query(Notification).order_by(Notification.created_at.desc())
                
                if unread_only:
                    query = query.filter(Notification.is_read == False)
                
                notifications = query.limit(limit).all()
                
                return [
                    {
                        "id": n.id,
                        "title": n.title,
                        "message": n.message,
                        "type": n.type,
                        "station_id": n.station_id,
                        "is_read": n.is_read,
                        "created_at": n.created_at.isoformat() if n.created_at else None
                    }
                    for n in notifications
                ]
        except Exception as e:
            logger.error(f"Error getting notifications: {e}")
            return []

    @staticmethod
    def mark_as_read(notification_id: int) -> bool:
        """Mark notification as read"""
        try:
            with get_db_context() as db:
                notification = db.query(Notification).filter(Notification.id == notification_id).first()
                if notification:
                    notification.is_read = True
                    db.commit()
                    return True
                return False
        except Exception as e:
            logger.error(f"Error marking notification as read: {e}")
            return False
    
    @staticmethod
    def mark_all_as_read() -> bool:
        """Mark all notifications as read"""
        try:
            with get_db_context() as db:
                db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
                db.commit()
                return True
        except Exception as e:
            logger.error(f"Error marking all notifications as read: {e}")
            return False
