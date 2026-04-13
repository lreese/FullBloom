"""Tests for variety endpoints — CRUD, bulk update, archive/restore."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.product import Color, ProductLine, ProductType, SalesItem, Variety

BASE = "/api/v1"


# ---------------------------------------------------------------------------
# List varieties
# ---------------------------------------------------------------------------


async def test_list_varieties_returns_active_only(async_client: AsyncClient, variety, auth_headers_admin):
    """GET /varieties defaults to active=true and returns only active varieties."""
    # Create an archived variety in the same product line
    await Variety.create(
        product_line=variety.product_line,
        name="Archived Variety",
        is_active=False,
    )

    resp = await async_client.get(f"{BASE}/varieties", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Freedom"
    assert data[0]["is_active"] is True


async def test_list_varieties_archived(async_client: AsyncClient, variety, auth_headers_admin):
    """GET /varieties?active=false returns only archived varieties."""
    variety.is_active = False
    await variety.save()

    resp = await async_client.get(f"{BASE}/varieties", params={"active": "false"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["is_active"] is False


# ---------------------------------------------------------------------------
# Get variety detail
# ---------------------------------------------------------------------------


async def test_get_variety_detail_with_sales_items(
    async_client: AsyncClient, variety, sales_item, auth_headers_admin):
    """GET /varieties/{id} returns nested sales items with customer_prices_count."""
    resp = await async_client.get(f"{BASE}/varieties/{variety.id}", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(variety.id)
    assert data["name"] == "Freedom"
    assert "sales_items" in data
    assert len(data["sales_items"]) == 1
    si = data["sales_items"][0]
    assert si["id"] == str(sales_item.id)
    assert si["customer_prices_count"] == 0


async def test_get_variety_not_found(async_client: AsyncClient, auth_headers_admin):
    """GET /varieties/{id} returns 404 for nonexistent UUID."""
    fake_id = uuid.uuid4()
    resp = await async_client.get(f"{BASE}/varieties/{fake_id}", headers=auth_headers_admin)
    assert resp.status_code == 404
    assert "not found" in resp.json()["error"].lower()


# ---------------------------------------------------------------------------
# Create variety
# ---------------------------------------------------------------------------


async def test_create_variety_success(async_client: AsyncClient, product_line, color, auth_headers_admin):
    """POST /varieties creates with required fields and returns 201."""
    payload = {
        "name": "Mondial",
        "product_line_id": str(product_line.id),
        "color_id": str(color.id),
    }
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["name"] == "Mondial"
    assert data["product_line_id"] == str(product_line.id)
    assert data["product_line_name"] == "Rose"
    assert data["color_id"] == str(color.id)
    assert data["color_name"] == "Red"
    assert data["is_active"] is True
    assert data["sales_items_count"] == 0


async def test_create_variety_duplicate_name_same_product_line(
    async_client: AsyncClient, variety, auth_headers_admin):
    """POST /varieties returns 422 when name exists in same product line."""
    payload = {
        "name": "Freedom",
        "product_line_id": str(variety.product_line_id),
    }
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


async def test_create_variety_duplicate_name_different_product_line(
    async_client: AsyncClient, product_type, variety, auth_headers_admin):
    """POST /varieties succeeds when same name is in a different product line."""
    other_pl = await ProductLine.create(product_type=product_type, name="Tulip")
    payload = {
        "name": "Freedom",
        "product_line_id": str(other_pl.id),
    }
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Freedom"


async def test_create_variety_invalid_product_line(async_client: AsyncClient, auth_headers_admin):
    """POST /varieties returns 422 when product_line_id doesn't exist."""
    payload = {
        "name": "Ghost",
        "product_line_id": str(uuid.uuid4()),
    }
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "not found" in resp.json()["error"].lower()


async def test_create_variety_invalid_color(async_client: AsyncClient, product_line, auth_headers_admin):
    """POST /varieties returns 422 when color_id doesn't exist."""
    payload = {
        "name": "Ghost",
        "product_line_id": str(product_line.id),
        "color_id": str(uuid.uuid4()),
    }
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "Color not found" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Update variety
# ---------------------------------------------------------------------------


async def test_update_variety_success(async_client: AsyncClient, variety, auth_headers_admin):
    """PATCH /varieties/{id} updates fields and returns updated object."""
    new_color = await Color.create(name="Pink")
    resp = await async_client.patch(
        f"{BASE}/varieties/{variety.id}",
        json={"color_id": str(new_color.id), "flowering_type": "Spray"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["color_id"] == str(new_color.id)
    assert data["color_name"] == "Pink"
    assert data["flowering_type"] == "Spray"
    assert data["name"] == "Freedom"  # unchanged


async def test_update_variety_not_found(async_client: AsyncClient, auth_headers_admin):
    """PATCH /varieties/{id} returns 404 for nonexistent UUID."""
    fake_id = uuid.uuid4()
    resp = await async_client.patch(
        f"{BASE}/varieties/{fake_id}", json={"flowering_type": "Spray"}, headers=auth_headers_admin)
    assert resp.status_code == 404


async def test_update_variety_empty_body(async_client: AsyncClient, variety, auth_headers_admin):
    """PATCH /varieties/{id} with no fields returns 422."""
    resp = await async_client.patch(f"{BASE}/varieties/{variety.id}", json={}, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "No fields" in resp.json()["error"]


async def test_update_variety_name_uniqueness_check(
    async_client: AsyncClient, variety, product_line, auth_headers_admin):
    """PATCH /varieties/{id} rejects duplicate name within same product line."""
    other = await Variety.create(product_line=product_line, name="Mondial")
    resp = await async_client.patch(
        f"{BASE}/varieties/{other.id}", json={"name": "Freedom"}, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Archive / Restore
# ---------------------------------------------------------------------------


async def test_archive_variety(async_client: AsyncClient, variety, auth_headers_admin):
    """POST /varieties/{id}/archive sets is_active=false."""
    resp = await async_client.post(f"{BASE}/varieties/{variety.id}/archive", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(variety.id)
    assert data["is_active"] is False


async def test_restore_variety(async_client: AsyncClient, variety, auth_headers_admin):
    """POST /varieties/{id}/restore sets is_active=true."""
    variety.is_active = False
    await variety.save()

    resp = await async_client.post(f"{BASE}/varieties/{variety.id}/restore", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_active"] is True


async def test_archive_variety_not_found(async_client: AsyncClient, auth_headers_admin):
    """POST /varieties/{id}/archive returns 404 for nonexistent UUID."""
    fake_id = uuid.uuid4()
    resp = await async_client.post(f"{BASE}/varieties/{fake_id}/archive", headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Bulk update
# ---------------------------------------------------------------------------


async def test_bulk_update_allowed_field(async_client: AsyncClient, variety, auth_headers_admin):
    """PATCH /varieties/bulk with 'show' field updates all specified IDs."""
    resp = await async_client.patch(
        f"{BASE}/varieties/bulk",
        json={"ids": [str(variety.id)], "field": "show", "value": False}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["updated_count"] == 1

    # Verify the DB was updated
    refreshed = await Variety.get(id=variety.id)
    assert refreshed.show is False


async def test_bulk_update_disallowed_field(async_client: AsyncClient, variety, auth_headers_admin):
    """PATCH /varieties/bulk with 'name' returns 422."""
    resp = await async_client.patch(
        f"{BASE}/varieties/bulk",
        json={"ids": [str(variety.id)], "field": "name", "value": "Hacked"}, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "not bulk-updatable" in resp.json()["error"]


async def test_bulk_update_returns_count(async_client: AsyncClient, product_line, auth_headers_admin):
    """Response includes correct updated_count for multiple varieties."""
    v1 = await Variety.create(product_line=product_line, name="V1")
    v2 = await Variety.create(product_line=product_line, name="V2")
    v3 = await Variety.create(product_line=product_line, name="V3")

    resp = await async_client.patch(
        f"{BASE}/varieties/bulk",
        json={
            "ids": [str(v1.id), str(v2.id), str(v3.id)],
            "field": "show",
            "value": False,
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["updated_count"] == 3


# ---------------------------------------------------------------------------
# Important edge cases
# ---------------------------------------------------------------------------


async def test_create_variety_empty_name(async_client: AsyncClient, product_line, auth_headers_admin):
    """Pydantic validator rejects whitespace-only name."""
    payload = {"name": "   ", "product_line_id": str(product_line.id)}
    resp = await async_client.post(f"{BASE}/varieties", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422


async def test_update_variety_partial_update(async_client: AsyncClient, variety, color, auth_headers_admin):
    """Only specified fields change, others remain untouched."""
    original_color_id = str(color.id)
    resp = await async_client.patch(
        f"{BASE}/varieties/{variety.id}",
        json={"flowering_type": "Garden"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["flowering_type"] == "Garden"
    assert data["color_id"] == original_color_id  # unchanged


async def test_bulk_update_with_nonexistent_ids(async_client: AsyncClient, auth_headers_admin):
    """Bulk update with non-existent IDs returns updated_count=0, no error."""
    fake_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    resp = await async_client.patch(
        f"{BASE}/varieties/bulk",
        json={"ids": fake_ids, "field": "show", "value": False}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["updated_count"] == 0


async def test_list_varieties_sales_items_count_excludes_inactive(
    async_client: AsyncClient, variety, auth_headers_admin):
    """sales_items_count only counts active items."""
    await SalesItem.create(
        variety=variety,
        name="Active Item",
        stems_per_order=10,
        retail_price=5.00,
        is_active=True,
    )
    await SalesItem.create(
        variety=variety,
        name="Inactive Item",
        stems_per_order=10,
        retail_price=5.00,
        is_active=False,
    )

    resp = await async_client.get(f"{BASE}/varieties", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["sales_items_count"] == 1  # only the active one
