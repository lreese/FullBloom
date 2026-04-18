from fastapi import Depends, HTTPException, Request
from app.auth.permissions import has_permission
from app.auth.supabase import decode_supabase_jwt
from app.models.user import User

# Test hook: set to a PyJWKClient override for testing
_jwks_client_override = None


async def get_current_user(request: Request) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.split(" ", 1)[1]
    payload = decode_supabase_jwt(token, _jwks_client_override=_jwks_client_override)
    supabase_user_id = payload.get("sub")

    # Look up by supabase_user_id first
    user = await User.filter(supabase_user_id=supabase_user_id).first()

    if user is None:
        # Check for a pending invite by email
        # Extract email from JWT claims (Supabase includes it)
        email = payload.get("email")
        if email:
            user = await User.filter(email=email, status="pending").first()
            if user:
                # Link the pending invite to this Supabase user
                user.supabase_user_id = supabase_user_id
                # user.status will be set to 'active' below

        if user is None:
            raise HTTPException(status_code=401, detail="User not found. Contact your administrator for an invitation.")

    # Auto-activate pending users
    if user.status == "pending":
        user.status = "active"
        # Try to get metadata from JWT
        user_metadata = payload.get("user_metadata", {})
        if user_metadata.get("avatar_url"):
            user.avatar_url = user_metadata["avatar_url"]
        if user_metadata.get("full_name") and not user.display_name:
            user.display_name = user_metadata["full_name"]
        await user.save()

    if user.status != "active":
        raise HTTPException(status_code=401, detail="Account not active")

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
