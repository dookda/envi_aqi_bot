"""
Logging configuration using Loguru
"""

import sys
from pathlib import Path
from loguru import logger

from backend_model.config import settings


def setup_logging():
    """Configure logging for the application"""
    
    # Remove default handler
    logger.remove()
    
    # Console handler with color
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.log_level,
        colorize=True,
    )
    
    # Ensure logs directory exists
    logs_dir = Path(settings.logs_dir)
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # File handler for all logs
    logger.add(
        logs_dir / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
    )
    
    # Separate file for errors
    logger.add(
        logs_dir / "errors.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
    )
    
    # Separate file for ingestion logs
    logger.add(
        logs_dir / "ingestion.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="INFO",
        rotation="50 MB",
        retention="30 days",
        filter=lambda record: "ingestion" in record["extra"].get("context", ""),
    )
    
    # Separate file for imputation logs
    logger.add(
        logs_dir / "imputation.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="INFO",
        rotation="50 MB",
        retention="30 days",
        filter=lambda record: "imputation" in record["extra"].get("context", ""),
    )
    
    logger.info("Logging configured successfully")


# Setup logging on module import
setup_logging()

# Export logger for use in other modules
__all__ = ["logger"]
