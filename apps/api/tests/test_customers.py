"""Tests for customer search endpoint (app.routers.customers)."""

import pytest

from app.models.customer import Customer

pytestmark = pytest.mark.anyio


async def _create_customer(number: int, name: str, is_active: bool = True) -> Customer:
    """Helper to create a customer record."""
    return await Customer.create(
        customer_number=number,
        name=name,
        is_active=is_active,
    )


async def test_search_by_name_partial(async_client, auth_headers_admin):
    """Search should match partial customer name (case-insensitive)."""
    await _create_customer(100, "Sunrise Flowers")
    await _create_customer(101, "Mountain View Farm")

    resp = await async_client.get("/api/v1/customers", params={"search": "sunrise"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Sunrise Flowers"


async def test_search_by_customer_number(async_client, auth_headers_admin):
    """Search should match customer_number as a substring."""
    await _create_customer(4567, "Alpha Farm")
    await _create_customer(8901, "Beta Blooms")

    resp = await async_client.get("/api/v1/customers", params={"search": "456"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["customer_number"] == 4567


async def test_search_case_insensitive(async_client, auth_headers_admin):
    """Search should be case-insensitive for name matching."""
    await _create_customer(200, "Oregon Flowers")

    resp = await async_client.get("/api/v1/customers", params={"search": "OREGON"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Oregon Flowers"


async def test_search_no_results(async_client, auth_headers_admin):
    """Search with no matching term returns empty list."""
    await _create_customer(300, "Valley Growers")

    resp = await async_client.get("/api/v1/customers", params={"search": "nonexistent"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 0


async def test_no_search_returns_all(async_client, auth_headers_admin):
    """Without search param, all active customers are returned."""
    await _create_customer(400, "Farm A")
    await _create_customer(401, "Farm B")
    await _create_customer(402, "Farm C", is_active=False)

    resp = await async_client.get("/api/v1/customers", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    # Default active=True, so only 2 active customers
    assert len(data) == 2
    names = {c["name"] for c in data}
    assert names == {"Farm A", "Farm B"}


async def test_search_with_active_false(async_client, auth_headers_admin):
    """Search with active=false returns only inactive customers matching the query."""
    await _create_customer(500, "Sunset Farm", is_active=True)
    await _create_customer(501, "Sunset Blooms", is_active=False)
    await _create_customer(502, "Mountain View", is_active=False)

    resp = await async_client.get(
        "/api/v1/customers", params={"active": "false", "search": "sunset"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Sunset Blooms"
    assert data[0]["is_active"] is False


async def test_search_with_active_omitted(async_client, auth_headers_admin):
    """When active param is omitted, default is True — only active customers returned."""
    await _create_customer(600, "River Farm", is_active=True)
    await _create_customer(601, "River Blooms", is_active=False)

    # No active param at all — should default to active=True
    resp = await async_client.get("/api/v1/customers", params={"search": "river"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "River Farm"
    assert data[0]["is_active"] is True
