"""
Tests for data ingestion service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, AsyncMock

from backend_model.services.ingestion import IngestionService


class TestIngestionService:
    """Tests for IngestionService"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.service = IngestionService()
    
    def test_parse_measurements_valid_data(self):
        """Test parsing valid measurement data"""
        station_id = "TEST001"
        measurements = [
            {"DATETIMEDATA": "2024-01-01 10:00:00", "PM25": 25.5},
            {"DATETIMEDATA": "2024-01-01 11:00:00", "PM25": 30.0},
            {"DATETIMEDATA": "2024-01-01 12:00:00", "PM25": None},
        ]
        
        records = self.service.parse_measurements(station_id, measurements)
        
        assert len(records) == 3
        assert records[0]["station_id"] == station_id
        assert records[0]["pm25"] == 25.5
        assert records[1]["pm25"] == 30.0
        assert records[2]["pm25"] is None
    
    def test_parse_measurements_invalid_datetime(self):
        """Test parsing with invalid datetime"""
        station_id = "TEST001"
        measurements = [
            {"DATETIMEDATA": "invalid-date", "PM25": 25.5},
            {"DATETIMEDATA": "2024-01-01 10:00:00", "PM25": 30.0},
        ]
        
        records = self.service.parse_measurements(station_id, measurements)
        
        # Should only parse the valid record
        assert len(records) == 1
        assert records[0]["pm25"] == 30.0
    
    def test_parse_measurements_negative_pm25(self):
        """Test that negative PM25 values are set to None"""
        station_id = "TEST001"
        measurements = [
            {"DATETIMEDATA": "2024-01-01 10:00:00", "PM25": -5.0},
        ]
        
        records = self.service.parse_measurements(station_id, measurements)
        
        assert len(records) == 1
        assert records[0]["pm25"] is None
    
    def test_parse_measurements_empty_pm25(self):
        """Test parsing with empty PM25 string"""
        station_id = "TEST001"
        measurements = [
            {"DATETIMEDATA": "2024-01-01 10:00:00", "PM25": ""},
            {"DATETIMEDATA": "2024-01-01 11:00:00", "PM25": "-"},
        ]
        
        records = self.service.parse_measurements(station_id, measurements)
        
        assert len(records) == 2
        assert records[0]["pm25"] is None
        assert records[1]["pm25"] is None
    
    @pytest.mark.asyncio
    async def test_fetch_with_retry_success(self):
        """Test successful fetch"""
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = {"result": "OK"}
            mock_response.raise_for_status = MagicMock()
            
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await self.service.fetch_with_retry("http://test.com")
            
            assert result == {"result": "OK"}
    
    @pytest.mark.asyncio
    async def test_fetch_with_retry_failure(self):
        """Test fetch with all retries failing"""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=Exception("Network error")
            )
            
            result = await self.service.fetch_with_retry("http://test.com")
            
            assert result is None


class TestMissingDataDetection:
    """Tests for missing data detection"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.service = IngestionService()
    
    def test_gap_classification(self):
        """Test gap type classification"""
        # Would need database fixtures for full testing
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
