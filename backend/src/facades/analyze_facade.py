"""
Analyze facade.

Orchestrates the full /analyze pipeline:
  1. Decode + resize the uploaded image
  2. Parse and validate bounding boxes
  3. (Optional) derive pixel-per-cm from a reference object
  4. Run SAM segmentation (serialised through the inference lock)
  5. Run tissue colour analysis
  6. (Optional) run the healing indicator for surgical wounds
  7. Assemble and return a validated AnalyzeResponse

The facade is the only layer that knows about the overall flow; the
individual services and ML models know nothing about each other.
"""
import numpy as np

from src.config import DISCLAIMER
from src.exceptions import NoWoundFoundError
from src.ml.loader import get_inference_lock
from src.schemas.analyze import AnalyzeResponse, HealingIndicator, TissueMix
from src.services.healing_service import healing_not_healed_prob
from src.services.image_service import (
    compute_pixels_per_cm,
    overlay_to_data_url,
    parse_ref_box,
    parse_wound_boxes,
    read_image,
    to_px,
)
from src.services.segment_service import segment_wound
from src.services.tissue_service import tissue_mix

_HEALING_NOTE = (
    "Experimental. Trained on a small set of surgical wound photos labelled by "
    "surgeons (test AUROC ≈ 0.75, accuracy ≈ 66%). Not for chronic wounds."
)


def run_analyze(
    image_data: bytes,
    wound_boxes_json: str,
    ref_box_json: str | None,
    ref_cm: float | None,
    wound_kind: str,
) -> AnalyzeResponse:
    """
    Execute the end-to-end wound analysis pipeline.

    Parameters
    ----------
    image_data      : raw bytes of the uploaded image file
    wound_boxes_json: JSON string — list of [x1,y1,x2,y2] fractional boxes
    ref_box_json    : JSON string — single [x1,y1,x2,y2] reference box, or None
    ref_cm          : real side length of the reference object in cm, or None
    wound_kind      : 'surgical' enables the healing indicator; anything else skips it

    Returns
    -------
    AnalyzeResponse  (Pydantic-validated)
    """
    # ── 1. Decode image ──────────────────────────────────────────────────────
    img = read_image(image_data)
    h, w = img.shape[:2]

    # ── 2. Parse boxes ───────────────────────────────────────────────────────
    boxes   = parse_wound_boxes(wound_boxes_json)
    ref_box = parse_ref_box(ref_box_json, ref_cm)
    ppc     = compute_pixels_per_cm(ref_box, w, h, ref_cm) if (ref_box and ref_cm) else None

    # ── 3–5. CPU-bound inference (serialised) ────────────────────────────────
    with get_inference_lock():
        mask = np.zeros((h, w), dtype=np.uint8)
        for b in boxes:
            mask |= segment_wound(img, to_px(b, w, h))

        if mask.sum() == 0:
            raise NoWoundFoundError()

        pct, overlay = tissue_mix(img, mask)

        healing_indicator: HealingIndicator | None = None
        if wound_kind == "surgical":
            prob = healing_not_healed_prob(img)
            healing_indicator = HealingIndicator(
                not_healed_probability=round(prob, 3),
                note=_HEALING_NOTE,
            )

    # ── 6. Post-inference ────────────────────────────────────────────────────
    area_px  = int(mask.sum())
    warnings: list[str] = []

    if area_px / (h * w) > 0.5:
        warnings.append("The outline covers over half the photo — check the wound box.")
    if ppc is None:
        warnings.append(
            "No reference object given: area is in pixels and only comparable "
            "between photos taken at the same camera distance."
        )

    # ── 7. Return validated response ─────────────────────────────────────────
    return AnalyzeResponse(
        area=round(area_px / ppc**2, 2) if ppc else float(area_px),
        unit="cm2" if ppc else "px",
        tissue=TissueMix(**pct),
        overlay=overlay_to_data_url(overlay),
        healing_indicator=healing_indicator,
        warnings=warnings,
        disclaimer=DISCLAIMER,
    )
