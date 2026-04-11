"""Pydantic schemas for product line endpoints."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductLineListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_type_id: str
    product_type_name: str
    is_active: bool
    variety_count: int


class ProductLineCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    product_type_id: UUID

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class ProductLineUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)
    product_type_id: UUID | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None
