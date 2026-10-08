"""
Custom exception hierarchy and FastAPI exception handlers.

All domain errors inherit from WoundAPIError so they can be caught
by a single handler that returns a consistent JSON error envelope.
"""
from fastapi import Request
from fastapi.responses import JSONResponse


# ── Base ─────────────────────────────────────────────────────────────────────

class WoundAPIError(Exception):
    """Base class for every domain-level error in the Wound API."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ── 4xx client errors ────────────────────────────────────────────────────────

class AuthenticationError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(401, "Invalid or missing API key.")


class ImageTooLargeError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(413, "Image too large — maximum allowed size is 8 MB.")


class ImageReadError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(400, "Could not read the image. Ensure it is a valid JPEG or PNG.")


class InvalidBoxCountError(WoundAPIError):
    def __init__(self, max_wounds: int) -> None:
        super().__init__(
            400,
            f"wound_boxes must be a JSON array of 1–{max_wounds} boxes.",
        )


class InvalidBoxError(WoundAPIError):
    def __init__(self, name: str) -> None:
        super().__init__(
            400,
            f"{name} must be [x1, y1, x2, y2] as image fractions (0..1) "
            "with x1 < x2 and y1 < y2.",
        )


class InvalidRefBoxError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(400, "ref_cm must be a positive number when ref_box is supplied.")


class NoWoundFoundError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(422, "No wound region detected — try a tighter bounding box.")


# ── 5xx server errors ────────────────────────────────────────────────────────

class HealingModelUnavailableError(WoundAPIError):
    def __init__(self) -> None:
        super().__init__(503, "Healing indicator model is unavailable on this server.")


# ── FastAPI handlers ─────────────────────────────────────────────────────────

async def wound_api_error_handler(request: Request, exc: WoundAPIError) -> JSONResponse:
    """Return a consistent JSON envelope for all domain errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected exceptions — hide internals from the client."""
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected internal error occurred.", "status_code": 500},
    )
