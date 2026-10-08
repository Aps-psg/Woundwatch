"""
Assess facade.

Applies rule-based logic to two wound visit snapshots and returns a
healing status + phase estimate.  No ML inference is involved here —
the logic is purely arithmetic and conditional.
"""
from src.config import DISCLAIMER, STALL_DAYS, STALL_PCT, WORSEN_PCT
from src.schemas.assess import AssessRequest, AssessResponse


def run_assess(req: AssessRequest) -> AssessResponse:
    """
    Derive wound healing status and phase from two visit snapshots.

    Parameters
    ----------
    req : AssessRequest
        Validated Pydantic model with first visit, last visit, and days elapsed.

    Returns
    -------
    AssessResponse  (Pydantic-validated)
    """
    first, last, days = req.first, req.last, req.days

    # ── Area change ───────────────────────────────────────────────────────────
    change    = 100 * (last.area - first.area) / max(first.area, 1e-9)
    reduction = -change

    # ── Status (rule-based) ───────────────────────────────────────────────────
    if change > WORSEN_PCT:
        status = "worsening"
    elif abs(change) <= STALL_PCT and days >= STALL_DAYS:
        status = "stalled"
    elif reduction > STALL_PCT:
        status = "improving"
    else:
        status = "too early to tell"

    # ── Healing phase (rule-based) ────────────────────────────────────────────
    if last.necrotic >= 30 or last.slough >= 40:
        phase = "inflammatory / stalled (lots of slough or dead tissue)"
    elif reduction >= 80:
        phase = "maturation / near closure"
    elif last.granulation >= 50 and reduction >= 20:
        phase = "proliferative (granulation tissue, area shrinking)"
    else:
        phase = "unclear — needs more visits or clinician review"

    return AssessResponse(
        status=status,
        phase=phase,
        area_change_pct=round(change, 1),
        reason=(
            f"area {change:+.0f}% over {days} days; "
            f"granulation {last.granulation:.0f}%, "
            f"slough {last.slough:.0f}%, "
            f"necrotic {last.necrotic:.0f}%"
        ),
        disclaimer=DISCLAIMER,
    )
