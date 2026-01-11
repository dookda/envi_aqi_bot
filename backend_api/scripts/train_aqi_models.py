"""
Training script for all Air Quality Parameter models (excluding meteorology)

This script trains LSTM models for each air quality parameter:
- pm25: PM2.5 (μg/m³)
- pm10: PM10 (μg/m³)
- o3: Ozone (ppb)
- co: Carbon Monoxide (ppm)
- no2: Nitrogen Dioxide (ppb)
- so2: Sulfur Dioxide (ppb)

Models are saved to separate output folders organized by parameter.
"""

import os
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib

# TensorFlow imports with GPU memory management
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TF warnings
import tensorflow as tf
from tensorflow import keras
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout
from keras.callbacks import EarlyStopping, ModelCheckpoint
from keras.optimizers import Adam

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend_model.config import settings
from backend_model.logger import logger
from backend_model.database import get_db_context
from backend_model.models import Station, ModelTrainingLog


# Air quality parameters to train (excluding meteorology)
AQI_PARAMETERS = ['pm25', 'pm10', 'o3', 'co', 'no2', 'so2']

# Base models directory
BASE_MODELS_DIR = Path(settings.models_dir).parent / "models"


class AQIModelTrainer:
    """Trainer for multi-parameter AQI LSTM models"""
    
    def __init__(self, parameter: str, output_dir: Optional[Path] = None):
        """
        Initialize trainer for a specific parameter
        
        Args:
            parameter: Air quality parameter to train (pm25, pm10, o3, co, no2, so2)
            output_dir: Optional custom output directory. If None, uses models/{parameter}/
        """
        if parameter not in AQI_PARAMETERS:
            raise ValueError(f"Invalid parameter: {parameter}. Must be one of {AQI_PARAMETERS}")
        
        self.parameter = parameter
        self.sequence_length = settings.sequence_length
        self.lstm_units_1 = settings.lstm_units_1
        self.lstm_units_2 = settings.lstm_units_2
        self.batch_size = settings.batch_size
        self.epochs = settings.epochs
        self.patience = settings.early_stopping_patience
        self.validation_split = settings.validation_split
        
        # Set output directory - organized by parameter
        if output_dir:
            self.models_dir = output_dir / parameter
        else:
            self.models_dir = BASE_MODELS_DIR / parameter
        
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure GPU memory growth if available
        self._configure_gpu()
        
        logger.info(f"AQI Model Trainer initialized for '{parameter}'")
        logger.info(f"Output directory: {self.models_dir}")
    
    def _configure_gpu(self):
        """Configure TensorFlow GPU settings"""
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            try:
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)
                logger.info(f"GPU(s) available: {len(gpus)}")
            except RuntimeError as e:
                logger.warning(f"GPU configuration error: {e}")
    
    def get_model_path(self, station_id: str) -> Path:
        """Get path for station-specific model"""
        return self.models_dir / f"lstm_{station_id}.keras"
    
    def get_scaler_path(self, station_id: str) -> Path:
        """Get path for station-specific scaler"""
        return self.models_dir / f"scaler_{station_id}.pkl"
    
    def get_model_version(self, station_id: str) -> str:
        """Generate model version string"""
        return f"{self.parameter}_{station_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    def build_model(self) -> Sequential:
        """
        Build LSTM model architecture:
        - LSTM (64 units)
        - Dropout (0.2)
        - LSTM (32 units)
        - Dropout (0.2)
        - Dense (1)
        """
        model = Sequential([
            LSTM(
                self.lstm_units_1, 
                input_shape=(self.sequence_length, 1),
                return_sequences=True,
                name='lstm_1'
            ),
            Dropout(0.2, name='dropout_1'),
            LSTM(
                self.lstm_units_2,
                return_sequences=False,
                name='lstm_2'
            ),
            Dropout(0.2, name='dropout_2'),
            Dense(1, name='output')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def prepare_training_data(
        self,
        db: Session,
        station_id: str
    ) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[MinMaxScaler]]:
        """
        Prepare training data from contiguous sequences for the specified parameter
        
        Args:
            db: Database session
            station_id: Station identifier
            
        Returns:
            Tuple of (X_train, y_train, scaler) or (None, None, None) if insufficient data
        """
        # Fetch all non-null values for this parameter
        result = db.execute(
            text(f"""
                SELECT datetime, {self.parameter} FROM aqi_hourly
                WHERE station_id = :station_id
                AND {self.parameter} IS NOT NULL
                ORDER BY datetime
            """),
            {"station_id": station_id}
        )
        
        data = list(result)
        
        if len(data) < self.sequence_length + 1:
            logger.warning(f"Insufficient {self.parameter} data for {station_id}: {len(data)} records")
            return None, None, None
        
        # Convert to DataFrame
        df = pd.DataFrame(data, columns=['datetime', self.parameter])
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.set_index('datetime').sort_index()
        
        # Find contiguous sequences
        sequences = self._find_contiguous_sequences(df)
        
        if not sequences:
            logger.warning(f"No contiguous sequences found for {station_id} ({self.parameter})")
            return None, None, None
        
        # Scale data
        scaler = MinMaxScaler(feature_range=(0, 1))
        all_values = df[self.parameter].values.reshape(-1, 1)
        scaler.fit(all_values)
        
        # Build training sequences from contiguous data
        X, y = [], []
        
        for seq_df in sequences:
            if len(seq_df) < self.sequence_length + 1:
                continue
            
            scaled = scaler.transform(seq_df[self.parameter].values.reshape(-1, 1))
            
            for i in range(len(scaled) - self.sequence_length):
                X.append(scaled[i:i + self.sequence_length])
                y.append(scaled[i + self.sequence_length])
        
        if not X:
            logger.warning(f"No valid training sequences for {station_id} ({self.parameter})")
            return None, None, None
        
        X = np.array(X)
        y = np.array(y)
        
        logger.info(f"Prepared {len(X)} training samples for {station_id} ({self.parameter})")
        
        return X, y, scaler
    
    def _find_contiguous_sequences(
        self,
        df: pd.DataFrame,
        max_gap_hours: int = 1
    ) -> List[pd.DataFrame]:
        """
        Find contiguous sequences with no gaps larger than max_gap_hours
        
        Args:
            df: DataFrame with datetime index
            max_gap_hours: Maximum allowed gap between consecutive points
            
        Returns:
            List of DataFrames, each containing a contiguous sequence
        """
        if len(df) < 2:
            return [df] if len(df) > 0 else []
        
        sequences = []
        start_idx = 0
        
        for i in range(1, len(df)):
            time_diff = (df.index[i] - df.index[i-1]).total_seconds() / 3600
            
            if time_diff > max_gap_hours:
                # Save current sequence if long enough
                if i - start_idx >= self.sequence_length:
                    sequences.append(df.iloc[start_idx:i])
                start_idx = i
        
        # Add final sequence
        if len(df) - start_idx >= self.sequence_length:
            sequences.append(df.iloc[start_idx:])
        
        return sequences
    
    def train_model(
        self,
        station_id: str,
        epochs: Optional[int] = None,
        force_retrain: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Train LSTM model for a station and specific parameter
        
        Args:
            station_id: Station identifier
            epochs: Override default epochs
            force_retrain: Force retraining even if model exists
            
        Returns:
            Training results dictionary or None if failed
        """
        model_path = self.get_model_path(station_id)
        
        if model_path.exists() and not force_retrain:
            logger.info(f"Model already exists for {station_id} ({self.parameter}), skipping training")
            return {"status": "skipped", "reason": "model_exists", "parameter": self.parameter}
        
        start_time = time.time()
        training_epochs = epochs or self.epochs
        model_version = self.get_model_version(station_id)
        
        logger.info(f"Starting training for {station_id} ({self.parameter})")
        
        with get_db_context() as db:
            # Prepare data
            X, y, scaler = self.prepare_training_data(db, station_id)
            
            if X is None:
                return {"status": "failed", "reason": "insufficient_data", "parameter": self.parameter}
            
            # Split data
            split_idx = int(len(X) * (1 - self.validation_split))
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            
            # Check minimum sample requirements
            if len(X_train) < 10 or len(X_val) < 2:
                logger.warning(f"Insufficient samples after split for {station_id} ({self.parameter}): "
                              f"train={len(X_train)}, val={len(X_val)}")
                return {"status": "failed", "reason": "insufficient_samples_after_split", "parameter": self.parameter}
            
            # Build model
            model = self.build_model()
            
            # Callbacks
            callbacks = [
                EarlyStopping(
                    monitor='val_loss',
                    patience=self.patience,
                    restore_best_weights=True,
                    verbose=1
                ),
                ModelCheckpoint(
                    str(model_path),
                    monitor='val_loss',
                    save_best_only=True,
                    verbose=0
                )
            ]
            
            # Train
            history = model.fit(
                X_train, y_train,
                epochs=training_epochs,
                batch_size=self.batch_size,
                validation_data=(X_val, y_val),
                callbacks=callbacks,
                verbose=1
            )
            
            # Save scaler
            scaler_path = self.get_scaler_path(station_id)
            joblib.dump(scaler, scaler_path)
            
            # Calculate final metrics
            train_pred = model.predict(X_train, verbose=0)
            val_pred = model.predict(X_val, verbose=0)
            
            train_rmse = np.sqrt(np.mean((y_train - train_pred) ** 2))
            val_rmse = np.sqrt(np.mean((y_val - val_pred) ** 2))
            train_mae = np.mean(np.abs(y_train - train_pred))
            val_mae = np.mean(np.abs(y_val - val_pred))
            
            # Calculate R² (coefficient of determination)
            ss_res_val = np.sum((y_val - val_pred) ** 2)
            ss_tot_val = np.sum((y_val - np.mean(y_val)) ** 2)
            val_r2 = 1 - (ss_res_val / ss_tot_val) if ss_tot_val > 0 else 0.0
            
            ss_res_train = np.sum((y_train - train_pred) ** 2)
            ss_tot_train = np.sum((y_train - np.mean(y_train)) ** 2)
            train_r2 = 1 - (ss_res_train / ss_tot_train) if ss_tot_train > 0 else 0.0
            
            training_duration = time.time() - start_time
            epochs_completed = len(history.history['loss'])
            
            # Log training - use original station_id to satisfy foreign key constraint
            # Parameter info is already included in model_version
            training_log = ModelTrainingLog(
                station_id=station_id,  # Keep original station_id for FK constraint
                model_version=model_version,  # Already includes parameter: {param}_{station}_{timestamp}
                training_samples=len(X_train),
                validation_samples=len(X_val),
                train_rmse=float(train_rmse),
                val_rmse=float(val_rmse),
                train_mae=float(train_mae),
                val_mae=float(val_mae),
                train_r2=float(train_r2),
                val_r2=float(val_r2),
                epochs_completed=epochs_completed,
                training_duration_seconds=training_duration
            )
            db.add(training_log)
            db.commit()
            
            # Convert R² to percentage for logging
            accuracy_percent = val_r2 * 100
            
            logger.info(
                f"Training completed for {station_id} ({self.parameter}): "
                f"RMSE={val_rmse:.4f}, MAE={val_mae:.4f}, R²={val_r2:.4f} ({accuracy_percent:.1f}%), "
                f"epochs={epochs_completed}, time={training_duration:.1f}s"
            )
            
            return {
                "status": "completed",
                "parameter": self.parameter,
                "station_id": station_id,
                "model_version": model_version,
                "model_path": str(model_path),
                "scaler_path": str(scaler_path),
                "training_samples": len(X_train),
                "validation_samples": len(X_val),
                "train_rmse": float(train_rmse),
                "val_rmse": float(val_rmse),
                "train_mae": float(train_mae),
                "val_mae": float(val_mae),
                "train_r2": float(train_r2),
                "val_r2": float(val_r2),
                "accuracy_percent": round(val_r2 * 100, 2),
                "epochs_completed": epochs_completed,
                "training_duration_seconds": training_duration
            }


def get_all_stations() -> List[str]:
    """Get all station IDs from database"""
    with get_db_context() as db:
        stations = db.query(Station).all()
        return [s.station_id for s in stations]


def train_all_parameters(
    station_ids: Optional[List[str]] = None,
    parameters: Optional[List[str]] = None,
    force_retrain: bool = False,
    output_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Train models for all air quality parameters across multiple stations
    
    Args:
        station_ids: List of station IDs to train. If None, trains all stations.
        parameters: List of parameters to train. If None, trains all AQI parameters.
        force_retrain: Force retraining even if models exist.
        output_dir: Optional base output directory. If None, uses models/{parameter}/
        
    Returns:
        Summary of all training results
    """
    # Default to all stations if not specified
    if station_ids is None:
        station_ids = get_all_stations()
    
    # Default to all AQI parameters
    if parameters is None:
        parameters = AQI_PARAMETERS
    
    # Validate parameters
    for param in parameters:
        if param not in AQI_PARAMETERS:
            raise ValueError(f"Invalid parameter: {param}. Must be one of {AQI_PARAMETERS}")
    
    # Convert output_dir to Path if provided
    base_output = Path(output_dir) if output_dir else None
    
    logger.info(f"Starting training for {len(parameters)} parameters across {len(station_ids)} stations")
    logger.info(f"Parameters: {parameters}")
    logger.info(f"Output directory: {base_output or BASE_MODELS_DIR}")
    
    all_results = {}
    total_trained = 0
    total_skipped = 0
    total_failed = 0
    start_time = time.time()
    
    for param in parameters:
        logger.info(f"\n{'='*60}")
        logger.info(f"Training models for parameter: {param}")
        logger.info(f"{'='*60}")
        
        trainer = AQIModelTrainer(param, output_dir=base_output)
        param_results = []
        
        for i, station_id in enumerate(station_ids, 1):
            logger.info(f"[{i}/{len(station_ids)}] Training {param} model for station {station_id}")
            
            result = trainer.train_model(station_id, force_retrain=force_retrain)
            param_results.append(result)
            
            if result:
                if result["status"] == "completed":
                    total_trained += 1
                elif result["status"] == "skipped":
                    total_skipped += 1
                else:
                    total_failed += 1
            else:
                total_failed += 1
        
        all_results[param] = param_results
    
    total_duration = time.time() - start_time
    
    summary = {
        "parameters": parameters,
        "stations_count": len(station_ids),
        "total_trained": total_trained,
        "total_skipped": total_skipped,
        "total_failed": total_failed,
        "total_duration_seconds": round(total_duration, 2),
        "output_base_dir": str(base_output or BASE_MODELS_DIR),
        "results": all_results
    }
    
    logger.info(f"\n{'='*60}")
    logger.info("TRAINING SUMMARY")
    logger.info(f"{'='*60}")
    logger.info(f"Parameters trained: {parameters}")
    logger.info(f"Stations processed: {len(station_ids)}")
    logger.info(f"Models trained: {total_trained}")
    logger.info(f"Models skipped: {total_skipped}")
    logger.info(f"Models failed: {total_failed}")
    logger.info(f"Total duration: {total_duration:.1f}s")
    
    return summary


def main():
    """Main entry point for command-line usage"""
    parser = argparse.ArgumentParser(
        description="Train LSTM models for Air Quality Index parameters (excluding meteorology)"
    )
    
    parser.add_argument(
        "--stations",
        type=str,
        nargs="*",
        help="Station IDs to train (default: all stations)"
    )
    
    parser.add_argument(
        "--parameters",
        type=str,
        nargs="*",
        choices=AQI_PARAMETERS,
        help=f"Parameters to train. Choices: {AQI_PARAMETERS} (default: all)"
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force retraining even if models exist"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        help=f"Base output directory for models (default: {BASE_MODELS_DIR})"
    )
    
    parser.add_argument(
        "--list-stations",
        action="store_true",
        help="List all available stations and exit"
    )
    
    args = parser.parse_args()
    
    # List stations mode
    if args.list_stations:
        stations = get_all_stations()
        print(f"\nAvailable stations ({len(stations)}):")
        for s in sorted(stations):
            print(f"  - {s}")
        return
    
    # Run training
    results = train_all_parameters(
        station_ids=args.stations,
        parameters=args.parameters,
        force_retrain=args.force,
        output_dir=args.output_dir
    )
    
    print(f"\nTraining complete!")
    print(f"  - Models trained: {results['total_trained']}")
    print(f"  - Models skipped: {results['total_skipped']}")
    print(f"  - Models failed: {results['total_failed']}")
    print(f"  - Output directory: {results['output_base_dir']}")


if __name__ == "__main__":
    main()
