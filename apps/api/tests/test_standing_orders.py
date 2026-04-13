"""Tests for standing order CRUD, status transitions, cadence matching, and order generation."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.customer import Customer
from app.models.order import Order, OrderLine
from app.models.product import Color, ProductLine, ProductType, SalesItem, Variety
from app.models.standing_order import (
    StandingOrder,
    StandingOrderAuditLog,
    StandingOrderLine,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def customer():
    return await Customer.create(customer_number=2001, name="Standing Test Shop")


@pytest.fixture
async def customer_b():
    return await Customer.create(customer_number=2002, name="Bloom Boutique B")


@pytest.fixture
async def sales_items():
    """Create two sales items."""
    pt = await ProductType.create(name="Cut Flower")
    pl = await ProductLine.create(product_type=pt, name="Rose")
    color = await Color.create(name="Red")
    variety = await Variety.create(
        product_line=pl, name="Freedom", color=color, flowering_type="Hybrid Tea"
    )
    si_a = await SalesItem.create(
        variety=variety, name="Freedom 25st", stems_per_order=25, retail_price=12.50
    )
    si_b = await SalesItem.create(
        variety=variety, name="Freedom 10st", stems_per_order=10, retail_price=8.00
    )
    return si_a, si_b


def _build_create_payload(customer, sales_items, **overrides):
    """Build a valid standing order create payload."""
    si_a, si_b = sales_items
    payload = {
        "customer_id": str(customer.id),
        "frequency_weeks": 1,
        "days_of_week": [0, 2, 4],  # Mon, Wed, Fri
        "reference_date": "2026-04-13",  # a Monday
        "ship_via": "FedEx",
        "salesperson_email": "sales@test.com",
        "notes": "Weekly standing order",
        "lines": [
            {
                "sales_item_id": str(si_a.id),
                "stems": 50,
                "price_per_stem": 0.75,
                "color_variety": "Red",
            },
            {
                "sales_item_id": str(si_b.id),
                "stems": 30,
                "price_per_stem": 0.60,
            },
        ],
    }
    payload.update(overrides)
    return payload


async def _create_standing_order_via_api(client, customer, sales_items, headers=None, **overrides):
    """Helper to create a standing order and return the response data."""
    payload = _build_create_payload(customer, sales_items, **overrides)
    resp = await client.post("/api/v1/standing-orders", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_standing_order(async_client, customer, sales_items, auth_headers_admin):
    data = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    assert data["status"] == "active"
    assert data["customer_name"] == "Standing Test Shop"
    assert data["frequency_weeks"] == 1
    assert data["days_of_week"] == [0, 2, 4]
    assert data["lines_count"] == 2


@pytest.mark.anyio
async def test_create_invalid_customer(async_client, sales_items, auth_headers_admin):
    si_a, _ = sales_items
    payload = {
        "customer_id": str(uuid.uuid4()),
        "frequency_weeks": 1,
        "days_of_week": [0],
        "reference_date": "2026-04-13",
        "lines": [{"sales_item_id": str(si_a.id), "stems": 10, "price_per_stem": 1.0}],
    }
    resp = await async_client.post("/api/v1/standing-orders", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "not found" in resp.json()["error"].lower()


@pytest.mark.anyio
async def test_create_empty_lines(async_client, customer, auth_headers_admin):
    payload = {
        "customer_id": str(customer.id),
        "frequency_weeks": 1,
        "days_of_week": [0],
        "reference_date": "2026-04-13",
        "lines": [],
    }
    resp = await async_client.post("/api/v1/standing-orders", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_invalid_frequency(async_client, customer, sales_items, auth_headers_admin):
    si_a, _ = sales_items
    payload = {
        "customer_id": str(customer.id),
        "frequency_weeks": 3,
        "days_of_week": [0],
        "reference_date": "2026-04-13",
        "lines": [{"sales_item_id": str(si_a.id), "stems": 10, "price_per_stem": 1.0}],
    }
    resp = await async_client.post("/api/v1/standing-orders", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_invalid_days_of_week(async_client, customer, sales_items, auth_headers_admin):
    si_a, _ = sales_items
    payload = {
        "customer_id": str(customer.id),
        "frequency_weeks": 1,
        "days_of_week": [7],
        "reference_date": "2026-04-13",
        "lines": [{"sales_item_id": str(si_a.id), "stems": 10, "price_per_stem": 1.0}],
    }
    resp = await async_client.post("/api/v1/standing-orders", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_default_active_only(async_client, customer, sales_items, auth_headers_admin):
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    # Create a second and pause it
    data2 = await _create_standing_order_via_api(
        async_client, customer, sales_items, headers=auth_headers_admin, days_of_week=[1]
    )
    await async_client.post(
        f"/api/v1/standing-orders/{data2['id']}/pause",
        json={"reason": "vacation"}, headers=auth_headers_admin)

    resp = await async_client.get("/api/v1/standing-orders", headers=auth_headers_admin)
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1
    assert items[0]["status"] == "active"


@pytest.mark.anyio
async def test_list_filter_all(async_client, customer, sales_items, auth_headers_admin):
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    data2 = await _create_standing_order_via_api(
        async_client, customer, sales_items, headers=auth_headers_admin, days_of_week=[1]
    )
    await async_client.post(
        f"/api/v1/standing-orders/{data2['id']}/pause",
        json={"reason": "vacation"}, headers=auth_headers_admin)

    resp = await async_client.get("/api/v1/standing-orders?status=all", headers=auth_headers_admin)
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 2


@pytest.mark.anyio
async def test_list_filter_paused(async_client, customer, sales_items, auth_headers_admin):
    data = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{data['id']}/pause",
        json={"reason": "vacation"}, headers=auth_headers_admin)

    resp = await async_client.get("/api/v1/standing-orders?status=paused", headers=auth_headers_admin)
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1
    assert items[0]["status"] == "paused"


@pytest.mark.anyio
async def test_list_search_by_customer_name(async_client, customer, customer_b, sales_items, auth_headers_admin):
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await _create_standing_order_via_api(async_client, customer_b, sales_items, headers=auth_headers_admin)

    resp = await async_client.get("/api/v1/standing-orders?status=all&search=Boutique", headers=auth_headers_admin)
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1
    assert "Boutique" in items[0]["customer_name"]


@pytest.mark.anyio
async def test_list_filter_by_salesperson(async_client, customer, sales_items, auth_headers_admin):
    await _create_standing_order_via_api(
        async_client, customer, sales_items, headers=auth_headers_admin, salesperson_email="alice@test.com"
    )
    await _create_standing_order_via_api(
        async_client, customer, sales_items,
        headers=auth_headers_admin,
        salesperson_email="bob@test.com",
        days_of_week=[1],
    )

    resp = await async_client.get(
        "/api/v1/standing-orders?status=all&salesperson_email=alice", headers=auth_headers_admin)
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1


# ---------------------------------------------------------------------------
# GET DETAIL
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_detail(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.get(f"/api/v1/standing-orders/{created['id']}", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == created["id"]
    assert len(data["lines"]) == 2
    assert data["cadence_description"] == "Every week on Mon, Wed, Fri"
    assert data["days_of_week_names"] == ["Monday", "Wednesday", "Friday"]


@pytest.mark.anyio
async def test_get_detail_404(async_client, auth_headers_admin):
    resp = await async_client.get(f"/api/v1/standing-orders/{uuid.uuid4()}", headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_header_fields(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={
            "frequency_weeks": 2,
            "ship_via": "UPS",
            "reason": "Customer requested biweekly",
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["frequency_weeks"] == 2
    assert data["ship_via"] == "UPS"


@pytest.mark.anyio
async def test_update_lines(async_client, customer, sales_items, auth_headers_admin):
    si_a, si_b = sales_items
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Get existing lines
    detail = await async_client.get(f"/api/v1/standing-orders/{created['id']}", headers=auth_headers_admin)
    lines = detail.json()["data"]["lines"]

    # Keep first line (modified stems), drop second, add no new
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={
            "reason": "Adjusted quantities",
            "lines": [
                {
                    "id": lines[0]["id"],
                    "sales_item_id": lines[0]["sales_item_id"],
                    "stems": 100,
                    "price_per_stem": 0.75,
                    "color_variety": "Red",
                },
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["lines"]) == 1
    assert data["lines"][0]["stems"] == 100


@pytest.mark.anyio
async def test_update_creates_audit_log(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={"ship_via": "UPS", "reason": "Changed carrier"}, headers=auth_headers_admin)

    resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    assert resp.status_code == 200
    entries = resp.json()["data"]
    update_entry = next(e for e in entries if e["action"] == "updated")
    assert update_entry["reason"] == "Changed carrier"
    ship_via_change = next(
        c for c in update_entry["changes"] if c["field"] == "ship_via"
    )
    assert ship_via_change["old_value"] == "FedEx"
    assert ship_via_change["new_value"] == "UPS"


@pytest.mark.anyio
async def test_update_409_when_paused(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "temp"}, headers=auth_headers_admin)
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={"ship_via": "UPS", "reason": "try update"}, headers=auth_headers_admin)
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_update_409_when_cancelled(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "done"}, headers=auth_headers_admin)
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={"ship_via": "UPS", "reason": "try update"}, headers=auth_headers_admin)
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# PAUSE
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_pause_happy_path(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "Customer on vacation"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "paused"


@pytest.mark.anyio
async def test_pause_409_when_not_active(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    # Pause first
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "first"}, headers=auth_headers_admin)
    # Try to pause again
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "again"}, headers=auth_headers_admin)
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_pause_audit_log(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "vacation"}, headers=auth_headers_admin)
    resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    entries = resp.json()["data"]
    paused_entry = next(e for e in entries if e["action"] == "paused")
    assert paused_entry["reason"] == "vacation"


# ---------------------------------------------------------------------------
# RESUME
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_resume_happy_path(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "temp"}, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/resume",
        json={}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "active"


@pytest.mark.anyio
async def test_resume_409_when_active(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/resume",
        json={}, headers=auth_headers_admin)
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_resume_409_when_cancelled(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "closed"}, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/resume",
        json={}, headers=auth_headers_admin)
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_resume_audit_log(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "temp"}, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/resume",
        json={}, headers=auth_headers_admin)
    resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    entries = resp.json()["data"]
    assert any(e["action"] == "resumed" for e in entries)


# ---------------------------------------------------------------------------
# CANCEL
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_cancel_happy_path(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "Customer account closed"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "cancelled"


@pytest.mark.anyio
async def test_cancel_409_when_already_cancelled(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "first"}, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "again"}, headers=auth_headers_admin)
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_cancel_from_paused(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "temp"}, headers=auth_headers_admin)
    resp = await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "actually closing"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "cancelled"


@pytest.mark.anyio
async def test_cancel_audit_log(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/cancel",
        json={"reason": "closing"}, headers=auth_headers_admin)
    resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    entries = resp.json()["data"]
    cancel_entry = next(e for e in entries if e["action"] == "cancelled")
    assert cancel_entry["reason"] == "closing"


# ---------------------------------------------------------------------------
# GENERATE PREVIEW
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_generate_preview_cadence_match(async_client, customer, sales_items, auth_headers_admin):
    """A weekly Mon/Wed/Fri order should match Mon Apr 13, Wed Apr 15, Fri Apr 17."""
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    resp = await async_client.post(
        "/api/v1/standing-orders/generate-preview",
        json={"date_from": "2026-04-13", "date_to": "2026-04-17"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    dates = [m["generate_date"] for m in data["matches"]]
    assert "2026-04-13" in dates  # Monday
    assert "2026-04-15" in dates  # Wednesday
    assert "2026-04-17" in dates  # Friday
    assert "2026-04-14" not in dates  # Tuesday - not in cadence


@pytest.mark.anyio
async def test_generate_preview_two_week_cycle(async_client, customer, sales_items, auth_headers_admin):
    """A biweekly Mon order should match week 1 but not week 2."""
    await _create_standing_order_via_api(
        async_client, customer, sales_items,
        headers=auth_headers_admin,
        frequency_weeks=2,
        days_of_week=[0],  # Monday only
        reference_date="2026-04-13",  # This is a Monday
    )

    # Check two consecutive Mondays
    resp = await async_client.post(
        "/api/v1/standing-orders/generate-preview",
        json={"date_from": "2026-04-13", "date_to": "2026-04-27"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    dates = [m["generate_date"] for m in resp.json()["data"]["matches"]]
    assert "2026-04-13" in dates  # Week 0 (reference) - match
    assert "2026-04-20" not in dates  # Week 1 - skip
    assert "2026-04-27" in dates  # Week 2 - match

    # Generate an order for week 0 date, then verify already_generated in preview
    await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    resp2 = await async_client.post(
        "/api/v1/standing-orders/generate-preview",
        json={"date_from": "2026-04-13", "date_to": "2026-04-27"}, headers=auth_headers_admin)
    matches = resp2.json()["data"]["matches"]
    match_map = {m["generate_date"]: m for m in matches}
    assert match_map["2026-04-13"]["already_generated"] is True
    assert match_map["2026-04-27"]["already_generated"] is False


@pytest.mark.anyio
async def test_generate_preview_duplicate_detection(async_client, customer, sales_items, auth_headers_admin):
    """Already-generated orders should be flagged."""
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Generate orders first
    await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)

    # Preview should show already_generated
    resp = await async_client.post(
        "/api/v1/standing-orders/generate-preview",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    matches = resp.json()["data"]["matches"]
    assert len(matches) == 1
    assert matches[0]["already_generated"] is True


# ---------------------------------------------------------------------------
# GENERATE ORDERS
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_generate_orders_creates_linked_orders(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    resp = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["orders_created"] == 1
    assert len(data["order_ids"]) == 1

    # Verify the generated order is linked
    order = await Order.get(id=data["order_ids"][0]).prefetch_related("lines")
    assert str(order.standing_order_id) == created["id"]
    assert len(order.lines) == 2  # type: ignore[arg-type]

    # Verify line field values — price_per_stem, effective_price_per_stem, stems
    lines_sorted = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]
    line_a = lines_sorted[0]
    assert line_a.stems == 50
    assert float(line_a.price_per_stem) == 0.75
    # No fee on these lines, so effective == price
    assert float(line_a.effective_price_per_stem) == 0.75

    line_b = lines_sorted[1]
    assert line_b.stems == 30
    assert float(line_b.price_per_stem) == 0.60
    assert float(line_b.effective_price_per_stem) == 0.60


@pytest.mark.anyio
async def test_generate_orders_skips_duplicates(async_client, customer, sales_items, auth_headers_admin):
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Generate once
    resp1 = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp1.json()["data"]["orders_created"] == 1

    # Generate again — should skip
    resp2 = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp2.json()["data"]["orders_created"] == 0
    assert resp2.json()["data"]["orders_skipped"] == 1


@pytest.mark.anyio
async def test_generate_orders_excludes_paused(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    await async_client.post(
        f"/api/v1/standing-orders/{created['id']}/pause",
        json={"reason": "vacation"}, headers=auth_headers_admin)

    resp = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp.json()["data"]["orders_created"] == 0


@pytest.mark.anyio
async def test_generate_orders_multi_day(async_client, customer, sales_items, auth_headers_admin):
    """Mon/Wed/Fri weekly over a full week should generate 3 orders."""
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    resp = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-17"}, headers=auth_headers_admin)
    assert resp.status_code == 201
    assert resp.json()["data"]["orders_created"] == 3


# ---------------------------------------------------------------------------
# AUDIT LOG RETRIEVAL
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_audit_log_list(async_client, customer, sales_items, auth_headers_admin):
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert len(entries) >= 1
    created_entry = entries[-1]
    assert created_entry["action"] == "created"  # oldest entry
    assert isinstance(created_entry["changes"], list)
    assert created_entry["entered_by"] == "admin@oregonflowers.com"


@pytest.mark.anyio
async def test_audit_log_404(async_client, auth_headers_admin):
    resp = await async_client.get(
        f"/api/v1/standing-orders/{uuid.uuid4()}/audit-log", headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# MISSING: 404 cases for PUT, pause, resume, cancel
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_404(async_client, auth_headers_admin):
    resp = await async_client.put(
        f"/api/v1/standing-orders/{uuid.uuid4()}",
        json={"ship_via": "UPS", "reason": "test"}, headers=auth_headers_admin)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_pause_404(async_client, auth_headers_admin):
    resp = await async_client.post(
        f"/api/v1/standing-orders/{uuid.uuid4()}/pause",
        json={"reason": "test"}, headers=auth_headers_admin)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_resume_404(async_client, auth_headers_admin):
    resp = await async_client.post(
        f"/api/v1/standing-orders/{uuid.uuid4()}/resume",
        json={}, headers=auth_headers_admin)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_cancel_404(async_client, auth_headers_admin):
    resp = await async_client.post(
        f"/api/v1/standing-orders/{uuid.uuid4()}/cancel",
        json={"reason": "test"}, headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# MISSING: Zero stems on update (422)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_zero_stems_422(async_client, customer, sales_items, auth_headers_admin):
    si_a, _ = sales_items
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)
    detail = await async_client.get(f"/api/v1/standing-orders/{created['id']}", headers=auth_headers_admin)
    lines = detail.json()["data"]["lines"]

    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={
            "reason": "testing zero stems",
            "lines": [
                {
                    "id": lines[0]["id"],
                    "sales_item_id": lines[0]["sales_item_id"],
                    "stems": 0,
                    "price_per_stem": 0.75,
                },
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# MISSING: 4-week cadence
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_generate_preview_four_week_cycle(async_client, customer, sales_items, auth_headers_admin):
    """A 4-week Mon order should match week 0 and week 4, skip weeks 1-3."""
    await _create_standing_order_via_api(
        async_client, customer, sales_items,
        headers=auth_headers_admin,
        frequency_weeks=4,
        days_of_week=[0],  # Monday only
        reference_date="2026-04-13",  # Monday
    )

    # Check 5 consecutive Mondays (weeks 0-4)
    resp = await async_client.post(
        "/api/v1/standing-orders/generate-preview",
        json={"date_from": "2026-04-13", "date_to": "2026-05-11"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    dates = [m["generate_date"] for m in resp.json()["data"]["matches"]]
    assert "2026-04-13" in dates   # Week 0 - match
    assert "2026-04-20" not in dates  # Week 1 - skip
    assert "2026-04-27" not in dates  # Week 2 - skip
    assert "2026-05-04" not in dates  # Week 3 - skip
    assert "2026-05-11" in dates   # Week 4 - match


# ---------------------------------------------------------------------------
# MISSING: Generate with no matches
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_generate_no_matching_dates(async_client, customer, sales_items, auth_headers_admin):
    """Generate for a date range where no cadences fire returns 0 orders."""
    # Mon/Wed/Fri standing order
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Request only Tuesday Apr 14 — no match
    resp = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-14", "date_to": "2026-04-14"}, headers=auth_headers_admin)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["orders_created"] == 0
    assert data["orders_skipped"] == 0
    assert data["order_ids"] == []


# ---------------------------------------------------------------------------
# MISSING: apply_to_future_orders=true
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_apply_to_future_orders(async_client, customer, sales_items, auth_headers_admin):
    """Updating with apply_to_future_orders=true rewrites future order lines."""
    si_a, si_b = sales_items
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Generate an order for a future date (Mon Apr 20 — 1 week out)
    gen_resp = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-20", "date_to": "2026-04-20"}, headers=auth_headers_admin)
    assert gen_resp.status_code == 201
    order_id = gen_resp.json()["data"]["order_ids"][0]

    # Verify original lines
    order = await Order.get(id=order_id).prefetch_related("lines")
    original_lines = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]
    assert len(original_lines) == 2
    assert original_lines[0].stems == 50

    # Get existing standing order lines
    detail = await async_client.get(f"/api/v1/standing-orders/{created['id']}", headers=auth_headers_admin)
    so_lines = detail.json()["data"]["lines"]

    # Update standing order: change stems on first line, apply to future
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={
            "reason": "Volume increase",
            "apply_to_future_orders": True,
            "lines": [
                {
                    "id": so_lines[0]["id"],
                    "sales_item_id": so_lines[0]["sales_item_id"],
                    "stems": 200,
                    "price_per_stem": 0.80,
                    "color_variety": "Red",
                },
                {
                    "id": so_lines[1]["id"],
                    "sales_item_id": so_lines[1]["sales_item_id"],
                    "stems": 30,
                    "price_per_stem": 0.60,
                },
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 200

    # Re-fetch the future order — lines should be updated
    order = await Order.get(id=order_id).prefetch_related("lines")
    updated_lines = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]
    assert len(updated_lines) == 2
    assert updated_lines[0].stems == 200
    assert float(updated_lines[0].price_per_stem) == 0.80


# ---------------------------------------------------------------------------
# MISSING: skip_already_generated=false (duplicate creation)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_generate_skip_already_generated_false(async_client, customer, sales_items, auth_headers_admin):
    """With skip_already_generated=false, a duplicate order should be created."""
    await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    # Generate once
    resp1 = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={"date_from": "2026-04-13", "date_to": "2026-04-13"}, headers=auth_headers_admin)
    assert resp1.json()["data"]["orders_created"] == 1

    # Generate again with skip_already_generated=false
    resp2 = await async_client.post(
        "/api/v1/standing-orders/generate",
        json={
            "date_from": "2026-04-13",
            "date_to": "2026-04-13",
            "skip_already_generated": False,
        }, headers=auth_headers_admin)
    data = resp2.json()["data"]
    assert data["orders_created"] == 1
    assert data["orders_skipped"] == 0
    assert len(data["order_ids"]) == 1


# ---------------------------------------------------------------------------
# SHALLOW #3: test_update_lines — add new line (no id)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_add_new_line(async_client, customer, sales_items, auth_headers_admin):
    """Sending a line without an id via the update endpoint creates a new line."""
    si_a, si_b = sales_items
    created = await _create_standing_order_via_api(async_client, customer, sales_items, headers=auth_headers_admin)

    detail = await async_client.get(f"/api/v1/standing-orders/{created['id']}", headers=auth_headers_admin)
    lines = detail.json()["data"]["lines"]
    assert len(lines) == 2

    # Keep existing lines, add a third (no id)
    resp = await async_client.put(
        f"/api/v1/standing-orders/{created['id']}",
        json={
            "reason": "Adding a third line",
            "lines": [
                {
                    "id": lines[0]["id"],
                    "sales_item_id": lines[0]["sales_item_id"],
                    "stems": lines[0]["stems"],
                    "price_per_stem": float(lines[0]["price_per_stem"]),
                    "color_variety": lines[0].get("color_variety"),
                },
                {
                    "id": lines[1]["id"],
                    "sales_item_id": lines[1]["sales_item_id"],
                    "stems": lines[1]["stems"],
                    "price_per_stem": float(lines[1]["price_per_stem"]),
                },
                {
                    "sales_item_id": str(si_a.id),
                    "stems": 75,
                    "price_per_stem": 0.50,
                    "color_variety": "Pink",
                },
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["lines"]) == 3

    new_line = next(l for l in data["lines"] if l["stems"] == 75)
    assert new_line["color_variety"] == "Pink"
    assert float(new_line["price_per_stem"]) == 0.50

    # Verify audit log captured line_added
    audit_resp = await async_client.get(
        f"/api/v1/standing-orders/{created['id']}/audit-log", headers=auth_headers_admin)
    entries = audit_resp.json()["data"]
    update_entry = next(e for e in entries if e["action"] == "updated")
    assert any(c["field"] == "line_added" for c in update_entry["changes"])
