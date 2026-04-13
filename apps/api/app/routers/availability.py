"""Availability endpoint — read-only sales view of current inventory."""

from datetime import date
from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, Query

logger = structlog.get_logger()

from app.models.inventory import DailyCount, Estimate, SheetCompletion
from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    AvailabilityProductLine,
    AvailabilityProductType,
    AvailabilityResponse,
    AvailabilityVariety,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["availability"], dependencies=[Depends(get_current_user)])


@router.get("/availability")
async def get_availability(
    query_date: date = Query(default_factory=date.today, alias="date"),
    _user: User = Depends(require_permission("inventory_availability", "read")),
) -> dict:
    """Return availability across all product types for a given date."""
    logger.info("get_availability", date=str(query_date))
    product_types = await ProductType.filter(is_active=True).order_by("name")

    result_pts: list[AvailabilityProductType] = []
    for pt in product_types:
        # Get in-harvest, active varieties
        varieties = (
            await Variety.filter(
                product_line__product_type_id=pt.id,
                in_harvest=True,
                is_active=True,
            )
            .prefetch_related("product_line", "color")
            .order_by("product_line__name", "name")
        )
        if not varieties:
            continue

        variety_ids = [v.id for v in varieties]

        # Check for actual daily counts
        daily_counts = await DailyCount.filter(
            product_type_id=pt.id,
            count_date=query_date,
            variety_id__in=variety_ids,
        )
        dc_map = {str(dc.variety_id): dc.count_value for dc in daily_counts}

        # Check for estimates (find most recent week that covers this date)
        estimates = await Estimate.filter(
            product_type_id=pt.id,
            pull_day=query_date,
            variety_id__in=variety_ids,
        )
        est_map = {str(e.variety_id): e.estimate_value for e in estimates}

        # Determine data source
        has_counts = len(daily_counts) > 0
        data_source = "actual_counts" if has_counts else "estimates_only"

        # Sheet completion info
        completion = await SheetCompletion.get_or_none(
            product_type_id=pt.id,
            sheet_type="daily_count",
            sheet_date=query_date,
        )

        # Group by product line
        pl_map: dict[str, list[AvailabilityVariety]] = {}
        pl_names: dict[str, str] = {}
        for v in varieties:
            pl_id = str(v.product_line_id)
            pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]
            item = AvailabilityVariety(
                variety_name=v.name,
                color_hex=v.color.hex_color if v.color_id else None,
                remaining_count=dc_map.get(str(v.id)),
                estimate=est_map.get(str(v.id)),
            )
            pl_map.setdefault(pl_id, []).append(item)

        product_lines = [
            AvailabilityProductLine(
                product_line_name=pl_names[pl_id],
                varieties=vars_list,
            )
            for pl_id, vars_list in pl_map.items()
        ]

        result_pts.append(
            AvailabilityProductType(
                product_type_id=str(pt.id),
                product_type_name=pt.name,
                data_source=data_source,
                counts_completed_at=completion.completed_at if completion and completion.is_complete else None,
                counts_completed_by=completion.completed_by if completion and completion.is_complete else None,
                product_lines=product_lines,
            )
        )

    return {
        "data": AvailabilityResponse(
            date=query_date,
            product_types=result_pts,
        )
    }
