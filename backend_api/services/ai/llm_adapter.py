"""
Local LLM Adapter for Ollama

Provides HTTP-based inference with local LLM models running in Docker.
Supports stateless inference with no external tool access.
"""

import httpx
from typing import Optional, Dict, Any
from backend_model.logger import logger
from backend_model.config import settings


class OllamaAdapter:
    """
    Adapter for Ollama local LLM inference server

    Ollama provides HTTP API for local model inference.
    This adapter handles communication with Ollama service.
    """

    def __init__(
        self,
        base_url: str = "http://ollama:11434",
        model: str = "qwen2.5:7b",
        timeout: float = 30.0
    ):
        """
        Initialize Ollama adapter

        Args:
            base_url: Ollama server URL (default: http://ollama:11434)
            model: Model name (qwen2.5:7b, llama3.1:8b, or mistral:7b)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 500
    ) -> Optional[str]:
        """
        Generate response from LLM

        Args:
            prompt: User prompt
            system_prompt: System instruction
            temperature: Sampling temperature (0.0-1.0, lower = more deterministic)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text or None on error
        """
        try:
            # Ollama API endpoint
            url = f"{self.base_url}/api/generate"

            # Build request payload
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                }
            }

            logger.info(f"Calling Ollama API with model={self.model}, temp={temperature}")

            # Make request
            response = await self.client.post(url, json=payload)
            response.raise_for_status()

            # Parse response
            result = response.json()
            generated_text = result.get("response", "").strip()

            logger.info(f"Ollama generated {len(generated_text)} characters")
            return generated_text

        except httpx.TimeoutException:
            logger.error(f"Ollama request timeout after {self.timeout}s")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"Ollama HTTP error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return None

    async def is_healthy(self) -> bool:
        """
        Check if Ollama service is healthy and model is available

        Returns:
            True if service is healthy, False otherwise
        """
        try:
            url = f"{self.base_url}/api/tags"
            response = await self.client.get(url)
            response.raise_for_status()

            # Check if our model is available
            data = response.json()
            models = data.get("models", [])
            model_names = [m.get("name", "") for m in models]

            if self.model in model_names:
                logger.info(f"Ollama health check passed - model {self.model} available")
                return True
            else:
                logger.warning(f"Ollama model {self.model} not found. Available: {model_names}")
                return False

        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Global instance (configured from environment)
_ollama_adapter: Optional[OllamaAdapter] = None


def get_ollama_adapter() -> OllamaAdapter:
    """
    Get global Ollama adapter instance

    Returns:
        OllamaAdapter instance
    """
    global _ollama_adapter

    if _ollama_adapter is None:
        # Get configuration from environment
        ollama_url = getattr(settings, "ollama_url", "http://ollama:11434")
        ollama_model = getattr(settings, "ollama_model", "qwen2.5:3b")
        ollama_timeout = getattr(settings, "ollama_timeout", 60.0)

        _ollama_adapter = OllamaAdapter(
            base_url=ollama_url,
            model=ollama_model,
            timeout=ollama_timeout
        )

    return _ollama_adapter
