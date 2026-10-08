"""
Tissue-type classification by HSV colour analysis.

Thresholds are illustrative and have not been clinically validated.
Tissue types and their visual encoding:

  granulation  — red pixels   → overlay colour: bright red   (255, 0,   0)
  slough       — yellow pixels → overlay colour: yellow       (255, 255, 0)
  necrotic     — dark pixels  → overlay colour: black         (0,   0,   0)
  other        — remainder    → no overlay colour change
  wound border — green contour (0, 255, 0)
"""
import cv2
import numpy as np


def tissue_mix(
    img_rgb: np.ndarray,
    mask: np.ndarray,
) -> tuple[dict[str, float], np.ndarray]:
    """
    Classify wound pixels into tissue types and render a colour-coded overlay.

    Parameters
    ----------
    img_rgb : np.ndarray
        Full H × W × 3 RGB image.
    mask : np.ndarray
        Binary uint8 wound mask (1 = wound, 0 = background), same H × W.

    Returns
    -------
    pct : dict[str, float]
        Keys: granulation / slough / necrotic / other — each a percentage 0–100.
    overlay : np.ndarray
        RGB image with translucent tissue colours blended in and a green wound
        contour drawn on top.
    """
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = mask.astype(bool)

    # ── Tissue classification (HSV thresholds) ───────────────────────────────
    necrotic    = m & (v < 70)
    granulation = m & ~necrotic & ((h <= 10) | (h >= 165)) & (s >= 70)
    slough      = m & ~necrotic & ~granulation & (
        (((h >= 15) & (h <= 35)) & (s >= 40)) | ((s < 40) & (v >= 170))
    )
    other = m & ~necrotic & ~granulation & ~slough

    total = max(int(m.sum()), 1)
    pct: dict[str, float] = {
        name: round(100 * int(region.sum()) / total, 1)
        for name, region in dict(
            granulation=granulation,
            slough=slough,
            necrotic=necrotic,
            other=other,
        ).items()
    }

    # ── Colour overlay ───────────────────────────────────────────────────────
    overlay = img_rgb.copy()
    for region, colour in (
        (granulation, (255,   0,   0)),
        (slough,      (255, 255,   0)),
        (necrotic,    (  0,   0,   0)),
    ):
        overlay[region] = (
            0.5 * overlay[region] + 0.5 * np.array(colour)
        ).astype(np.uint8)

    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    cv2.drawContours(overlay, contours, -1, (0, 255, 0), 2)

    return pct, overlay
