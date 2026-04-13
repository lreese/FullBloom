"""Profile router — /api/v1/profile endpoints (self-service)."""

import re
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.permissions import PERMISSIONS
from app.models.user import User
from app.schemas.user import UpdateProfileRequest, UserWithPermissionsResponse

def _strip_html(value: str) -> str:
    return re.sub(r'<[^>]+>', '', value)


profile_router = APIRouter(
    prefix="/api/v1/profile",
    tags=["profile"],
    dependencies=[Depends(get_current_user)],
)


@profile_router.get("")
async def get_profile(user: User = Depends(get_current_user)) -> dict:
    permissions = PERMISSIONS.get(user.role, {})
    return {
        "data": UserWithPermissionsResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            permissions=permissions,
        ).model_dump()
    }


@profile_router.put("")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
) -> dict:
    if body.display_name is not None:
        user.display_name = _strip_html(body.display_name.strip())
    if body.phone is not None:
        user.phone = _strip_html(body.phone.strip())
    await user.save()
    permissions = PERMISSIONS.get(user.role, {})
    return {
        "data": UserWithPermissionsResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            permissions=permissions,
        ).model_dump()
    }
