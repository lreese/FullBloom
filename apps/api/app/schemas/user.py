from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.auth.permissions import VALID_ROLES


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


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str

    def model_post_init(self, __context: object) -> None:
        if self.role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")


class ChangeRoleRequest(BaseModel):
    role: str

    def model_post_init(self, __context: object) -> None:
        if self.role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    phone: str | None = None
