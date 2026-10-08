"""Shared FastAPI dependency functions used across multiple routers."""
import hmac

from fastapi import Header

from src.config import API_KEY
from src.exceptions import AuthenticationError


def verify_api_key(x_api_key: str | None = Header(None)) -> None:
    """
    Validate the x-api-key request header.

    If API_KEY is not set in the environment, all requests are allowed through.
    Uses constant-time comparison to prevent timing-based key enumeration.
    """
    if API_KEY and not (x_api_key and hmac.compare_digest(x_api_key, API_KEY)):
        raise AuthenticationError()
