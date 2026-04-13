"""Tests for admin user management endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

from app.models.user import User


@pytest.fixture
def mock_supabase_admin():
    mock_client = MagicMock()
    mock_user = MagicMock()
    mock_user.id = "new-supabase-uuid-123"
    mock_result = MagicMock()
    mock_result.user = mock_user
    mock_client.auth.admin.invite_user_by_email.return_value = mock_result
    with patch("app.routers.users.get_supabase_admin", return_value=mock_client):
        yield mock_client


class TestListUsers:
    async def test_admin_can_list_users(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        emails = [u["email"] for u in data]
        assert "admin@oregonflowers.com" in emails
        assert "sales@oregonflowers.com" in emails

    async def test_salesperson_cannot_list_users(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_salesperson)
        assert resp.status_code == 403

    async def test_field_worker_cannot_list_users(
        self, async_client: AsyncClient, field_worker_user, auth_headers_field_worker
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_field_worker)
        assert resp.status_code == 403

    async def test_list_users_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/users")
        assert resp.status_code == 401


class TestInviteUser:
    async def test_admin_can_invite(
        self, async_client: AsyncClient, admin_user, auth_headers_admin, mock_supabase_admin
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            json={"email": "newuser@oregonflowers.com", "role": "salesperson"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["email"] == "newuser@oregonflowers.com"
        assert data["role"] == "salesperson"
        assert data["status"] == "pending"
        # Verify Supabase was called
        mock_supabase_admin.auth.admin.invite_user_by_email.assert_called_once_with(
            "newuser@oregonflowers.com"
        )

    async def test_duplicate_email_returns_422(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            json={"email": "sales@oregonflowers.com", "role": "salesperson"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 422

    async def test_invalid_role_returns_422(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            json={"email": "x@oregonflowers.com", "role": "superuser"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 422

    async def test_salesperson_cannot_invite(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            json={"email": "x@oregonflowers.com", "role": "salesperson"},
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 403

    async def test_invite_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.post(
            "/api/v1/users/invite",
            json={"email": "x@oregonflowers.com", "role": "salesperson"},
        )
        assert resp.status_code == 401

    async def test_invite_fails_when_supabase_errors(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        with patch("app.routers.users.get_supabase_admin") as mock:
            mock.return_value.auth.admin.invite_user_by_email.side_effect = Exception(
                "Supabase error"
            )
            resp = await async_client.post(
                "/api/v1/users/invite",
                headers=auth_headers_admin,
                json={"email": "fail@oregonflowers.com", "role": "salesperson"},
            )
            assert resp.status_code == 502


class TestListSalespeople:
    async def test_admin_can_list_salespeople(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.get("/api/v1/users/salespeople", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        emails = [u["email"] for u in data]
        assert "admin@oregonflowers.com" in emails
        assert "sales@oregonflowers.com" in emails

    async def test_salesperson_can_list_salespeople(
        self, async_client: AsyncClient, salesperson_user, auth_headers_salesperson
    ):
        resp = await async_client.get(
            "/api/v1/users/salespeople", headers=auth_headers_salesperson
        )
        assert resp.status_code == 200

    async def test_field_worker_can_list_salespeople(
        self, async_client: AsyncClient, field_worker_user, auth_headers_field_worker
    ):
        # field_worker has orders:r
        resp = await async_client.get(
            "/api/v1/users/salespeople", headers=auth_headers_field_worker
        )
        assert resp.status_code == 200

    async def test_deactivated_users_excluded(
        self, async_client: AsyncClient, admin_user, deactivated_user, auth_headers_admin
    ):
        resp = await async_client.get("/api/v1/users/salespeople", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        emails = [u["email"] for u in data]
        assert "deactivated@oregonflowers.com" not in emails


class TestChangeRole:
    async def test_admin_can_change_role(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.put(
            f"/api/v1/users/{salesperson_user.id}/role",
            json={"role": "field_worker"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["role"] == "field_worker"

    async def test_change_role_invalid_role(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.put(
            f"/api/v1/users/{salesperson_user.id}/role",
            json={"role": "superuser"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 422

    async def test_change_role_user_not_found(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.put(
            "/api/v1/users/00000000-0000-0000-0000-000000000000/role",
            json={"role": "salesperson"},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 404

    async def test_salesperson_cannot_change_role(
        self, async_client: AsyncClient, salesperson_user, field_worker_user, auth_headers_salesperson
    ):
        resp = await async_client.put(
            f"/api/v1/users/{field_worker_user.id}/role",
            json={"role": "salesperson"},
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 403


class TestDeactivateUser:
    async def test_admin_can_deactivate_salesperson(
        self, async_client: AsyncClient, admin_user, salesperson_user, auth_headers_admin
    ):
        resp = await async_client.post(
            f"/api/v1/users/{salesperson_user.id}/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "deactivated"

    async def test_cannot_deactivate_yourself(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        # Admin cannot deactivate their own account.
        resp = await async_client.post(
            f"/api/v1/users/{admin_user.id}/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 409
        assert "yourself" in resp.json()["error"]

    async def test_can_deactivate_admin_when_another_exists(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        second_admin = await User.create(
            supabase_user_id="admin2-uuid",
            email="admin2@oregonflowers.com",
            role="admin",
            status="active",
        )
        resp = await async_client.post(
            f"/api/v1/users/{second_admin.id}/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "deactivated"

    async def test_deactivate_not_found(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.post(
            "/api/v1/users/00000000-0000-0000-0000-000000000000/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 404

    async def test_salesperson_cannot_deactivate(
        self, async_client: AsyncClient, salesperson_user, field_worker_user, auth_headers_salesperson
    ):
        resp = await async_client.post(
            f"/api/v1/users/{field_worker_user.id}/deactivate",
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 403


class TestReactivateUser:
    async def test_admin_can_reactivate(
        self, async_client: AsyncClient, admin_user, deactivated_user, auth_headers_admin
    ):
        resp = await async_client.post(
            f"/api/v1/users/{deactivated_user.id}/reactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "active"

    async def test_reactivate_not_found(
        self, async_client: AsyncClient, admin_user, auth_headers_admin
    ):
        resp = await async_client.post(
            "/api/v1/users/00000000-0000-0000-0000-000000000000/reactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 404

    async def test_salesperson_cannot_reactivate(
        self, async_client: AsyncClient, salesperson_user, deactivated_user, auth_headers_salesperson
    ):
        resp = await async_client.post(
            f"/api/v1/users/{deactivated_user.id}/reactivate",
            headers=auth_headers_salesperson,
        )
        assert resp.status_code == 403
