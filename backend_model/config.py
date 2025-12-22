"""
Configuration management using Pydantic Settings
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database Configuration
    database_url: str = "postgresql://aqi_user:aqi_password@localhost:5432/aqi_db"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Application Configuration
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    
    # Air4Thai API Configuration
    air4thai_station_api: str = "http://air4thai.pcd.go.th/forappV2/getAQI_JSON.php"
    air4thai_history_api: str = "http://air4thai.com/forweb/getHistoryData.php"
    api_request_timeout: int = 30
    api_retry_attempts: int = 3
    api_retry_delay: float = 1.0
    
    # LSTM Model Configuration
    sequence_length: int = 24  # Hours of context for prediction
    lstm_units_1: int = 64
    lstm_units_2: int = 32
    batch_size: int = 32
    epochs: int = 100
    early_stopping_patience: int = 10
    validation_split: float = 0.2
    
    # Model Paths
    models_dir: str = "/app/models"
    logs_dir: str = "/app/logs"
    
    # Scheduler Configuration
    ingest_cron_hour: str = "*"
    ingest_cron_minute: str = "5"
    
    # Imputation Configuration
    max_gap_hours: int = 24  # Maximum gap to impute
    min_context_hours: int = 24  # Minimum historical context required

    # AI Chatbot Configuration (Local LLM)
    ollama_url: str = "http://ollama:11434"
    ollama_model: str = "qwen2.5:1.5b"  # Using 1.5b for faster CPU inference
    ollama_timeout: float = 60.0  # Increased timeout for initial model loading

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export settings for easy access
settings = get_settings()
