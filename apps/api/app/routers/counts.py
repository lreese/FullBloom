"""Daily count endpoints — list, save, and recent counts for sanity checks."""

from datetime import date
from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, HTTPException, Query

logger = structlog.get_logger()

from app.models.inventory import CountAuditLog, DailyCount, SheetCompletion
from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    CountItem,
    CountProductLineResponse,
    CountSaveRequest,
    CountSaveResponse,
    CountSheetResponse,
    CountVarietyResponse,
    RecentCountItem,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["counts"], dependencies=[Depends(get_current_user)])


@router.get("/counts")
async def list_counts(
    product_type_id: UUID = Query(...),
    count_date: date = Query(default_factory=date.today),
    _user: User = Depends(require_permission("inventory_counts", "read")),
) -> dict:
    """List daily counts for a product type on a date."""
    logger.info("list_counts", product_type_id=str(product_type_id), count_date=str(count_date))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    # Get in-harvest, active varieties for this product type
    varieties = (
        await Variety.filter(
            product_line__product_type_id=product_type_id,
            in_harvest=True,
            is_active=True,
        )
        .prefetch_related("product_line")
        .order_by("product_line__name", "name")
    )

    # Existing counts keyed by variety_id
    counts = await DailyCount.filter(
        product_type_id=product_type_id, count_date=count_date
    )
    count_map = {str(c.variety_id): c for c in counts}

    # Sheet completion status
    completion = await SheetCompletion.get_or_none(
        product_type_id=product_type_id,
        sheet_type="daily_count",
        sheet_date=count_date,
    )

    # Group by product line
    pl_map: dict[str, list[CountVarietyResponse]] = {}
    pl_names: dict[str, str] = {}
    for v in varieties:
        pl_id = str(v.product_line_id)
        pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]
        existing = count_map.get(str(v.id))
        item = CountVarietyResponse(
            variety_id=str(v.id),
            variety_name=v.name,
            count_value=existing.count_value if existing else None,
            is_done=existing.is_done if existing else False,
            entered_by=existing.entered_by if existing else None,
            updated_at=existing.updated_at if existing else None,
        )
        pl_map.setdefault(pl_id, []).append(item)

    product_lines = [
        CountProductLineResponse(
            product_line_id=pl_id,
            product_line_name=pl_names[pl_id],
            varieties=vars_list,
        )
        for pl_id, vars_list in pl_map.items()
    ]

    return {
        "data": CountSheetResponse(
            count_date=count_date,
            product_type_id=str(product_type_id),
            product_type_name=product_type.name,
            sheet_complete=completion.is_complete if completion else False,
            completed_by=completion.completed_by if completion else None,
            completed_at=completion.completed_at if completion else None,
            product_lines=product_lines,
        )
    }


@router.put("/counts")
async def save_counts(body: CountSaveRequest, user: User = Depends(require_permission("inventory_counts", "write"))) -> dict:
    """Batch save/update daily counts."""
    logger.info("save_counts", product_type_id=str(body.product_type_id), count_date=str(body.count_date), count=len(body.counts))

    # Reject writes if the sheet is already completed
    completion = await SheetCompletion.get_or_none(
        product_type_id=body.product_type_id,
        sheet_type="daily_count",
        sheet_date=body.count_date,
    )
    if completion and completion.is_complete:
        raise HTTPException(status_code=409, detail="Sheet is complete — reopen it before making changes")

    # Validate variety IDs belong to this product type and are active
    variety_ids = list({item.variety_id for item in body.counts})
    valid_ids = set(
        await Variety.filter(
            id__in=variety_ids,
            product_line__product_type_id=body.product_type_id,
            is_active=True,
        ).values_list("id", flat=True)
    )
    saved = 0
    for item in body.counts:
        if item.variety_id not in valid_ids:
            logger.warning("save_counts_skipped_invalid_variety", variety_id=str(item.variety_id), product_type_id=str(body.product_type_id))
            continue
        existing = await DailyCount.get_or_none(
            variety_id=item.variety_id, count_date=body.count_date
        )
        if existing:
            old_value = existing.count_value
            existing.count_value = item.count_value
            existing.is_done = item.is_done
            existing.entered_by = user.email
            await existing.save()

            # Audit log
            action = "set"
            amount = item.count_value if item.count_value is not None else 0
            await CountAuditLog.create(
                daily_count=existing,
                action=action,
                amount=amount,
                resulting_total=item.count_value or 0,
                entered_by=user.email,
            )
        else:
            dc = await DailyCount.create(
                variety_id=item.variety_id,
                product_type_id=body.product_type_id,
                count_date=body.count_date,
                count_value=item.count_value,
                is_done=item.is_done,
                entered_by=user.email,
            )
            await CountAuditLog.create(
                daily_count=dc,
                action="set",
                amount=item.count_value or 0,
                resulting_total=item.count_value or 0,
                entered_by=user.email,
            )
        saved += 1

    return {"data": CountSaveResponse(saved_count=saved)}


@router.get("/counts/latest")
async def get_latest_count_date(product_type_id: UUID = Query(...), _user: User = Depends(require_permission("inventory_counts", "read"))) -> dict:
    """Return the most recent count date for a product type."""
    logger.info("get_latest_count_date", product_type_id=str(product_type_id))
    latest = await DailyCount.filter(product_type_id=product_type_id).order_by("-count_date").first()
    if not latest:
        raise HTTPException(404, detail="No previous counts found")
    return {"data": {"count_date": str(latest.count_date)}}


@router.get("/counts/recent-batch")
async def get_recent_counts_batch(product_type_id: UUID = Query(...), _user: User = Depends(require_permission("inventory_counts", "read"))) -> dict:
    """Return recent counts for all in-harvest varieties of a product type."""
    logger.info("get_recent_counts_batch", product_type_id=str(product_type_id))
    varieties = await Variety.filter(
        product_line__product_type_id=product_type_id,
        in_harvest=True,
        is_active=True,
    ).values_list("id", flat=True)

    result = {}
    for vid in varieties:
        counts = await DailyCount.filter(
            variety_id=vid, count_value__isnull=False
        ).order_by("-count_date").limit(5).values("count_date", "count_value")
        if counts:
            result[str(vid)] = counts
    return {"data": result}


@router.get("/counts/{variety_id}/audit-log")
async def get_audit_log(variety_id: UUID, count_date: date = Query(default_factory=date.today), _user: User = Depends(require_permission("inventory_counts", "read"))) -> dict:
    """Return audit log entries for a variety on a specific date."""
    logger.info("get_audit_log", variety_id=str(variety_id), count_date=str(count_date))
    daily_count = await DailyCount.filter(variety_id=variety_id, count_date=count_date).first()
    if not daily_count:
        return {"data": []}
    entries = await CountAuditLog.filter(daily_count=daily_count).order_by("-created_at").limit(20)
    return {
        "data": [
            {
                "id": str(e.id),
                "action": e.action,
                "amount": e.amount,
                "resulting_total": e.resulting_total,
                "entered_by": e.entered_by,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ]
    }


@router.get("/counts/recent/{variety_id}")
async def recent_counts(variety_id: UUID, _user: User = Depends(require_permission("inventory_counts", "read"))) -> dict:
    """Return last 5 daily counts for a variety."""
    logger.info("recent_counts", variety_id=str(variety_id))
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    rows = (
        await DailyCount.filter(variety_id=variety_id)
        .order_by("-count_date")
        .limit(5)
    )
    data = [
        RecentCountItem(count_date=r.count_date, count_value=r.count_value)
        for r in rows
    ]
    return {"data": data}
