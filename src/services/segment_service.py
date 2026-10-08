"""
Wound segmentation using Meta's Segment Anything Model (SAM).

The model is accessed via the shared singleton in src.ml.loader so it is
never loaded more than once per process.
"""
import numpy as np
import torch
from PIL import Image

from src.ml.loader import get_sam


@torch.no_grad()
def segment_wound(img_rgb: np.ndarray, box_px: list[float]) -> np.ndarray:
    """
    Segment a single wound region described by a pixel bounding box.

    Parameters
    ----------
    img_rgb : np.ndarray
        H × W × 3 uint8 array in RGB order.
    box_px : list[float]
        Pixel-space box [x1, y1, x2, y2] obtained from image_service.to_px().

    Returns
    -------
    np.ndarray
        Binary mask (uint8) with shape (H, W): 1 = wound pixel, 0 = background.
        Same spatial dimensions as img_rgb.
    """
    sam_proc, sam = get_sam()
    inputs = sam_proc(Image.fromarray(img_rgb), input_boxes=[[box_px]], return_tensors="pt")
    out    = sam(**inputs)

    masks = sam_proc.image_processor.post_process_masks(
        out.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu(),
    )[0][0]

    best = int(out.iou_scores.cpu()[0, 0].argmax())
    return masks[best].numpy().astype(np.uint8)
