"""Tests for product type endpoints."""

import pytest

from app.models.product import ProductLine, ProductType


@pytest.mark.anyio
async def test_list_product_types_with_product_line_count(async_client, product_type, product_line):
    """GET /product-types returns product_line_count for each type."""
    resp = await async_client.get("/api/v1/product-types")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Cut Flower"
    assert data[0]["is_active"] is True
    assert data[0]["product_line_count"] == 1


@pytest.mark.anyio
async def test_create_product_type_success(async_client):
    """POST /product-types creates a new product type."""
    resp = await async_client.post(
        "/api/v1/product-types", json={"name": "Potted Plant"}
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["name"] == "Potted Plant"
    assert data["is_active"] is True
    assert data["product_line_count"] == 0


@pytest.mark.anyio
async def test_create_product_type_duplicate(async_client, product_type):
    """POST /product-types rejects duplicate names."""
    resp = await async_client.post(
        "/api/v1/product-types", json={"name": "Cut Flower"}
    )
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


@pytest.mark.anyio
async def test_update_product_type_success(async_client, product_type):
    """PATCH /product-types/{id} updates the name."""
    resp = await async_client.patch(
        f"/api/v1/product-types/{product_type.id}", json={"name": "Dried Flower"}
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == "Dried Flower"


@pytest.mark.anyio
async def test_archive_product_type_returns_product_line_count(
    async_client, product_type, product_line
):
    """POST /product-types/{id}/archive sets is_active=false and returns product_line_count."""
    resp = await async_client.post(
        f"/api/v1/product-types/{product_type.id}/archive"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_active"] is False
    assert data["product_line_count"] == 1


@pytest.mark.anyio
async def test_restore_product_type(async_client, product_type):
    """POST /product-types/{id}/restore sets is_active=true."""
    # Archive first
    product_type.is_active = False
    await product_type.save()

    resp = await async_client.post(
        f"/api/v1/product-types/{product_type.id}/restore"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_active"] is True
