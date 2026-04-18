"""Users router — /api/v1/users endpoints (admin CRUD)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user, require_permission
from app.auth.supabase import get_supabase_admin
from app.models.user import User
from app.schemas.user import ChangeRoleRequest, InviteUserRequest, UserResponse

users_router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)


@users_router.get("")
async def list_users(_user: User = Depends(require_permission("users", "read"))) -> dict:
    users = await User.all().order_by("-created_at")
    return {"data": [UserResponse.model_validate(u).model_dump() for u in users]}


@users_router.post("/invite", status_code=201)
async def invite_user(
    body: InviteUserRequest,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    existing = await User.filter(email=body.email).first()
    if existing:
        raise HTTPException(status_code=422, detail="Email already exists")

    # Call Supabase Admin API to invite the user
    try:
        admin = get_supabase_admin()
        result = admin.auth.admin.invite_user_by_email(body.email)
        supabase_user_id = result.user.id
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send invitation: {e}")

    # Create local user record with the real Supabase UUID
    user = await User.create(
        supabase_user_id=str(supabase_user_id),
        email=body.email,
        role=body.role,
        status="pending",
    )
    return {"data": UserResponse.model_validate(user).model_dump()}


# IMPORTANT: /salespeople must be defined BEFORE /{user_id}/role to prevent FastAPI
# from trying to parse the literal string "salespeople" as a UUID.
@users_router.get("/salespeople")
async def list_salespeople(
    _user: User = Depends(require_permission("orders", "read")),
) -> dict:
    salespeople = await User.filter(
        role__in=["salesperson", "admin"], status="active"
    ).order_by("email")
    return {
        "data": [
            {"id": str(u.id), "email": u.email, "display_name": u.display_name}
            for u in salespeople
        ]
    }


@users_router.put("/{user_id}/role")
async def change_role(
    user_id: UUID,
    body: ChangeRoleRequest,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.role = body.role
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}


@users_router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: UUID,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == _user.id:
        raise HTTPException(status_code=409, detail="Cannot deactivate yourself")
    if target.role == "admin":
        # A pending admin can still log in and become active, so they are part of the 'live' pool.
        live_admin_count = await User.filter(role="admin", status__in=["active", "pending"]).count()
        if live_admin_count <= 1:
            raise HTTPException(
                status_code=409, detail="Cannot deactivate the last administrator"
            )
    target.status = "deactivated"
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}


@users_router.post("/{user_id}/reactivate")
async def reactivate_user(
    user_id: UUID,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.status = "active"
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}
