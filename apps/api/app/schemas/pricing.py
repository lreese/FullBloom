"""Pydantic schemas for pricing endpoints."""

from pydantic import BaseModel, ConfigDict


class CustomerPricingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sales_item_id: str
    sales_item_name: str
    stems_per_order: int
    customer_price: str
    retail_price: str
    is_custom: bool
