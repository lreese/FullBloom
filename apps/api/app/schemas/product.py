"""Pydantic schemas for variety endpoints."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VarietyListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_line_id: str
    product_line_name: str
    product_type_name: str
    color_id: str | None
    color_name: str | None
    hex_color: str | None
    flowering_type: str | None
    can_replace: bool
    show: bool
    is_active: bool
    weekly_sales_category: str | None
    item_group_id: int | None
    item_group_description: str | None
    sales_items_count: int


class SalesItemDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    stems_per_order: int
    retail_price: str
    is_active: bool
    customer_prices_count: int


class VarietyDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_line_id: str
    product_line_name: str
    product_type_name: str
    color_id: str | None
    color_name: str | None
    hex_color: str | None
    flowering_type: str | None
    can_replace: bool
    show: bool
    is_active: bool
    weekly_sales_category: str | None
    item_group_id: int | None
    item_group_description: str | None
    sales_items: list[SalesItemDetailResponse]


class VarietyCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    product_line_id: UUID
    color_id: UUID | None = None
    flowering_type: str | None = Field(None, max_length=50)
    can_replace: bool = False
    show: bool = True
    weekly_sales_category: str | None = Field(None, max_length=100)
    item_group_id: int | None = None
    item_group_description: str | None = Field(None, max_length=255)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class VarietyUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)
    product_line_id: UUID | None = None
    color_id: UUID | None = None
    flowering_type: str | None = Field(None, max_length=50)
    can_replace: bool | None = None
    show: bool | None = None
    weekly_sales_category: str | None = Field(None, max_length=100)
    item_group_id: int | None = None
    item_group_description: str | None = Field(None, max_length=255)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None


class BulkUpdateRequest(BaseModel):
    ids: list[UUID]
    field: str
    value: str | bool | None


class ProductLineOption(BaseModel):
    id: str
    name: str
    product_type: str


class ColorOption(BaseModel):
    id: str
    name: str


class VarietyDropdownOptionsResponse(BaseModel):
    product_lines: list[ProductLineOption]
    colors: list[ColorOption]
    flowering_types: list[str]
    weekly_sales_categories: list[str]
