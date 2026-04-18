"""Auth router — /api/v1/auth endpoints."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, require_permission
from app.auth.permissions import PERMISSIONS
from app.models.user import User
from app.schemas.user import UserWithPermissionsResponse

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
    dependencies=[Depends(get_current_user)],
)

AREA_LABELS = {
    "users": "User Management",
    "orders": "Orders & Standing Orders",
    "customers": "Customers",
    "inventory_counts": "Inventory (Counts, Estimates)",
    "inventory_harvest": "Inventory (Harvest Status)",
    "inventory_availability": "Inventory (Availability, Comparison)",
    "products": "Products",
    "pricing": "Pricing",
    "import": "Import",
}


@auth_router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
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
            created_at=user.created_at,
            permissions=permissions,
        ).model_dump()
    }


@auth_router.get("/permissions")
async def get_permissions(_user: User = Depends(require_permission("users", "read"))) -> dict:
    return {
        "data": {
            "roles": list(PERMISSIONS.keys()),
            "areas": [{"key": key, "label": label} for key, label in AREA_LABELS.items()],
            "matrix": PERMISSIONS,
        }
    }
