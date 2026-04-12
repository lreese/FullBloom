"""Inventory service — calculation helpers for counts, estimates, and sanity checks."""

from datetime import date, timedelta
from uuid import UUID

from app.models.inventory import DailyCount, PullDaySchedule


def calculate_10_stem_equivalent(bunch_count: int, bunch_size: int) -> int:
    """Convert a bunch count to 10-stem equivalent."""
    return round(bunch_count * bunch_size / 10)


async def get_sanity_check_data(variety_id: UUID) -> list[int]:
    """Return last 5 non-null count values for a variety, most recent first."""
    rows = (
        await DailyCount.filter(variety_id=variety_id, count_value__isnull=False)
        .order_by("-count_date")
        .limit(5)
        .values_list("count_value", flat=True)
    )
    return list(rows)


def check_sanity(value: int, recent_values: list[int]) -> dict | None:
    """Check if a value is anomalous relative to recent history.

    Returns a warning dict if value > 5x or < 0.2x the average of
    recent_values, or None if everything looks fine.
    Requires at least 3 data points to make a judgement.
    """
    if len(recent_values) < 3:
        return None
    avg = sum(recent_values) / len(recent_values)
    if avg == 0:
        return None
    ratio = value / avg
    if ratio > 5 or ratio < 0.2:
        return {"warning": f"~{round(ratio)}x avg", "average": round(avg)}
    return None


async def get_pull_dates(week_start: date) -> list[date]:
    """Convert pull day numbers to actual dates for the given week.

    Looks up PullDaySchedule for the specific week first, then falls
    back to the default schedule (week_start is None).  Day numbers:
    1=Mon, 2=Tue, ..., 7=Sun.
    """
    schedule = await PullDaySchedule.get_or_none(week_start=week_start)
    if schedule is None:
        schedule = await PullDaySchedule.get_or_none(week_start=None)
    if schedule is None:
        # Hard default: Mon, Wed, Fri
        pull_day_numbers = [1, 3, 5]
    else:
        pull_day_numbers = schedule.pull_days

    # week_start is Monday (isoweekday=1), so day N is week_start + (N-1)
    return [week_start + timedelta(days=d - 1) for d in sorted(pull_day_numbers)]
