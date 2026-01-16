"""
Migration: Add LINE user ID and notification settings to users table

Run this script to add the new columns:
    python backend_api/migrations/add_line_user_id.py
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text
from backend_model.database import get_db_context
from backend_model.logger import logger


def migrate():
    """Add line_user_id and receive_notifications columns to users table"""
    
    with get_db_context() as db:
        try:
            # Check if columns exist
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('line_user_id', 'receive_notifications')
            """))
            existing_columns = [row[0] for row in result.fetchall()]
            
            # Add line_user_id if not exists
            if 'line_user_id' not in existing_columns:
                logger.info("Adding line_user_id column...")
                db.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN line_user_id VARCHAR UNIQUE
                """))
                db.execute(text("""
                    CREATE INDEX idx_users_line_user_id ON users(line_user_id)
                """))
                logger.info("✓ Added line_user_id column")
            else:
                logger.info("line_user_id column already exists")
            
            # Add receive_notifications if not exists
            if 'receive_notifications' not in existing_columns:
                logger.info("Adding receive_notifications column...")
                db.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN receive_notifications BOOLEAN DEFAULT TRUE
                """))
                logger.info("✓ Added receive_notifications column")
            else:
                logger.info("receive_notifications column already exists")
            
            db.commit()
            logger.info("Migration completed successfully!")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            db.rollback()
            raise


if __name__ == "__main__":
    migrate()
