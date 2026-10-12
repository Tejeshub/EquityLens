from fastapi import APIRouter

from core import policy

router = APIRouter(prefix="/api/v1", tags=["capabilities"])


@router.get("/capabilities")
def capabilities():
    """Public, non-sensitive: which data sources are enabled in this deployment and why a disabled one is off."""
    return policy.capabilities()
