"""Shared test fixtures — Tortoise ORM + httpx AsyncClient + factory helpers."""

import time
import uuid
from unittest.mock import patch

import jwt
import pytest
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

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


def _make_test_token(supabase_user_id: str) -> str:
    return jwt.encode(
        {"sub": supabase_user_id, "exp": time.time() + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture(autouse=True)
async def initialize_db():
    """Spin up an in-memory SQLite database for each test, then tear it down."""
    await Tortoise.init(config=TORTOISE_TEST_CONFIG)
    await Tortoise.generate_schemas()
    yield
    await Tortoise._drop_databases()


@pytest.fixture(autouse=True)
def mock_jwt_secret():
    with patch("app.auth.dependencies.SUPABASE_JWT_SECRET", TEST_JWT_SECRET):
        yield


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
