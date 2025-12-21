"""
Tests for validation service
"""

import pytest
import numpy as np
import pandas as pd

from backend.services.validation import ValidationService


class TestValidationService:
    """Tests for ValidationService"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.service = ValidationService()
    
    def test_calculate_rmse(self):
        """Test RMSE calculation"""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        predicted = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        
        rmse = self.service.calculate_rmse(actual, predicted)
        
        assert rmse == 0.0
    
    def test_calculate_rmse_with_error(self):
        """Test RMSE with prediction error"""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        predicted = np.array([2.0, 3.0, 4.0, 5.0, 6.0])  # All off by 1
        
        rmse = self.service.calculate_rmse(actual, predicted)
        
        assert rmse == 1.0
    
    def test_calculate_mae(self):
        """Test MAE calculation"""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        predicted = np.array([2.0, 3.0, 4.0, 5.0, 6.0])  # All off by 1
        
        mae = self.service.calculate_mae(actual, predicted)
        
        assert mae == 1.0
    
    def test_linear_interpolation(self):
        """Test linear interpolation"""
        series = pd.Series([1.0, np.nan, 3.0, np.nan, 5.0])
        missing_indices = [1, 3]
        
        interpolated = self.service.linear_interpolation(series, missing_indices)
        
        assert len(interpolated) == 2
        np.testing.assert_almost_equal(interpolated[0], 2.0)  # Between 1 and 3
        np.testing.assert_almost_equal(interpolated[1], 4.0)  # Between 3 and 5
    
    def test_forward_fill(self):
        """Test forward fill imputation"""
        series = pd.Series([1.0, np.nan, 3.0, np.nan, 5.0])
        missing_indices = [1, 3]
        
        filled = self.service.forward_fill(series, missing_indices)
        
        assert len(filled) == 2
        assert filled[0] == 1.0  # Forward filled from index 0
        assert filled[1] == 3.0  # Forward filled from index 2
    
    def test_gap_classification(self):
        """Test gap type classification"""
        from backend.services.imputation import ImputationService
        imputation = ImputationService()
        
        assert imputation.classify_gap(1) == "short"
        assert imputation.classify_gap(3) == "short"
        assert imputation.classify_gap(4) == "medium"
        assert imputation.classify_gap(24) == "medium"
        assert imputation.classify_gap(25) == "long"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
