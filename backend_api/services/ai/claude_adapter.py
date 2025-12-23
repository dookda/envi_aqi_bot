"""
Anthropic Claude AI Adapter for AI Chatbot

Provides faster inference using Claude API (claude-3-haiku or claude-3-sonnet)
for performance comparison with local Ollama.
"""

import httpx
from typing import Optional, Dict, Any
from backend_model.logger import logger
import os


class ClaudeAdapter:
    """
    Adapter for Anthropic Claude API

    Provides cloud-based LLM inference with faster response times
    compared to local Ollama models.
    """

    def __init__(
        self,
        api_key: str = None,
        model: str = "claude-3-haiku-20240307",
        timeout: float = 30.0
    ):
        """
        Initialize Claude adapter

        Args:
            api_key: Anthropic API key (from environment if not provided)
            model: Model name (claude-3-haiku-20240307, claude-3-sonnet-20240229, claude-3-5-sonnet-20241022)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model
        self.timeout = timeout
        self.base_url = "https://api.anthropic.com/v1"
        self.client = httpx.AsyncClient(timeout=timeout)

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 256
    ) -> Optional[str]:
        """
        Generate response from Claude

        Args:
            prompt: User prompt
            system_prompt: System instruction
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text or None on error
        """
        if not self.api_key:
            logger.error("Anthropic API key not configured")
            return None

        try:
            url = f"{self.base_url}/messages"

            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }

            payload = {
                "model": self.model,
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": temperature,
            }

            logger.info(f"Calling Claude API with model={self.model}")

            response = await self.client.post(url, headers=headers, json=payload)
            response.raise_for_status()

            result = response.json()
            
            # Claude returns content as an array of content blocks
            content_blocks = result.get("content", [])
            if content_blocks and len(content_blocks) > 0:
                generated_text = content_blocks[0].get("text", "").strip()
            else:
                generated_text = ""

            logger.info(f"Claude generated {len(generated_text)} characters")
            return generated_text

        except httpx.TimeoutException:
            logger.error(f"Claude request timeout after {self.timeout}s")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"Claude HTTP error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Claude error: {e}")
            return None

    async def is_healthy(self) -> bool:
        """
        Check if Claude API is accessible

        Returns:
            True if API key is valid and service is healthy
        """
        if not self.api_key:
            logger.warning("Anthropic API key not configured")
            return False

        try:
            # Try a minimal request to verify API key
            url = f"{self.base_url}/messages"
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            
            # Send a minimal test request
            payload = {
                "model": self.model,
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "test"}]
            }
            
            response = await self.client.post(url, headers=headers, json=payload)
            
            # 200 = success, 401 = bad key, other codes may indicate issues
            if response.status_code == 200:
                logger.info("Claude health check passed")
                return True
            else:
                logger.warning(f"Claude health check returned status {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Claude health check failed: {e}")
            return False

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Global instance
_claude_adapter: Optional[ClaudeAdapter] = None


def get_claude_adapter() -> ClaudeAdapter:
    """Get global Claude adapter instance"""
    global _claude_adapter

    if _claude_adapter is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        model = os.getenv("CLAUDE_MODEL", "claude-3-haiku-20240307")
        timeout = float(os.getenv("CLAUDE_TIMEOUT", "30"))

        _claude_adapter = ClaudeAdapter(
            api_key=api_key,
            model=model,
            timeout=timeout
        )

    return _claude_adapter
