"""Application-wide constants and environment configuration."""
import os

# ── Security ────────────────────────────────────────────────────────────────
API_KEY: str | None = os.environ.get("API_KEY")

# ── Image limits ─────────────────────────────────────────────────────────────
MAX_BYTES: int = 8 * 1024 * 1024   # 8 MB
MAX_SIDE: int = 1_600               # px – longest side after resize
MAX_WOUNDS: int = 5

# ── Disclaimer (required on every response) ──────────────────────────────────
DISCLAIMER: str = (
    "Estimates from a prototype, not a diagnosis. "
    "Share worsening or stalled wounds with a clinician."
)

# ── Assess thresholds (illustrative, not clinically validated) ───────────────
WORSEN_PCT: float = 10.0
STALL_PCT: float = 10.0
STALL_DAYS: int = 7

# ── Filesystem paths ─────────────────────────────────────────────────────────
BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEALING_MODEL_PATH: str = os.path.join(BASE_DIR, "healing_status_logreg.joblib")
