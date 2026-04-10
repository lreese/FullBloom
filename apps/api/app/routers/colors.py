"""Variety color endpoints — CRUD + archive/restore."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.product import Variety, VarietyColor
from app.schemas.color import (
    VarietyColorCreateRequest,
    VarietyColorListResponse,
    VarietyColorUpdateRequest,
)

router = APIRouter(prefix="/api/v1", tags=["variety-colors"])


@router.get("/variety-colors")
async def list_variety_colors(active: bool = True) -> dict:
    """List all variety colors."""
    colors = await VarietyColor.filter(is_active=active).prefetch_related(
        "variety"
    ).order_by("color_name")

    return {
        "data": [
            VarietyColorListResponse(
                id=str(c.id),
                variety_id=str(c.variety_id),
                variety_name=c.variety.name,  # type: ignore[attr-defined]
                color_name=c.color_name,
                is_active=c.is_active,
            )
            for c in colors
        ]
    }


@router.post("/variety-colors", status_code=201)
async def create_variety_color(data: VarietyColorCreateRequest) -> dict:
    """Create a new variety color entry."""
    variety = await Variety.get_or_none(id=data.variety_id)
    if variety is None:
        raise HTTPException(status_code=422, detail="Variety not found")

    existing = await VarietyColor.filter(
        variety_id=data.variety_id, color_name=data.color_name
    ).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Color '{data.color_name}' already exists for variety '{variety.name}'",
        )

    color = await VarietyColor.create(**data.model_dump())
    return {
        "data": VarietyColorListResponse(
            id=str(color.id),
            variety_id=str(color.variety_id),
            variety_name=variety.name,
            color_name=color.color_name,
            is_active=color.is_active,
        )
    }


@router.patch("/variety-colors/{color_id}")
async def update_variety_color(
    color_id: UUID, data: VarietyColorUpdateRequest
) -> dict:
    """Update a variety color entry."""
    color = await VarietyColor.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Variety color not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await color.update_from_dict(update_data).save()
    await color.fetch_related("variety")

    return {
        "data": VarietyColorListResponse(
            id=str(color.id),
            variety_id=str(color.variety_id),
            variety_name=color.variety.name,  # type: ignore[attr-defined]
            color_name=color.color_name,
            is_active=color.is_active,
        )
    }


@router.post("/variety-colors/{color_id}/archive")
async def archive_variety_color(color_id: UUID) -> dict:
    """Soft-delete a variety color entry."""
    color = await VarietyColor.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Variety color not found")
    color.is_active = False
    await color.save()
    return {"data": {"id": str(color.id), "is_active": False}}


@router.post("/variety-colors/{color_id}/restore")
async def restore_variety_color(color_id: UUID) -> dict:
    """Restore a soft-deleted variety color entry."""
    color = await VarietyColor.get_or_none(id=color_id)
    if color is None:
        raise HTTPException(status_code=404, detail="Variety color not found")
    color.is_active = True
    await color.save()
    return {"data": {"id": str(color.id), "is_active": True}}
