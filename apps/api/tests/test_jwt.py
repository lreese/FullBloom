import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jwt import PyJWK

from app.auth.supabase import decode_supabase_jwt
from tests.conftest import TEST_PRIVATE_KEY_PEM, _test_jwk_client, _test_public_key, _b64url_uint


def _make_token(payload: dict) -> str:
    """Sign a token with the test RSA private key."""
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm="RS256")


class _WrongKeyJWKClient:
    """A JWKS client that returns a different public key (simulates wrong key)."""

    def __init__(self):
        wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key()
        self._jwk = PyJWK.from_json(
            json.dumps({
                "kty": "RSA",
                "n": _b64url_uint(wrong_key.public_numbers().n),
                "e": _b64url_uint(wrong_key.public_numbers().e),
                "alg": "RS256",
                "use": "sig",
            })
        )

    def get_signing_key_from_jwt(self, token: str):
        return self._jwk


class TestDecodeSupabaseJWT:
    def test_valid_token(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
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
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
        with pytest.raises(Exception):
            decode_supabase_jwt(token, _jwks_client_override=_WrongKeyJWKClient())

    def test_token_missing_sub_raises(self):
        token = _make_token({"exp": time.time() + 3600})
        with pytest.raises(Exception):
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)

    def test_token_missing_exp_raises(self):
        token = jwt.encode({"sub": "user-uuid"}, TEST_PRIVATE_KEY_PEM, algorithm="RS256")
        with pytest.raises(Exception):
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
