"""Harvest status endpoints — view and bulk-toggle in_harvest flag."""

from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, HTTPException, Query

logger = structlog.get_logger()

from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    HarvestStatusItem,
    HarvestStatusUpdateRequest,
    HarvestStatusUpdateResponse,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["harvest_status"], dependencies=[Depends(get_current_user)])


@router.get("/varieties/harvest-status")
async def list_harvest_status(
    product_type_id: UUID = Query(...),
    _user: User = Depends(require_permission("inventory_harvest", "read")),
) -> dict:
    """Return harvest status for all active varieties of a product type."""
    logger.info("list_harvest_status", product_type_id=str(product_type_id))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    varieties = (
        await Variety.filter(
            product_line__product_type_id=product_type_id,
            is_active=True,
        )
        .prefetch_related("product_line")
        .order_by("product_line__name", "name")
    )

    data = [
        HarvestStatusItem(
            variety_id=str(v.id),
            variety_name=v.name,
            product_line_name=v.product_line.name,  # type: ignore[attr-defined]
            in_harvest=v.in_harvest,
            stems_per_bunch=v.stems_per_bunch,
        )
        for v in varieties
    ]
    return {"data": data}


@router.patch("/varieties/harvest-status/bulk")
async def bulk_update_harvest_status(body: HarvestStatusUpdateRequest, user: User = Depends(require_permission("inventory_harvest", "write"))) -> dict:
    """Bulk toggle in_harvest for varieties."""
    logger.info("bulk_update_harvest_status", count=len(body.updates))
    updated = 0
    for item in body.updates:
        variety = await Variety.get_or_none(id=item.variety_id)
        if variety is None:
            continue
        variety.in_harvest = item.in_harvest
        await variety.save()
        updated += 1

    return {"data": HarvestStatusUpdateResponse(updated_count=updated)}
