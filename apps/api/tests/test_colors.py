"""Tests for color endpoints (app.routers.colors)."""

import uuid


async def test_list_colors(async_client, color, auth_headers_admin):
    """GET /api/v1/colors returns active colors."""
    resp = await async_client.get("/api/v1/colors", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Red"
    assert data[0]["is_active"] is True


async def test_create_color_success(async_client, auth_headers_admin):
    """POST /api/v1/colors creates a new color entry."""
    payload = {"name": "Pink"}
    resp = await async_client.post("/api/v1/colors", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["name"] == "Pink"
    assert data["is_active"] is True


async def test_create_color_with_hex(async_client, auth_headers_admin):
    """POST /api/v1/colors creates a color with hex value."""
    payload = {"name": "Blue", "hex_color": "#0000FF"}
    resp = await async_client.post("/api/v1/colors", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["name"] == "Blue"
    assert data["hex_color"] == "#0000FF"


async def test_create_color_duplicate(async_client, color, auth_headers_admin):
    """POST /api/v1/colors rejects duplicate color name."""
    payload = {"name": "Red"}
    resp = await async_client.post("/api/v1/colors", json=payload, headers=auth_headers_admin)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


async def test_update_color_success(async_client, color, auth_headers_admin):
    """PATCH /api/v1/colors/{id} updates fields."""
    resp = await async_client.patch(
        f"/api/v1/colors/{color.id}",
        json={"hex_color": "#FF0000"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["hex_color"] == "#FF0000"
    assert data["name"] == "Red"


async def test_update_color_not_found(async_client, auth_headers_admin):
    """PATCH /api/v1/colors/{id} returns 404 for nonexistent UUID."""
    fake_id = uuid.uuid4()
    resp = await async_client.patch(
        f"/api/v1/colors/{fake_id}", json={"name": "Blue"}, headers=auth_headers_admin)
    assert resp.status_code == 404


async def test_archive_color(async_client, color, auth_headers_admin):
    """POST /api/v1/colors/{id}/archive sets is_active=false."""
    resp = await async_client.post(f"/api/v1/colors/{color.id}/archive", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_active"] is False


async def test_restore_color(async_client, color, auth_headers_admin):
    """POST /api/v1/colors/{id}/restore sets is_active=true."""
    color.is_active = False
    await color.save()

    resp = await async_client.post(f"/api/v1/colors/{color.id}/restore", headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_active"] is True


async def test_list_colors_filtered_by_active(async_client, color, auth_headers_admin):
    """GET /api/v1/colors?active=false returns only archived colors."""
    color.is_active = False
    await color.save()

    resp = await async_client.get("/api/v1/colors", params={"active": "false"}, headers=auth_headers_admin)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["is_active"] is False

    resp_active = await async_client.get("/api/v1/colors", headers=auth_headers_admin)
    assert resp_active.status_code == 200
    assert len(resp_active.json()["data"]) == 0
