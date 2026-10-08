"""
Surgical-wound healing indicator: DINOv2 feature extraction + logistic regression.

Experimental — test AUROC ≈ 0.75, accuracy ≈ 66%.  Trained on surgical
wound photos only; results on chronic wounds are not meaningful.
"""
import numpy as np
import torch
from PIL import Image

from src.exceptions import HealingModelUnavailableError
from src.ml.loader import get_dino, get_healing_clf


@torch.no_grad()
def healing_not_healed_prob(img_rgb: np.ndarray) -> float:
    """
    Estimate the probability that a surgical wound has NOT healed.

    Uses DINOv2 to extract a feature vector (CLS token concatenated with
    the mean of patch tokens) and passes it to the sklearn Pipeline loaded
    at startup.

    Parameters
    ----------
    img_rgb : np.ndarray
        Full H × W × 3 RGB wound photo.

    Returns
    -------
    float
        Value in [0, 1] — higher = more likely NOT healed.

    Raises
    ------
    HealingModelUnavailableError
        If the .joblib classifier was absent at startup.
    """
    clf = get_healing_clf()
    if clf is None:
        raise HealingModelUnavailableError()

    dino_proc, dino = get_dino()
    inp  = dino_proc(images=Image.fromarray(img_rgb), return_tensors="pt")
    hidden = dino(**inp).last_hidden_state
    feat = torch.cat([hidden[:, 0], hidden[:, 1:].mean(1)], dim=1).numpy()

    return float(clf.predict_proba(feat)[0, 1])
