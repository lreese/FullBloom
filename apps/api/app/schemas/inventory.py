"""Pydantic schemas for inventory endpoints."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Daily Counts
# ---------------------------------------------------------------------------


class CountItem(BaseModel):
    variety_id: UUID
    count_value: int | None = None
    is_done: bool = False


class CountSaveRequest(BaseModel):
    product_type_id: UUID
    count_date: date
    entered_by: str | None = None
    counts: list[CountItem]


class CountVarietyResponse(BaseModel):
    variety_id: str
    variety_name: str
    count_value: int | None
    is_done: bool
    entered_by: str | None
    updated_at: datetime | None = None


class CountProductLineResponse(BaseModel):
    product_line_id: str
    product_line_name: str
    varieties: list[CountVarietyResponse]


class CountSheetResponse(BaseModel):
    count_date: date
    product_type_id: str
    product_type_name: str
    sheet_complete: bool
    completed_by: str | None = None
    completed_at: datetime | None = None
    product_lines: list[CountProductLineResponse]


class CountSaveResponse(BaseModel):
    saved_count: int


class RecentCountItem(BaseModel):
    count_date: date
    count_value: int | None


# ---------------------------------------------------------------------------
# Customer Counts
# ---------------------------------------------------------------------------


class CustomerCountItem(BaseModel):
    variety_id: UUID
    customer_id: UUID
    bunch_size: int
    sleeve_type: str
    bunch_count: int | None = None
    is_done: bool = False


class CustomerCountSaveRequest(BaseModel):
    product_type_id: UUID
    count_date: date
    entered_by: str | None = None
    counts: list[CustomerCountItem]


class TemplateColumn(BaseModel):
    customer_id: str
    customer_name: str
    bunch_size: int
    sleeve_type: str


class CustomerCountVarietyResponse(BaseModel):
    variety_id: str
    variety_name: str
    is_done: bool
    counts: dict[str, int | None]


class CustomerCountProductLineResponse(BaseModel):
    product_line_id: str
    product_line_name: str
    varieties: list[CustomerCountVarietyResponse]
    totals: dict[str, int]


class CustomerCountSheetResponse(BaseModel):
    count_date: date
    product_type_id: str
    product_type_name: str
    sheet_complete: bool
    template_columns: list[TemplateColumn]
    product_lines: list[CustomerCountProductLineResponse]
    grand_totals: dict[str, int]


class CustomerCountSaveResponse(BaseModel):
    saved_count: int


# ---------------------------------------------------------------------------
# Estimates
# ---------------------------------------------------------------------------


class EstimateItem(BaseModel):
    variety_id: UUID
    pull_day: date
    estimate_value: int | None = None
    is_done: bool = False


class EstimateSaveRequest(BaseModel):
    product_type_id: UUID
    week_start: date
    entered_by: str | None = None
    estimates: list[EstimateItem]


class EstimateVarietyResponse(BaseModel):
    variety_id: str
    variety_name: str
    estimates: dict[str, int | None]
    is_done: bool


class EstimateProductLineResponse(BaseModel):
    product_line_id: str
    product_line_name: str
    varieties: list[EstimateVarietyResponse]


class EstimateSheetResponse(BaseModel):
    week_start: date
    product_type_id: str
    product_type_name: str
    sheet_complete: bool
    pull_days: list[date]
    last_week_actuals: dict[str, dict[str, int | None]]
    product_lines: list[EstimateProductLineResponse]


class EstimateSaveResponse(BaseModel):
    saved_count: int


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------


class ComparisonDayData(BaseModel):
    estimate: int | None
    actual: int | None
    variance: int | None


class ComparisonVarietyResponse(BaseModel):
    variety_name: str
    days: dict[str, ComparisonDayData]


class ComparisonProductLineResponse(BaseModel):
    product_line_name: str
    varieties: list[ComparisonVarietyResponse]


class ComparisonSummary(BaseModel):
    total_estimated: int
    total_actual: int
    variance_pct: float | None


class ComparisonResponse(BaseModel):
    week_start: date
    pull_days: list[date]
    product_lines: list[ComparisonProductLineResponse]
    summary: ComparisonSummary


# ---------------------------------------------------------------------------
# Availability
# ---------------------------------------------------------------------------


class AvailabilityVariety(BaseModel):
    variety_name: str
    remaining_count: int | None
    estimate: int | None


class AvailabilityProductLine(BaseModel):
    product_line_name: str
    varieties: list[AvailabilityVariety]


class AvailabilityProductType(BaseModel):
    product_type_id: str
    product_type_name: str
    data_source: str
    counts_completed_at: datetime | None = None
    counts_completed_by: str | None = None
    product_lines: list[AvailabilityProductLine]


class AvailabilityResponse(BaseModel):
    date: date
    product_types: list[AvailabilityProductType]


# ---------------------------------------------------------------------------
# Sheet Completion
# ---------------------------------------------------------------------------


class SheetCompleteRequest(BaseModel):
    product_type_id: UUID
    sheet_type: str
    sheet_date: date
    completed_by: str | None = None


class SheetCompleteResponse(BaseModel):
    is_complete: bool
    completed_by: str | None = None
    completed_at: datetime | None = None


# ---------------------------------------------------------------------------
# Harvest Status
# ---------------------------------------------------------------------------


class HarvestStatusItem(BaseModel):
    variety_id: str
    variety_name: str
    product_line_name: str
    in_harvest: bool
    stems_per_bunch: int


class HarvestStatusUpdateItem(BaseModel):
    variety_id: UUID
    in_harvest: bool


class HarvestStatusUpdateRequest(BaseModel):
    updates: list[HarvestStatusUpdateItem]


class HarvestStatusUpdateResponse(BaseModel):
    updated_count: int


# ---------------------------------------------------------------------------
# Count Sheet Templates
# ---------------------------------------------------------------------------


class TemplateColumnInput(BaseModel):
    customer_id: UUID
    bunch_size: int
    sleeve_type: str


class TemplateUpdateRequest(BaseModel):
    columns: list[TemplateColumnInput]


class TemplateResponse(BaseModel):
    product_type_id: str
    columns: list[TemplateColumn]


# ---------------------------------------------------------------------------
# Pull Day Schedules
# ---------------------------------------------------------------------------


class PullDayUpdateRequest(BaseModel):
    week_start: date | None = None
    pull_days: list[int]


class PullDayScheduleResponse(BaseModel):
    week_start: date | None
    pull_days: list[int]
    pull_dates: list[date]
    is_default: bool
