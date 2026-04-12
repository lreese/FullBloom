"""Sheet completion endpoints — mark sheets complete or reopen them."""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, HTTPException

logger = structlog.get_logger()

from app.models.inventory import (
    CustomerCount,
    DailyCount,
    Estimate,
    SheetCompletion,
)
from app.models.product import Variety
from app.schemas.inventory import (
    SheetCompleteRequest,
    SheetCompleteResponse,
)

router = APIRouter(prefix="/api/v1", tags=["sheet_completion"])


@router.post("/sheets/complete")
async def complete_sheet(body: SheetCompleteRequest) -> dict:
    """Auto-mark all varieties as done and mark the sheet as complete."""
    logger.info("complete_sheet", product_type_id=str(body.product_type_id), sheet_type=body.sheet_type, sheet_date=str(body.sheet_date))
    # Get in-harvest varieties for this product type
    varieties = await Variety.filter(
        product_line__product_type_id=body.product_type_id,
        in_harvest=True,
        is_active=True,
    )
    variety_ids = [v.id for v in varieties]

    # Auto-mark existing records as done (don't create phantom records
    # for varieties that haven't been counted — the frontend treats all
    # varieties as done when the sheet is complete via isComplete prop)
    if body.sheet_type == "daily_count":
        await DailyCount.filter(
            product_type_id=body.product_type_id,
            count_date=body.sheet_date,
            variety_id__in=variety_ids,
        ).update(is_done=True)

    elif body.sheet_type == "customer_count":
        await CustomerCount.filter(
            product_type_id=body.product_type_id,
            count_date=body.sheet_date,
            variety_id__in=variety_ids,
        ).update(is_done=True)

    elif body.sheet_type == "estimate":
        await Estimate.filter(
            product_type_id=body.product_type_id,
            week_start=body.sheet_date,
            variety_id__in=variety_ids,
        ).update(is_done=True)

    else:
        raise HTTPException(status_code=422, detail=f"Unknown sheet type: {body.sheet_type}")

    now = datetime.now(timezone.utc)
    completion, created = await SheetCompletion.get_or_create(
        product_type_id=body.product_type_id,
        sheet_type=body.sheet_type,
        sheet_date=body.sheet_date,
        defaults={
            "is_complete": True,
            "completed_by": body.completed_by,
            "completed_at": now,
        },
    )
    if not created:
        completion.is_complete = True
        completion.completed_by = body.completed_by
        completion.completed_at = now
        await completion.save()

    return {
        "data": SheetCompleteResponse(
            is_complete=True,
            completed_by=completion.completed_by,
            completed_at=completion.completed_at,
        )
    }


@router.post("/sheets/uncomplete")
async def uncomplete_sheet(body: SheetCompleteRequest) -> dict:
    """Reopen a completed sheet."""
    logger.info("uncomplete_sheet", product_type_id=str(body.product_type_id), sheet_type=body.sheet_type, sheet_date=str(body.sheet_date))
    completion = await SheetCompletion.get_or_none(
        product_type_id=body.product_type_id,
        sheet_type=body.sheet_type,
        sheet_date=body.sheet_date,
    )
    if completion:
        completion.is_complete = False
        completion.completed_by = None
        completion.completed_at = None
        await completion.save()

    return {
        "data": SheetCompleteResponse(is_complete=False)
    }
