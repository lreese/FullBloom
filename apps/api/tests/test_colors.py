"""Tests for variety color endpoints (app.routers.colors)."""

import uuid


async def test_list_variety_colors(async_client, variety_color):
    """GET /api/v1/variety-colors returns active colors."""
    resp = await async_client.get("/api/v1/variety-colors")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["color_name"] == "Red"
    assert data[0]["is_active"] is True


async def test_create_variety_color_success(async_client, variety):
    """POST /api/v1/variety-colors creates a new color entry."""
    payload = {"variety_id": str(variety.id), "color_name": "Pink"}
    resp = await async_client.post("/api/v1/variety-colors", json=payload)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["color_name"] == "Pink"
    assert data["variety_id"] == str(variety.id)
    assert data["is_active"] is True


async def test_create_variety_color_duplicate(async_client, variety_color, variety):
    """POST /api/v1/variety-colors rejects duplicate color for same variety."""
    payload = {"variety_id": str(variety.id), "color_name": "Red"}
    resp = await async_client.post("/api/v1/variety-colors", json=payload)
    assert resp.status_code == 422
    assert "already exists" in resp.json()["error"]


async def test_create_variety_color_invalid_variety(async_client):
    """POST /api/v1/variety-colors returns 422 for non-existent variety."""
    fake_id = str(uuid.uuid4())
    payload = {"variety_id": fake_id, "color_name": "Blue"}
    resp = await async_client.post("/api/v1/variety-colors", json=payload)
    assert resp.status_code == 422
    assert "Variety not found" in resp.json()["error"]
