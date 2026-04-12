"""Pydantic schemas for standing order endpoints."""

from datetime import date
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator, model_validator

StandingOrderStatus = Literal["active", "paused", "cancelled"]


class StandingOrderLineCreateRequest(BaseModel):
    sales_item_id: UUID
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    color_variety: str | None = None  # max 100 chars enforced by model
    notes: str | None = None

    @field_validator("color_variety")
    @classmethod
    def color_variety_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 100:
            raise ValueError("color_variety must be 100 characters or fewer")
        return v

    @field_validator("notes")
    @classmethod
    def notes_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 2000:
            raise ValueError("notes must be 2000 characters or fewer")
        return v

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class StandingOrderCreateRequest(BaseModel):
    customer_id: UUID
    frequency_weeks: int
    days_of_week: list[int]
    reference_date: date
    ship_via: str | None = None
    salesperson_email: EmailStr | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    freight_charge_included: bool = False
    notes: str | None = None
    lines: list[StandingOrderLineCreateRequest]

    @field_validator("frequency_weeks")
    @classmethod
    def frequency_must_be_valid(cls, v: int) -> int:
        if v not in (1, 2, 4):
            raise ValueError("frequency_weeks must be 1, 2, or 4")
        return v

    @field_validator("days_of_week")
    @classmethod
    def days_must_be_valid(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("at least one day of week is required")
        if not all(0 <= d <= 6 for d in v):
            raise ValueError("days_of_week must be integers 0-6 (Mon-Sun)")
        return sorted(set(v))

    @field_validator("lines")
    @classmethod
    def lines_must_not_be_empty(cls, v: list) -> list:
        if len(v) < 1:
            raise ValueError("standing order must have at least 1 line item")
        return v


class StandingOrderLineUpdateRequest(BaseModel):
    id: UUID | None = None
    sales_item_id: UUID
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    color_variety: str | None = None
    notes: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class StandingOrderUpdateRequest(BaseModel):
    frequency_weeks: int | None = None
    days_of_week: list[int] | None = None
    reference_date: date | None = None
    ship_via: str | None = None
    salesperson_email: EmailStr | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    freight_charge_included: bool | None = None
    notes: str | None = None
    reason: str  # required for updates
    apply_to_future_orders: bool = False

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("reason cannot be blank")
        return v
    lines: list[StandingOrderLineUpdateRequest] | None = None

    @field_validator("frequency_weeks")
    @classmethod
    def frequency_must_be_valid(cls, v: int | None) -> int | None:
        if v is not None and v not in (1, 2, 4):
            raise ValueError("frequency_weeks must be 1, 2, or 4")
        return v

    @field_validator("days_of_week")
    @classmethod
    def days_must_be_valid(cls, v: list[int] | None) -> list[int] | None:
        if v is not None:
            if not v:
                raise ValueError("at least one day of week is required")
            if not all(0 <= d <= 6 for d in v):
                raise ValueError("days_of_week must be integers 0-6")
            return sorted(set(v))
        return v


class StatusChangeRequest(BaseModel):
    reason: str | None = None


class StatusChangeWithReasonRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("reason cannot be blank")
        return v


class GeneratePreviewRequest(BaseModel):
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        if (self.date_to - self.date_from).days > 90:
            raise ValueError("date range cannot exceed 90 days")
        return self


class GenerateRequest(BaseModel):
    date_from: date
    date_to: date
    skip_already_generated: bool = True
    standing_order_ids: list[UUID] | None = None  # if provided, only generate for these

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        if (self.date_to - self.date_from).days > 90:
            raise ValueError("date range cannot exceed 90 days")
        return self


# --- Response schemas ---


class StandingOrderLineResponse(BaseModel):
    id: str
    line_number: int
    sales_item_id: str
    sales_item_name: str
    stems: int
    price_per_stem: str
    item_fee_pct: str | None
    item_fee_dollar: str | None
    color_variety: str | None
    notes: str | None


class StandingOrderCreateResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: StandingOrderStatus
    frequency_weeks: int
    days_of_week: list[int]
    reference_date: str
    lines_count: int
    created_at: str


class StandingOrderDetailResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: StandingOrderStatus
    frequency_weeks: int
    days_of_week: list[int]
    days_of_week_names: list[str]
    reference_date: str
    cadence_description: str
    ship_via: str | None
    salesperson_email: str | None
    box_charge: str | None
    holiday_charge_pct: str | None
    special_charge: str | None
    freight_charge: str | None
    freight_charge_included: bool
    notes: str | None
    created_at: str
    updated_at: str
    lines: list[StandingOrderLineResponse]


class StandingOrderListItemResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: StandingOrderStatus
    frequency_weeks: int
    days_of_week: list[int]
    cadence_description: str
    lines_count: int
    total_stems: int
    salesperson_email: str | None
    updated_at: str


class GeneratePreviewMatch(BaseModel):
    standing_order_id: str
    customer_name: str
    cadence_description: str
    generate_date: str
    lines_count: int
    total_stems: int
    already_generated: bool


class GeneratePreviewResponse(BaseModel):
    date_from: str
    date_to: str
    matches: list[GeneratePreviewMatch]


class GenerateResponse(BaseModel):
    orders_created: int
    orders_skipped: int
    order_ids: list[str]


class StandingOrderAuditLogResponse(BaseModel):
    id: str
    action: str
    reason: str | None
    changes: list
    entered_by: str | None
    created_at: str
