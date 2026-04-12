"""Comparison endpoint — estimate vs actual variance analysis."""

from datetime import date
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query

logger = structlog.get_logger()

from app.models.inventory import DailyCount, Estimate
from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    ComparisonDayData,
    ComparisonProductLineResponse,
    ComparisonResponse,
    ComparisonSummary,
    ComparisonVarietyResponse,
)
from app.services.inventory_service import get_pull_dates

router = APIRouter(prefix="/api/v1", tags=["comparison"])


@router.get("/counts/comparison")
async def get_comparison(
    product_type_id: UUID = Query(...),
    week_start: date = Query(...),
) -> dict:
    """Get estimate vs actual comparison for a week."""
    logger.info("get_comparison", product_type_id=str(product_type_id), week_start=str(week_start))
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

    variety_ids = [v.id for v in varieties]

    # Fetch estimates and actuals
    estimates = await Estimate.filter(
        product_type_id=product_type_id,
        week_start=week_start,
        variety_id__in=variety_ids,
    )
    est_map: dict[str, int | None] = {}
    for e in estimates:
        est_map[f"{e.variety_id}|{e.pull_day.isoformat()}"] = e.estimate_value

    actuals = await DailyCount.filter(
        product_type_id=product_type_id,
        count_date__in=pull_days,
        variety_id__in=variety_ids,
    )
    act_map: dict[str, int | None] = {}
    for dc in actuals:
        act_map[f"{dc.variety_id}|{dc.count_date.isoformat()}"] = dc.count_value

    # Build response, compute totals
    total_estimated = 0
    total_actual = 0
    pl_map: dict[str, list[ComparisonVarietyResponse]] = {}
    pl_names: dict[str, str] = {}

    for v in varieties:
        pl_id = str(v.product_line_id)
        pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]

        days: dict[str, ComparisonDayData] = {}
        for pd in pull_days:
            key = f"{v.id}|{pd.isoformat()}"
            est_val = est_map.get(key)
            act_val = act_map.get(key)
            variance = None
            if est_val is not None and act_val is not None:
                variance = act_val - est_val
            days[pd.isoformat()] = ComparisonDayData(
                estimate=est_val, actual=act_val, variance=variance
            )
            if est_val is not None:
                total_estimated += est_val
            if act_val is not None:
                total_actual += act_val

        item = ComparisonVarietyResponse(
            variety_name=v.name,
            days=days,
        )
        pl_map.setdefault(pl_id, []).append(item)

    product_lines = [
        ComparisonProductLineResponse(
            product_line_name=pl_names[pl_id],
            varieties=vars_list,
        )
        for pl_id, vars_list in pl_map.items()
    ]

    variance_pct = None
    if total_estimated > 0:
        variance_pct = round((total_actual - total_estimated) / total_estimated * 100, 1)

    return {
        "data": ComparisonResponse(
            week_start=week_start,
            pull_days=pull_days,
            product_lines=product_lines,
            summary=ComparisonSummary(
                total_estimated=total_estimated,
                total_actual=total_actual,
                variance_pct=variance_pct,
            ),
        )
    }
