"""
Image I/O, bounding-box parsing, and overlay rendering utilities.

All functions here are pure helpers: they raise domain exceptions
(WoundAPIError subclasses) instead of raw HTTPExceptions so business
logic stays decoupled from the HTTP layer.
"""
import base64
import io
import json

import cv2
import numpy as np
from PIL import Image, ImageOps

from src.config import MAX_SIDE, MAX_WOUNDS
from src.exceptions import (
    ImageReadError,
    InvalidBoxCountError,
    InvalidBoxError,
    InvalidRefBoxError,
)


def read_image(data: bytes) -> np.ndarray:
    """
    Decode raw bytes into an RGB numpy array.

    Automatically corrects EXIF orientation and down-scales the longest
    side to MAX_SIDE px to keep inference time predictable.
    """
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except Exception as exc:
        raise ImageReadError() from exc

    scale = min(1.0, MAX_SIDE / max(img.size))
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    return np.array(img)


def parse_box(raw: list, name: str) -> list[float]:
    """
    Validate and return a fractional bounding box [x1, y1, x2, y2].

    All values must be in 0..1, with x1 < x2 and y1 < y2.
    """
    try:
        b = [float(v) for v in raw]
    except (TypeError, ValueError) as exc:
        raise InvalidBoxError(name) from exc

    if len(b) != 4 or not (0 <= b[0] < b[2] <= 1 and 0 <= b[1] < b[3] <= 1):
        raise InvalidBoxError(name)
    return b


def parse_wound_boxes(wound_boxes_json: str) -> list[list[float]]:
    """Parse and validate the JSON-encoded wound_boxes form field."""
    try:
        raw_boxes = json.loads(wound_boxes_json)
        assert isinstance(raw_boxes, list) and 1 <= len(raw_boxes) <= MAX_WOUNDS
    except Exception as exc:
        raise InvalidBoxCountError(MAX_WOUNDS) from exc

    return [parse_box(b, "wound box") for b in raw_boxes]


def parse_ref_box(ref_box_json: str | None, ref_cm: float | None) -> list[float] | None:
    """
    Parse and validate the optional reference-object bounding box.

    Returns None when ref_box_json is falsy (reference not provided).
    Raises InvalidRefBoxError when the box is given but ref_cm is missing/invalid.
    """
    if not ref_box_json:
        return None
    if not ref_cm or ref_cm <= 0:
        raise InvalidRefBoxError()
    try:
        raw = json.loads(ref_box_json)
    except json.JSONDecodeError as exc:
        raise InvalidBoxError("ref_box") from exc
    return parse_box(raw, "ref_box")


def to_px(box: list[float], w: int, h: int) -> list[float]:
    """Convert a fractional [x1, y1, x2, y2] box to pixel coordinates."""
    return [box[0] * w, box[1] * h, box[2] * w, box[3] * h]


def compute_pixels_per_cm(ref_box: list[float], w: int, h: int, ref_cm: float) -> float:
    """
    Derive the pixel-per-centimetre ratio from a reference object bounding box.

    Uses the average of the box's pixel width and height so the estimate is
    robust to slight camera tilt.
    """
    rpx = to_px(ref_box, w, h)
    return ((rpx[2] - rpx[0]) + (rpx[3] - rpx[1])) / 2 / ref_cm


def overlay_to_data_url(overlay: np.ndarray, max_side: int = 800) -> str:
    """
    Encode a numpy RGB image as a base64 JPEG data URL.

    Down-scales the image if it exceeds max_side px on any axis.
    """
    img = Image.fromarray(overlay)
    scale = min(1.0, max_side / max(img.size))
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
