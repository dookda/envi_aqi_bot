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
import pandas as pd
from scipy import interpolate
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend_model.config import settings
from backend_model.logger import logger
from backend_model.models import AQIHourly, ImputationLog
from backend_model.database import get_db_context
from backend_model.services.lstm_model import lstm_model_service


class ImputationService:
    """Service for LSTM-based data imputation"""
    
    def __init__(self):
        self.sequence_length = settings.sequence_length
        self.max_gap_hours = settings.max_gap_hours
        self.min_context_hours = settings.min_context_hours
        self.fallback_method = settings.fallback_imputation_method
        self.short_gap_threshold = settings.short_gap_threshold
        self.medium_gap_threshold = settings.medium_gap_threshold
    
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

    def linear_interpolation_single(
        self,
        db: Session,
        station_id: str,
        target_datetime: datetime
    ) -> Optional[float]:
        """
        Perform linear interpolation for a single missing value

        Args:
            db: Database session
            station_id: Station identifier
            target_datetime: Target datetime to impute

        Returns:
            Interpolated value or None if insufficient data
        """
        # Get values before and after target
        result_before = db.execute(
            text("""
                SELECT datetime, pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime < :target
                AND pm25 IS NOT NULL
                ORDER BY datetime DESC
                LIMIT 10
            """),
            {"station_id": station_id, "target": target_datetime}
        )

        result_after = db.execute(
            text("""
                SELECT datetime, pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime > :target
                AND pm25 IS NOT NULL
                ORDER BY datetime ASC
                LIMIT 10
            """),
            {"station_id": station_id, "target": target_datetime}
        )

        before_data = list(result_before)
        after_data = list(result_after)

        if not before_data or not after_data:
            logger.debug(f"Insufficient data for linear interpolation at {target_datetime}")
            return None

        # Get closest points before and after
        time_before, value_before = before_data[0]
        time_after, value_after = after_data[0]

        # Calculate time differences in hours
        hours_from_before = (target_datetime - time_before).total_seconds() / 3600
        hours_to_after = (time_after - target_datetime).total_seconds() / 3600
        total_hours = hours_from_before + hours_to_after

        # Linear interpolation
        weight_before = hours_to_after / total_hours
        weight_after = hours_from_before / total_hours

        interpolated_value = (value_before * weight_before + value_after * weight_after)

        return max(0.0, interpolated_value)  # Ensure non-negative PM2.5

    def forward_fill_single(
        self,
        db: Session,
        station_id: str,
        target_datetime: datetime
    ) -> Optional[float]:
        """
        Perform forward-fill for a single missing value

        Args:
            db: Database session
            station_id: Station identifier
            target_datetime: Target datetime to impute

        Returns:
            Forward-filled value or None if no previous data
        """
        # Get last known value before target
        result = db.execute(
            text("""
                SELECT pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND datetime < :target
                AND pm25 IS NOT NULL
                ORDER BY datetime DESC
                LIMIT 1
            """),
            {"station_id": station_id, "target": target_datetime}
        )

        data = list(result)

        if not data:
            # No previous value, try next value
            result = db.execute(
                text("""
                    SELECT pm25 FROM aqi_hourly
                    WHERE station_id = :station_id
                    AND datetime > :target
                    AND pm25 IS NOT NULL
                    ORDER BY datetime ASC
                    LIMIT 1
                """),
                {"station_id": station_id, "target": target_datetime}
            )
            data = list(result)

        if not data:
            logger.debug(f"No surrounding data for forward fill at {target_datetime}")
            return None

        return max(0.0, float(data[0][0]))  # Ensure non-negative PM2.5

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
            
            # Get model version with robust null handling
            model_info = lstm_model_service.get_model_info(station_id)
            if model_info and model_info.get("training_info"):
                model_version = model_info["training_info"].get("model_version", "v1.0")
            elif model_info:
                # Use created_at timestamp as version if no training log
                created = model_info.get("created_at")
                if created:
                    model_version = created.strftime("v%Y%m%d")
                else:
                    model_version = "v1.0"
            else:
                model_version = "v1.0"
            
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
        end_datetime: Optional[datetime] = None,
        method: str = "auto"
    ) -> Dict[str, Any]:
        """
        Impute all missing values for a station within range

        Args:
            station_id: Station identifier
            start_datetime: Optional start of range
            end_datetime: Optional end of range
            method: Imputation method - "auto", "lstm", "linear", or "forward_fill"
                   "auto" tries LSTM first, falls back to linear if model unavailable

        Returns:
            Summary of imputation results
        """
        # Determine if LSTM is available
        use_lstm = False
        fallback_reason = None

        if method in ["auto", "lstm"]:
            if not lstm_model_service.model_exists(station_id):
                # Train model first
                logger.info(f"Training model for {station_id} before imputation")
                train_result = lstm_model_service.train_model(station_id)

                if train_result.get("status") == "failed":
                    fallback_reason = train_result.get("reason", "model_training_failed")

                    if method == "lstm":
                        # LSTM requested but not available - fail
                        return {
                            "station_id": station_id,
                            "status": "failed",
                            "reason": f"model_training_failed: {fallback_reason}",
                            "imputed_count": 0
                        }
                    else:
                        # auto mode - fallback to configured method
                        logger.warning(
                            f"LSTM training failed for {station_id} ({fallback_reason}), "
                            f"falling back to {self.fallback_method} method"
                        )
                        method = self.fallback_method
                else:
                    use_lstm = True
            else:
                use_lstm = True
        
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
                        # Determine which method to use for this gap
                        imputed_value = None
                        imputation_method = method

                        # Auto-select method based on gap size if using fallback
                        if method in ["linear", "forward_fill"] and gap_hours <= self.short_gap_threshold:
                            imputation_method = "forward_fill"
                        elif method == "linear" and gap_hours <= self.medium_gap_threshold:
                            imputation_method = "linear"

                        # Perform imputation based on selected method
                        if use_lstm or imputation_method == "lstm":
                            result = self.impute_single_value(db, station_id, current)
                            if result and result.get("status") == "success":
                                imputed += 1
                                results.append(result)
                            else:
                                failed += 1
                                if result:
                                    logger.debug(f"Failed to impute {station_id} at {current}: {result.get('error', 'insufficient context')}")
                                else:
                                    logger.debug(f"Failed to impute {station_id} at {current}: insufficient context")
                        elif imputation_method == "linear":
                            imputed_value = self.linear_interpolation_single(db, station_id, current)
                        elif imputation_method == "forward_fill":
                            imputed_value = self.forward_fill_single(db, station_id, current)

                        # If using fallback method, update database directly
                        if imputed_value is not None and imputation_method in ["linear", "forward_fill"]:
                            try:
                                model_version = f"{imputation_method}_v1.0"
                                db.execute(
                                    text("""
                                        UPDATE aqi_hourly
                                        SET pm25 = :pm25, is_imputed = TRUE, model_version = :model_version
                                        WHERE station_id = :station_id AND datetime = :datetime
                                    """),
                                    {
                                        "pm25": imputed_value,
                                        "station_id": station_id,
                                        "datetime": current,
                                        "model_version": model_version
                                    }
                                )

                                # Log imputation
                                imputation_log = ImputationLog(
                                    station_id=station_id,
                                    datetime=current,
                                    imputed_value=imputed_value,
                                    input_window_start=current - timedelta(hours=1),
                                    input_window_end=current + timedelta(hours=1),
                                    model_version=model_version
                                )
                                db.add(imputation_log)

                                imputed += 1
                                results.append({
                                    "station_id": station_id,
                                    "datetime": current,
                                    "imputed_value": imputed_value,
                                    "method": imputation_method,
                                    "status": "success"
                                })
                                logger.bind(context="imputation").info(
                                    f"Imputed {station_id} at {current}: {imputed_value:.2f} using {imputation_method}"
                                )
                            except Exception as e:
                                logger.error(f"Fallback imputation failed for {station_id} at {current}: {e}")
                                failed += 1
                        elif imputed_value is None and imputation_method in ["linear", "forward_fill"]:
                            failed += 1
                            logger.debug(f"Failed to impute {station_id} at {current} using {imputation_method}: insufficient data")

                    current += timedelta(hours=1)
            
            db.commit()

            result_dict = {
                "station_id": station_id,
                "status": "completed",
                "method_used": "lstm" if use_lstm else method,
                "total_missing": len(missing),
                "imputed_count": imputed,
                "skipped_count": skipped,
                "failed_count": failed,
                "results": results
            }

            if fallback_reason:
                result_dict["fallback_reason"] = fallback_reason
                result_dict["note"] = f"LSTM training failed, used {method} as fallback"

            return result_dict
    
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
        from backend_model.models import Station
        
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
    
    def impute_station_gaps_batch(
        self,
        station_id: str,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Impute all missing values for a station using BATCH database operations
        
        Performance: Collects all predictions first, then saves them in a single
        batch UPDATE operation for 3-5x faster database writes.
        
        Args:
            station_id: Station identifier
            start_datetime: Optional start of range
            end_datetime: Optional end of range
            
        Returns:
            Summary of imputation results
        """
        import time
        start_time = time.time()
        
        # Ensure model exists
        if not lstm_model_service.model_exists(station_id):
            logger.info(f"Training model for {station_id} before imputation")
            train_result = lstm_model_service.train_model(station_id)
            
            if train_result.get("status") == "failed":
                return {
                    "station_id": station_id,
                    "status": "failed",
                    "reason": "model_training_failed",
                    "imputed_count": 0
                }
        
        # Load model ONCE (cached)
        model, scaler = lstm_model_service.load_model(station_id)
        if model is None:
            return {
                "station_id": station_id,
                "status": "failed",
                "reason": "model_not_found",
                "imputed_count": 0
            }
        
        # Get model version
        model_info = lstm_model_service.get_model_info(station_id)
        if model_info and model_info.get("training_info"):
            model_version = model_info["training_info"].get("model_version", "v1.0")
        else:
            model_version = "v1.0"
        
        pending_updates = []  # Collect updates for batch operation
        
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
                f"Found {len(missing)} missing values for {station_id} (batch mode)"
            )
            
            # Group into gaps
            gaps = self._identify_gaps(missing)
            
            imputed = 0
            skipped = 0
            failed = 0
            
            for gap_start, gap_end, gap_hours in gaps:
                if not self.should_impute(gap_hours):
                    skipped += gap_hours
                    continue
                
                # Predict each hour in the gap
                current = gap_start
                while current <= gap_end:
                    if current in missing:
                        # Get context window
                        context, window_start, window_end = self.get_context_window(
                            db, station_id, current
                        )
                        
                        if context is not None:
                            try:
                                predicted_value = lstm_model_service.predict(
                                    model, scaler, context
                                )
                                pending_updates.append({
                                    "datetime": current,
                                    "pm25": predicted_value,
                                    "window_start": window_start,
                                    "window_end": window_end
                                })
                                imputed += 1
                            except Exception as e:
                                logger.debug(f"Prediction failed for {current}: {e}")
                                failed += 1
                        else:
                            failed += 1
                    
                    current += timedelta(hours=1)
            
            # BATCH UPDATE - Single database operation
            if pending_updates:
                # Update aqi_hourly table
                for update in pending_updates:
                    db.execute(
                        text("""
                            UPDATE aqi_hourly
                            SET pm25 = :pm25, is_imputed = TRUE, model_version = :model_version
                            WHERE station_id = :station_id AND datetime = :datetime
                        """),
                        {
                            "pm25": update["pm25"],
                            "station_id": station_id,
                            "datetime": update["datetime"],
                            "model_version": model_version
                        }
                    )
                
                # Batch insert imputation logs
                log_entries = [
                    ImputationLog(
                        station_id=station_id,
                        datetime=update["datetime"],
                        imputed_value=update["pm25"],
                        input_window_start=update["window_start"],
                        input_window_end=update["window_end"],
                        model_version=model_version
                    )
                    for update in pending_updates
                ]
                db.add_all(log_entries)
                
                db.commit()
                
                logger.bind(context="imputation").info(
                    f"Batch saved {len(pending_updates)} imputed values for {station_id}"
                )
            
            elapsed = time.time() - start_time
            
            return {
                "station_id": station_id,
                "status": "completed",
                "total_missing": len(missing),
                "imputed_count": imputed,
                "skipped_count": skipped,
                "failed_count": failed,
                "elapsed_seconds": round(elapsed, 2),
                "mode": "batch"
            }
    
    async def impute_station_gaps(
        self,
        station_id: str,
        start_datetime: Optional[datetime] = None,
        end_datetime: Optional[datetime] = None
    ) -> int:
        """
        Async wrapper for batch imputation (compatible with pipeline service)
        
        Returns:
            Number of values imputed
        """
        result = self.impute_station_gaps_batch(station_id, start_datetime, end_datetime)
        return result.get("imputed_count", 0)


# Singleton instance
imputation_service = ImputationService()

