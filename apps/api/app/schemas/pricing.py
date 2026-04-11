"""Pydantic schemas for pricing endpoints."""

from decimal import Decimal, InvalidOperation
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Price List
# ---------------------------------------------------------------------------


class PriceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    is_active: bool
    customer_count: int


class PriceListCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    copy_from: UUID | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class PriceListUpdateRequest(BaseModel):
    name: str = Field(max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


# ---------------------------------------------------------------------------
# Price List Items / Matrix
# ---------------------------------------------------------------------------


class PriceListItemUpdateRequest(BaseModel):
    """Request body for updating a single price list item cell."""
    price: str

    @field_validator("price")
    @classmethod
    def price_is_numeric(cls, v: str) -> str:
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Price must be a valid number")


class RetailPriceUpdateRequest(BaseModel):
    """Request body for updating the retail price of a sales item."""
    sales_item_id: UUID
    price: str

    @field_validator("price")
    @classmethod
    def price_is_numeric(cls, v: str) -> str:
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Price must be a valid number")


class PriceListItemResponse(BaseModel):
    price_list_id: str
    sales_item_id: str
    price: str


class PriceListMatrixItem(BaseModel):
    sales_item_id: str
    sales_item_name: str
    variety_name: str
    stems_per_order: int
    retail_price: str
    prices: dict[str, str]  # price_list_id -> price


class PriceListMatrixResponse(BaseModel):
    price_lists: list[PriceListResponse]
    items: list[PriceListMatrixItem]


# ---------------------------------------------------------------------------
# Customer Pricing
# ---------------------------------------------------------------------------


class CustomerPricingItem(BaseModel):
    sales_item_id: str
    sales_item_name: str
    variety_name: str
    stems_per_order: int
    retail_price: str
    price_list_price: str | None
    customer_override: str | None
    effective_price: str
    source: str  # "override" | "price_list" | "retail"
    anomaly: bool


class CustomerPricingSummary(BaseModel):
    total_items: int
    override_count: int
    override_percentage: float


class CustomerPricingCustomer(BaseModel):
    id: str
    name: str
    price_list_id: str | None
    price_list_name: str | None


class CustomerPricingResponse(BaseModel):
    customer: CustomerPricingCustomer
    items: list[CustomerPricingItem]
    summary: CustomerPricingSummary


# ---------------------------------------------------------------------------
# Item Pricing (item-centric view)
# ---------------------------------------------------------------------------


class ItemPricingCustomer(BaseModel):
    customer_id: str
    customer_name: str
    price_list_name: str | None
    price_list_price: str | None
    customer_override: str | None
    effective_price: str
    source: str
    anomaly: bool


class ItemPricingSalesItem(BaseModel):
    id: str
    name: str
    retail_price: str


class ItemPricingResponse(BaseModel):
    sales_item: ItemPricingSalesItem
    customers: list[ItemPricingCustomer]


# ---------------------------------------------------------------------------
# Customer Price Override Requests
# ---------------------------------------------------------------------------


class CustomerPriceCreateRequest(BaseModel):
    sales_item_id: UUID
    price: str

    @field_validator("price")
    @classmethod
    def price_is_numeric(cls, v: str) -> str:
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Price must be a valid number")


class BulkCustomerPriceRequest(BaseModel):
    action: Literal["set_price", "remove_overrides", "reset_to_list"]
    sales_item_ids: list[UUID] = Field(max_length=1000)
    price: str | None = None

    @field_validator("price")
    @classmethod
    def price_is_numeric(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Price must be a valid number")


# ---------------------------------------------------------------------------
# Bulk Price List Item Request
# ---------------------------------------------------------------------------


class BulkPriceListItemRequest(BaseModel):
    price_list_id: UUID
    sales_item_ids: list[UUID] = Field(max_length=1000)
    price: str

    @field_validator("price")
    @classmethod
    def price_is_numeric(cls, v: str) -> str:
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Price must be a valid number")


# ---------------------------------------------------------------------------
# Impact Preview
# ---------------------------------------------------------------------------


class ImpactPreviewResponse(BaseModel):
    customers_on_list: int
    customers_with_overrides: int
    customers_affected: int
    current_price: str
    new_price: str
