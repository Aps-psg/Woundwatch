"""Pydantic schemas for the POST /assess endpoint."""
from typing import Literal

from pydantic import BaseModel, Field


class Visit(BaseModel):
    """Wound measurements captured at a single clinical visit."""

    area:        float = Field(..., gt=0,  description="Wound area (cm² or px)")
    granulation: float = Field(..., ge=0, le=100, description="% granulation tissue")
    slough:      float = Field(..., ge=0, le=100, description="% slough")
    necrotic:    float = Field(..., ge=0, le=100, description="% necrotic tissue")


class AssessRequest(BaseModel):
    """Body for POST /assess."""

    first: Visit
    last:  Visit
    days:  int = Field(..., ge=0, description="Calendar days elapsed between first and last visit")


class AssessResponse(BaseModel):
    """Rule-based healing assessment returned by POST /assess."""

    status: Literal["improving", "worsening", "stalled", "too early to tell"]
    phase:  str   = Field(..., description="Estimated wound healing phase")
    area_change_pct: float = Field(..., description="% change in area (positive = larger)")
    reason:     str
    disclaimer: str
