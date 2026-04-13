"""Product type endpoints — CRUD + archive/restore."""

from uuid import UUID

from fastapi import Depends, APIRouter, HTTPException

from app.models.product import ProductLine, ProductType
from app.schemas.product_type import (
    ProductTypeCreateRequest,
    ProductTypeListResponse,
    ProductTypeUpdateRequest,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["product-types"], dependencies=[Depends(get_current_user)])


@router.get("/product-types")
async def list_product_types(active: bool = True) -> dict:
    """List product types with product line counts."""
    product_types = await ProductType.filter(is_active=active).order_by("name")

    data = []
    for pt in product_types:
        product_line_count = await ProductLine.filter(
            product_type_id=pt.id, is_active=True
        ).count()
        data.append(
            ProductTypeListResponse(
                id=str(pt.id),
                name=pt.name,
                is_active=pt.is_active,
                product_line_count=product_line_count,
            )
        )
    return {"data": data}


@router.post("/product-types", status_code=201)
async def create_product_type(data: ProductTypeCreateRequest, user: User = Depends(require_permission("products", "write"))) -> dict:
    """Create a new product type."""
    existing = await ProductType.filter(name=data.name).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Product type '{data.name}' already exists",
        )

    pt = await ProductType.create(**data.model_dump())
    return {
        "data": ProductTypeListResponse(
            id=str(pt.id),
            name=pt.name,
            is_active=pt.is_active,
            product_line_count=0,
        )
    }


@router.patch("/product-types/{product_type_id}")
async def update_product_type(
    product_type_id: UUID, data: ProductTypeUpdateRequest,
    user: User = Depends(require_permission("products", "write")),
) -> dict:
    """Update a product type's fields."""
    pt = await ProductType.get_or_none(id=product_type_id)
    if pt is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await pt.update_from_dict(update_data).save()
    product_line_count = await ProductLine.filter(
        product_type_id=pt.id, is_active=True
    ).count()

    return {
        "data": ProductTypeListResponse(
            id=str(pt.id),
            name=pt.name,
            is_active=pt.is_active,
            product_line_count=product_line_count,
        )
    }


@router.post("/product-types/{product_type_id}/archive")
async def archive_product_type(product_type_id: UUID, user: User = Depends(require_permission("products", "write"))) -> dict:
    """Archive a product type. Returns product line count as a warning."""
    pt = await ProductType.get_or_none(id=product_type_id)
    if pt is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    product_line_count = await ProductLine.filter(
        product_type_id=pt.id, is_active=True
    ).count()
    pt.is_active = False
    await pt.save()
    return {
        "data": {
            "id": str(pt.id),
            "is_active": False,
            "product_line_count": product_line_count,
        }
    }


@router.post("/product-types/{product_type_id}/restore")
async def restore_product_type(product_type_id: UUID, user: User = Depends(require_permission("products", "write"))) -> dict:
    """Restore an archived product type."""
    pt = await ProductType.get_or_none(id=product_type_id)
    if pt is None:
        raise HTTPException(status_code=404, detail="Product type not found")
    pt.is_active = True
    await pt.save()
    return {"data": {"id": str(pt.id), "is_active": True}}
