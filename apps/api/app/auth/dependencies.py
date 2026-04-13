from fastapi import Depends, HTTPException, Request
from app.auth.permissions import has_permission
from app.auth.supabase import decode_supabase_jwt
from app.config import SUPABASE_JWT_SECRET
from app.models.user import User


async def get_current_user(request: Request) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    token = auth_header.split(" ", 1)[1]
    payload = decode_supabase_jwt(token, SUPABASE_JWT_SECRET)
    supabase_user_id = payload.get("sub")
    user = await User.filter(supabase_user_id=supabase_user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status == "deactivated":
        raise HTTPException(status_code=401, detail="Account deactivated")
    return user


def require_permission(area: str, action: str):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.role, area, action):
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' cannot {action} '{area}'",
            )
        return user
    return _check
