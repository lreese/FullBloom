"""Tests for product line endpoints."""

import uuid

import pytest
from app.models.product import ProductLine, ProductType, Variety

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


async def test_list_product_lines_with_variety_count(
    async_client, product_type, product_line
):
    """GET /product-lines returns lines with correct variety_count."""
    # Create two active varieties and one inactive
    await Variety.create(product_line=product_line, name="Freedom")
    await Variety.create(product_line=product_line, name="Esperance")
    await Variety.create(
        product_line=product_line, name="Archived Var", is_active=False
    )

    resp = await async_client.get("/api/v1/product-lines")
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert len(data) == 1

    pl = data[0]
    assert pl["name"] == "Rose"
    assert pl["product_type_name"] == "Cut Flower"
    assert pl["variety_count"] == 2  # only active
    assert pl["is_active"] is True
    # Shape check
    assert set(pl.keys()) == {
        "id",
        "name",
        "product_type_id",
        "product_type_name",
        "is_active",
        "variety_count",
    }


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_product_line_success(async_client, product_type):
    """POST creates a product line and returns 201."""
    payload = {"name": "Tulip", "product_type_id": str(product_type.id)}
    resp = await async_client.post("/api/v1/product-lines", json=payload)
    assert resp.status_code == 201

    pl = resp.json()["data"]
    assert pl["name"] == "Tulip"
    assert pl["product_type_id"] == str(product_type.id)
    assert pl["product_type_name"] == "Cut Flower"
    assert pl["is_active"] is True
    assert pl["variety_count"] == 0
    uuid.UUID(pl["id"])


async def test_create_product_line_duplicate(async_client, product_type, product_line):
    """422 when name + product_type combo already exists."""
    payload = {"name": "Rose", "product_type_id": str(product_type.id)}
    resp = await async_client.post("/api/v1/product-lines", json=payload)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


async def test_create_product_line_invalid_product_type(async_client):
    """422 when product_type_id does not exist."""
    fake_id = uuid.uuid4()
    payload = {"name": "Orchid", "product_type_id": str(fake_id)}
    resp = await async_client.post("/api/v1/product-lines", json=payload)
    assert resp.status_code == 422
    assert "Product type not found" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Archive
# ---------------------------------------------------------------------------


async def test_archive_product_line_returns_variety_count(
    async_client, product_line
):
    """Archive sets is_active=False and reports active variety count."""
    await Variety.create(product_line=product_line, name="Freedom")
    await Variety.create(
        product_line=product_line, name="Archived", is_active=False
    )

    resp = await async_client.post(
        f"/api/v1/product-lines/{product_line.id}/archive"
    )
    assert resp.status_code == 200

    body = resp.json()["data"]
    assert body["is_active"] is False
    assert body["variety_count"] == 1  # only the active one

    await product_line.refresh_from_db()
    assert product_line.is_active is False


# ---------------------------------------------------------------------------
# Uniqueness scoping
# ---------------------------------------------------------------------------


async def test_product_line_name_uniqueness_scoped_to_product_type(
    async_client, product_type, product_line
):
    """Same name is allowed under a different product type."""
    other_type = await ProductType.create(name="Potted Plant")
    payload = {"name": "Rose", "product_type_id": str(other_type.id)}
    resp = await async_client.post("/api/v1/product-lines", json=payload)
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Rose"
