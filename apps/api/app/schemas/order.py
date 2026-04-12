"""Pydantic schemas for order endpoints."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class OrderLineCreateRequest(BaseModel):
    sales_item_id: UUID
    assorted: bool = False
    color_variety: str | None = None
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    notes: str | None = None
    box_quantity: int | None = None
    bunches_per_box: int | None = None
    stems_per_bunch: int | None = None
    box_reference: str | None = None
    is_special: bool = False
    sleeve: str | None = None
    upc: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class OrderCreateRequest(BaseModel):
    customer_id: UUID
    order_date: date
    ship_via: str | None = None
    order_label: str | None = None
    freight_charge_included: bool = False
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    order_notes: str | None = None
    po_number: str | None = None
    salesperson_email: EmailStr | None = None
    force_duplicate: bool = False
    lines: list[OrderLineCreateRequest]

    @field_validator("lines")
    @classmethod
    def lines_must_not_be_empty(cls, v: list[OrderLineCreateRequest]) -> list[OrderLineCreateRequest]:
        if len(v) < 1:
            raise ValueError("order must have at least 1 line item")
        return v


class OrderLineSalesItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class OrderLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    line_number: int
    sales_item: OrderLineSalesItemResponse
    assorted: bool
    color_variety: str | None
    stems: int
    list_price_per_stem: str
    price_per_stem: str
    item_fee_pct: str | None
    item_fee_dollar: str | None
    effective_price_per_stem: str
    notes: str | None
    box_quantity: int | None
    bunches_per_box: int | None
    stems_per_bunch: int | None
    box_reference: str | None
    is_special: bool
    sleeve: str | None
    upc: str | None


class OrderCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    customer_id: str
    order_date: str
    lines_count: int
    created_at: str


class OrderCustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_number: int
    name: str


class OrderDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    customer: OrderCustomerResponse
    order_date: str
    ship_via: str | None
    price_list: str
    freight_charge_included: bool
    box_charge: str | None
    holiday_charge_pct: str | None
    special_charge: str | None
    freight_charge: str | None
    order_notes: str | None
    po_number: str | None
    salesperson_email: str | None
    order_label: str | None
    created_at: str
    updated_at: str
    lines: list[OrderLineResponse]


# --- Update schemas ---


class OrderLineUpdateRequest(BaseModel):
    id: UUID | None = None
    sales_item_id: UUID
    assorted: bool = False
    color_variety: str | None = None
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    notes: str | None = None
    box_quantity: int | None = None
    bunches_per_box: int | None = None
    stems_per_bunch: int | None = None
    box_reference: str | None = None
    is_special: bool = False
    sleeve: str | None = None
    upc: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class OrderUpdateRequest(BaseModel):
    order_date: date | None = None
    ship_via: str | None = None
    order_label: str | None = None
    freight_charge_included: bool | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    order_notes: str | None = None
    po_number: str | None = None
    salesperson_email: EmailStr | None = None
    lines: list[OrderLineUpdateRequest] | None = None


# --- List schemas ---


class OrderListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    customer_id: str
    customer_name: str
    order_date: str
    ship_via: str | None
    lines_count: int
    total_stems: int
    salesperson_email: str | None
    standing_order_id: str | None = None
    po_number: str | None = None
    created_at: str


class OrderListResponse(BaseModel):
    items: list[OrderListItemResponse]
    total: int
    offset: int
    limit: int


# --- Audit log schema ---


class OrderAuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    changes: list
    entered_by: str | None
    created_at: str
