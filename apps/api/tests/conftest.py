"""Shared test fixtures — Tortoise ORM + httpx AsyncClient + factory helpers."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from tortoise import Tortoise

from app.main import app
from app.models.product import (
    ProductLine,
    ProductType,
    SalesItem,
    Variety,
    VarietyColor,
)

TORTOISE_TEST_CONFIG = {
    "connections": {"default": "sqlite://:memory:"},
    "apps": {
        "models": {
            "models": [
                "app.models.customer",
                "app.models.product",
                "app.models.pricing",
                "app.models.order",
            ],
            "default_connection": "default",
        },
    },
}


@pytest.fixture(autouse=True)
async def initialize_db():
    """Spin up an in-memory SQLite database for each test, then tear it down."""
    await Tortoise.init(config=TORTOISE_TEST_CONFIG)
    await Tortoise.generate_schemas()
    yield
    await Tortoise._drop_databases()


@pytest.fixture
async def async_client():
    """httpx AsyncClient wired to the FastAPI app (no real server needed)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


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
async def variety(product_line):
    """Create a Variety under the default ProductLine."""
    return await Variety.create(
        product_line=product_line,
        name="Freedom",
        color="Red",
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


@pytest.fixture
async def variety_color(variety):
    """Create a VarietyColor under the default Variety."""
    return await VarietyColor.create(variety=variety, color_name="Red")
