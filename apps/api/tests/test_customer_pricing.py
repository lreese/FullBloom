"""Tests for customer pricing endpoints."""

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
    """Create a PriceList."""
    return await PriceList.create(name="Wholesale High")


@pytest.fixture
async def customer_with_list(price_list):
    """Create a customer assigned to a price list."""
    return await Customer.create(
        customer_number=100, name="Test Buyer", price_list_id=price_list.id
    )


@pytest.fixture
async def setup_pricing(price_list, customer_with_list, sales_item):
    """Set up a full pricing scenario: list + item + customer."""
    await PriceListItem.create(
        price_list=price_list, sales_item=sales_item, price=10.00
    )
    return {
        "price_list": price_list,
        "customer": customer_with_list,
        "sales_item": sales_item,
    }


# ---------------------------------------------------------------------------
# Customer Pricing Grid
# ---------------------------------------------------------------------------


async def test_customer_pricing_grid(async_client, setup_pricing):
    """GET /customers/{id}/pricing returns full grid with effective prices."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]

    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing")
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["customer"]["id"] == str(customer.id)
    assert data["customer"]["price_list_name"] == "Wholesale High"
    assert len(data["items"]) >= 1
    assert data["summary"]["total_items"] >= 1

    # Find our sales item in the grid
    item = next(i for i in data["items"] if i["sales_item_id"] == str(si.id))
    assert float(item["price_list_price"]) == 10.00
    assert item["customer_override"] is None
    assert float(item["effective_price"]) == 10.00
    assert item["source"] == "price_list"


async def test_customer_pricing_with_override(async_client, setup_pricing):
    """Override takes precedence over price list price."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    await CustomerPrice.create(customer=customer, sales_item=si, price=8.00)

    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing")
    data = resp.json()["data"]

    item = next(i for i in data["items"] if i["sales_item_id"] == str(si.id))
    assert float(item["customer_override"]) == 8.00
    assert float(item["effective_price"]) == 8.00
    assert item["source"] == "override"
    assert data["summary"]["override_count"] >= 1


async def test_customer_pricing_retail_fallback(async_client, sales_item):
    """Customer with no price list falls back to retail."""
    customer = await Customer.create(customer_number=200, name="Retail Buyer")

    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing")
    data = resp.json()["data"]

    item = next(i for i in data["items"] if i["sales_item_id"] == str(sales_item.id))
    assert item["price_list_price"] is None
    assert item["source"] == "retail"
    assert float(item["effective_price"]) == float(sales_item.retail_price)


async def test_customer_pricing_not_found(async_client):
    """404 when customer does not exist."""
    resp = await async_client.get(f"/api/v1/customers/{uuid.uuid4()}/pricing")
    assert resp.status_code == 404
    assert "Customer not found" in resp.json()["error"]


# ---------------------------------------------------------------------------
# Set / Remove Override
# ---------------------------------------------------------------------------


async def test_set_customer_price_create(async_client, customer_with_list, sales_item):
    """POST /customers/{id}/prices creates a new override."""
    resp = await async_client.post(
        f"/api/v1/customers/{customer_with_list.id}/prices",
        json={"sales_item_id": str(sales_item.id), "price": "7.50"},
    )
    # Returns 201 when creating a new override
    assert resp.status_code == 201

    data = resp.json()["data"]
    assert data["customer_id"] == str(customer_with_list.id)
    assert float(data["price"]) == 7.50


async def test_set_customer_price_update(async_client, setup_pricing):
    """POST /customers/{id}/prices updates an existing override."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    await CustomerPrice.create(customer=customer, sales_item=si, price=8.00)

    resp = await async_client.post(
        f"/api/v1/customers/{customer.id}/prices",
        json={"sales_item_id": str(si.id), "price": "9.00"},
    )
    assert resp.status_code == 200
    assert float(resp.json()["data"]["price"]) == 9.00


async def test_remove_customer_price(async_client, setup_pricing):
    """DELETE /customers/{id}/prices/{si_id} removes the override."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    await CustomerPrice.create(customer=customer, sales_item=si, price=8.00)

    resp = await async_client.delete(
        f"/api/v1/customers/{customer.id}/prices/{si.id}"
    )
    assert resp.status_code == 204

    # Verify it's gone
    cp = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=si.id
    ).first()
    assert cp is None


async def test_remove_customer_price_not_found(async_client, customer_with_list, sales_item):
    """DELETE returns 404 when no override exists."""
    resp = await async_client.delete(
        f"/api/v1/customers/{customer_with_list.id}/prices/{sales_item.id}"
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Bulk Actions
# ---------------------------------------------------------------------------


async def test_bulk_set_price(async_client, setup_pricing):
    """Bulk set_price creates/updates overrides for all specified items."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]

    resp = await async_client.post(
        f"/api/v1/customers/{customer.id}/prices/bulk",
        json={
            "action": "set_price",
            "sales_item_ids": [str(si.id)],
            "price": "6.00",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["affected_count"] == 1

    cp = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=si.id
    ).first()
    assert float(cp.price) == 6.00


async def test_bulk_remove_overrides(async_client, setup_pricing):
    """Bulk remove_overrides deletes specified overrides."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    await CustomerPrice.create(customer=customer, sales_item=si, price=8.00)

    resp = await async_client.post(
        f"/api/v1/customers/{customer.id}/prices/bulk",
        json={
            "action": "remove_overrides",
            "sales_item_ids": [str(si.id)],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["affected_count"] == 1

    cp = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=si.id
    ).first()
    assert cp is None


async def test_bulk_reset_to_list(async_client, setup_pricing):
    """Bulk reset_to_list deletes overrides so customer falls through to price list price."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]

    # Create an override first
    await CustomerPrice.create(customer=customer, sales_item=si, price=8.00)

    resp = await async_client.post(
        f"/api/v1/customers/{customer.id}/prices/bulk",
        json={
            "action": "reset_to_list",
            "sales_item_ids": [str(si.id)],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["affected_count"] == 1

    # Override should be deleted, not updated
    cp = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=si.id
    ).first()
    assert cp is None  # override removed; customer falls through to price list


# ---------------------------------------------------------------------------
# Item-Centric View
# ---------------------------------------------------------------------------


async def test_item_pricing_view(async_client, setup_pricing):
    """GET /sales-items/{id}/customer-pricing returns all customers' prices."""
    si = setup_pricing["sales_item"]
    customer = setup_pricing["customer"]

    resp = await async_client.get(f"/api/v1/sales-items/{si.id}/customer-pricing")
    assert resp.status_code == 200

    data = resp.json()["data"]
    assert data["sales_item"]["id"] == str(si.id)
    assert len(data["customers"]) >= 1

    c_row = next(c for c in data["customers"] if c["customer_id"] == str(customer.id))
    assert c_row["price_list_name"] == "Wholesale High"
    assert float(c_row["effective_price"]) == 10.00
    assert c_row["source"] == "price_list"


async def test_item_pricing_not_found(async_client):
    """404 when sales item does not exist."""
    resp = await async_client.get(f"/api/v1/sales-items/{uuid.uuid4()}/customer-pricing")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Anomaly Detection
# ---------------------------------------------------------------------------


async def test_anomaly_flag(async_client, setup_pricing):
    """Override >20% off from list price flags anomaly."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    # List price is 10.00; set override to 7.00 (30% off — exceeds 20%)
    await CustomerPrice.create(customer=customer, sales_item=si, price=7.00)

    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing")
    data = resp.json()["data"]

    item = next(i for i in data["items"] if i["sales_item_id"] == str(si.id))
    assert item["anomaly"] is True


async def test_no_anomaly_within_threshold(async_client, setup_pricing):
    """Override within 20% does not flag anomaly."""
    customer = setup_pricing["customer"]
    si = setup_pricing["sales_item"]
    # List price is 10.00; set override to 9.00 (10% off — within threshold)
    await CustomerPrice.create(customer=customer, sales_item=si, price=9.00)

    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing")
    data = resp.json()["data"]

    item = next(i for i in data["items"] if i["sales_item_id"] == str(si.id))
    assert item["anomaly"] is False


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


async def test_export_customer_pricing_csv(async_client, setup_pricing):
    """GET /customers/{id}/pricing/export returns CSV."""
    customer = setup_pricing["customer"]
    resp = await async_client.get(f"/api/v1/customers/{customer.id}/pricing/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Sales Item" in resp.text
    assert "Effective Price" in resp.text
