"""Shared test fixtures — Tortoise ORM + httpx AsyncClient + factory helpers."""

import json
import time
import uuid
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from jwt import PyJWK
from httpx import ASGITransport, AsyncClient
from tortoise import Tortoise

from app.main import app
from app.models.product import (
    Color,
    ProductLine,
    ProductType,
    SalesItem,
    Variety,
)
from app.models.user import User

TORTOISE_TEST_CONFIG = {
    "connections": {"default": "sqlite://:memory:"},
    "apps": {
        "models": {
            "models": [
                "app.models.customer",
                "app.models.product",
                "app.models.pricing",
                "app.models.order",
                "app.models.inventory",
                "app.models.standing_order",
                "app.models.user",
            ],
            "default_connection": "default",
        },
    },
}

# Generate an EC keypair for test JWT signing (ES256, matching Supabase)
_test_private_key = ec.generate_private_key(ec.SECP256R1())
_test_public_key = _test_private_key.public_key()

TEST_PRIVATE_KEY_PEM = _test_private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)


def _b64url_bytes(data: bytes) -> str:
    """Encode bytes as Base64url without padding."""
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _ec_coord_bytes(val: int) -> bytes:
    """Encode an EC coordinate as a 32-byte big-endian value (P-256)."""
    return val.to_bytes(32, "big")


class _TestJWKClient:
    """A fake PyJWKClient that returns our test EC public key."""

    def get_signing_key_from_jwt(self, token: str):
        nums = _test_public_key.public_numbers()
        return PyJWK.from_json(
            json.dumps({
                "kty": "EC",
                "crv": "P-256",
                "x": _b64url_bytes(_ec_coord_bytes(nums.x)),
                "y": _b64url_bytes(_ec_coord_bytes(nums.y)),
                "alg": "ES256",
                "use": "sig",
            })
        )


_test_jwk_client = _TestJWKClient()


def _make_test_token(supabase_user_id: str, extra_claims: dict | None = None) -> str:
    claims = {"sub": supabase_user_id, "exp": time.time() + 3600}
    if extra_claims:
        claims.update(extra_claims)
    return jwt.encode(claims, TEST_PRIVATE_KEY_PEM, algorithm="ES256")


@pytest.fixture(autouse=True)
async def initialize_db():
    """Spin up an in-memory SQLite database for each test, then tear it down."""
    await Tortoise.init(config=TORTOISE_TEST_CONFIG)
    await Tortoise.generate_schemas()
    yield
    await Tortoise._drop_databases()


@pytest.fixture(autouse=True)
def mock_jwks_client():
    """Inject our test JWKS client so JWT verification uses the test RSA keys."""
    import app.auth.dependencies as deps
    original = deps._jwks_client_override
    deps._jwks_client_override = _test_jwk_client
    yield
    deps._jwks_client_override = original


@pytest.fixture
async def async_client():
    """httpx AsyncClient wired to the FastAPI app (no real server needed)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


# ---------------------------------------------------------------------------
# Auth user fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def admin_user():
    return await User.create(
        supabase_user_id="admin-uuid",
        email="admin@oregonflowers.com",
        display_name="Admin User",
        role="admin",
        status="active",
    )


@pytest.fixture
async def salesperson_user():
    return await User.create(
        supabase_user_id="sales-uuid",
        email="sales@oregonflowers.com",
        display_name="Sales User",
        role="salesperson",
        status="active",
    )


@pytest.fixture
async def field_worker_user():
    return await User.create(
        supabase_user_id="field-uuid",
        email="field@oregonflowers.com",
        display_name="Field Worker",
        role="field_worker",
        status="active",
    )


@pytest.fixture
async def deactivated_user():
    return await User.create(
        supabase_user_id="deactivated-uuid",
        email="deactivated@oregonflowers.com",
        display_name="Deactivated User",
        role="salesperson",
        status="deactivated",
    )


@pytest.fixture
async def data_manager_user():
    return await User.create(
        supabase_user_id="data-mgr-uuid",
        email="data@oregonflowers.com",
        display_name="Data Manager",
        role="data_manager",
        status="active",
    )


@pytest.fixture
def auth_headers_admin(admin_user):
    return {"Authorization": f"Bearer {_make_test_token(admin_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_salesperson(salesperson_user):
    return {"Authorization": f"Bearer {_make_test_token(salesperson_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_field_worker(field_worker_user):
    return {"Authorization": f"Bearer {_make_test_token(field_worker_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_deactivated(deactivated_user):
    return {"Authorization": f"Bearer {_make_test_token(deactivated_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_data_manager(data_manager_user):
    return {"Authorization": f"Bearer {_make_test_token(data_manager_user.supabase_user_id)}"}


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def product_type():
    """Create a ProductType and return it."""
    return await ProductType.create(name="Cut Flower")


@pytest.fixture
async def product_line(product_type):
    """Create a ProductLine under the default ProductType."""
    return await ProductLine.create(product_type=product_type, name="Rose")


@pytest.fixture
async def color():
    """Create a Color and return it."""
    return await Color.create(name="Red")


@pytest.fixture
async def variety(product_line, color):
    """Create a Variety under the default ProductLine with a Color FK."""
    return await Variety.create(
        product_line=product_line,
        name="Freedom",
        color=color,
        flowering_type="Hybrid Tea",
    )


@pytest.fixture
async def sales_item(variety):
    """Create a SalesItem under the default Variety."""
    return await SalesItem.create(
        variety=variety,
        name=f"Freedom 25st {uuid.uuid4().hex[:6]}",
        stems_per_order=25,
        retail_price=12.50,
    )
