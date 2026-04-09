"""Health check endpoint."""

from fastapi import APIRouter
from tortoise import Tortoise

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Return service health including database connectivity."""
    db_status = "connected"
    try:
        conn = Tortoise.get_connection("default")
        await conn.execute_query("SELECT 1")
    except Exception:
        db_status = "disconnected"

    return {"data": {"status": "healthy", "database": db_status}}
