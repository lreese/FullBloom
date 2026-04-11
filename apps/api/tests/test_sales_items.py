"""Tests for sales item endpoints."""

import uuid

import pytest
from app.models.customer import Customer
from app.models.pricing import CustomerPrice
from app.models.product import SalesItem

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


async def test_list_sales_items_for_variety(async_client, variety):
    """GET /varieties/{id}/sales-items returns active items ordered by name."""
    await SalesItem.create(
        variety=variety, name="Bravo 10st", stems_per_order=10, retail_price=5.00
    )
    await SalesItem.create(
        variety=variety, name="Alpha 25st", stems_per_order=25, retail_price=12.50
    )
    # Inactive — should NOT appear by default
    await SalesItem.create(
        variety=variety,
        name="Charlie 50st",
        stems_per_order=50,
        retail_price=20.00,
        is_active=False,
    )

    resp = await async_client.get(f"/api/v1/varieties/{variety.id}/sales-items")
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert len(data) == 2
    # Ordered by name
    assert data[0]["name"] == "Alpha 25st"
    assert data[1]["name"] == "Bravo 10st"
    # Shape check
    for item in data:
        assert set(item.keys()) == {
            "id",
            "name",
            "stems_per_order",
            "retail_price",
            "cost_price",
            "is_active",
            "customer_prices_count",
            "price_list_prices",
        }


async def test_list_sales_items_include_inactive(async_client, variety):
    """include_inactive=true returns all items."""
    await SalesItem.create(
        variety=variety, name="Active Item", stems_per_order=10, retail_price=5.00
    )
    await SalesItem.create(
        variety=variety,
        name="Inactive Item",
        stems_per_order=25,
        retail_price=12.50,
        is_active=False,
    )

    resp = await async_client.get(
        f"/api/v1/varieties/{variety.id}/sales-items?include_inactive=true"
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2


async def test_list_sales_items_variety_not_found(async_client):
    """404 when variety does not exist."""
    fake_id = uuid.uuid4()
    resp = await async_client.get(f"/api/v1/varieties/{fake_id}/sales-items")
    assert resp.status_code == 404
    assert "Variety not found" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_sales_item_success(async_client, variety):
    """POST creates a sales item and returns 201 with correct shape."""
    payload = {
        "name": "Freedom 25st",
        "stems_per_order": 25,
        "retail_price": "12.50",
    }
    resp = await async_client.post(
        f"/api/v1/varieties/{variety.id}/sales-items", json=payload
    )
    assert resp.status_code == 201

    item = resp.json()["data"]
    assert item["name"] == "Freedom 25st"
    assert item["stems_per_order"] == 25
    assert float(item["retail_price"]) == 12.50
    assert item["is_active"] is True
    assert item["customer_prices_count"] == 0
    # UUID is valid
    uuid.UUID(item["id"])


async def test_create_sales_item_duplicate_name(async_client, variety):
    """422 when name already exists."""
    await SalesItem.create(
        variety=variety, name="Dupe Name", stems_per_order=10, retail_price=5.00
    )

    payload = {"name": "Dupe Name", "stems_per_order": 25, "retail_price": "12.50"}
    resp = await async_client.post(
        f"/api/v1/varieties/{variety.id}/sales-items", json=payload
    )
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


async def test_update_sales_item_success(async_client, sales_item):
    """PATCH updates fields and returns updated item."""
    resp = await async_client.patch(
        f"/api/v1/sales-items/{sales_item.id}",
        json={"name": "Updated Name", "stems_per_order": 50},
    )
    assert resp.status_code == 200

    item = resp.json()["data"]
    assert item["name"] == "Updated Name"
    assert item["stems_per_order"] == 50
    # Unchanged field
    assert float(item["retail_price"]) == 12.50


async def test_update_sales_item_not_found(async_client):
    """404 for non-existent sales item."""
    fake_id = uuid.uuid4()
    resp = await async_client.patch(
        f"/api/v1/sales-items/{fake_id}", json={"name": "Nope"}
    )
    assert resp.status_code == 404
    assert "Sales item not found" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Archive / Restore
# ---------------------------------------------------------------------------


async def test_archive_sales_item_returns_customer_prices_count(
    async_client, sales_item
):
    """Archive sets is_active=False and reports customer_prices_count."""
    # Create a customer and a customer price to verify the count
    customer = await Customer.create(customer_number=1, name="Test Buyer")
    await CustomerPrice.create(
        customer=customer, sales_item=sales_item, price=10.00
    )

    resp = await async_client.post(f"/api/v1/sales-items/{sales_item.id}/archive")
    assert resp.status_code == 200

    body = resp.json()["data"]
    assert body["is_active"] is False
    assert body["customer_prices_count"] == 1

    # Confirm DB state
    await sales_item.refresh_from_db()
    assert sales_item.is_active is False


async def test_restore_sales_item(async_client, variety):
    """Restore sets is_active back to True."""
    si = await SalesItem.create(
        variety=variety,
        name="Archived Item",
        stems_per_order=10,
        retail_price=5.00,
        is_active=False,
    )

    resp = await async_client.post(f"/api/v1/sales-items/{si.id}/restore")
    assert resp.status_code == 200

    body = resp.json()["data"]
    assert body["is_active"] is True


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


async def test_sales_item_stems_per_order_must_be_positive(async_client, variety):
    """stems_per_order <= 0 is rejected by Pydantic validation."""
    payload = {"name": "Bad Item", "stems_per_order": 0, "retail_price": "5.00"}
    resp = await async_client.post(
        f"/api/v1/varieties/{variety.id}/sales-items", json=payload
    )
    assert resp.status_code == 422


async def test_archive_then_restore_round_trip(async_client, sales_item):
    """Archive then restore returns the item to active state."""
    # Archive
    resp = await async_client.post(f"/api/v1/sales-items/{sales_item.id}/archive")
    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False

    # Restore
    resp = await async_client.post(f"/api/v1/sales-items/{sales_item.id}/restore")
    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is True

    # Verify DB
    await sales_item.refresh_from_db()
    assert sales_item.is_active is True
