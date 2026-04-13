"""Tests for price list endpoints."""

import uuid

import pytest

from app.models.customer import Customer
from app.models.pricing import CustomerPrice, PriceList, PriceListItem
from app.models.product import SalesItem

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def price_list():
    """Create a PriceList and return it."""
    return await PriceList.create(name="Wholesale High")


@pytest.fixture
async def price_list_with_items(price_list, sales_item):
    """Create a PriceList with a PriceListItem."""
    await PriceListItem.create(
        price_list=price_list, sales_item=sales_item, price=10.00
    )
    return price_list


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


async def test_list_price_lists(async_client, auth_headers_admin):
    """GET /price-lists returns active price lists with customer counts."""
    pl = await PriceList.create(name="Test List")
    customer = await Customer.create(customer_number=1, name="Buyer", price_list_id=pl.id)

    resp = await async_client.get("/api/v1/price-lists", headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Test List"
    assert data[0]["customer_count"] == 1
    assert data[0]["is_active"] is True


async def test_list_price_lists_filter_inactive(async_client, auth_headers_admin):
    """GET /price-lists?active=false returns only inactive lists."""
    await PriceList.create(name="Active List")
    await PriceList.create(name="Inactive List", is_active=False)

    resp = await async_client.get("/api/v1/price-lists?active=false", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Inactive List"


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_price_list_from_retail(async_client, sales_item, auth_headers_admin):
    """POST /price-lists creates a list and copies from retail prices."""
    resp = await async_client.post(
        "/api/v1/price-lists", json={"name": "New List"}, headers=auth_headers_admin)
    assert resp.status_code == 201

    data = resp.json()["data"]
    assert data["name"] == "New List"
    assert data["customer_count"] == 0
    uuid.UUID(data["id"])

    # Verify PriceListItem was created from retail
    pli = await PriceListItem.filter(price_list_id=data["id"]).first()
    assert pli is not None
    assert pli.price == sales_item.retail_price


async def test_create_price_list_copy_from(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """POST /price-lists with copy_from copies from another list."""
    resp = await async_client.post(
        "/api/v1/price-lists",
        json={"name": "Copied List", "copy_from": str(price_list_with_items.id)}, headers=auth_headers_admin)
    assert resp.status_code == 201

    data = resp.json()["data"]
    pli = await PriceListItem.filter(price_list_id=data["id"], sales_item_id=sales_item.id).first()
    assert pli is not None
    assert float(pli.price) == 10.00


async def test_create_price_list_duplicate_name(async_client, auth_headers_admin):
    """POST /price-lists with duplicate name returns 422."""
    await PriceList.create(name="Dupe")
    resp = await async_client.post("/api/v1/price-lists", json={"name": "Dupe"}, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Rename
# ---------------------------------------------------------------------------


async def test_rename_price_list(async_client, price_list, auth_headers_admin):
    """PATCH /price-lists/{id} renames the list."""
    resp = await async_client.patch(
        f"/api/v1/price-lists/{price_list.id}", json={"name": "Renamed"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "Renamed"


async def test_rename_price_list_not_found(async_client, auth_headers_admin):
    """PATCH /price-lists/{id} with fake ID returns 404."""
    resp = await async_client.patch(
        f"/api/v1/price-lists/{uuid.uuid4()}", json={"name": "Nope"}, headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Archive / Restore
# ---------------------------------------------------------------------------


async def test_archive_price_list_converts_overrides(async_client, variety, auth_headers_admin):
    """Archive converts customer list assignments to CustomerPrice overrides."""
    pl = await PriceList.create(name="To Archive")
    si = await SalesItem.create(
        variety=variety, name="Item A", stems_per_order=10, retail_price=5.00
    )
    await PriceListItem.create(price_list=pl, sales_item=si, price=4.00)
    customer = await Customer.create(
        customer_number=10, name="Customer A", price_list_id=pl.id
    )

    resp = await async_client.post(f"/api/v1/price-lists/{pl.id}/archive", headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["is_active"] is False
    assert data["customers_converted"] == 1

    # Customer should now have no price list
    await customer.refresh_from_db()
    assert customer.price_list_id is None

    # Customer should have an override at the old list price
    cp = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=si.id
    ).first()
    assert cp is not None
    assert float(cp.price) == 4.00


async def test_restore_price_list(async_client, auth_headers_admin):
    """POST /price-lists/{id}/restore sets is_active back to True."""
    pl = await PriceList.create(name="Archived", is_active=False)
    resp = await async_client.post(f"/api/v1/price-lists/{pl.id}/restore", headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is True


# ---------------------------------------------------------------------------
# Matrix
# ---------------------------------------------------------------------------


async def test_matrix_returns_correct_structure(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """GET /price-lists/matrix returns matrix with correct shape."""
    resp = await async_client.get("/api/v1/price-lists/matrix", headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert "price_lists" in data
    assert "items" in data
    assert len(data["price_lists"]) == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["sales_item_id"] == str(sales_item.id)
    assert str(price_list_with_items.id) in data["items"][0]["prices"]


# ---------------------------------------------------------------------------
# Inline Edit
# ---------------------------------------------------------------------------


async def test_update_price_list_item(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """PATCH /price-list-items/{pl_id}/{si_id} updates the cell."""
    resp = await async_client.patch(
        f"/api/v1/price-list-items/{price_list_with_items.id}/{sales_item.id}",
        json={"price": "8.50"}, headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert float(data["price"]) == 8.50


async def test_update_price_list_item_creates_if_missing(async_client, price_list, sales_item, auth_headers_admin):
    """PATCH creates a PriceListItem if it doesn't exist."""
    resp = await async_client.patch(
        f"/api/v1/price-list-items/{price_list.id}/{sales_item.id}",
        json={"price": "7.00"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert float(resp.json()["data"]["price"]) == 7.00


# ---------------------------------------------------------------------------
# Bulk
# ---------------------------------------------------------------------------


async def test_bulk_update_price_list_items(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """PATCH /price-list-items/bulk sets price for multiple items."""
    resp = await async_client.patch(
        "/api/v1/price-list-items/bulk",
        json={
            "price_list_id": str(price_list_with_items.id),
            "sales_item_ids": [str(sales_item.id)],
            "price": "6.00",
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["updated_count"] == 1


# ---------------------------------------------------------------------------
# Retail Price Update
# ---------------------------------------------------------------------------


async def test_update_retail_price(async_client, sales_item, auth_headers_admin):
    """PATCH /price-lists/matrix/retail updates SalesItem.retail_price."""
    resp = await async_client.patch(
        "/api/v1/price-lists/matrix/retail",
        json={"sales_item_id": str(sales_item.id), "price": "15.00"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert float(resp.json()["data"]["retail_price"]) == 15.00


# ---------------------------------------------------------------------------
# Impact Preview
# ---------------------------------------------------------------------------


async def test_impact_preview(async_client, price_list_with_items, sales_item, variety, auth_headers_admin):
    """GET impact preview shows affected customer counts."""
    customer = await Customer.create(
        customer_number=20, name="Impact Test", price_list_id=price_list_with_items.id
    )

    resp = await async_client.get(
        f"/api/v1/price-list-items/{price_list_with_items.id}/{sales_item.id}/impact",
        params={"new_price": "9.00"}, headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["customers_on_list"] == 1
    assert data["customers_with_overrides"] == 0
    assert data["customers_affected"] == 1
    assert float(data["current_price"]) == 10.00
    assert float(data["new_price"]) == 9.00


async def test_impact_preview_with_override(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """Impact preview counts overrides as unaffected."""
    customer = await Customer.create(
        customer_number=21, name="Override Customer", price_list_id=price_list_with_items.id
    )
    await CustomerPrice.create(customer=customer, sales_item=sales_item, price=8.00)

    resp = await async_client.get(
        f"/api/v1/price-list-items/{price_list_with_items.id}/{sales_item.id}/impact",
        params={"new_price": "9.00"}, headers=auth_headers_admin)
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["customers_on_list"] == 1
    assert data["customers_with_overrides"] == 1
    assert data["customers_affected"] == 0


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


async def test_export_matrix_csv(async_client, price_list_with_items, sales_item, auth_headers_admin):
    """GET /price-lists/matrix/export returns CSV."""
    resp = await async_client.get("/api/v1/price-lists/matrix/export", headers=auth_headers_admin)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Sales Item" in resp.text
