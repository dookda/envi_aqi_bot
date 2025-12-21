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
    pollutant: str = Field(default="pm25", description="pm25 | pm10 | aqi | o3 | no2 | so2 | co")
    start_date: datetime
    end_date: datetime
    interval: str = Field(default="15min", description="15min | hour | day")


# AI Chat Schemas
class ChatQueryRequest(BaseModel):
    """Natural language query for air quality data"""
    query: str = Field(..., max_length=300, description="Natural language query in Thai or English")


class ChatIntent(BaseModel):
    """Parsed intent from LLM"""
    station_id: str
    pollutant: str = Field(description="pm25 | pm10 | aqi | o3 | no2 | so2 | co")
    start_date: str = Field(description="ISO-8601 datetime")
    end_date: str = Field(description="ISO-8601 datetime")
    interval: str = Field(description="15min | hour | day")
    output_type: str = Field(description="text | chart | map | infographic")


class ChatResponse(BaseModel):
    """Response from AI chat endpoint"""
    status: str  # success | out_of_scope | invalid_request | error
    message: Optional[str] = None
    intent: Optional[ChatIntent] = None
    data: Optional[List[AQIHistoryDataPoint]] = None
    summary: Optional[dict] = None
    output_type: Optional[str] = None
