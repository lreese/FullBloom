"""Pydantic schemas for sales item endpoints."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SalesItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    stems_per_order: int
    retail_price: str
    is_active: bool
    customer_prices_count: int


class SalesItemCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    stems_per_order: int = Field(gt=0)
    retail_price: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class SalesItemUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)
    stems_per_order: int | None = Field(None, gt=0)
    retail_price: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None
