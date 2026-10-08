"""POST /assess — rule-based healing assessment endpoint."""
from fastapi import APIRouter, Depends

from src.dependencies import verify_api_key
from src.facades.assess_facade import run_assess
from src.schemas.assess import AssessRequest, AssessResponse

router = APIRouter(tags=["Assess"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/assess",
    response_model=AssessResponse,
    summary="Assess wound healing progress across two visits",
    response_description="Status, healing phase, and area-change summary",
)
def assess(req: AssessRequest) -> AssessResponse:
    """
    Compare two wound visit snapshots and return a rule-based healing assessment.

    Both `first.area` and `last.area` must be in the same unit (cm² or px).
    """
    return run_assess(req)
