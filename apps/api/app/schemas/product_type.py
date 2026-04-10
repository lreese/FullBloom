"""Pydantic schemas for product type endpoints."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductTypeListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    is_active: bool
    product_line_count: int


class ProductTypeCreateRequest(BaseModel):
    name: str = Field(max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class ProductTypeUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None
