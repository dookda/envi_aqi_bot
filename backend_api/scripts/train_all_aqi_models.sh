#!/bin/bash
# Train all Air Quality Index models (excluding meteorology)
# Run each parameter separately to avoid memory issues

set -e

OUTPUT_DIR="${1:-/app/models}"
FORCE_FLAG="${2:-}"

echo "==================================="
echo "AQI Model Training Script"
echo "==================================="
echo "Output directory: $OUTPUT_DIR"
echo "Force retrain: ${FORCE_FLAG:-false}"
echo ""

# Air quality parameters (excluding meteorology)
PARAMETERS=("pm25" "pm10" "o3" "co" "no2" "so2")

for param in "${PARAMETERS[@]}"; do
    echo ""
    echo "==================================="
    echo "Training models for: $param"
    echo "==================================="
    echo ""
    
    if [ -n "$FORCE_FLAG" ]; then
        python -m backend_api.scripts.train_aqi_models --parameters "$param" --output-dir "$OUTPUT_DIR" --force
    else
        python -m backend_api.scripts.train_aqi_models --parameters "$param" --output-dir "$OUTPUT_DIR"
    fi
    
    echo ""
    echo "Completed training for: $param"
    echo ""
done

echo ""
echo "==================================="
echo "All AQI model training completed!"
echo "==================================="
echo ""
echo "Models saved to:"
for param in "${PARAMETERS[@]}"; do
    count=$(ls -1 "$OUTPUT_DIR/$param/lstm_"*.keras 2>/dev/null | wc -l | tr -d ' ')
    echo "  - $OUTPUT_DIR/$param/: $count models"
done
