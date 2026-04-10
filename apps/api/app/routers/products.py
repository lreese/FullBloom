"""Variety endpoints — CRUD, bulk update, archive/restore."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.product import Color, ProductLine, Variety
from app.schemas.product import (
    BulkUpdateRequest,
    SalesItemDetailResponse,
    VarietyCreateRequest,
    VarietyDetailResponse,
    VarietyDropdownOptionsResponse,
    VarietyListResponse,
    VarietyUpdateRequest,
)
from app.services.product_service import bulk_update_varieties, get_variety_dropdown_options

router = APIRouter(prefix="/api/v1", tags=["varieties"])


def _variety_color_id(v) -> str | None:
    """Extract color_id as string from a Variety instance."""
    return str(v.color_id) if v.color_id else None


def _variety_color_name(v) -> str | None:
    """Extract color name from a prefetched Variety instance."""
    if v.color_id and v.color:
        return v.color.name  # type: ignore[attr-defined]
    return None


@router.get("/varieties")
async def list_varieties(active: bool = True) -> dict:
    """List varieties filtered by active status."""
    qs = Variety.filter(is_active=active)
    varieties = await qs.prefetch_related(
        "sales_items", "product_line", "product_line__product_type", "color"
    ).order_by("name")

    data = []
    for v in varieties:
        active_sales_items = [
            si for si in v.sales_items  # type: ignore[attr-defined]
            if si.is_active
        ]
        data.append(
            VarietyListResponse(
                id=str(v.id),
                name=v.name,
                product_line_id=str(v.product_line_id),
                product_line_name=v.product_line.name,  # type: ignore[attr-defined]
                product_type_name=v.product_line.product_type.name,  # type: ignore[attr-defined]
                color_id=_variety_color_id(v),
                color_name=_variety_color_name(v),
                hex_color=v.hex_color,
                flowering_type=v.flowering_type,
                can_replace=v.can_replace,
                show=v.show,
                is_active=v.is_active,
                weekly_sales_category=v.weekly_sales_category,
                item_group_id=v.item_group_id,
                item_group_description=v.item_group_description,
                sales_items_count=len(active_sales_items),
            )
        )
    return {"data": data}


@router.get("/varieties/dropdown-options")
async def variety_dropdown_options() -> dict:
    """Get distinct values for dropdown and bulk-update fields."""
    options = await get_variety_dropdown_options()
    return {"data": VarietyDropdownOptionsResponse(**options)}


@router.get("/varieties/{variety_id}")
async def get_variety(variety_id: UUID) -> dict:
    """Get a single variety with its sales items."""
    variety = await Variety.get_or_none(id=variety_id).prefetch_related(
        "sales_items__customer_prices", "product_line", "product_line__product_type",
        "color"
    )
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    sales_items = [
        SalesItemDetailResponse(
            id=str(si.id),
            name=si.name,
            stems_per_order=si.stems_per_order,
            retail_price=str(si.retail_price),
            is_active=si.is_active,
            customer_prices_count=len(si.customer_prices),  # type: ignore[attr-defined]
        )
        for si in variety.sales_items  # type: ignore[attr-defined]
    ]

    return {
        "data": VarietyDetailResponse(
            id=str(variety.id),
            name=variety.name,
            product_line_id=str(variety.product_line_id),
            product_line_name=variety.product_line.name,  # type: ignore[attr-defined]
            product_type_name=variety.product_line.product_type.name,  # type: ignore[attr-defined]
            color_id=_variety_color_id(variety),
            color_name=_variety_color_name(variety),
            hex_color=variety.hex_color,
            flowering_type=variety.flowering_type,
            can_replace=variety.can_replace,
            show=variety.show,
            is_active=variety.is_active,
            weekly_sales_category=variety.weekly_sales_category,
            item_group_id=variety.item_group_id,
            item_group_description=variety.item_group_description,
            sales_items=sales_items,
        )
    }


@router.post("/varieties", status_code=201)
async def create_variety(data: VarietyCreateRequest) -> dict:
    """Create a new variety with uniqueness check per product line."""
    product_line = await ProductLine.get_or_none(id=data.product_line_id)
    if product_line is None:
        raise HTTPException(status_code=422, detail="Product line not found")

    # Validate color_id if provided
    if data.color_id is not None:
        color = await Color.get_or_none(id=data.color_id)
        if color is None:
            raise HTTPException(status_code=422, detail="Color not found")

    existing = await Variety.filter(
        product_line_id=data.product_line_id, name=data.name
    ).first()
    if existing:
        await product_line.fetch_related("product_type")
        raise HTTPException(
            status_code=422,
            detail=f"Variety '{data.name}' already exists in product line '{product_line.name}'",
        )

    variety = await Variety.create(**data.model_dump())
    await variety.fetch_related("product_line__product_type", "sales_items", "color")

    return {
        "data": VarietyListResponse(
            id=str(variety.id),
            name=variety.name,
            product_line_id=str(variety.product_line_id),
            product_line_name=variety.product_line.name,  # type: ignore[attr-defined]
            product_type_name=variety.product_line.product_type.name,  # type: ignore[attr-defined]
            color_id=_variety_color_id(variety),
            color_name=_variety_color_name(variety),
            hex_color=variety.hex_color,
            flowering_type=variety.flowering_type,
            can_replace=variety.can_replace,
            show=variety.show,
            is_active=variety.is_active,
            weekly_sales_category=variety.weekly_sales_category,
            item_group_id=variety.item_group_id,
            item_group_description=variety.item_group_description,
            sales_items_count=0,
        )
    }


@router.patch("/varieties/bulk")
async def bulk_update(data: BulkUpdateRequest) -> dict:
    """Bulk update a field across multiple varieties."""
    try:
        updated_count = await bulk_update_varieties(data.ids, data.field, data.value)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"data": {"updated_count": updated_count}}


@router.patch("/varieties/{variety_id}")
async def update_variety(variety_id: UUID, data: VarietyUpdateRequest) -> dict:
    """Update a variety's fields. Only include fields to change."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    # Validate color_id if provided
    if "color_id" in update_data and update_data["color_id"] is not None:
        color = await Color.get_or_none(id=update_data["color_id"])
        if color is None:
            raise HTTPException(status_code=422, detail="Color not found")

    # Check uniqueness if name or product_line_id is changing
    new_name = update_data.get("name", variety.name)
    new_pl_id = update_data.get("product_line_id", variety.product_line_id)
    if "name" in update_data or "product_line_id" in update_data:
        existing = await Variety.filter(
            product_line_id=new_pl_id, name=new_name
        ).exclude(id=variety_id).first()
        if existing:
            pl = await ProductLine.get(id=new_pl_id)
            raise HTTPException(
                status_code=422,
                detail=f"Variety '{new_name}' already exists in product line '{pl.name}'",
            )

    await variety.update_from_dict(update_data).save()
    await variety.fetch_related("product_line__product_type", "sales_items", "color")

    active_sales_items = [
        si for si in variety.sales_items  # type: ignore[attr-defined]
        if si.is_active
    ]

    return {
        "data": VarietyListResponse(
            id=str(variety.id),
            name=variety.name,
            product_line_id=str(variety.product_line_id),
            product_line_name=variety.product_line.name,  # type: ignore[attr-defined]
            product_type_name=variety.product_line.product_type.name,  # type: ignore[attr-defined]
            color_id=_variety_color_id(variety),
            color_name=_variety_color_name(variety),
            hex_color=variety.hex_color,
            flowering_type=variety.flowering_type,
            can_replace=variety.can_replace,
            show=variety.show,
            is_active=variety.is_active,
            weekly_sales_category=variety.weekly_sales_category,
            item_group_id=variety.item_group_id,
            item_group_description=variety.item_group_description,
            sales_items_count=len(active_sales_items),
        )
    }


@router.post("/varieties/{variety_id}/archive")
async def archive_variety(variety_id: UUID) -> dict:
    """Archive a variety (set is_active = false)."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")
    variety.is_active = False
    await variety.save()
    return {"data": {"id": str(variety.id), "is_active": False}}


@router.post("/varieties/{variety_id}/restore")
async def restore_variety(variety_id: UUID) -> dict:
    """Restore an archived variety."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")
    variety.is_active = True
    await variety.save()
    return {"data": {"id": str(variety.id), "is_active": True}}
