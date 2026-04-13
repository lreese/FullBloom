"""Tests for order list, update, delete, and audit log endpoints."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.customer import Customer
from app.models.order import Order, OrderAuditLog, OrderLine
from app.models.product import ProductLine, ProductType, SalesItem, Variety, Color


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def customer():
    """Create a test customer."""
    return await Customer.create(
        customer_number=1001,
        name="Test Flower Shop",
    )


@pytest.fixture
async def customer_b():
    """Create a second test customer."""
    return await Customer.create(
        customer_number=1002,
        name="Bloom Boutique",
    )


@pytest.fixture
async def sales_item_pair():
    """Create two sales items for order line tests."""
    pt = await ProductType.create(name="Cut Flower")
    pl = await ProductLine.create(product_type=pt, name="Rose")
    color = await Color.create(name="Red")
    variety = await Variety.create(
        product_line=pl,
        name="Freedom",
        color=color,
        flowering_type="Hybrid Tea",
    )
    si_a = await SalesItem.create(
        variety=variety, name="Freedom 25st", stems_per_order=25, retail_price=12.50
    )
    si_b = await SalesItem.create(
        variety=variety, name="Freedom 10st", stems_per_order=10, retail_price=8.00
    )
    return si_a, si_b


async def _create_order_directly(
    customer, sales_items, order_number="ORD-20260412-001", order_date="2026-04-12",
    ship_via="FedEx", salesperson_email="sales@test.com",
):
    """Helper: create an order directly in the DB, bypassing the service."""
    order = await Order.create(
        order_number=order_number,
        customer=customer,
        order_date=order_date,
        ship_via=ship_via,
        price_list="Retail",
        salesperson_email=salesperson_email,
    )
    for idx, si in enumerate(sales_items, start=1):
        await OrderLine.create(
            order=order,
            sales_item=si,
            stems=25,
            list_price_per_stem=si.retail_price,
            price_per_stem=si.retail_price,
            effective_price_per_stem=si.retail_price,
            line_number=idx,
        )
    return order


# ---------------------------------------------------------------------------
# List endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_orders_empty(async_client: AsyncClient, auth_headers_admin):
    resp = await async_client.get("/api/v1/orders", headers=auth_headers_admin)
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] == 0
    assert body["items"] == []
    assert body["offset"] == 0
    assert body["limit"] == 25


@pytest.mark.anyio
async def test_list_orders_with_data(async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, si_b = sales_item_pair
    await _create_order_directly(customer, [si_a, si_b])
    await _create_order_directly(
        customer, [si_a], order_number="ORD-20260412-002", order_date="2026-04-11"
    )

    resp = await async_client.get("/api/v1/orders", headers=auth_headers_admin)
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] == 2
    assert len(body["items"]) == 2
    # First item should be newest by order_date
    assert body["items"][0]["order_number"] == "ORD-20260412-001"
    assert body["items"][0]["customer_name"] == "Test Flower Shop"
    assert body["items"][0]["lines_count"] == 2
    assert body["items"][0]["total_stems"] == 50


@pytest.mark.anyio
async def test_list_orders_pagination(async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    for i in range(5):
        await _create_order_directly(
            customer, [si_a], order_number=f"ORD-20260412-{i+1:03d}"
        )

    resp = await async_client.get("/api/v1/orders?offset=0&limit=2", headers=auth_headers_admin)
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["limit"] == 2

    resp2 = await async_client.get("/api/v1/orders?offset=2&limit=2", headers=auth_headers_admin)
    body2 = resp2.json()["data"]
    assert len(body2["items"]) == 2
    assert body2["offset"] == 2


@pytest.mark.anyio
async def test_list_orders_date_range_filter(async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    await _create_order_directly(
        customer, [si_a], order_number="ORD-EARLY-001", order_date="2026-04-01"
    )
    await _create_order_directly(
        customer, [si_a], order_number="ORD-MID-001", order_date="2026-04-10"
    )
    await _create_order_directly(
        customer, [si_a], order_number="ORD-LATE-001", order_date="2026-04-20"
    )

    resp = await async_client.get("/api/v1/orders?date_from=2026-04-05&date_to=2026-04-15", headers=auth_headers_admin)
    body = resp.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["order_number"] == "ORD-MID-001"


@pytest.mark.anyio
async def test_list_orders_customer_filter(
    async_client: AsyncClient, customer, customer_b, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    await _create_order_directly(customer, [si_a], order_number="ORD-A-001")
    await _create_order_directly(customer_b, [si_a], order_number="ORD-B-001")

    resp = await async_client.get(f"/api/v1/orders?customer_id={customer.id}", headers=auth_headers_admin)
    body = resp.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["order_number"] == "ORD-A-001"


@pytest.mark.anyio
async def test_list_orders_search_by_order_number(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    await _create_order_directly(customer, [si_a], order_number="ORD-20260412-001")
    await _create_order_directly(customer, [si_a], order_number="ORD-20260413-999")

    resp = await async_client.get("/api/v1/orders?search=999", headers=auth_headers_admin)
    body = resp.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["order_number"] == "ORD-20260413-999"


@pytest.mark.anyio
async def test_list_orders_search_by_customer_name(
    async_client: AsyncClient, customer, customer_b, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    await _create_order_directly(customer, [si_a], order_number="ORD-A-001")
    await _create_order_directly(customer_b, [si_a], order_number="ORD-B-001")

    resp = await async_client.get("/api/v1/orders?search=Bloom", headers=auth_headers_admin)
    body = resp.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["customer_name"] == "Bloom Boutique"


# ---------------------------------------------------------------------------
# Update endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_order_header_fields(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    resp = await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={"ship_via": "UPS", "order_notes": "Updated notes"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["ship_via"] == "UPS"
    assert data["order_notes"] == "Updated notes"


@pytest.mark.anyio
async def test_update_order_add_line(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, si_b = sales_item_pair
    order = await _create_order_directly(customer, [si_a])
    await order.fetch_related("lines")
    existing_line = list(order.lines)[0]  # type: ignore[attr-defined]

    resp = await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={
            "lines": [
                {
                    "id": str(existing_line.id),
                    "sales_item_id": str(si_a.id),
                    "stems": 25,
                    "price_per_stem": 12.50,
                },
                {
                    "sales_item_id": str(si_b.id),
                    "stems": 10,
                    "price_per_stem": 8.00,
                },
            ]
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["lines"]) == 2


@pytest.mark.anyio
async def test_update_order_remove_line(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, si_b = sales_item_pair
    order = await _create_order_directly(customer, [si_a, si_b])
    await order.fetch_related("lines")
    lines = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]
    keep_line = lines[0]

    resp = await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={
            "lines": [
                {
                    "id": str(keep_line.id),
                    "sales_item_id": str(si_a.id),
                    "stems": 25,
                    "price_per_stem": 12.50,
                },
            ]
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["lines"]) == 1


@pytest.mark.anyio
async def test_update_order_modify_line(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])
    await order.fetch_related("lines")
    existing_line = list(order.lines)[0]  # type: ignore[attr-defined]

    resp = await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={
            "lines": [
                {
                    "id": str(existing_line.id),
                    "sales_item_id": str(si_a.id),
                    "stems": 50,
                    "price_per_stem": 10.00,
                },
            ]
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["lines"][0]["stems"] == 50
    assert float(data["lines"][0]["price_per_stem"]) == 10.00


@pytest.mark.anyio
async def test_update_order_creates_audit_log(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={"ship_via": "DHL"}, headers=auth_headers_admin)

    logs = await OrderAuditLog.filter(order_id=order.id).all()
    assert len(logs) == 1
    assert logs[0].action == "updated"
    # The changes should include ship_via
    field_names = [c["field"] for c in logs[0].changes]
    assert "ship_via" in field_names


@pytest.mark.anyio
async def test_update_order_not_found(async_client: AsyncClient, auth_headers_admin):
    fake_id = str(uuid.uuid4())
    resp = await async_client.put(
        f"/api/v1/orders/{fake_id}",
        json={"ship_via": "UPS"}, headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_delete_order_success(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    resp = await async_client.delete(f"/api/v1/orders/{order.id}", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["deleted"] is True
    assert data["order_number"] == "ORD-20260412-001"

    # Verify order is soft-deleted (still in DB but flagged)
    order_after = await Order.get_or_none(id=order.id)
    assert order_after is not None
    assert order_after.is_deleted is True

    # Verify soft-deleted order is hidden from list and get endpoints
    list_resp = await async_client.get("/api/v1/orders", headers=auth_headers_admin)
    assert len(list_resp.json()["data"]["items"]) == 0

    get_resp = await async_client.get(f"/api/v1/orders/{order.id}", headers=auth_headers_admin)
    assert get_resp.status_code == 404


@pytest.mark.anyio
async def test_delete_order_not_found(async_client: AsyncClient, auth_headers_admin):
    fake_id = str(uuid.uuid4())
    resp = await async_client.delete(f"/api/v1/orders/{fake_id}", headers=auth_headers_admin)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_delete_order_creates_audit_log(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])
    order_id = str(order.id)

    await async_client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers_admin)

    # Soft delete preserves audit log — verify the "deleted" entry exists
    from app.models.order import OrderAuditLog
    logs = await OrderAuditLog.filter(order_id=order_id, action="deleted").all()
    assert len(logs) == 1
    assert logs[0].changes[0]["field"] == "snapshot"
    assert logs[0].changes[0]["old_value"]["order_number"] is not None


# ---------------------------------------------------------------------------
# Audit log endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_audit_log_retrieval(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    # Create some audit log entries
    await OrderAuditLog.create(
        order=order, action="created", changes=[], entered_by=None
    )
    await OrderAuditLog.create(
        order=order,
        action="updated",
        changes=[{"field": "ship_via", "old_value": "FedEx", "new_value": "UPS"}],
        entered_by="admin@test.com",
    )

    resp = await async_client.get(f"/api/v1/orders/{order.id}/audit-log", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    # Most recent first
    assert data[0]["action"] == "updated"
    assert data[0]["entered_by"] == "admin@test.com"
    assert data[1]["action"] == "created"


@pytest.mark.anyio
async def test_audit_log_not_found(async_client: AsyncClient, auth_headers_admin):
    fake_id = str(uuid.uuid4())
    resp = await async_client.get(f"/api/v1/orders/{fake_id}/audit-log", headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create endpoint tests (via API)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_order_audit_log_written(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Verify the create_order service writes an audit log entry."""
    si_a, _ = sales_item_pair

    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "customer_id": str(customer.id),
            "order_date": "2026-04-12",
            "ship_via": "FedEx",
            "lines": [
                {
                    "sales_item_id": str(si_a.id),
                    "stems": 25,
                    "price_per_stem": 12.50,
                }
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 201
    order_id = resp.json()["data"]["id"]
    logs = await OrderAuditLog.filter(order_id=order_id).all()
    assert len(logs) == 1
    assert logs[0].action == "created"


# ---------------------------------------------------------------------------
# Get single order endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_get_order_detail(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """GET /api/v1/orders/{order_id} returns full order detail with customer and lines."""
    si_a, si_b = sales_item_pair
    order = await _create_order_directly(customer, [si_a, si_b])

    resp = await async_client.get(f"/api/v1/orders/{order.id}", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(order.id)
    assert data["order_number"] == "ORD-20260412-001"
    assert data["customer"]["name"] == "Test Flower Shop"
    assert data["customer"]["customer_number"] == 1001
    assert len(data["lines"]) == 2
    # Lines should be sorted by line_number
    assert data["lines"][0]["line_number"] == 1
    assert data["lines"][1]["line_number"] == 2
    assert data["ship_via"] == "FedEx"


@pytest.mark.anyio
async def test_get_order_not_found(async_client: AsyncClient, auth_headers_admin):
    """GET /api/v1/orders/{order_id} returns 404 for unknown ID."""
    fake_id = str(uuid.uuid4())
    resp = await async_client.get(f"/api/v1/orders/{fake_id}", headers=auth_headers_admin)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create endpoint — duplicate detection tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_order_duplicate_detection_409(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Submitting the same order twice returns 409 with existing order number."""
    si_a, _ = sales_item_pair
    payload = {
        "customer_id": str(customer.id),
        "order_date": "2026-04-12",
        "ship_via": "FedEx",
        "lines": [
            {
                "sales_item_id": str(si_a.id),
                "stems": 25,
                "price_per_stem": 12.50,
            }
        ],
    }

    resp1 = await async_client.post("/api/v1/orders", json=payload, headers=auth_headers_admin)
    assert resp1.status_code == 201

    resp2 = await async_client.post("/api/v1/orders", json=payload, headers=auth_headers_admin)
    assert resp2.status_code == 409
    assert "Duplicate order detected" in resp2.json()["error"]


@pytest.mark.anyio
async def test_create_order_force_duplicate_bypass(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """force_duplicate=true allows creating a duplicate order (201)."""
    si_a, _ = sales_item_pair
    payload = {
        "customer_id": str(customer.id),
        "order_date": "2026-04-12",
        "ship_via": "FedEx",
        "lines": [
            {
                "sales_item_id": str(si_a.id),
                "stems": 25,
                "price_per_stem": 12.50,
            }
        ],
    }

    resp1 = await async_client.post("/api/v1/orders", json=payload, headers=auth_headers_admin)
    assert resp1.status_code == 201

    payload["force_duplicate"] = True
    resp2 = await async_client.post("/api/v1/orders", json=payload, headers=auth_headers_admin)
    assert resp2.status_code == 201
    assert resp2.json()["data"]["order_number"] != resp1.json()["data"]["order_number"]


# ---------------------------------------------------------------------------
# Create endpoint — invalid input tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_order_invalid_customer_id(
    async_client: AsyncClient, sales_item_pair, auth_headers_admin):
    """Non-existent customer_id returns 422."""
    si_a, _ = sales_item_pair
    fake_customer_id = str(uuid.uuid4())
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "customer_id": fake_customer_id,
            "order_date": "2026-04-12",
            "lines": [
                {
                    "sales_item_id": str(si_a.id),
                    "stems": 25,
                    "price_per_stem": 12.50,
                }
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "not found" in resp.json()["error"].lower()


@pytest.mark.anyio
async def test_create_order_invalid_sales_item_id(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Non-existent sales_item_id in a line returns 422."""
    fake_si_id = str(uuid.uuid4())
    payload = {
        "customer_id": str(customer.id),
        "order_date": "2026-04-12",
        "lines": [
            {
                "sales_item_id": fake_si_id,
                "stems": 25,
                "price_per_stem": 12.50,
            }
        ],
    }

    resp = await async_client.post("/api/v1/orders", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "not found" in resp.json()["error"].lower()


@pytest.mark.anyio
async def test_create_order_stems_zero_rejected(async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Schema validator rejects stems=0 with 422."""
    si_a, _ = sales_item_pair
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "customer_id": str(customer.id),
            "order_date": "2026-04-12",
            "lines": [
                {
                    "sales_item_id": str(si_a.id),
                    "stems": 0,
                    "price_per_stem": 12.50,
                }
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_order_stems_negative_rejected(async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Schema validator rejects stems=-1 with 422."""
    si_a, _ = sales_item_pair
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "customer_id": str(customer.id),
            "order_date": "2026-04-12",
            "lines": [
                {
                    "sales_item_id": str(si_a.id),
                    "stems": -1,
                    "price_per_stem": 12.50,
                }
            ],
        }, headers=auth_headers_admin)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_create_order_empty_lines_rejected(async_client: AsyncClient, customer, auth_headers_admin):
    """Schema validator rejects empty lines list with 422."""
    resp = await async_client.post(
        "/api/v1/orders",
        json={
            "customer_id": str(customer.id),
            "order_date": "2026-04-12",
            "lines": [],
        }, headers=auth_headers_admin)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# List endpoint — additional filter tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_list_orders_salesperson_email_filter(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """salesperson_email filter returns only matching orders."""
    si_a, _ = sales_item_pair
    await _create_order_directly(
        customer, [si_a], order_number="ORD-SP-001",
        salesperson_email="alice@flowers.com",
    )
    await _create_order_directly(
        customer, [si_a], order_number="ORD-SP-002",
        salesperson_email="bob@flowers.com",
    )

    resp = await async_client.get("/api/v1/orders?salesperson_email=alice", headers=auth_headers_admin)
    body = resp.json()["data"]
    assert body["total"] == 1
    assert body["items"][0]["order_number"] == "ORD-SP-001"
    assert body["items"][0]["salesperson_email"] == "alice@flowers.com"


@pytest.mark.anyio
async def test_list_orders_limit_zero_rejected(async_client: AsyncClient, auth_headers_admin):
    """limit=0 should return 422 (minimum is 1)."""
    resp = await async_client.get("/api/v1/orders?limit=0", headers=auth_headers_admin)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_orders_limit_over_max_rejected(async_client: AsyncClient, auth_headers_admin):
    """limit=101 should return 422 (maximum is 100)."""
    resp = await async_client.get("/api/v1/orders?limit=101", headers=auth_headers_admin)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Update audit log — value assertions
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_update_order_audit_log_captures_values(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Audit log changes include correct old_value and new_value, not just field name."""
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={"ship_via": "DHL"}, headers=auth_headers_admin)

    logs = await OrderAuditLog.filter(order_id=order.id).all()
    assert len(logs) == 1
    ship_via_change = next(c for c in logs[0].changes if c["field"] == "ship_via")
    assert ship_via_change["old_value"] == "FedEx"
    assert ship_via_change["new_value"] == "DHL"


@pytest.mark.anyio
async def test_update_order_effective_price_calculation(
    async_client: AsyncClient, customer, sales_item_pair, auth_headers_admin):
    """Verify effective_price is recalculated with fees on update."""
    si_a, _ = sales_item_pair
    order = await _create_order_directly(customer, [si_a])

    resp = await async_client.put(
        f"/api/v1/orders/{order.id}",
        json={
            "lines": [
                {
                    "sales_item_id": str(si_a.id),
                    "stems": 25,
                    "price_per_stem": 10.00,
                    "item_fee_pct": 0.10,
                    "item_fee_dollar": 0.50,
                },
            ]
        }, headers=auth_headers_admin)
    assert resp.status_code == 200
    line = resp.json()["data"]["lines"][0]
    # effective = (10.00 * 1.10) + 0.50 = 11.50
    assert float(line["effective_price_per_stem"]) == 11.50
