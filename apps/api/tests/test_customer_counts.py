"""Tests for customer count endpoints — list, save, audit log."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.customer import Customer
from app.models.inventory import (
    CountSheetTemplate,
    CustomerCount,
    CustomerCountAuditLog,
    SheetCompletion,
)
from app.models.pricing import PriceList
from app.models.product import Color, ProductLine, ProductType, Variety

BASE = "/api/v1"
TODAY = date(2026, 4, 12)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def cc_product_type():
    return await ProductType.create(name="Cut Flower")


@pytest.fixture
async def cc_product_line(cc_product_type):
    return await ProductLine.create(product_type=cc_product_type, name="Rose")


@pytest.fixture
async def cc_variety(cc_product_line):
    return await Variety.create(
        product_line=cc_product_line,
        name="Freedom",
        in_harvest=True,
        is_active=True,
    )


@pytest.fixture
async def cc_customer():
    """Create a customer for customer count tests."""
    return await Customer.create(customer_number=1001, name="Test Buyer")


@pytest.fixture
async def cc_template(cc_product_type, cc_customer):
    """Create a count sheet template with one column."""
    return await CountSheetTemplate.create(
        product_type=cc_product_type,
        columns=[
            {
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
            }
        ],
    )


# ---------------------------------------------------------------------------
# GET /customer-counts
# ---------------------------------------------------------------------------


async def test_list_customer_counts_empty(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_template, cc_customer
):
    """GET /customer-counts returns varieties with null counts when nothing saved."""
    resp = await async_client.get(
        f"{BASE}/customer-counts",
        params={"product_type_id": str(cc_product_type.id), "count_date": TODAY.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["sheet_complete"] is False
    assert len(data["template_columns"]) == 1
    assert data["template_columns"][0]["customer_name"] == "Test Buyer"
    assert len(data["product_lines"]) == 1


async def test_list_customer_counts_invalid_product_type(async_client: AsyncClient):
    """GET /customer-counts returns 404 for nonexistent product type."""
    resp = await async_client.get(
        f"{BASE}/customer-counts",
        params={"product_type_id": str(uuid.uuid4()), "count_date": TODAY.isoformat()},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /customer-counts — create new
# ---------------------------------------------------------------------------


async def test_save_customer_counts_create_new(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_customer
):
    """PUT /customer-counts creates new CustomerCount records and audit logs."""
    payload = {
        "product_type_id": str(cc_product_type.id),
        "count_date": TODAY.isoformat(),
        "entered_by": "tester",
        "counts": [
            {
                "variety_id": str(cc_variety.id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
                "bunch_count": 5,
                "is_done": False,
            }
        ],
    }
    resp = await async_client.put(f"{BASE}/customer-counts", json=payload)
    assert resp.status_code == 200
    assert resp.json()["data"]["saved_count"] == 1

    cc = await CustomerCount.get(
        variety_id=cc_variety.id,
        customer_id=cc_customer.id,
        count_date=TODAY,
        bunch_size=10,
        sleeve_type="Plastic",
    )
    assert cc.bunch_count == 5
    assert cc.entered_by == "tester"

    logs = await CustomerCountAuditLog.filter(customer_count=cc).all()
    assert len(logs) == 1
    assert logs[0].action == "set"
    assert logs[0].amount == 5


# ---------------------------------------------------------------------------
# PUT /customer-counts — update existing
# ---------------------------------------------------------------------------


async def test_save_customer_counts_update_existing(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_customer
):
    """PUT /customer-counts updates existing record and creates audit log."""
    await CustomerCount.create(
        variety=cc_variety,
        product_type=cc_product_type,
        customer=cc_customer,
        count_date=TODAY,
        bunch_size=10,
        sleeve_type="Plastic",
        bunch_count=3,
        entered_by="old_user",
    )
    payload = {
        "product_type_id": str(cc_product_type.id),
        "count_date": TODAY.isoformat(),
        "entered_by": "new_user",
        "counts": [
            {
                "variety_id": str(cc_variety.id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
                "bunch_count": 8,
                "is_done": True,
            }
        ],
    }
    resp = await async_client.put(f"{BASE}/customer-counts", json=payload)
    assert resp.status_code == 200
    assert resp.json()["data"]["saved_count"] == 1

    cc = await CustomerCount.get(
        variety_id=cc_variety.id,
        customer_id=cc_customer.id,
        count_date=TODAY,
        bunch_size=10,
        sleeve_type="Plastic",
    )
    assert cc.bunch_count == 8
    assert cc.is_done is True
    assert cc.entered_by == "new_user"

    logs = await CustomerCountAuditLog.filter(customer_count=cc).all()
    assert len(logs) == 1  # only the update log


# ---------------------------------------------------------------------------
# PUT /customer-counts — invalid variety skipped
# ---------------------------------------------------------------------------


async def test_save_customer_counts_skips_invalid_variety(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_customer
):
    """PUT /customer-counts skips entries with invalid variety IDs."""
    fake_id = uuid.uuid4()
    payload = {
        "product_type_id": str(cc_product_type.id),
        "count_date": TODAY.isoformat(),
        "entered_by": "tester",
        "counts": [
            {
                "variety_id": str(cc_variety.id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
                "bunch_count": 5,
                "is_done": False,
            },
            {
                "variety_id": str(fake_id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Paper",
                "bunch_count": 99,
                "is_done": False,
            },
        ],
    }
    resp = await async_client.put(f"{BASE}/customer-counts", json=payload)
    assert resp.status_code == 200
    assert resp.json()["data"]["saved_count"] == 1


# ---------------------------------------------------------------------------
# PUT /customer-counts — rejects when sheet complete (409)
# ---------------------------------------------------------------------------


async def test_save_customer_counts_rejects_when_sheet_complete(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_customer
):
    """PUT /customer-counts returns 409 when the customer_count sheet is complete."""
    await SheetCompletion.create(
        product_type=cc_product_type,
        sheet_type="customer_count",
        sheet_date=TODAY,
        is_complete=True,
        completed_by="admin",
    )
    payload = {
        "product_type_id": str(cc_product_type.id),
        "count_date": TODAY.isoformat(),
        "entered_by": "tester",
        "counts": [
            {
                "variety_id": str(cc_variety.id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
                "bunch_count": 5,
                "is_done": False,
            }
        ],
    }
    resp = await async_client.put(f"{BASE}/customer-counts", json=payload)
    assert resp.status_code == 409
    assert "complete" in resp.json()["error"].lower()


# ---------------------------------------------------------------------------
# GET /customer-counts/{variety_id}/audit-log
# ---------------------------------------------------------------------------


async def test_customer_count_audit_log_empty(
    async_client: AsyncClient, cc_variety, cc_customer
):
    """GET /customer-counts/{variety_id}/audit-log returns empty when no records exist."""
    resp = await async_client.get(
        f"{BASE}/customer-counts/{cc_variety.id}/audit-log",
        params={
            "customer_id": str(cc_customer.id),
            "bunch_size": 10,
            "sleeve_type": "Plastic",
            "count_date": TODAY.isoformat(),
        },
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_customer_count_audit_log_returns_entries(
    async_client: AsyncClient, cc_product_type, cc_variety, cc_customer
):
    """GET /customer-counts/{variety_id}/audit-log returns audit entries after saving."""
    # Save a customer count
    payload = {
        "product_type_id": str(cc_product_type.id),
        "count_date": TODAY.isoformat(),
        "entered_by": "tester",
        "counts": [
            {
                "variety_id": str(cc_variety.id),
                "customer_id": str(cc_customer.id),
                "bunch_size": 10,
                "sleeve_type": "Plastic",
                "bunch_count": 7,
                "is_done": False,
            }
        ],
    }
    await async_client.put(f"{BASE}/customer-counts", json=payload)

    resp = await async_client.get(
        f"{BASE}/customer-counts/{cc_variety.id}/audit-log",
        params={
            "customer_id": str(cc_customer.id),
            "bunch_size": 10,
            "sleeve_type": "Plastic",
            "count_date": TODAY.isoformat(),
        },
    )
    assert resp.status_code == 200
    entries = resp.json()["data"]
    assert len(entries) == 1
    assert entries[0]["action"] == "set"
    assert entries[0]["amount"] == 7
    assert entries[0]["entered_by"] == "tester"


async def test_customer_count_audit_log_validates_sleeve_type(
    async_client: AsyncClient, cc_variety, cc_customer
):
    """GET /customer-counts/{variety_id}/audit-log validates sleeve_type as Literal."""
    resp = await async_client.get(
        f"{BASE}/customer-counts/{cc_variety.id}/audit-log",
        params={
            "customer_id": str(cc_customer.id),
            "bunch_size": 10,
            "sleeve_type": "InvalidType",
            "count_date": TODAY.isoformat(),
        },
    )
    assert resp.status_code == 422
