"""Sales item endpoints — CRUD + archive/restore.

Create and list are nested under varieties. Update, archive, and restore are flat.
"""

from decimal import Decimal
from uuid import UUID

from fastapi import Depends, APIRouter, HTTPException

from app.models.pricing import PriceList, PriceListItem
from app.models.product import SalesItem, Variety
from app.schemas.sales_item import (
    SalesItemCreateRequest,
    SalesItemFlatCreateRequest,
    SalesItemResponse,
    SalesItemUpdateRequest,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["sales-items"], dependencies=[Depends(get_current_user)])


def _build_sales_item_response(
    si: SalesItem,
    customer_prices_count: int,
    price_list_prices: dict[str, str] | None = None,
) -> SalesItemResponse:
    """Build a SalesItemResponse from a SalesItem instance."""
    variety_id = None
    variety_name = None
    # If variety is prefetched, include it
    try:
        if si.variety:
            variety_id = str(si.variety.id)
            variety_name = si.variety.name
    except Exception:
        # variety not prefetched — use the FK directly
        if si.variety_id:
            variety_id = str(si.variety_id)

    # Compute margin when cost_price is available
    margin = None
    if si.cost_price is not None:
        margin = str(Decimal(str(si.retail_price)) - Decimal(str(si.cost_price)))

    return SalesItemResponse(
        id=str(si.id),
        variety_id=variety_id,
        variety_name=variety_name,
        name=si.name,
        stems_per_order=si.stems_per_order,
        retail_price=str(si.retail_price),
        cost_price=str(si.cost_price) if si.cost_price is not None else None,
        margin=margin,
        is_active=si.is_active,
        customer_prices_count=customer_prices_count,
        price_list_prices=price_list_prices or {},
    )


async def _get_price_list_prices(si_id: UUID) -> dict[str, str]:
    """Get price list prices for a sales item as a {price_list_id: price} map."""
    plis = await PriceListItem.filter(sales_item_id=si_id).prefetch_related("price_list").all()
    return {
        str(pli.price_list_id): str(pli.price)
        for pli in plis
        if pli.price_list.is_active  # type: ignore[union-attr]
    }


async def _batch_price_list_prices(
    sales_item_ids: list[UUID],
) -> dict[str, dict[str, str]]:
    """Batch-load price list prices for multiple sales items in one query."""
    active_pl_ids = set(
        str(pl.id) for pl in await PriceList.filter(is_active=True).all()
    )
    all_pli = await PriceListItem.filter(
        sales_item_id__in=sales_item_ids
    ).values("sales_item_id", "price_list_id", "price")

    pli_map: dict[str, dict[str, str]] = {}
    for pli in all_pli:
        pl_id = str(pli["price_list_id"])
        if pl_id not in active_pl_ids:
            continue
        sid = str(pli["sales_item_id"])
        if sid not in pli_map:
            pli_map[sid] = {}
        pli_map[sid][pl_id] = str(pli["price"])
    return pli_map


@router.get("/varieties/{variety_id}/sales-items")
async def list_sales_items(
    variety_id: UUID, active: bool | None = True,
    _user: User = Depends(require_permission("pricing", "read")),
) -> dict:
    """List sales items for a variety."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    qs = SalesItem.filter(variety_id=variety_id)
    if active is not None:
        qs = qs.filter(is_active=active)

    sales_items = await qs.prefetch_related("customer_prices").order_by("name")

    pli_map = await _batch_price_list_prices([si.id for si in sales_items])

    data = [
        _build_sales_item_response(
            si,
            customer_prices_count=len(si.customer_prices),  # type: ignore[attr-defined]
            price_list_prices=pli_map.get(str(si.id), {}),
        )
        for si in sales_items
    ]

    return {"data": data}


@router.get("/sales-items")
async def list_all_sales_items(active: bool | None = True, _user: User = Depends(require_permission("pricing", "read"))) -> dict:
    """List all sales items across all varieties."""
    qs = SalesItem.all()
    if active is not None:
        qs = qs.filter(is_active=active)

    sales_items = await qs.prefetch_related("customer_prices", "variety").order_by("name")

    pli_map = await _batch_price_list_prices([si.id for si in sales_items])

    data = [
        _build_sales_item_response(
            si,
            customer_prices_count=len(si.customer_prices),  # type: ignore[attr-defined]
            price_list_prices=pli_map.get(str(si.id), {}),
        )
        for si in sales_items
    ]

    return {"data": data}


@router.post("/sales-items", status_code=201)
async def create_sales_item_flat(data: SalesItemFlatCreateRequest, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Create a new sales item (flat endpoint, variety_id in body)."""
    variety = await Variety.get_or_none(id=data.variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    existing = await SalesItem.filter(name=data.name).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Sales item name '{data.name}' already exists",
        )

    create_data = data.model_dump(exclude={"variety_id"})
    si = await SalesItem.create(variety_id=data.variety_id, **create_data)

    # Pre-populate PriceListItems for all active price lists at retail price
    active_lists = await PriceList.filter(is_active=True).all()
    for pl in active_lists:
        await PriceListItem.create(
            price_list=pl, sales_item=si, price=si.retail_price
        )

    plp = await _get_price_list_prices(si.id)
    await si.fetch_related("variety")

    return {
        "data": _build_sales_item_response(si, customer_prices_count=0, price_list_prices=plp)
    }


@router.post("/varieties/{variety_id}/sales-items", status_code=201)
async def create_sales_item(
    variety_id: UUID, data: SalesItemCreateRequest,
    user: User = Depends(require_permission("pricing", "write")),
) -> dict:
    """Create a new sales item for a variety."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    existing = await SalesItem.filter(name=data.name).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Sales item name '{data.name}' already exists",
        )

    si = await SalesItem.create(variety_id=variety_id, **data.model_dump())

    # Pre-populate PriceListItems for all active price lists at retail price
    active_lists = await PriceList.filter(is_active=True).all()
    for pl in active_lists:
        await PriceListItem.create(
            price_list=pl, sales_item=si, price=si.retail_price
        )

    plp = await _get_price_list_prices(si.id)
    await si.fetch_related("variety")

    return {
        "data": _build_sales_item_response(si, customer_prices_count=0, price_list_prices=plp)
    }


@router.patch("/sales-items/{sales_item_id}")
async def update_sales_item(
    sales_item_id: UUID, data: SalesItemUpdateRequest,
    user: User = Depends(require_permission("pricing", "write")),
) -> dict:
    """Update a sales item."""
    si = await SalesItem.get_or_none(id=sales_item_id)
    if si is None:
        raise HTTPException(status_code=404, detail="Sales item not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    # Check name uniqueness if name is changing
    if "name" in update_data:
        existing = await SalesItem.filter(
            name=update_data["name"]
        ).exclude(id=sales_item_id).first()
        if existing:
            raise HTTPException(
                status_code=422,
                detail=f"Sales item name '{update_data['name']}' already exists",
            )

    await si.update_from_dict(update_data).save()
    await si.fetch_related("customer_prices", "variety")
    plp = await _get_price_list_prices(si.id)

    return {
        "data": _build_sales_item_response(
            si,
            customer_prices_count=len(si.customer_prices),  # type: ignore[attr-defined]
            price_list_prices=plp,
        )
    }


@router.post("/sales-items/{sales_item_id}/archive")
async def archive_sales_item(sales_item_id: UUID, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Soft-delete a sales item. Returns customer price count as a warning."""
    si = await SalesItem.get_or_none(id=sales_item_id)
    if si is None:
        raise HTTPException(status_code=404, detail="Sales item not found")

    await si.fetch_related("customer_prices")
    customer_prices_count = len(si.customer_prices)  # type: ignore[attr-defined]

    si.is_active = False
    await si.save()
    return {
        "data": {
            "id": str(si.id),
            "is_active": False,
            "customer_prices_count": customer_prices_count,
        }
    }


@router.post("/sales-items/{sales_item_id}/restore")
async def restore_sales_item(sales_item_id: UUID, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Restore a soft-deleted sales item."""
    si = await SalesItem.get_or_none(id=sales_item_id)
    if si is None:
        raise HTTPException(status_code=404, detail="Sales item not found")
    si.is_active = True
    await si.save()
    return {"data": {"id": str(si.id), "is_active": True}}
