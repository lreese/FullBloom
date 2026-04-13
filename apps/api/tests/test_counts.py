"""Tests for daily count endpoints — list, save, audit log, recent counts."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.inventory import CountAuditLog, DailyCount, SheetCompletion
from app.models.product import Color, ProductLine, ProductType, Variety

BASE = "/api/v1"
TODAY = date(2026, 4, 12)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def inv_product_type():
    return await ProductType.create(name="Cut Flower")


@pytest.fixture
async def inv_product_line(inv_product_type):
    return await ProductLine.create(product_type=inv_product_type, name="Rose")


@pytest.fixture
async def inv_variety(inv_product_line):
    return await Variety.create(
        product_line=inv_product_line,
        name="Freedom",
        in_harvest=True,
        is_active=True,
    )


# ---------------------------------------------------------------------------
# GET /counts
# ---------------------------------------------------------------------------


async def test_list_counts_empty(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """GET /counts returns an empty sheet when no counts exist."""
    resp = await async_client.get(
        f"{BASE}/counts",
        params={"product_type_id": str(inv_product_type.id), "count_date": TODAY.isoformat()}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["sheet_complete"] is False
    assert len(data["product_lines"]) == 1
    varieties = data["product_lines"][0]["varieties"]
    assert len(varieties) == 1
    assert varieties[0]["count_value"] is None
    assert varieties[0]["is_done"] is False


async def test_list_counts_with_existing_data(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """GET /counts returns existing count data."""
    await DailyCount.create(
        variety=inv_variety,
        product_type=inv_product_type,
        count_date=TODAY,
        count_value=42,
        is_done=True,
        entered_by="tester",
    )
    resp = await async_client.get(
        f"{BASE}/counts",
        params={"product_type_id": str(inv_product_type.id), "count_date": TODAY.isoformat()}, headers=auth_headers_admin)
    assert resp.status_code == 200
    varieties = resp.json()["data"]["product_lines"][0]["varieties"]
    assert varieties[0]["count_value"] == 42
    assert varieties[0]["is_done"] is True


async def test_list_counts_invalid_product_type(async_client: AsyncClient, auth_headers_admin):
    """GET /counts returns 404 for nonexistent product type."""
    resp = await async_client.get(
        f"{BASE}/counts",
        params={"product_type_id": str(uuid.uuid4()), "count_date": TODAY.isoformat()}, headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /counts — create new
# ---------------------------------------------------------------------------


async def test_save_counts_create_new(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """PUT /counts creates new DailyCount records and audit logs."""
    payload = {
        "product_type_id": str(inv_product_type.id),
        "count_date": TODAY.isoformat(),
        "counts": [
            {
                "variety_id": str(inv_variety.id),
                "count_value": 50,
                "is_done": False,
            }
        ],
    }
    resp = await async_client.put(f"{BASE}/counts", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["saved_count"] == 1

    # Verify DB record
    dc = await DailyCount.get(variety_id=inv_variety.id, count_date=TODAY)
    assert dc.count_value == 50
    assert dc.entered_by == "admin@oregonflowers.com"

    # Verify audit log
    logs = await CountAuditLog.filter(daily_count=dc).all()
    assert len(logs) == 1
    assert logs[0].action == "set"
    assert logs[0].amount == 50


# ---------------------------------------------------------------------------
# PUT /counts — update existing
# ---------------------------------------------------------------------------


async def test_save_counts_update_existing(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """PUT /counts updates an existing DailyCount and creates a new audit log entry."""
    await DailyCount.create(
        variety=inv_variety,
        product_type=inv_product_type,
        count_date=TODAY,
        count_value=10,
        entered_by="old_user",
    )
    payload = {
        "product_type_id": str(inv_product_type.id),
        "count_date": TODAY.isoformat(),
        "counts": [
            {
                "variety_id": str(inv_variety.id),
                "count_value": 75,
                "is_done": True,
            }
        ],
    }
    resp = await async_client.put(f"{BASE}/counts", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["saved_count"] == 1

    dc = await DailyCount.get(variety_id=inv_variety.id, count_date=TODAY)
    assert dc.count_value == 75
    assert dc.is_done is True
    assert dc.entered_by == "admin@oregonflowers.com"

    logs = await CountAuditLog.filter(daily_count=dc).all()
    assert len(logs) == 1
    assert logs[0].amount == 75


# ---------------------------------------------------------------------------
# PUT /counts — invalid variety skipped
# ---------------------------------------------------------------------------


async def test_save_counts_skips_invalid_variety(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """PUT /counts skips entries with invalid variety IDs."""
    fake_id = uuid.uuid4()
    payload = {
        "product_type_id": str(inv_product_type.id),
        "count_date": TODAY.isoformat(),
        "counts": [
            {"variety_id": str(inv_variety.id), "count_value": 10, "is_done": False},
            {"variety_id": str(fake_id), "count_value": 99, "is_done": False},
        ],
    }
    resp = await async_client.put(f"{BASE}/counts", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 200
    # Only the valid variety should be saved
    assert resp.json()["data"]["saved_count"] == 1


# ---------------------------------------------------------------------------
# PUT /counts — rejects when sheet complete (409)
# ---------------------------------------------------------------------------


async def test_save_counts_rejects_when_sheet_complete(
    async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """PUT /counts returns 409 when the daily_count sheet is already complete."""
    await SheetCompletion.create(
        product_type=inv_product_type,
        sheet_type="daily_count",
        sheet_date=TODAY,
        is_complete=True,
        completed_by="admin",
    )
    payload = {
        "product_type_id": str(inv_product_type.id),
        "count_date": TODAY.isoformat(),
        "counts": [
            {"variety_id": str(inv_variety.id), "count_value": 10, "is_done": False},
        ],
    }
    resp = await async_client.put(f"{BASE}/counts", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 409
    assert "complete" in resp.json()["error"].lower()


# ---------------------------------------------------------------------------
# GET /counts/{variety_id}/audit-log
# ---------------------------------------------------------------------------


async def test_audit_log_empty(async_client: AsyncClient, inv_variety, auth_headers_admin):
    """GET /counts/{variety_id}/audit-log returns empty when no counts exist."""
    resp = await async_client.get(
        f"{BASE}/counts/{inv_variety.id}/audit-log",
        params={"count_date": TODAY.isoformat()}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_audit_log_returns_entries(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """GET /counts/{variety_id}/audit-log returns audit entries after saving."""
    # Save a count to generate an audit log entry
    payload = {
        "product_type_id": str(inv_product_type.id),
        "count_date": TODAY.isoformat(),
        "counts": [
            {"variety_id": str(inv_variety.id), "count_value": 30, "is_done": False},
        ],
    }
    await async_client.put(f"{BASE}/counts", json=payload, headers=auth_headers_admin)

    resp = await async_client.get(
        f"{BASE}/counts/{inv_variety.id}/audit-log",
        params={"count_date": TODAY.isoformat()}, headers=auth_headers_admin)
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert len(entries) == 1
    assert entries[0]["action"] == "set"
    assert entries[0]["amount"] == 30
    assert entries[0]["entered_by"] == "admin@oregonflowers.com"


# ---------------------------------------------------------------------------
# GET /counts/recent/{variety_id}
# ---------------------------------------------------------------------------


async def test_recent_counts_empty(async_client: AsyncClient, inv_variety, auth_headers_admin):
    """GET /counts/recent/{variety_id} returns empty list when no counts exist."""
    resp = await async_client.get(f"{BASE}/counts/recent/{inv_variety.id}", headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_recent_counts_returns_data(async_client: AsyncClient, inv_product_type, inv_variety, auth_headers_admin):
    """GET /counts/recent/{variety_id} returns last 5 counts ordered by date desc."""
    for i in range(7):
        await DailyCount.create(
            variety=inv_variety,
            product_type=inv_product_type,
            count_date=date(2026, 4, 1 + i),
            count_value=10 + i,
        )
    resp = await async_client.get(f"{BASE}/counts/recent/{inv_variety.id}", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 5
    # Most recent first
    assert data[0]["count_date"] == "2026-04-07"


async def test_recent_counts_not_found(async_client: AsyncClient, auth_headers_admin):
    """GET /counts/recent/{variety_id} returns 404 for nonexistent variety."""
    resp = await async_client.get(f"{BASE}/counts/recent/{uuid.uuid4()}", headers=auth_headers_admin)
    assert resp.status_code == 404
