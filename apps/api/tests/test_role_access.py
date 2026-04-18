"""Cross-role integration tests: verifies the permission matrix is enforced at the HTTP level."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
class TestFieldWorkerRestrictions:
    """Field workers should get 403 on pricing and import endpoints."""

    async def test_field_worker_cannot_read_sales_items(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        resp = await async_client.get("/api/v1/sales-items", headers=auth_headers_field_worker)
        assert resp.status_code == 403

    async def test_field_worker_cannot_read_price_lists(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        resp = await async_client.get("/api/v1/price-lists", headers=auth_headers_field_worker)
        assert resp.status_code == 403

    async def test_field_worker_cannot_write_orders(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        resp = await async_client.post(
            "/api/v1/orders", headers=auth_headers_field_worker, json={}
        )
        assert resp.status_code == 403

    async def test_field_worker_can_read_orders(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        resp = await async_client.get("/api/v1/orders", headers=auth_headers_field_worker)
        assert resp.status_code == 200

    async def test_field_worker_can_write_counts(
        self, async_client: AsyncClient, auth_headers_field_worker: dict, product_type
    ):
        resp = await async_client.put(
            "/api/v1/counts",
            headers=auth_headers_field_worker,
            json={"product_type_id": str(product_type.id), "count_date": "2026-04-12", "counts": []},
        )
        assert resp.status_code == 200

    async def test_field_worker_cannot_access_users(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_field_worker)
        assert resp.status_code == 403


@pytest.mark.anyio
class TestSalespersonRestrictions:
    """Salespeople should not be able to write products or access import."""

    async def test_salesperson_cannot_write_varieties(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.post(
            "/api/v1/varieties",
            headers=auth_headers_salesperson,
            json={"name": "Test", "product_line_id": "00000000-0000-0000-0000-000000000000"},
        )
        assert resp.status_code == 403

    async def test_salesperson_cannot_write_counts(
        self, async_client: AsyncClient, auth_headers_salesperson: dict, product_type
    ):
        # Salesperson has 'r' on inventory_counts, not 'rw'
        resp = await async_client.put(
            "/api/v1/counts",
            headers=auth_headers_salesperson,
            json={"product_type_id": str(product_type.id), "count_date": "2026-04-12", "counts": []},
        )
        assert resp.status_code == 403
        assert "cannot write 'inventory_counts'" in resp.json()["error"]

    async def test_salesperson_can_read_varieties(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.get("/api/v1/varieties", headers=auth_headers_salesperson)
        assert resp.status_code == 200

    async def test_salesperson_cannot_access_import(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.post(
            "/api/v1/import/varieties",
            headers=auth_headers_salesperson,
            json={},
        )
        assert resp.status_code == 403


@pytest.mark.anyio
class TestDataManagerRestrictions:
    """Data managers can write products but not orders."""

    async def test_data_manager_cannot_write_orders(
        self, async_client: AsyncClient, auth_headers_data_manager: dict
    ):
        resp = await async_client.post(
            "/api/v1/orders", headers=auth_headers_data_manager, json={}
        )
        assert resp.status_code == 403

    async def test_data_manager_can_read_orders(
        self, async_client: AsyncClient, auth_headers_data_manager: dict
    ):
        resp = await async_client.get("/api/v1/orders", headers=auth_headers_data_manager)
        assert resp.status_code == 200

    async def test_data_manager_can_write_products(
        self, async_client: AsyncClient, auth_headers_data_manager: dict, product_line
    ):
        resp = await async_client.post(
            "/api/v1/varieties",
            headers=auth_headers_data_manager,
            json={"name": "Test Variety", "product_line_id": str(product_line.id)},
        )
        assert resp.status_code == 201
