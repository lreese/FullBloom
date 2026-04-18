import json
import time

import jwt
import pytest
from fastapi import HTTPException
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWK

from app.auth.supabase import decode_supabase_jwt
from tests.conftest import TEST_PRIVATE_KEY_PEM, _test_jwk_client, _test_public_key, _b64url_bytes, _ec_coord_bytes


def _make_token(payload: dict) -> str:
    """Sign a token with the test EC private key."""
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="ES256")


class _WrongKeyJWKClient:
    """A JWKS client that returns a different public key (simulates wrong key)."""

    def __init__(self):
        wrong_key = ec.generate_private_key(ec.SECP256R1()).public_key()
        nums = wrong_key.public_numbers()
        self._jwk = PyJWK.from_json(
            json.dumps({
                "kty": "EC",
                "crv": "P-256",
                "x": _b64url_bytes(_ec_coord_bytes(nums.x)),
                "y": _b64url_bytes(_ec_coord_bytes(nums.y)),
                "alg": "ES256",
                "use": "sig",
            })
        )

    def get_signing_key_from_jwt(self, token: str):
        return self._jwk


class TestDecodeSupabaseJWT:
    def test_valid_token(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600, "aud": "authenticated"})
        payload = decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
        assert payload["sub"] == "user-uuid-123"

    def test_expired_token_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() - 100})
        with pytest.raises(Exception, match="expired"):
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)

    def test_invalid_token_raises(self):
        with pytest.raises(Exception):
            decode_supabase_jwt("not-a-jwt", _jwks_client_override=_test_jwk_client)

    def test_wrong_key_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600, "aud": "authenticated"})
        with pytest.raises(Exception):
            decode_supabase_jwt(token, _jwks_client_override=_WrongKeyJWKClient())

    def test_token_missing_sub_raises(self):
        token = _make_token({"exp": time.time() + 3600})
        with pytest.raises(HTTPException) as exc:
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
        assert exc.value.status_code == 401
        assert "sub" in str(exc.value.detail)

    def test_token_missing_exp_raises(self):
        token = jwt.encode({"sub": "user-uuid"}, TEST_PRIVATE_KEY_PEM, algorithm="ES256")
        with pytest.raises(HTTPException) as exc:
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
        assert exc.value.status_code == 401
        assert "exp" in str(exc.value.detail)

    def test_missing_config_raises_500(self, monkeypatch):
        # Ensure we don't use the override
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600, "aud": "authenticated"})
        
        # Patch the module's cached client and config
        import app.auth.supabase as supabase_module
        monkeypatch.setattr(supabase_module, "_jwks_client", None)
        monkeypatch.setattr(supabase_module, "SUPABASE_URL", "")
        
        # Should raise RuntimeError, NOT HTTPException(401)
        with pytest.raises(RuntimeError, match="SUPABASE_URL must be set for JWKS verification"):
            decode_supabase_jwt(token, _jwks_client_override=None)
