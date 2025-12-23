"""
Configuration management using Pydantic Settings
"""

from functools import lru_cache
from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database Configuration
    database_url: str = "postgresql://aqi_user:aqi_password@localhost:5432/aqi_db"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL format"""
        if not v or not v.strip():
            raise ValueError('DATABASE_URL cannot be empty')
        if not v.startswith('postgresql://'):
            raise ValueError('DATABASE_URL must be a PostgreSQL connection string')
        return v

    @field_validator('database_pool_size')
    @classmethod
    def validate_pool_size(cls, v: int) -> int:
        """Validate pool size is within reasonable bounds"""
        if v < 1:
            raise ValueError('Database pool_size must be at least 1')
        if v > 100:
            raise ValueError('Database pool_size cannot exceed 100')
        return v

    @field_validator('database_max_overflow')
    @classmethod
    def validate_max_overflow(cls, v: int) -> int:
        """Validate max overflow is within reasonable bounds"""
        if v < 0:
            raise ValueError('Database max_overflow cannot be negative')
        if v > 200:
            raise ValueError('Database max_overflow cannot exceed 200')
        return v
    
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

    @field_validator('api_request_timeout')
    @classmethod
    def validate_api_timeout(cls, v: int) -> int:
        """Validate API request timeout"""
        if v < 1:
            raise ValueError('API timeout must be at least 1 second')
        if v > 300:
            raise ValueError('API timeout cannot exceed 300 seconds')
        return v

    @field_validator('api_retry_attempts')
    @classmethod
    def validate_api_retries(cls, v: int) -> int:
        """Validate API max retries"""
        if v < 0:
            raise ValueError('API max retries cannot be negative')
        if v > 10:
            raise ValueError('API max retries cannot exceed 10')
        return v
    
    # LSTM Model Configuration
    sequence_length: int = 24  # Hours of context for prediction
    lstm_units_1: int = 64
    lstm_units_2: int = 32
    batch_size: int = 32
    epochs: int = 100
    early_stopping_patience: int = 10
    validation_split: float = 0.2

    @field_validator('sequence_length')
    @classmethod
    def validate_sequence_length(cls, v: int) -> int:
        """Validate sequence length for LSTM"""
        if v < 1:
            raise ValueError('Sequence length must be at least 1')
        if v > 168:  # 1 week max
            raise ValueError('Sequence length cannot exceed 168 hours (1 week)')
        return v

    @field_validator('batch_size')
    @classmethod
    def validate_batch_size(cls, v: int) -> int:
        """Validate batch size"""
        if v < 1:
            raise ValueError('Batch size must be at least 1')
        if v > 512:
            raise ValueError('Batch size cannot exceed 512')
        return v

    @field_validator('epochs')
    @classmethod
    def validate_epochs(cls, v: int) -> int:
        """Validate epochs"""
        if v < 1:
            raise ValueError('Epochs must be at least 1')
        if v > 1000:
            raise ValueError('Epochs cannot exceed 1000')
        return v

    @field_validator('validation_split')
    @classmethod
    def validate_validation_split(cls, v: float) -> float:
        """Validate validation split ratio"""
        if v < 0.0 or v > 1.0:
            raise ValueError('Validation split must be between 0.0 and 1.0')
        return v
    
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
