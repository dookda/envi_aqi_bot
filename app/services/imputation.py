"""
Imputation Service for missing PM2.5 values

Handles:
- Triggering LSTM-based imputation
- Applying imputation rules from specification
- Logging imputation events for auditability
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.logger import logger
from app.models import AQIHourly, ImputationLog
from app.database import get_db_context
from app.services.lstm_model import lstm_model_service


class ImputationService:
    """Service for LSTM-based data imputation"""
    
    def __init__(self):
        self.sequence_length = settings.sequence_length
        self.max_gap_hours = settings.max_gap_hours
        self.min_context_hours = settings.min_context_hours
    
    def find_missing_timestamps(
        self,
        db: Session,
        station_id: str,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None
    ) -> List[datetime]:
        """
        Find timestamps with missing PM2.5 values
        
        Args:
            db: Database session
            station_id: Station identifier
            start_datetime: Optional start of search range
            end_datetime: Optional end of search range
            
        Returns:
            List of datetime objects with missing values
        """
        query = """
            SELECT datetime FROM aqi_hourly
            WHERE station_id = :station_id
            AND pm25 IS NULL
            AND is_imputed = FALSE
        """
        params = {"station_id": station_id}
        
        if start_datetime:
            query += " AND datetime >= :start"
            params["start"] = start_datetime
        
        if end_datetime:
            query += " AND datetime <= :end"
            params["end"] = end_datetime
        
        query += " ORDER BY datetime"
        
        result = db.execute(text(query), params)
        return [row[0] for row in result]
    
    def get_context_window(
        self,
        db: Session,
        station_id: str,
        target_datetime: datetime
    ) -> Tuple[Optional[np.ndarray], datetime, datetime]:
        """
        Get the context window (previous N valid hours) for prediction
        
        Args:
            db: Database session
            station_id: Station identifier
            target_datetime: Target datetime to predict
            
        Returns:
            Tuple of (context_array, window_start, window_end) or (None, _, _) if insufficient
        """
        # Query previous valid readings
        result = db.execute(
            text("""
                SELECT datetime, pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime < :target
                AND pm25 IS NOT NULL
                ORDER BY datetime DESC
                LIMIT :limit
            """),
            {
                "station_id": station_id,
                "target": target_datetime,
                "limit": self.sequence_length
            }
        )
        
        data = list(result)
        
        if len(data) < self.sequence_length:
            logger.debug(
                f"Insufficient context for {station_id} at {target_datetime}: "
                f"found {len(data)}, need {self.sequence_length}"
            )
            return None, target_datetime, target_datetime
        
        # Reverse to chronological order
        data = data[::-1]
        
        # Check if context is truly contiguous (no large gaps)
        for i in range(1, len(data)):
            time_diff = (data[i][0] - data[i-1][0]).total_seconds() / 3600
            if time_diff > 24:  # Allow gaps up to 24 hours in context
                logger.debug(f"Large gap in context for {station_id}: {time_diff} hours")
                return None, target_datetime, target_datetime
        
        values = np.array([row[1] for row in data])
        window_start = data[0][0]
        window_end = data[-1][0]
        
        return values, window_start, window_end
    
    def classify_gap(self, gap_hours: int) -> str:
        """Classify gap type based on duration"""
        if gap_hours <= 3:
            return "short"
        elif gap_hours <= 24:
            return "medium"
        else:
            return "long"
    
    def should_impute(self, gap_hours: int) -> bool:
        """
        Determine if a gap should be imputed
        
        According to spec:
        - Short gaps (1-3 hours): impute
        - Medium gaps (4-24 hours): impute
        - Long gaps (>24 hours): flag only, no imputation
        """
        return gap_hours <= self.max_gap_hours
    
    def impute_single_value(
        self,
        db: Session,
        station_id: str,
        target_datetime: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Impute a single missing value
        
        Args:
            db: Database session
            station_id: Station identifier
            target_datetime: Datetime to impute
            
        Returns:
            Imputation result or None if failed
        """
        # Load model
        model, scaler = lstm_model_service.load_model(station_id)
        
        if model is None:
            logger.warning(f"No model available for {station_id}, cannot impute")
            return None
        
        # Get context window
        context, window_start, window_end = self.get_context_window(
            db, station_id, target_datetime
        )
        
        if context is None:
            logger.debug(f"Insufficient context for {station_id} at {target_datetime}")
            return None
        
        # Make prediction
        try:
            predicted_value = lstm_model_service.predict(model, scaler, context)
            
            # Get model version
            model_info = lstm_model_service.get_model_info(station_id)
            model_version = model_info.get("training_info", {}).get("model_version", "unknown") if model_info else "unknown"
            
            # Update database
            db.execute(
                text("""
                    UPDATE aqi_hourly
                    SET pm25 = :pm25, is_imputed = TRUE, model_version = :model_version
                    WHERE station_id = :station_id AND datetime = :datetime
                """),
                {
                    "pm25": predicted_value,
                    "station_id": station_id,
                    "datetime": target_datetime,
                    "model_version": model_version
                }
            )
            
            # Log imputation
            imputation_log = ImputationLog(
                station_id=station_id,
                datetime=target_datetime,
                imputed_value=predicted_value,
                input_window_start=window_start,
                input_window_end=window_end,
                model_version=model_version
            )
            db.add(imputation_log)
            
            logger.bind(context="imputation").info(
                f"Imputed {station_id} at {target_datetime}: {predicted_value:.2f}"
            )
            
            return {
                "station_id": station_id,
                "datetime": target_datetime,
                "imputed_value": predicted_value,
                "model_version": model_version,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"Imputation failed for {station_id} at {target_datetime}: {e}")
            return {
                "station_id": station_id,
                "datetime": target_datetime,
                "status": "failed",
                "error": str(e)
            }
    
    def impute_station_gaps(
        self,
        station_id: str,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Impute all missing values for a station within range
        
        Args:
            station_id: Station identifier
            start_datetime: Optional start of range
            end_datetime: Optional end of range
            
        Returns:
            Summary of imputation results
        """
        # Ensure model exists
        if not lstm_model_service.model_exists(station_id):
            # Train model first
            logger.info(f"Training model for {station_id} before imputation")
            train_result = lstm_model_service.train_model(station_id)
            
            if train_result.get("status") == "failed":
                return {
                    "station_id": station_id,
                    "status": "failed",
                    "reason": "model_training_failed",
                    "imputed_count": 0
                }
        
        results = []
        
        with get_db_context() as db:
            # Find missing timestamps
            missing = self.find_missing_timestamps(
                db, station_id, start_datetime, end_datetime
            )
            
            if not missing:
                return {
                    "station_id": station_id,
                    "status": "completed",
                    "reason": "no_missing_values",
                    "imputed_count": 0
                }
            
            logger.bind(context="imputation").info(
                f"Found {len(missing)} missing values for {station_id}"
            )
            
            # Group into gaps and check if should impute
            gaps = self._identify_gaps(missing)
            
            imputed = 0
            skipped = 0
            failed = 0
            
            for gap_start, gap_end, gap_hours in gaps:
                if not self.should_impute(gap_hours):
                    logger.debug(f"Skipping long gap ({gap_hours}h) for {station_id}")
                    skipped += gap_hours
                    continue
                
                # Impute each hour in the gap
                current = gap_start
                while current <= gap_end:
                    if current in missing:
                        result = self.impute_single_value(db, station_id, current)
                        if result and result.get("status") == "success":
                            imputed += 1
                            results.append(result)
                        else:
                            failed += 1
                    current += timedelta(hours=1)
            
            db.commit()
            
            return {
                "station_id": station_id,
                "status": "completed",
                "total_missing": len(missing),
                "imputed_count": imputed,
                "skipped_count": skipped,
                "failed_count": failed,
                "results": results
            }
    
    def _identify_gaps(
        self,
        missing_datetimes: List[datetime]
    ) -> List[Tuple[datetime, datetime, int]]:
        """
        Identify contiguous gaps from list of missing timestamps
        
        Returns:
            List of (gap_start, gap_end, gap_hours)
        """
        if not missing_datetimes:
            return []
        
        gaps = []
        gap_start = missing_datetimes[0]
        prev = missing_datetimes[0]
        
        for dt in missing_datetimes[1:]:
            time_diff = (dt - prev).total_seconds() / 3600
            
            if time_diff > 1:
                # New gap starts
                gap_hours = int((prev - gap_start).total_seconds() / 3600) + 1
                gaps.append((gap_start, prev, gap_hours))
                gap_start = dt
            
            prev = dt
        
        # Add final gap
        gap_hours = int((prev - gap_start).total_seconds() / 3600) + 1
        gaps.append((gap_start, prev, gap_hours))
        
        return gaps
    
    async def run_imputation_cycle(self, station_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run imputation cycle for multiple stations
        
        Args:
            station_ids: List of stations to process, None for all
            
        Returns:
            Summary of imputation cycle
        """
        from app.models import Station
        
        with get_db_context() as db:
            if station_ids is None:
                stations = db.query(Station).all()
                station_ids = [s.station_id for s in stations]
        
        logger.bind(context="imputation").info(
            f"Starting imputation cycle for {len(station_ids)} stations"
        )
        
        results = []
        total_imputed = 0
        
        for station_id in station_ids:
            result = self.impute_station_gaps(station_id)
            results.append(result)
            total_imputed += result.get("imputed_count", 0)
        
        return {
            "stations_processed": len(station_ids),
            "total_imputed": total_imputed,
            "results": results
        }
    
    def rollback_imputation(
        self,
        db: Session,
        station_id: str,
        start_datetime: datetime,
        end_datetime: datetime
    ) -> int:
        """
        Rollback imputed values (set back to NULL)
        
        Args:
            db: Database session
            station_id: Station identifier
            start_datetime: Start of rollback range
            end_datetime: End of rollback range
            
        Returns:
            Number of values rolled back
        """
        result = db.execute(
            text("""
                UPDATE aqi_hourly
                SET pm25 = NULL, is_imputed = FALSE, model_version = NULL
                WHERE station_id = :station_id
                AND datetime >= :start
                AND datetime <= :end
                AND is_imputed = TRUE
            """),
            {
                "station_id": station_id,
                "start": start_datetime,
                "end": end_datetime
            }
        )
        
        rolled_back = result.rowcount
        
        logger.bind(context="imputation").info(
            f"Rolled back {rolled_back} imputed values for {station_id}"
        )
        
        return rolled_back


# Singleton instance
imputation_service = ImputationService()
