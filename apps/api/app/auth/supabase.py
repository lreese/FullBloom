import jwt
from jwt import PyJWKClient
from fastapi import HTTPException
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_admin_client: Client | None = None
_jwks_client: PyJWKClient | None = None


def get_supabase_admin() -> Client:
    """Get a Supabase client with admin (service role) privileges."""
    global _admin_client
    if _admin_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _admin_client


def _get_jwks_client() -> PyJWKClient:
    """Get a cached JWKS client that fetches public keys from Supabase."""
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL must be set for JWKS verification")
        jwks_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def decode_supabase_jwt(token: str, _jwks_client_override: PyJWKClient | None = None) -> dict:
    """Decode and validate a Supabase JWT using JWKS (RS256).

    Args:
        token: The JWT to decode.
        _jwks_client_override: Optional override for testing. If not provided,
            uses the production JWKS client that fetches keys from Supabase.
    """
    try:
        client = _jwks_client_override or _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            options={"require": ["sub", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")
