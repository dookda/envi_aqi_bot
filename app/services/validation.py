"""
Validation and Evaluation Service

Handles:
- Offline validation with masked data
- RMSE/MAE metrics calculation
- Baseline comparison (linear interpolation, forward-fill)
- Acceptance criteria checking
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session
from scipy import interpolate

from app.config import settings
from app.logger import logger
from app.database import get_db_context
from app.services.lstm_model import lstm_model_service


class ValidationService:
    """Service for model validation and evaluation"""
    
    def __init__(self):
        self.sequence_length = settings.sequence_length
    
    def calculate_rmse(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate Root Mean Square Error"""
        return float(np.sqrt(np.mean((actual - predicted) ** 2)))
    
    def calculate_mae(self, actual: np.ndarray, predicted: np.ndarray) -> float:
        """Calculate Mean Absolute Error"""
        return float(np.mean(np.abs(actual - predicted)))
    
    def linear_interpolation(
        self,
        series: pd.Series,
        missing_indices: List[int]
    ) -> np.ndarray:
        """
        Perform linear interpolation for missing values
        
        Args:
            series: Time series with some values
            missing_indices: Indices to interpolate
            
        Returns:
            Interpolated values for missing indices
        """
        known_indices = [i for i in range(len(series)) if i not in missing_indices]
        known_values = series.iloc[known_indices].values
        
        if len(known_indices) < 2:
            return np.full(len(missing_indices), np.nan)
        
        f = interpolate.interp1d(
            known_indices,
            known_values,
            kind='linear',
            fill_value='extrapolate'
        )
        
        return f(missing_indices)
    
    def forward_fill(
        self,
        series: pd.Series,
        missing_indices: List[int]
    ) -> np.ndarray:
        """
        Perform forward-fill (naive) imputation
        
        Args:
            series: Time series with some values
            missing_indices: Indices to fill
            
        Returns:
            Forward-filled values
        """
        result = []
        
        for idx in missing_indices:
            # Find last known value before this index
            for i in range(idx - 1, -1, -1):
                if i not in missing_indices and not pd.isna(series.iloc[i]):
                    result.append(series.iloc[i])
                    break
            else:
                # No previous value found, use next known value
                for i in range(idx + 1, len(series)):
                    if i not in missing_indices and not pd.isna(series.iloc[i]):
                        result.append(series.iloc[i])
                        break
                else:
                    result.append(np.nan)
        
        return np.array(result)
    
    def offline_validation(
        self,
        station_id: str,
        mask_percentage: float = 0.1,
        random_seed: int = 42
    ) -> Optional[Dict[str, Any]]:
        """
        Perform offline validation by masking known values and comparing predictions
        
        Args:
            station_id: Station identifier
            mask_percentage: Percentage of data to mask for testing
            random_seed: Random seed for reproducibility
            
        Returns:
            Validation results or None if failed
        """
        # Load model
        model, scaler = lstm_model_service.load_model(station_id)
        
        if model is None:
            logger.warning(f"No model available for validation: {station_id}")
            return None
        
        # Get complete data
        with get_db_context() as db:
            result = db.execute(
                text("""
                    SELECT datetime, pm25 FROM aqi_hourly
                    WHERE station_id = :station_id
                    AND pm25 IS NOT NULL
                    AND is_imputed = FALSE
                    ORDER BY datetime
                """),
                {"station_id": station_id}
            )
            data = list(result)
        
        if len(data) < self.sequence_length * 2:
            logger.warning(f"Insufficient data for validation: {station_id}")
            return None
        
        df = pd.DataFrame(data, columns=['datetime', 'pm25'])
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.set_index('datetime').sort_index()
        
        # Random masking
        np.random.seed(random_seed)
        n_samples = len(df)
        n_mask = int(n_samples * mask_percentage)
        
        # Only mask values that have sufficient context before them
        valid_mask_indices = list(range(self.sequence_length, n_samples))
        mask_indices = np.random.choice(valid_mask_indices, size=n_mask, replace=False)
        mask_indices = sorted(mask_indices)
        
        # Get actual values
        actual_values = df['pm25'].iloc[mask_indices].values
        
        # LSTM predictions
        lstm_predictions = []
        for idx in mask_indices:
            context = df['pm25'].iloc[idx - self.sequence_length:idx].values
            if len(context) == self.sequence_length:
                pred = lstm_model_service.predict(model, scaler, context)
                lstm_predictions.append(pred)
            else:
                lstm_predictions.append(np.nan)
        
        lstm_predictions = np.array(lstm_predictions)
        
        # Linear interpolation predictions
        linear_predictions = self.linear_interpolation(df['pm25'], mask_indices)
        
        # Forward-fill predictions
        ffill_predictions = self.forward_fill(df['pm25'], mask_indices)
        
        # Calculate metrics (excluding NaN)
        valid_mask = ~np.isnan(lstm_predictions) & ~np.isnan(linear_predictions) & ~np.isnan(ffill_predictions)
        
        if not np.any(valid_mask):
            logger.warning(f"No valid predictions for validation: {station_id}")
            return None
        
        actual_valid = actual_values[valid_mask]
        lstm_valid = lstm_predictions[valid_mask]
        linear_valid = linear_predictions[valid_mask]
        ffill_valid = ffill_predictions[valid_mask]
        
        # Metrics
        lstm_rmse = self.calculate_rmse(actual_valid, lstm_valid)
        lstm_mae = self.calculate_mae(actual_valid, lstm_valid)
        
        linear_rmse = self.calculate_rmse(actual_valid, linear_valid)
        linear_mae = self.calculate_mae(actual_valid, linear_valid)
        
        ffill_rmse = self.calculate_rmse(actual_valid, ffill_valid)
        ffill_mae = self.calculate_mae(actual_valid, ffill_valid)
        
        # Improvement percentages
        improvement_over_linear = ((linear_rmse - lstm_rmse) / linear_rmse * 100) if linear_rmse > 0 else 0
        improvement_over_ffill = ((ffill_rmse - lstm_rmse) / ffill_rmse * 100) if ffill_rmse > 0 else 0
        
        # Check acceptance criteria
        # 1. LSTM RMSE < Linear interpolation RMSE
        # 2. No negative PM2.5 values
        has_negative = np.any(lstm_valid < 0)
        passed_criteria = (lstm_rmse < linear_rmse) and not has_negative
        
        # Get model version
        model_info = lstm_model_service.get_model_info(station_id)
        model_version = model_info.get("training_info", {}).get("model_version", "unknown") if model_info else "unknown"
        
        result = {
            "station_id": station_id,
            "model_version": model_version,
            "test_samples": int(np.sum(valid_mask)),
            "lstm_rmse": lstm_rmse,
            "lstm_mae": lstm_mae,
            "linear_interp_rmse": linear_rmse,
            "linear_interp_mae": linear_mae,
            "forward_fill_rmse": ffill_rmse,
            "forward_fill_mae": ffill_mae,
            "improvement_over_linear": improvement_over_linear,
            "improvement_over_ffill": improvement_over_ffill,
            "passed_acceptance_criteria": passed_criteria,
            "acceptance_details": {
                "lstm_better_than_linear": lstm_rmse < linear_rmse,
                "no_negative_values": not has_negative
            }
        }
        
        logger.info(
            f"Validation for {station_id}: LSTM RMSE={lstm_rmse:.4f}, "
            f"Linear RMSE={linear_rmse:.4f}, Improvement={improvement_over_linear:.1f}%"
        )
        
        return result
    
    def validate_all_stations(
        self,
        mask_percentage: float = 0.1
    ) -> Dict[str, Any]:
        """
        Run validation for all stations with trained models
        
        Returns:
            Summary of validation results
        """
        from app.models import Station
        
        with get_db_context() as db:
            stations = db.query(Station).all()
        
        results = []
        passed_count = 0
        failed_count = 0
        skipped_count = 0
        
        for station in stations:
            if not lstm_model_service.model_exists(station.station_id):
                skipped_count += 1
                continue
            
            result = self.offline_validation(station.station_id, mask_percentage)
            
            if result is None:
                skipped_count += 1
                continue
            
            results.append(result)
            
            if result["passed_acceptance_criteria"]:
                passed_count += 1
            else:
                failed_count += 1
        
        # Aggregate metrics
        avg_lstm_rmse = np.mean([r["lstm_rmse"] for r in results]) if results else 0
        avg_improvement = np.mean([r["improvement_over_linear"] for r in results]) if results else 0
        
        return {
            "total_stations": len(stations),
            "validated": len(results),
            "passed": passed_count,
            "failed": failed_count,
            "skipped": skipped_count,
            "average_lstm_rmse": avg_lstm_rmse,
            "average_improvement_over_linear": avg_improvement,
            "results": results
        }
    
    def compare_imputation_quality(
        self,
        station_id: str,
        start_datetime: datetime,
        end_datetime: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Compare imputed values quality against actual values (if available)
        
        This is useful for monitoring imputation quality over time.
        """
        with get_db_context() as db:
            # Get imputed values that were later updated with actual values
            result = db.execute(
                text("""
                    SELECT 
                        il.datetime,
                        il.imputed_value,
                        ah.pm25 as actual_value
                    FROM imputation_log il
                    JOIN aqi_hourly ah ON il.station_id = ah.station_id 
                        AND il.datetime = ah.datetime
                    WHERE il.station_id = :station_id
                    AND il.datetime >= :start
                    AND il.datetime <= :end
                    AND ah.is_imputed = FALSE
                    AND ah.pm25 IS NOT NULL
                """),
                {
                    "station_id": station_id,
                    "start": start_datetime,
                    "end": end_datetime
                }
            )
            
            data = list(result)
        
        if not data:
            return None
        
        df = pd.DataFrame(data, columns=['datetime', 'imputed', 'actual'])
        
        rmse = self.calculate_rmse(df['actual'].values, df['imputed'].values)
        mae = self.calculate_mae(df['actual'].values, df['imputed'].values)
        
        return {
            "station_id": station_id,
            "samples": len(df),
            "rmse": rmse,
            "mae": mae,
            "mean_error": float(np.mean(df['imputed'] - df['actual'])),
            "std_error": float(np.std(df['imputed'] - df['actual'])),
        }


# Singleton instance
validation_service = ValidationService()
