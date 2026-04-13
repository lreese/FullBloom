"""Pull day schedule endpoints — view and manage pull day configurations."""

from datetime import date, timedelta

import structlog
from fastapi import Depends, APIRouter, Query

logger = structlog.get_logger()

from app.models.inventory import PullDaySchedule
from app.schemas.inventory import (
    PullDayScheduleResponse,
    PullDayUpdateRequest,
)
from app.services.inventory_service import get_pull_dates

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["pull_days"], dependencies=[Depends(get_current_user)])


def _current_week_monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


@router.get("/pull-day-schedules")
async def get_pull_day_schedule(
    week_start: date = Query(default_factory=_current_week_monday),
    _user: User = Depends(require_permission("inventory_counts", "read")),
) -> dict:
    """Get the pull day schedule for a week (falls back to default)."""
    logger.info("get_pull_day_schedule", week_start=str(week_start))
    # Try specific week first, then default
    schedule = await PullDaySchedule.get_or_none(week_start=week_start)
    is_default = False
    if schedule is None:
        schedule = await PullDaySchedule.get_or_none(week_start=None)
        is_default = True

    if schedule is None:
        pull_day_numbers = [1, 3, 5]
        is_default = True
    else:
        pull_day_numbers = schedule.pull_days

    pull_dates = await get_pull_dates(week_start)

    return {
        "data": PullDayScheduleResponse(
            week_start=week_start if not is_default else None,
            pull_days=pull_day_numbers,
            pull_dates=pull_dates,
            is_default=is_default,
        )
    }


@router.put("/pull-day-schedules")
async def save_pull_day_schedule(body: PullDayUpdateRequest, user: User = Depends(require_permission("inventory_counts", "write"))) -> dict:
    """Save or update a pull day schedule."""
    logger.info("save_pull_day_schedule", week_start=str(body.week_start), pull_days=body.pull_days)
    schedule = await PullDaySchedule.get_or_none(week_start=body.week_start)
    if schedule:
        schedule.pull_days = body.pull_days
        await schedule.save()
    else:
        schedule = await PullDaySchedule.create(
            week_start=body.week_start,
            pull_days=body.pull_days,
        )

    # Calculate actual dates (only meaningful for specific weeks)
    if body.week_start:
        pull_dates = await get_pull_dates(body.week_start)
    else:
        # For default schedule, show dates for current week
        pull_dates = await get_pull_dates(_current_week_monday())

    return {
        "data": PullDayScheduleResponse(
            week_start=body.week_start,
            pull_days=schedule.pull_days,
            pull_dates=pull_dates,
            is_default=body.week_start is None,
        )
    }
