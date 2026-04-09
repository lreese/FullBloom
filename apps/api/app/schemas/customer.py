"""Pydantic schemas for customer endpoints."""

from pydantic import BaseModel, ConfigDict


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: int
    name: str
    price_type: str
    is_active: bool
    stores: list[StoreResponse]


class CustomerListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: int
    name: str
    price_type: str
    is_active: bool
