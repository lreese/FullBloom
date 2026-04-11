"""Product line endpoints — CRUD + archive/restore."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.product import ProductLine, ProductType, Variety
from app.schemas.product_line import (
    ProductLineCreateRequest,
    ProductLineListResponse,
    ProductLineUpdateRequest,
)

router = APIRouter(prefix="/api/v1", tags=["product-lines"])


@router.get("/product-lines")
async def list_product_lines(active: bool = True) -> dict:
    """List product lines with variety counts."""
    product_lines = await ProductLine.filter(is_active=active).prefetch_related(
        "product_type"
    ).order_by("name")

    data = []
    for pl in product_lines:
        variety_count = await Variety.filter(
            product_line_id=pl.id, is_active=True
        ).count()
        data.append(
            ProductLineListResponse(
                id=str(pl.id),
                name=pl.name,
                product_type_id=str(pl.product_type_id),
                product_type_name=pl.product_type.name,  # type: ignore[attr-defined]
                is_active=pl.is_active,
                variety_count=variety_count,
            )
        )
    return {"data": data}


@router.get("/product-lines/dropdown-options")
async def product_line_dropdown_options() -> dict:
    """Get product types for the dropdown."""
    product_types = await ProductType.all().order_by("name")
    return {
        "data": {
            "product_types": [
                {"id": str(pt.id), "name": pt.name} for pt in product_types
            ]
        }
    }


@router.post("/product-lines", status_code=201)
async def create_product_line(data: ProductLineCreateRequest) -> dict:
    """Create a new product line."""
    product_type = await ProductType.get_or_none(id=data.product_type_id)
    if product_type is None:
        raise HTTPException(status_code=422, detail="Product type not found")

    existing = await ProductLine.filter(
        product_type_id=data.product_type_id, name=data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Product line '{data.name}' already exists in product type '{product_type.name}'",
        )

    pl = await ProductLine.create(**data.model_dump())
    return {
        "data": ProductLineListResponse(
            id=str(pl.id),
            name=pl.name,
            product_type_id=str(pl.product_type_id),
            product_type_name=product_type.name,
            is_active=pl.is_active,
            variety_count=0,
        )
    }


@router.patch("/product-lines/{product_line_id}")
async def update_product_line(
    product_line_id: UUID, data: ProductLineUpdateRequest
) -> dict:
    """Update a product line's fields."""
    pl = await ProductLine.get_or_none(id=product_line_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Product line not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await pl.update_from_dict(update_data).save()
    await pl.fetch_related("product_type")
    variety_count = await Variety.filter(
        product_line_id=pl.id, is_active=True
    ).count()

    return {
        "data": ProductLineListResponse(
            id=str(pl.id),
            name=pl.name,
            product_type_id=str(pl.product_type_id),
            product_type_name=pl.product_type.name,  # type: ignore[attr-defined]
            is_active=pl.is_active,
            variety_count=variety_count,
        )
    }


@router.post("/product-lines/{product_line_id}/archive")
async def archive_product_line(product_line_id: UUID) -> dict:
    """Archive a product line. Returns variety count as a warning."""
    pl = await ProductLine.get_or_none(id=product_line_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Product line not found")

    variety_count = await Variety.filter(
        product_line_id=pl.id, is_active=True
    ).count()
    pl.is_active = False
    await pl.save()
    return {
        "data": {
            "id": str(pl.id),
            "is_active": False,
            "variety_count": variety_count,
        }
    }


@router.post("/product-lines/{product_line_id}/restore")
async def restore_product_line(product_line_id: UUID) -> dict:
    """Restore an archived product line."""
    pl = await ProductLine.get_or_none(id=product_line_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Product line not found")
    pl.is_active = True
    await pl.save()
    return {"data": {"id": str(pl.id), "is_active": True}}
