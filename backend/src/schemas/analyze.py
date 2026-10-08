"""Pydantic schemas for the POST /analyze endpoint."""
from pydantic import BaseModel, Field


class TissueMix(BaseModel):
    """Percentage breakdown of tissue types within the wound mask."""

    granulation: float = Field(..., ge=0, le=100, description="% healthy granulation tissue (red)")
    slough: float      = Field(..., ge=0, le=100, description="% slough — yellow fibrinous tissue")
    necrotic: float    = Field(..., ge=0, le=100, description="% necrotic / dead tissue (black)")
    other: float       = Field(..., ge=0, le=100, description="% pixels not classified above")


class HealingIndicator(BaseModel):
    """Experimental surgical-wound healing indicator (DINOv2 + logistic regression)."""

    not_healed_probability: float = Field(
        ..., ge=0, le=1,
        description="Probability that the surgical wound has NOT healed (0 = healed, 1 = not healed)",
    )
    note: str = Field(..., description="Caveats and model accuracy information")


class AnalyzeResponse(BaseModel):
    """Full response from POST /analyze."""

    area: float = Field(..., description="Wound area in cm² (if reference given) or px")
    unit: str   = Field(..., description="'cm2' when reference object provided, otherwise 'px'")
    tissue: TissueMix
    overlay: str = Field(
        ..., description="Base64-encoded JPEG data URL with tissue colour overlay and wound contour"
    )
    healing_indicator: HealingIndicator | None = Field(
        None, description="Only present when wound_kind='surgical'"
    )
    warnings:   list[str] = Field(default_factory=list)
    disclaimer: str
