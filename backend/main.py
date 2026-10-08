"""
Wound Analysis API — application entry point.

This module is intentionally thin.  Its only responsibilities are:
  • Declare the FastAPI application with metadata
  • Register the startup / shutdown lifespan (loads ML models once)
  • Attach domain exception handlers
  • Include the feature routers

All business logic lives under src/.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.exceptions import WoundAPIError, unhandled_error_handler, wound_api_error_handler
from src.ml.loader import load_all_models
from src.routers import analyze, assess, health


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all ML models on startup; nothing to release on shutdown."""
    load_all_models()
    yield


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Wound Analysis API",
    description=(
        "Prototype decision-support tool: wound outline, area measurement, "
        "tissue-type breakdown (granulation / slough / necrotic), and an "
        "experimental surgical-wound healing indicator.\n\n"
        "> **Not a medical diagnosis.** Always share worsening or stalled "
        "wounds with a qualified clinician."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allows the browser (Expo web / React Native web) to call this API from any
# origin.  In production, replace "*" with your actual frontend domain.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ────────────────────────────────────────────────────────

app.add_exception_handler(WoundAPIError, wound_api_error_handler)   # type: ignore[arg-type]
app.add_exception_handler(Exception,     unhandled_error_handler)   # type: ignore[arg-type]

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(assess.router)
