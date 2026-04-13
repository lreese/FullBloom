import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    phone: str | None
    avatar_url: str | None
    role: str
    status: str
    created_at: datetime


class UserWithPermissionsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    phone: str | None
    avatar_url: str | None
    role: str
    status: str
    permissions: dict[str, str]


RoleType = Literal["admin", "salesperson", "data_manager", "field_worker"]


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: RoleType


class ChangeRoleRequest(BaseModel):
    role: RoleType


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        digits = re.sub(r'\D', '', v)
        if len(digits) != 10:
            raise ValueError("Phone number must contain exactly 10 digits")
        return v
