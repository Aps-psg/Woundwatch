"""
ML model loading and singleton accessors.

All heavy models (SAM, DINOv2, healing classifier) are loaded exactly
once at application startup via load_all_models() and then accessed
through the getter functions below.

A single threading.Lock serialises CPU inference so the server stays
stable on single-core / resource-constrained environments.
"""
import os
import threading

import joblib
import torch
from transformers import AutoImageProcessor, AutoModel, SamModel, SamProcessor

from src.config import HEALING_MODEL_PATH

# Respect the available CPU count for PyTorch's intra-op thread pool
torch.set_num_threads(max(1, os.cpu_count() or 1))

# ── Private singletons ────────────────────────────────────────────────────────
_inference_lock: threading.Lock = threading.Lock()

_sam_proc: SamProcessor | None = None
_sam:      SamModel     | None = None
_dino_proc: AutoImageProcessor | None = None
_dino:      AutoModel          | None = None
_healing_clf = None          # sklearn Pipeline or None if .joblib not found


# ── Public: lifecycle ────────────────────────────────────────────────────────

def load_all_models() -> None:
    """
    Download (on first run) and load all ML models into process memory.

    Called once from the FastAPI lifespan handler.  The healing classifier
    is loaded with a graceful fallback: if the .joblib file is absent the
    server still starts, but the /analyze surgical indicator will respond
    with 503 instead of crashing.
    """
    global _sam_proc, _sam, _dino_proc, _dino, _healing_clf

    _sam_proc = SamProcessor.from_pretrained("facebook/sam-vit-base")
    _sam      = SamModel.from_pretrained("facebook/sam-vit-base").eval()

    _dino_proc = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    _dino      = AutoModel.from_pretrained("facebook/dinov2-base").eval()

    try:
        _healing_clf = joblib.load(HEALING_MODEL_PATH)
    except FileNotFoundError:
        _healing_clf = None


# ── Public: accessors ────────────────────────────────────────────────────────

def get_sam() -> tuple[SamProcessor, SamModel]:
    if _sam_proc is None or _sam is None:
        raise RuntimeError("SAM model not loaded. Call load_all_models() first.")
    return _sam_proc, _sam


def get_dino() -> tuple[AutoImageProcessor, AutoModel]:
    if _dino_proc is None or _dino is None:
        raise RuntimeError("DINOv2 model not loaded. Call load_all_models() first.")
    return _dino_proc, _dino


def get_healing_clf():
    """Returns the healing Pipeline, or None if the .joblib was absent at startup."""
    return _healing_clf


def get_inference_lock() -> threading.Lock:
    """Returns the shared lock that serialises all CPU-bound inference calls."""
    return _inference_lock
