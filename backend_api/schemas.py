"""
Pydantic schemas for API request/response validation
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# Station Schemas
class StationBase(BaseModel):
    """Base station schema"""
    station_id: str
    name_th: Optional[str] = None
    name_en: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    station_type: Optional[str] = None


class StationCreate(StationBase):
    """Schema for creating a station"""
    pass


class StationResponse(StationBase):
    """Schema for station response"""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class StationWithStats(StationResponse):
    """Station with data statistics"""
    total_records: int = 0
    missing_records: int = 0
    imputed_records: int = 0
    missing_percentage: float = 0.0


# AQI Hourly Schemas
class AQIHourlyBase(BaseModel):
    """Base AQI hourly schema"""
    station_id: str
    datetime: datetime
    pm25: Optional[float] = None
    is_imputed: bool = False


class AQIHourlyCreate(AQIHourlyBase):
    """Schema for creating AQI measurement"""
    pass


class AQIHourlyResponse(AQIHourlyBase):
    """Schema for AQI measurement response"""
    model_version: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AQIHourlyBulkCreate(BaseModel):
    """Schema for bulk creating AQI measurements"""
    measurements: List[AQIHourlyCreate]


# Imputation Schemas
class ImputationRequest(BaseModel):
    """Request to trigger imputation"""
    station_id: str
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    method: str = Field(
        default="auto",
        description="Imputation method: 'auto' (LSTM with fallback), 'lstm', 'linear', or 'forward_fill'"
    )


class ImputationLogResponse(BaseModel):
    """Imputation log entry response"""
    id: int
    station_id: str
    datetime: datetime
    imputed_value: float
    input_window_start: datetime
    input_window_end: datetime
    model_version: str
    rmse_score: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Ingestion Schemas
class IngestionRequest(BaseModel):
    """Request to trigger data ingestion"""
    station_ids: Optional[List[str]] = None  # None means all stations
    days: int = Field(default=30, ge=1, le=30)


class IngestionLogResponse(BaseModel):
    """Ingestion log entry response"""
    id: int
    run_type: str
    station_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    records_fetched: int
    records_inserted: int
    missing_detected: int
    status: str
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Model Training Schemas
class TrainModelRequest(BaseModel):
    """Request to train LSTM model"""
    station_id: str
    epochs: Optional[int] = None
    force_retrain: bool = False


class ModelTrainingLogResponse(BaseModel):
    """Model training log response"""
    id: int
    station_id: str
    model_version: str
    training_samples: int
    validation_samples: int
    train_rmse: float
    val_rmse: float
    train_mae: float
    val_mae: float
    epochs_completed: int
    training_duration_seconds: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# Missing Data Analysis Schemas
class MissingDataGap(BaseModel):
    """Represents a gap in data"""
    start: datetime
    end: datetime
    hours: int
    gap_type: str  # 'short', 'medium', 'long'


class MissingDataAnalysis(BaseModel):
    """Analysis of missing data for a station"""
    station_id: str
    total_expected_hours: int
    total_present_hours: int
    total_missing_hours: int
    missing_percentage: float
    gaps: List[MissingDataGap]
    short_gaps: int  # 1-3 hours
    medium_gaps: int  # 4-24 hours
    long_gaps: int  # >24 hours


# Validation/Evaluation Schemas
class ValidationResult(BaseModel):
    """Result of model validation"""
    station_id: str
    model_version: str
    test_samples: int
    rmse: float
    mae: float
    linear_interp_rmse: float
    forward_fill_rmse: float
    improvement_over_linear: float  # percentage
    improvement_over_ffill: float  # percentage
    passed_acceptance_criteria: bool


# Health Check Response
class HealthResponse(BaseModel):
    """API health check response"""
    status: str
    database: str
    version: str
    environment: str


# AQI History Endpoint Schemas (for AI Layer)
class AQIHistoryDataPoint(BaseModel):
    """Single data point in AQI history response"""
    time: str  # ISO-8601 datetime
    value: Optional[float] = None


class AQIHistoryRequest(BaseModel):
    """Request for AQI history data"""
    station_id: str
    pollutant: str = Field(default="pm25", description="pm25 | pm10 | aqi | o3 | no2 | so2 | co | nox")
    start_date: datetime
    end_date: datetime
    interval: str = Field(default="15min", description="15min | hour | day")


# AI Chat Schemas
class ChatQueryRequest(BaseModel):
    """Natural language query for air quality data"""
    query: str = Field(..., max_length=300, description="Natural language query in Thai or English")


class ChatIntent(BaseModel):
    """Parsed intent from LLM - supports both data queries and search queries"""
    intent_type: Optional[str] = Field(default="get_data", description="search_stations | get_data")
    # For search_stations intent
    search_query: Optional[str] = Field(default=None, description="Location search query")
    # For get_data intent
    station_id: Optional[str] = Field(default=None, description="Station ID or name")
    pollutant: Optional[str] = Field(default=None, description="pm25 | pm10 | aqi | o3 | no2 | so2 | co | nox")
    start_date: Optional[str] = Field(default=None, description="ISO-8601 datetime")
    end_date: Optional[str] = Field(default=None, description="ISO-8601 datetime")
    interval: Optional[str] = Field(default=None, description="15min | hour | day")
    output_type: Optional[str] = Field(default=None, description="text | chart | map | infographic")


class ChatResponse(BaseModel):
    """Response from AI chat endpoint"""
    status: str  # success | out_of_scope | invalid_request | error
    message: Optional[str] = None
    intent: Optional[dict] = None  # Changed to dict to support both intent types
    data: Optional[List] = None  # Changed to generic List to support both data types
    summary: Optional[dict] = None
    output_type: Optional[str] = None



# Station Search Schemas
class StationSearchRequest(BaseModel):
    """Request to search for stations by name or location"""
    query: str = Field(..., max_length=100, description="Search query (e.g., 'Chiang Mai', 'เชียงใหม่')")
    include_summary: bool = Field(default=True, description="Include recent AQI summary for each station")


class StationSummary(BaseModel):
    """Summary of station with recent AQI data"""
    station_id: str
    name_th: Optional[str] = None
    name_en: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    station_type: Optional[str] = None
    # Recent data summary
    latest_pm25: Optional[float] = None
    latest_datetime: Optional[str] = None
    avg_pm25_24h: Optional[float] = None
    avg_pm25_7d: Optional[float] = None
    min_pm25_7d: Optional[float] = None
    max_pm25_7d: Optional[float] = None  
    aqi_level: Optional[str] = None
    trend_7d: Optional[str] = None
    data_completeness_7d: Optional[float] = None
    total_records: Optional[int] = None


class StationSearchResponse(BaseModel):
    """Response from station search"""
    query: str
    total_found: int
    stations: List[StationSummary]
    search_summary: Optional[str] = None


# Authentication Schemas
class UserBase(BaseModel):
    email: str
    username: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# Chart AI Insight Schemas
class ChartInsightRequest(BaseModel):
    """Request for AI-generated chart insights"""
    station_id: str = Field(..., description="Station ID to analyze")
    station_name: Optional[str] = Field(None, description="Station name for display")
    parameter: str = Field(default="pm25", description="Parameter to analyze: pm25, pm10, o3, co, no2, so2, nox")
    time_period_days: int = Field(default=7, ge=1, le=365, description="Number of days to analyze")
    statistics: Optional[dict] = Field(None, description="Pre-calculated statistics from chart data")
    data_points: Optional[int] = Field(None, description="Number of data points in chart")
    lang: str = Field(default="th", description="Language for AI response: th or en")


class ChartInsightResponse(BaseModel):
    """Response with AI-generated chart insights"""
    status: str  # success | error
    insight: Optional[str] = None  # Rule-based text description (fast)
    highlights: Optional[List[str]] = None  # Key points as bullet list
    health_advice: Optional[str] = None  # Health recommendations if applicable
    trend_summary: Optional[str] = None  # Brief trend description
    ai_description: Optional[str] = None  # Ollama-generated detailed description
    error: Optional[str] = None
