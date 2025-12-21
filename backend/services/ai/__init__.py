"""
AI Layer for Air Quality Chatbot

This module provides local LLM-based natural language query processing
for air quality data with strict guardrails and API-mediated data access.
"""

from .chatbot import chatbot_service

__all__ = ["chatbot_service"]
