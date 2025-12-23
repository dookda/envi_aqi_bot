#!/bin/bash
# Ollama Auto-Pull Entrypoint Script
# Automatically downloads the LLM model on first startup

set -e

# Model to download (matches OLLAMA_MODEL in API service)
MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"

echo "Starting Ollama service..."
# Start Ollama in the background
/bin/ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama service to be ready..."
sleep 5

# Check if model exists, if not pull it
if ! ollama list | grep -q "$MODEL"; then
    echo "Model '$MODEL' not found. Downloading..."
    echo "This may take 5-10 minutes depending on your internet speed..."
    ollama pull "$MODEL"
    echo "Model '$MODEL' downloaded successfully!"
else
    echo "Model '$MODEL' already exists. Skipping download."
fi

# Wait for Ollama process
wait $OLLAMA_PID
