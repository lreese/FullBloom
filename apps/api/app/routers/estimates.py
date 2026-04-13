"""Estimate endpoints — list and save weekly harvest estimates."""

from datetime import date, timedelta
from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, HTTPException, Query

logger = structlog.get_logger()

from app.models.inventory import DailyCount, Estimate, EstimateAuditLog, SheetCompletion
from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    EstimateProductLineResponse,
    EstimateSaveRequest,
    EstimateSaveResponse,
    EstimateSheetResponse,
    EstimateVarietyResponse,
)
from app.services.inventory_service import get_pull_dates

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["estimates"], dependencies=[Depends(get_current_user)])


def _current_week_monday() -> date:
    """Return Monday of the current week."""
    today = date.today()
    return today - timedelta(days=today.weekday())


@router.get("/estimates")
async def list_estimates(
    product_type_id: UUID = Query(...),
    week_start: date = Query(default_factory=_current_week_monday),
) -> dict:
    """List estimates for a product type for a week."""
    logger.info("list_estimates", product_type_id=str(product_type_id), week_start=str(week_start))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    pull_days = await get_pull_dates(week_start)

    # Get in-harvest, active varieties
    varieties = (
        await Variety.filter(
            product_line__product_type_id=product_type_id,
            in_harvest=True,
            is_active=True,
        )
        .prefetch_related("product_line")
        .order_by("product_line__name", "name")
    )

    # Existing estimates keyed by (variety_id, pull_day)
    estimates = await Estimate.filter(
        product_type_id=product_type_id, week_start=week_start
    )
    est_map: dict[str, Estimate] = {}
    for e in estimates:
        est_map[f"{e.variety_id}|{e.pull_day.isoformat()}"] = e

    # Last week actuals: daily counts for the previous week's pull days
    prev_week_start = week_start - timedelta(days=7)
    prev_pull_days = await get_pull_dates(prev_week_start)
    variety_ids = [v.id for v in varieties]

    last_week_counts = await DailyCount.filter(
        variety_id__in=variety_ids,
        count_date__in=prev_pull_days,
    )
    last_week_actuals: dict[str, dict[str, int | None]] = {}
    for dc in last_week_counts:
        vid = str(dc.variety_id)
        last_week_actuals.setdefault(vid, {})[dc.count_date.isoformat()] = dc.count_value

    # Sheet completion
    completion = await SheetCompletion.get_or_none(
        product_type_id=product_type_id,
        sheet_type="estimate",
        sheet_date=week_start,
    )

    # Group by product line
    pl_map: dict[str, list[EstimateVarietyResponse]] = {}
    pl_names: dict[str, str] = {}
    for v in varieties:
        pl_id = str(v.product_line_id)
        pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]

        est_dict: dict[str, int | None] = {}
        is_done = True
        for pd in pull_days:
            key = f"{v.id}|{pd.isoformat()}"
            e = est_map.get(key)
            est_dict[pd.isoformat()] = e.estimate_value if e else None
            if e is None or not e.is_done:
                is_done = False

        item = EstimateVarietyResponse(
            variety_id=str(v.id),
            variety_name=v.name,
            estimates=est_dict,
            is_done=is_done,
        )
        pl_map.setdefault(pl_id, []).append(item)

    product_lines = [
        EstimateProductLineResponse(
            product_line_id=pl_id,
            product_line_name=pl_names[pl_id],
            varieties=vars_list,
        )
        for pl_id, vars_list in pl_map.items()
    ]

    return {
        "data": EstimateSheetResponse(
            week_start=week_start,
            product_type_id=str(product_type_id),
            product_type_name=product_type.name,
            sheet_complete=completion.is_complete if completion else False,
            pull_days=pull_days,
            last_week_actuals=last_week_actuals,
            product_lines=product_lines,
        )
    }


@router.put("/estimates")
async def save_estimates(body: EstimateSaveRequest, user: User = Depends(require_permission("inventory_estimates", "write"))) -> dict:
    """Batch save/update estimates."""
    logger.info("save_estimates", product_type_id=str(body.product_type_id), week_start=str(body.week_start), count=len(body.estimates))

    # Reject writes if the sheet is already completed
    completion = await SheetCompletion.get_or_none(
        product_type_id=body.product_type_id,
        sheet_type="estimate",
        sheet_date=body.week_start,
    )
    if completion and completion.is_complete:
        raise HTTPException(status_code=409, detail="Sheet is complete — reopen it before making changes")

    # Validate variety IDs belong to this product type and are active
    variety_ids = list({item.variety_id for item in body.estimates})
    valid_ids = set(
        await Variety.filter(
            id__in=variety_ids,
            product_line__product_type_id=body.product_type_id,
            is_active=True,
        ).values_list("id", flat=True)
    )
    saved = 0
    for item in body.estimates:
        if item.variety_id not in valid_ids:
            logger.warning("save_estimates_skipped_invalid_variety", variety_id=str(item.variety_id), product_type_id=str(body.product_type_id))
            continue
        existing = await Estimate.get_or_none(
            variety_id=item.variety_id, pull_day=item.pull_day, week_start=body.week_start
        )
        if existing:
            existing.estimate_value = item.estimate_value
            existing.is_done = item.is_done
            existing.entered_by = user.email
            await existing.save()
            if item.estimate_value is not None:
                await EstimateAuditLog.create(
                    estimate=existing,
                    action="set",
                    amount=item.estimate_value,
                    resulting_total=item.estimate_value,
                    entered_by=user.email,
                )
        else:
            est = await Estimate.create(
                variety_id=item.variety_id,
                product_type_id=body.product_type_id,
                week_start=body.week_start,
                pull_day=item.pull_day,
                estimate_value=item.estimate_value,
                is_done=item.is_done,
                entered_by=user.email,
            )
            if item.estimate_value is not None:
                await EstimateAuditLog.create(
                    estimate=est,
                    action="set",
                    amount=item.estimate_value,
                    resulting_total=item.estimate_value,
                    entered_by=user.email,
                )
        saved += 1

    return {"data": EstimateSaveResponse(saved_count=saved)}


@router.get("/estimates/{variety_id}/audit-log")
async def get_estimate_audit_log(
    variety_id: UUID,
    week_start: date = Query(default_factory=_current_week_monday),
) -> dict:
    """Return audit log entries for a variety's estimates in a specific week."""
    estimates = await Estimate.filter(variety_id=variety_id, week_start=week_start)
    if not estimates:
        return {"data": []}
    estimate_ids = [e.id for e in estimates]
    entries = await EstimateAuditLog.filter(estimate_id__in=estimate_ids).order_by("-created_at").limit(20)
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
