"""Tests for sheet completion endpoints — complete and uncomplete sheets."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.inventory import (
    CustomerCount,
    DailyCount,
    Estimate,
    SheetCompletion,
)
from app.models.product import Color, ProductLine, ProductType, Variety

BASE = "/api/v1"
TODAY = date(2026, 4, 12)
WEEK_START = date(2026, 4, 6)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def sc_product_type():
    return await ProductType.create(name="Cut Flower")


@pytest.fixture
async def sc_product_line(sc_product_type):
    return await ProductLine.create(product_type=sc_product_type, name="Rose")


@pytest.fixture
async def sc_variety(sc_product_line):
    return await Variety.create(
        product_line=sc_product_line,
        name="Freedom",
        in_harvest=True,
        is_active=True,
    )


@pytest.fixture
async def sc_variety2(sc_product_line):
    return await Variety.create(
        product_line=sc_product_line,
        name="Mondial",
        in_harvest=True,
        is_active=True,
    )


# ---------------------------------------------------------------------------
# POST /sheets/complete — daily_count
# ---------------------------------------------------------------------------


async def test_complete_daily_count_sheet(
    async_client: AsyncClient, sc_product_type, sc_variety, auth_headers_admin):
    """Complete daily_count marks existing counts as done and creates SheetCompletion."""
    # Create an existing daily count
    await DailyCount.create(
        variety=sc_variety,
        product_type=sc_product_type,
        count_date=TODAY,
        count_value=42,
        is_done=False,
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "daily_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": "admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_complete"] is True
    assert data["completed_by"] == "admin"

    # Verify count was marked done
    dc = await DailyCount.get(variety_id=sc_variety.id, count_date=TODAY)
    assert dc.is_done is True

    # Verify SheetCompletion record
    sc = await SheetCompletion.get(
        product_type_id=sc_product_type.id,
        sheet_type="daily_count",
        sheet_date=TODAY,
    )
    assert sc.is_complete is True


async def test_complete_daily_count_no_phantom_records(
    async_client: AsyncClient, sc_product_type, sc_variety, sc_variety2, auth_headers_admin):
    """Complete daily_count marks existing records done but does not create phantom records."""
    # Only create a count for variety1, not variety2
    await DailyCount.create(
        variety=sc_variety,
        product_type=sc_product_type,
        count_date=TODAY,
        count_value=10,
        is_done=False,
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "daily_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": "admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200

    # variety1 should be marked done
    dc1 = await DailyCount.get(variety_id=sc_variety.id, count_date=TODAY)
    assert dc1.is_done is True
    assert dc1.count_value == 10

    # variety2 should NOT have a phantom record created
    dc2 = await DailyCount.get_or_none(variety_id=sc_variety2.id, count_date=TODAY)
    assert dc2 is None


# ---------------------------------------------------------------------------
# POST /sheets/complete — customer_count
# ---------------------------------------------------------------------------


async def test_complete_customer_count_sheet(
    async_client: AsyncClient, sc_product_type, sc_variety, auth_headers_admin):
    """Complete customer_count marks existing customer counts as done."""
    from app.models.customer import Customer

    customer = await Customer.create(customer_number=2001, name="Buyer A")
    await CustomerCount.create(
        variety=sc_variety,
        product_type=sc_product_type,
        customer=customer,
        count_date=TODAY,
        bunch_size=10,
        sleeve_type="Plastic",
        bunch_count=5,
        is_done=False,
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "customer_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": "admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["is_complete"] is True

    cc = await CustomerCount.get(
        variety_id=sc_variety.id, customer_id=customer.id, count_date=TODAY,
        bunch_size=10, sleeve_type="Plastic",
    )
    assert cc.is_done is True


# ---------------------------------------------------------------------------
# POST /sheets/complete — estimate
# ---------------------------------------------------------------------------


async def test_complete_estimate_sheet(
    async_client: AsyncClient, sc_product_type, sc_variety, auth_headers_admin):
    """Complete estimate marks existing estimates as done."""
    await Estimate.create(
        variety=sc_variety,
        product_type=sc_product_type,
        week_start=WEEK_START,
        pull_day=date(2026, 4, 6),
        estimate_value=100,
        is_done=False,
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "estimate",
        "sheet_date": WEEK_START.isoformat(),
        "completed_by": "admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["is_complete"] is True

    est = await Estimate.get(variety_id=sc_variety.id, pull_day=date(2026, 4, 6))
    assert est.is_done is True


# ---------------------------------------------------------------------------
# POST /sheets/complete — unknown sheet_type
# ---------------------------------------------------------------------------


async def test_complete_unknown_sheet_type(
    async_client: AsyncClient, sc_product_type, auth_headers_admin):
    """Complete with unknown sheet_type returns 422."""
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "bogus",
        "sheet_date": TODAY.isoformat(),
        "completed_by": "admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /sheets/complete — idempotent (re-completing)
# ---------------------------------------------------------------------------


async def test_complete_sheet_idempotent(
    async_client: AsyncClient, sc_product_type, sc_variety, auth_headers_admin):
    """Completing an already-complete sheet updates completed_by."""
    await SheetCompletion.create(
        product_type=sc_product_type,
        sheet_type="daily_count",
        sheet_date=TODAY,
        is_complete=True,
        completed_by="first_admin",
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "daily_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": "second_admin",
    }
    resp = await async_client.post(f"{BASE}/sheets/complete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["completed_by"] == "second_admin"

    # Only one SheetCompletion record should exist
    count = await SheetCompletion.filter(
        product_type_id=sc_product_type.id,
        sheet_type="daily_count",
        sheet_date=TODAY,
    ).count()
    assert count == 1


# ---------------------------------------------------------------------------
# POST /sheets/uncomplete
# ---------------------------------------------------------------------------


async def test_uncomplete_sheet(
    async_client: AsyncClient, sc_product_type, auth_headers_admin):
    """Uncomplete reopens a completed sheet."""
    await SheetCompletion.create(
        product_type=sc_product_type,
        sheet_type="daily_count",
        sheet_date=TODAY,
        is_complete=True,
        completed_by="admin",
    )
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "daily_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": None,
    }
    resp = await async_client.post(f"{BASE}/sheets/uncomplete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_complete"] is False

    sc = await SheetCompletion.get(
        product_type_id=sc_product_type.id,
        sheet_type="daily_count",
        sheet_date=TODAY,
    )
    assert sc.is_complete is False
    assert sc.completed_by is None


async def test_uncomplete_nonexistent_sheet(
    async_client: AsyncClient, sc_product_type, auth_headers_admin):
    """Uncomplete on a sheet that was never completed returns success (no-op)."""
    payload = {
        "product_type_id": str(sc_product_type.id),
        "sheet_type": "daily_count",
        "sheet_date": TODAY.isoformat(),
        "completed_by": None,
    }
    resp = await async_client.post(f"{BASE}/sheets/uncomplete", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["is_complete"] is False
