import time
import jwt
import pytest
from app.auth.supabase import decode_supabase_jwt

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


def _make_token(payload: dict, secret: str = TEST_JWT_SECRET) -> str:
    return jwt.encode(payload, secret, algorithm="HS256")


class TestDecodeSupabaseJWT:
    def test_valid_token(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
        payload = decode_supabase_jwt(token, TEST_JWT_SECRET)
        assert payload["sub"] == "user-uuid-123"

    def test_expired_token_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() - 100})
        with pytest.raises(Exception, match="expired"):
            decode_supabase_jwt(token, TEST_JWT_SECRET)

    def test_invalid_token_raises(self):
        with pytest.raises(Exception):
            decode_supabase_jwt("not-a-jwt", TEST_JWT_SECRET)

    def test_wrong_secret_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
        with pytest.raises(Exception):
            decode_supabase_jwt(token, "wrong-secret")
