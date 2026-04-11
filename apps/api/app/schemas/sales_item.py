"""Pydantic schemas for sales item endpoints."""

from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SalesItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    stems_per_order: int
    retail_price: str
    cost_price: str | None
    is_active: bool
    customer_prices_count: int
    price_list_prices: dict[str, str]  # price_list_id -> price


class SalesItemCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    stems_per_order: int = Field(gt=0)
    retail_price: str
    cost_price: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @field_validator("retail_price")
    @classmethod
    def retail_price_is_numeric(cls, v: str) -> str:
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Retail price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Retail price must be a valid number")

    @field_validator("cost_price")
    @classmethod
    def cost_price_is_numeric(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Cost price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Cost price must be a valid number")


class SalesItemUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)
    stems_per_order: int | None = Field(None, gt=0)
    retail_price: str | None = None
    cost_price: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None

    @field_validator("retail_price")
    @classmethod
    def retail_price_is_numeric(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Retail price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Retail price must be a valid number")

    @field_validator("cost_price")
    @classmethod
    def cost_price_is_numeric(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.replace("$", "").replace(",", "").strip()
        try:
            d = Decimal(cleaned)
            if d < 0:
                raise ValueError("Cost price cannot be negative")
            return str(d)
        except InvalidOperation:
            raise ValueError("Cost price must be a valid number")
