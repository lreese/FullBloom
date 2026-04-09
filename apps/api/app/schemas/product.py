"""Pydantic schemas for product endpoints."""

from pydantic import BaseModel, ConfigDict


class SalesItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    stems_per_order: int
    retail_price: str


class VarietyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    product_line: str
    name: str
    color: str | None
    hex_color: str | None
    flowering_type: str | None
    show: bool
    sales_items: list[SalesItemResponse]
