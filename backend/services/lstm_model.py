"""
LSTM Model Service for PM2.5 prediction

Handles:
- Model architecture definition
- Training with contiguous sequences
- Model persistence (save/load)
- Prediction for imputation
"""

import os
import time
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
from keras.models import Sequential, load_model
from keras.layers import LSTM, Dense, Dropout
from keras.callbacks import EarlyStopping, ModelCheckpoint
from keras.optimizers import Adam

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.config import settings
from backend.logger import logger
from backend.models import ModelTrainingLog
from backend.database import get_db_context


class LSTMModelService:
    """Service for LSTM model training and prediction"""
    
    def __init__(self):
        self.sequence_length = settings.sequence_length
        self.lstm_units_1 = settings.lstm_units_1
        self.lstm_units_2 = settings.lstm_units_2
        self.batch_size = settings.batch_size
        self.epochs = settings.epochs
        self.patience = settings.early_stopping_patience
        self.validation_split = settings.validation_split
        self.models_dir = Path(settings.models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Configure GPU memory growth if available
        self._configure_gpu()
    
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
        return f"{station_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    def build_model(self) -> Sequential:
        """
        Build LSTM model architecture as specified:
        - LSTM (64 units)
        - LSTM (32 units)
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
        Prepare training data from contiguous sequences
        
        Args:
            db: Database session
            station_id: Station identifier
            
        Returns:
            Tuple of (X_train, y_train, scaler) or (None, None, None) if insufficient data
        """
        # Fetch all non-null PM2.5 data ordered by datetime
        result = db.execute(
            text("""
                SELECT datetime, pm25 FROM aqi_hourly
                WHERE station_id = :station_id
                AND pm25 IS NOT NULL
                ORDER BY datetime
            """),
            {"station_id": station_id}
        )
        
        data = list(result)
        
        if len(data) < self.sequence_length + 1:
            logger.warning(f"Insufficient data for {station_id}: {len(data)} records")
            return None, None, None
        
        # Convert to DataFrame
        df = pd.DataFrame(data, columns=['datetime', 'pm25'])
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.set_index('datetime').sort_index()
        
        # Find contiguous sequences
        sequences = self._find_contiguous_sequences(df)
        
        if not sequences:
            logger.warning(f"No contiguous sequences found for {station_id}")
            return None, None, None
        
        # Scale data
        scaler = MinMaxScaler(feature_range=(0, 1))
        all_values = df['pm25'].values.reshape(-1, 1)
        scaler.fit(all_values)
        
        # Build training sequences from contiguous data
        X, y = [], []
        
        for seq_df in sequences:
            if len(seq_df) < self.sequence_length + 1:
                continue
            
            scaled = scaler.transform(seq_df['pm25'].values.reshape(-1, 1))
            
            for i in range(len(scaled) - self.sequence_length):
                X.append(scaled[i:i + self.sequence_length])
                y.append(scaled[i + self.sequence_length])
        
        if not X:
            logger.warning(f"No valid training sequences for {station_id}")
            return None, None, None
        
        X = np.array(X)
        y = np.array(y)
        
        logger.info(f"Prepared {len(X)} training samples for {station_id}")
        
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
        Train LSTM model for a station
        
        Args:
            station_id: Station identifier
            epochs: Override default epochs
            force_retrain: Force retraining even if model exists
            
        Returns:
            Training results dictionary or None if failed
        """
        model_path = self.get_model_path(station_id)
        
        if model_path.exists() and not force_retrain:
            logger.info(f"Model already exists for {station_id}, skipping training")
            return {"status": "skipped", "reason": "model_exists"}
        
        start_time = time.time()
        training_epochs = epochs or self.epochs
        model_version = self.get_model_version(station_id)
        
        logger.bind(context="imputation").info(f"Starting training for {station_id}")
        
        with get_db_context() as db:
            # Prepare data
            X, y, scaler = self.prepare_training_data(db, station_id)
            
            if X is None:
                return {"status": "failed", "reason": "insufficient_data"}
            
            # Split data
            split_idx = int(len(X) * (1 - self.validation_split))
            X_train, X_val = X[:split_idx], X[split_idx:]
            y_train, y_val = y[:split_idx], y[split_idx:]
            
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
            # R² = 1 - (SS_res / SS_tot)
            ss_res_val = np.sum((y_val - val_pred) ** 2)
            ss_tot_val = np.sum((y_val - np.mean(y_val)) ** 2)
            val_r2 = 1 - (ss_res_val / ss_tot_val) if ss_tot_val > 0 else 0.0
            
            ss_res_train = np.sum((y_train - train_pred) ** 2)
            ss_tot_train = np.sum((y_train - np.mean(y_train)) ** 2)
            train_r2 = 1 - (ss_res_train / ss_tot_train) if ss_tot_train > 0 else 0.0
            
            training_duration = time.time() - start_time
            epochs_completed = len(history.history['loss'])
            
            # Log training
            training_log = ModelTrainingLog(
                station_id=station_id,
                model_version=model_version,
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
            
            logger.bind(context="imputation").info(
                f"Training completed for {station_id}: "
                f"RMSE={val_rmse:.4f}, MAE={val_mae:.4f}, R²={val_r2:.4f} ({accuracy_percent:.1f}%), "
                f"epochs={epochs_completed}, time={training_duration:.1f}s"
            )
            
            return {
                "status": "completed",
                "station_id": station_id,
                "model_version": model_version,
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
    
    def load_model(self, station_id: str) -> Tuple[Optional[Sequential], Optional[MinMaxScaler]]:
        """
        Load trained model and scaler for a station
        
        Args:
            station_id: Station identifier
            
        Returns:
            Tuple of (model, scaler) or (None, None) if not found
        """
        model_path = self.get_model_path(station_id)
        scaler_path = self.get_scaler_path(station_id)
        
        if not model_path.exists() or not scaler_path.exists():
            logger.warning(f"Model or scaler not found for {station_id}")
            return None, None
        
        try:
            model = load_model(str(model_path))
            scaler = joblib.load(scaler_path)
            return model, scaler
        except Exception as e:
            logger.error(f"Failed to load model for {station_id}: {e}")
            return None, None
    
    def predict(
        self,
        model: Sequential,
        scaler: MinMaxScaler,
        input_sequence: np.ndarray
    ) -> float:
        """
        Make a single prediction
        
        Args:
            model: Trained LSTM model
            scaler: Fitted scaler
            input_sequence: Input sequence of shape (sequence_length,)
            
        Returns:
            Predicted PM2.5 value (inverse scaled)
        """
        # Scale input
        scaled_input = scaler.transform(input_sequence.reshape(-1, 1))
        
        # Reshape for LSTM: (1, sequence_length, 1)
        X = scaled_input.reshape(1, self.sequence_length, 1)
        
        # Predict
        scaled_pred = model.predict(X, verbose=0)
        
        # Inverse scale
        pred = scaler.inverse_transform(scaled_pred)[0, 0]
        
        # Ensure non-negative (PM2.5 cannot be negative)
        return max(0.0, float(pred))
    
    def model_exists(self, station_id: str) -> bool:
        """Check if a trained model exists for a station"""
        return self.get_model_path(station_id).exists() and self.get_scaler_path(station_id).exists()
    
    def get_model_info(self, station_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a station's model"""
        model_path = self.get_model_path(station_id)
        
        if not model_path.exists():
            return None
        
        stat = model_path.stat()
        
        training_info = None
        with get_db_context() as db:
            # Get latest training log
            log = db.query(ModelTrainingLog)\
                .filter(ModelTrainingLog.station_id == station_id)\
                .order_by(ModelTrainingLog.created_at.desc())\
                .first()
            
            # Extract data while in session context
            if log:
                val_r2 = log.val_r2 if hasattr(log, 'val_r2') and log.val_r2 is not None else None
                training_info = {
                    "model_version": log.model_version,
                    "val_rmse": log.val_rmse,
                    "val_mae": log.val_mae,
                    "val_r2": val_r2,
                    "accuracy_percent": round(val_r2 * 100, 1) if val_r2 is not None else None,
                    "training_samples": log.training_samples,
                }
        
        return {
            "station_id": station_id,
            "model_path": str(model_path),
            "model_size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_ctime),
            "training_info": training_info
        }


# Singleton instance
lstm_model_service = LSTMModelService()
