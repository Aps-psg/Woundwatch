"""POST /analyze — wound photo analysis endpoint."""
from fastapi import APIRouter, Depends, File, Form, UploadFile

from src.config import MAX_BYTES
from src.dependencies import verify_api_key
from src.exceptions import ImageTooLargeError
from src.facades.analyze_facade import run_analyze
from src.schemas.analyze import AnalyzeResponse

router = APIRouter(tags=["Analyze"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze a wound photo",
    response_description="Tissue breakdown, wound area, and optional healing indicator",
)
def analyze(
    image: UploadFile = File(..., description="Wound photo — JPEG or PNG, max 8 MB"),
    wound_boxes: str = Form(
        ...,
        description=(
            "JSON array of one to five bounding boxes, each as "
            "[x1, y1, x2, y2] image fractions (0..1)."
        ),
    ),
    ref_box: str | None = Form(
        None,
        description="JSON [x1, y1, x2, y2] bounding box around a known-size reference object.",
    ),
    ref_cm: float | None = Form(
        None,
        description="Real physical size of the reference object in centimetres.",
    ),
    wound_kind: str = Form(
        "other",
        description="Pass 'surgical' to activate the experimental healing indicator.",
    ),
) -> AnalyzeResponse:
    data = image.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ImageTooLargeError()
    return run_analyze(data, wound_boxes, ref_box, ref_cm, wound_kind)
