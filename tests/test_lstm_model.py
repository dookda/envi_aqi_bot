"""
Tests for LSTM model service
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from backend_model.services.lstm_model import LSTMModelService


class TestLSTMModelService:
    """Tests for LSTMModelService"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.service = LSTMModelService()
    
    def test_build_model_architecture(self):
        """Test model architecture matches specification"""
        model = self.service.build_model()
        
        # Check number of layers
        assert len(model.layers) == 5  # 2 LSTM + 2 Dropout + 1 Dense
        
        # Check LSTM units
        assert model.layers[0].units == 64  # First LSTM
        assert model.layers[2].units == 32  # Second LSTM
        
        # Check output layer
        assert model.layers[4].units == 1  # Dense output
    
    def test_get_model_path(self):
        """Test model path generation"""
        path = self.service.get_model_path("TEST001")
        
        assert "lstm_TEST001.keras" in str(path)
    
    def test_get_scaler_path(self):
        """Test scaler path generation"""
        path = self.service.get_scaler_path("TEST001")
        
        assert "scaler_TEST001.pkl" in str(path)
    
    def test_find_contiguous_sequences(self):
        """Test finding contiguous sequences in data"""
        import pandas as pd
        from datetime import datetime, timedelta
        
        # Create test data with a gap
        dates = pd.date_range(start='2024-01-01', periods=10, freq='h')
        gaps_dates = pd.date_range(start='2024-01-01 20:00:00', periods=10, freq='h')
        all_dates = dates.append(gaps_dates)
        
        df = pd.DataFrame({'pm25': range(20)}, index=all_dates)
        
        sequences = self.service._find_contiguous_sequences(df, max_gap_hours=1)
        
        # Should find 2 contiguous sequences (10-hour gap)
        assert len(sequences) == 2
    
    def test_model_exists_false(self):
        """Test model_exists returns False when no model"""
        assert not self.service.model_exists("NONEXISTENT_STATION")


class TestPrediction:
    """Tests for prediction functionality"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.service = LSTMModelService()
    
    def test_predict_non_negative(self):
        """Test that predictions are non-negative"""
        # Create mock model and scaler
        mock_model = MagicMock()
        mock_model.predict.return_value = np.array([[-0.5]])  # Negative scaled prediction
        
        mock_scaler = MagicMock()
        mock_scaler.transform.return_value = np.zeros((24, 1))
        mock_scaler.inverse_transform.return_value = np.array([[-5.0]])  # Negative after inverse
        
        input_seq = np.random.rand(24)
        
        result = self.service.predict(mock_model, mock_scaler, input_seq)
        
        # Result should be 0 (non-negative) despite negative prediction
        assert result >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
