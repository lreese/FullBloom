"""Pydantic schemas for variety color endpoints."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VarietyColorListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    variety_id: str
    variety_name: str
    color_name: str
    is_active: bool


class VarietyColorCreateRequest(BaseModel):
    variety_id: UUID
    color_name: str = Field(max_length=100)

    @field_validator("color_name")
    @classmethod
    def color_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Color name cannot be empty")
        return v.strip()


class VarietyColorUpdateRequest(BaseModel):
    color_name: str | None = Field(None, max_length=100)

    @field_validator("color_name")
    @classmethod
    def color_name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Color name cannot be empty")
        return v.strip() if v is not None else None
