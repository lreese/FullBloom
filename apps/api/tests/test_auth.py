"""Tests for auth and profile endpoints."""

import time

import jwt
import pytest
from httpx import AsyncClient

from app.auth.permissions import PERMISSIONS

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


class TestGetMe:
    async def test_me_returns_user_with_permissions(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.get("/api/v1/auth/me", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "admin@oregonflowers.com"
        assert data["role"] == "admin"
        assert data["status"] == "active"
        assert "permissions" in data
        assert data["permissions"] == PERMISSIONS["admin"]

    async def test_me_salesperson_gets_correct_permissions(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.get("/api/v1/auth/me", headers=auth_headers_salesperson)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["role"] == "salesperson"
        assert data["permissions"] == PERMISSIONS["salesperson"]

    async def test_me_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_me_deactivated_user_rejected(
        self, async_client: AsyncClient, deactivated_user, auth_headers_deactivated
    ):
        resp = await async_client.get("/api/v1/auth/me", headers=auth_headers_deactivated)
        assert resp.status_code == 401

    async def test_me_invalid_token_rejected(self, async_client: AsyncClient):
        resp = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
        )
        assert resp.status_code == 401


class TestGetPermissions:
    async def test_permissions_returns_matrix(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.get("/api/v1/auth/permissions", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "roles" in data
        assert "areas" in data
        assert "matrix" in data
        assert "admin" in data["roles"]
        assert data["matrix"] == PERMISSIONS

    async def test_permissions_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/auth/permissions")
        assert resp.status_code == 401

    async def test_permissions_areas_have_key_and_label(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        # Endpoint requires users:read permission — admin only
        resp = await async_client.get(
            "/api/v1/auth/permissions", headers=auth_headers_admin
        )
        assert resp.status_code == 200
        areas = resp.json()["data"]["areas"]
        for area in areas:
            assert "key" in area
            assert "label" in area


class TestGetProfile:
    async def test_get_profile_returns_self(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.get("/api/v1/profile", headers=auth_headers_salesperson)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "sales@oregonflowers.com"
        assert data["role"] == "salesperson"
        assert "permissions" in data

    async def test_get_profile_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/profile")
        assert resp.status_code == 401


class TestUpdateProfile:
    async def test_update_display_name(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.put(
            "/api/v1/profile",
            json={"display_name": "Updated Name"},
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["display_name"] == "Updated Name"

    async def test_update_phone(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.put(
            "/api/v1/profile",
            json={"phone": "503-555-0001"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["phone"] == "503-555-0001"

    async def test_update_profile_returns_permissions(
        self, async_client: AsyncClient, field_worker_user, auth_headers_field_worker
    ):
        resp = await async_client.put(
            "/api/v1/profile",
            json={"display_name": "New Name"},
            headers=auth_headers_field_worker,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["permissions"] == PERMISSIONS["field_worker"]

    async def test_update_profile_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.put("/api/v1/profile", json={"display_name": "X"})
        assert resp.status_code == 401

    async def test_partial_update_leaves_other_fields(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        # Set phone first
        await async_client.put(
            "/api/v1/profile",
            json={"phone": "503-555-9999"},
            headers=auth_headers_salesperson,
        )
        # Update only display_name — phone should be preserved
        resp = await async_client.put(
            "/api/v1/profile",
            json={"display_name": "New Display"},
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["display_name"] == "New Display"
        assert data["phone"] == "503-555-9999"


# ---------------------------------------------------------------------------
# Pending user tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_pending_user_returns_401(async_client: AsyncClient):
    """A pending user should not be able to access the API."""
    from app.models.user import User

    await User.create(
        supabase_user_id="pending-uuid",
        email="pending@oregonflowers.com",
        display_name="Pending User",
        role="salesperson",
        status="pending",
    )
    token = jwt.encode(
        {"sub": "pending-uuid", "exp": time.time() + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    resp = await async_client.get(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
