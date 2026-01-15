"""
SQLAlchemy ORM models for the AQI data pipeline
"""

from datetime import datetime as dt
from typing import Optional

from sqlalchemy import (
    Column, String, Float, Boolean, Integer,
    DateTime, Text, ForeignKey, CheckConstraint, func
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from backend_model.database import Base


class Station(Base):
    """Station metadata model with PostGIS support"""

    __tablename__ = "stations"

    station_id = Column(String, primary_key=True)
    name_th = Column(Text)
    name_en = Column(Text)
    lat = Column(Float)
    lon = Column(Float)
    location = Column(Geometry('POINT', srid=4326))  # PostGIS geometry point (WGS84)
    station_type = Column(String)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    measurements = relationship("AQIHourly", back_populates="station", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Station(id={self.station_id}, name={self.name_en})>"


class AQIHourly(Base):
    """Hourly AQI measurements model - Full Air4Thai API data with per-parameter imputation tracking"""
    
    __tablename__ = "aqi_hourly"
    
    station_id = Column(String, ForeignKey("stations.station_id", ondelete="CASCADE"), primary_key=True)
    datetime = Column(DateTime, primary_key=True)
    
    # === Pollutant Measurements ===
    pm25 = Column(Float, nullable=True)      # PM2.5 (μg/m³)
    pm10 = Column(Float, nullable=True)      # PM10 (μg/m³)
    o3 = Column(Float, nullable=True)        # Ozone (ppb)
    co = Column(Float, nullable=True)        # Carbon Monoxide (ppm)
    no2 = Column(Float, nullable=True)       # Nitrogen Dioxide (ppb)
    so2 = Column(Float, nullable=True)       # Sulfur Dioxide (ppb)
    nox = Column(Float, nullable=True)       # Nitrogen Oxides (ppb)
    
    # === Weather/Meteorological Data ===
    ws = Column(Float, nullable=True)        # Wind Speed (m/s)
    wd = Column(Float, nullable=True)        # Wind Direction (degrees, 0-360)
    temp = Column(Float, nullable=True)      # Temperature (°C)
    rh = Column(Float, nullable=True)        # Relative Humidity (%)
    bp = Column(Float, nullable=True)        # Barometric Pressure (mmHg)
    rain = Column(Float, nullable=True)      # Rainfall (mm)
    
    # === Imputation Flags (per-parameter tracking) ===
    is_imputed = Column(Boolean, default=False)       # Legacy: any parameter imputed
    pm25_imputed = Column(Boolean, default=False)
    pm10_imputed = Column(Boolean, default=False)
    o3_imputed = Column(Boolean, default=False)
    co_imputed = Column(Boolean, default=False)
    no2_imputed = Column(Boolean, default=False)
    so2_imputed = Column(Boolean, default=False)
    nox_imputed = Column(Boolean, default=False)
    ws_imputed = Column(Boolean, default=False)
    wd_imputed = Column(Boolean, default=False)
    temp_imputed = Column(Boolean, default=False)
    rh_imputed = Column(Boolean, default=False)
    bp_imputed = Column(Boolean, default=False)
    rain_imputed = Column(Boolean, default=False)
    
    # === Metadata ===
    model_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    station = relationship("Station", back_populates="measurements")
    
    def __repr__(self):
        return f"<AQIHourly(station={self.station_id}, datetime={self.datetime}, pm25={self.pm25})>"


class ImputationLog(Base):
    """Log of all imputation events for auditability - supports all Air4Thai parameters"""
    
    __tablename__ = "imputation_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String, ForeignKey("stations.station_id", ondelete="CASCADE"))
    datetime = Column(DateTime, nullable=False)
    
    # === Parameter Identification ===
    parameter = Column(String, nullable=False, default="pm25")  # pm25, pm10, o3, co, no2, so2, ws, wd, temp, rh, bp, rain
    
    # === Imputation Values ===
    imputed_value = Column(Float, nullable=False)
    original_value = Column(Float, nullable=True)  # Store original if correcting anomaly
    
    # === Context Window ===
    input_window_start = Column(DateTime, nullable=False)
    input_window_end = Column(DateTime, nullable=False)
    
    # === Model Info ===
    model_version = Column(String, nullable=False)
    imputation_method = Column(String, default="lstm")  # lstm, linear, mean, forward_fill
    
    # === Quality Metrics ===
    rmse_score = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)  # 0-1 confidence in imputation
    
    # === Metadata ===
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<ImputationLog(station={self.station_id}, param={self.parameter}, datetime={self.datetime}, value={self.imputed_value})>"


class ModelTrainingLog(Base):
    """Log of model training events"""
    
    __tablename__ = "model_training_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String, ForeignKey("stations.station_id", ondelete="CASCADE"))
    model_version = Column(String, nullable=False)
    training_samples = Column(Integer)
    validation_samples = Column(Integer)
    train_rmse = Column(Float)
    val_rmse = Column(Float)
    train_mae = Column(Float)
    val_mae = Column(Float)
    train_r2 = Column(Float)  # R² for training data
    val_r2 = Column(Float)    # R² for validation data (accuracy %)
    epochs_completed = Column(Integer)
    training_duration_seconds = Column(Float)
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<ModelTrainingLog(station={self.station_id}, version={self.model_version})>"



class IngestionLog(Base):
    """Log of data ingestion runs"""
    
    __tablename__ = "ingestion_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_type = Column(String, nullable=False)  # 'batch' or 'hourly'
    station_id = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    records_fetched = Column(Integer, default=0)
    records_inserted = Column(Integer, default=0)
    missing_detected = Column(Integer, default=0)
    status = Column(String, default="running")  # 'running', 'completed', 'failed'
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    __table_args__ = (
        CheckConstraint("run_type IN ('batch', 'hourly')", name="check_run_type"),
        CheckConstraint("status IN ('running', 'completed', 'failed')", name="check_status"),
    )
    
    def __repr__(self):
        return f"<IngestionLog(id={self.id}, type={self.run_type}, status={self.status})>"
