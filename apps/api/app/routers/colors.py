"""Color endpoints — CRUD + archive/restore for standalone Color model."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.product import Color
from app.schemas.color import (
    ColorCreateRequest,
    ColorListResponse,
    ColorUpdateRequest,
)

router = APIRouter(prefix="/api/v1", tags=["colors"])


@router.get("/colors")
async def list_colors(active: bool = True) -> dict:
    """List all colors, filtered by active status."""
    colors = await Color.filter(is_active=active).order_by("name")

    return {
        "data": [
            ColorListResponse(
                id=str(c.id),
                name=c.name,
                hex_color=c.hex_color,
                is_active=c.is_active,
            )
            for c in colors
        ]
    }


@router.post("/colors", status_code=201)
async def create_color(data: ColorCreateRequest) -> dict:
    """Create a new color entry."""
    existing = await Color.filter(name=data.name).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Color '{data.name}' already exists",
        )

    color = await Color.create(**data.model_dump())
    return {
        "data": ColorListResponse(
            id=str(color.id),
            name=color.name,
            hex_color=color.hex_color,
            is_active=color.is_active,
        )
    }


@router.patch("/colors/{color_id}")
async def update_color(color_id: UUID, data: ColorUpdateRequest) -> dict:
    """Update a color entry."""
    color = await Color.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Color not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    # Check name uniqueness if changing name
    if "name" in update_data:
        existing = await Color.filter(name=update_data["name"]).exclude(id=color_id).first()
        if existing:
            raise HTTPException(
                status_code=422,
                detail=f"Color '{update_data['name']}' already exists",
            )

    await color.update_from_dict(update_data).save()

    return {
        "data": ColorListResponse(
            id=str(color.id),
            name=color.name,
            hex_color=color.hex_color,
            is_active=color.is_active,
        )
    }


@router.post("/colors/{color_id}/archive")
async def archive_color(color_id: UUID) -> dict:
    """Soft-delete a color."""
    color = await Color.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Color not found")
    color.is_active = False
    await color.save()
    return {"data": {"id": str(color.id), "is_active": False}}


@router.post("/colors/{color_id}/restore")
async def restore_color(color_id: UUID) -> dict:
    """Restore a soft-deleted color."""
    color = await Color.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Color not found")
    color.is_active = True
    await color.save()
    return {"data": {"id": str(color.id), "is_active": True}}
