"""Customer pricing endpoints."""

from fastapi import APIRouter

from app.services.pricing_service import get_customer_pricing

router = APIRouter(prefix="/api/v1", tags=["pricing"])


@router.get("/customers/{customer_id}/pricing")
async def customer_pricing(customer_id: str) -> dict:
    """Return resolved pricing for all sales items for a given customer."""
    data = await get_customer_pricing(customer_id)
    return {"data": data}
