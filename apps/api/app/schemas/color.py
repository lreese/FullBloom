"""Pydantic schemas for color endpoints."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ColorListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    hex_color: str | None
    is_active: bool


class ColorCreateRequest(BaseModel):
    name: str = Field(max_length=100)
    hex_color: str | None = Field(None, max_length=7)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class ColorUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=100)
    hex_color: str | None = Field(None, max_length=7)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None
