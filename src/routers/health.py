"""GET /health — liveness probe."""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe", response_description="Server is up")
def health() -> dict[str, bool]:
    """Return 200 OK when the server is running."""
    return {"ok": True}
