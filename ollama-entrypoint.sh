#!/bin/bash
# Ollama Auto-Pull Entrypoint Script
# Automatically downloads the LLM model on first startup
# Optimized for limited memory servers (16GB RAM)

set -e

# Model to download (matches OLLAMA_MODEL in API service)
MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"

# Memory optimization settings for 16GB server
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"

echo "=========================================="
echo " Ollama AI Server (Optimized for CX43)"
echo "=========================================="
echo " Model: $MODEL"
echo " Parallel: $OLLAMA_NUM_PARALLEL"
echo " Max Models: $OLLAMA_MAX_LOADED_MODELS"
echo "=========================================="

echo "Starting Ollama service..."
# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready (longer wait for slower servers)
echo "Waiting for Ollama service to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Check if model exists, if not pull it
if ! ollama list | grep -q "$MODEL"; then
    echo ""
    echo "Model '$MODEL' not found. Downloading..."
    echo "This may take 5-10 minutes depending on your internet speed..."
    echo ""
    ollama pull "$MODEL"
    echo ""
    echo "✓ Model '$MODEL' downloaded successfully!"
else
    echo "✓ Model '$MODEL' already exists. Skipping download."
fi

# Preload model for faster first query
echo ""
echo "Preloading model for faster inference..."
echo '{"model":"'"$MODEL"'","keep_alive":"24h"}' | curl -s http://localhost:11434/api/generate -d @- > /dev/null 2>&1 || true
echo "✓ Model preloaded and ready!"
echo ""

# Wait for Ollama process
wait $OLLAMA_PID
