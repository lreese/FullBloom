"""Price list endpoints — CRUD, matrix, inline edit, bulk, import/export."""

import asyncio
import csv
import io
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import Depends, APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from tortoise.functions import Count
from tortoise.transactions import in_transaction

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_CSV_ROWS = 10_000
_import_lock = asyncio.Lock()

from app.models.customer import Customer
from app.models.pricing import PriceList, PriceListItem
from app.models.product import SalesItem
from app.schemas.pricing import (
    BulkPriceListItemRequest,
    PriceListCreateRequest,
    PriceListItemUpdateRequest,
    PriceListUpdateRequest,
    RetailPriceUpdateRequest,
)
from app.services.pricing_service import (
    archive_price_list,
    create_price_list,
    get_impact_preview,
    get_price_list_matrix,
    log_price_change,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["price-lists"], dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Price List CRUD
# ---------------------------------------------------------------------------


@router.get("/price-lists")
async def list_price_lists(active: bool | None = True, _user: User = Depends(require_permission("pricing", "read"))) -> dict:
    """List price lists with customer counts."""
    qs = PriceList.all()
    if active is not None:
        qs = qs.filter(is_active=active)
    price_lists = await qs.order_by("name")

    # Batch-load active customer counts in a single query instead of N+1
    pl_ids = [pl.id for pl in price_lists]
    count_rows = await Customer.filter(
        price_list_id__in=pl_ids, is_active=True
    ).annotate(cnt=Count("id")).group_by("price_list_id").values("price_list_id", "cnt")
    count_map = {str(row["price_list_id"]): row["cnt"] for row in count_rows}

    data = [
        {
            "id": str(pl.id),
            "name": pl.name,
            "is_active": pl.is_active,
            "customer_count": count_map.get(str(pl.id), 0),
        }
        for pl in price_lists
    ]

    return {"data": data}


@router.post("/price-lists", status_code=201)
async def create_price_list_endpoint(body: PriceListCreateRequest, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Create a new price list, pre-populating items from a source."""
    existing = await PriceList.filter(name=body.name).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Price list '{body.name}' already exists",
        )

    if body.copy_from:
        source = await PriceList.get_or_none(id=body.copy_from)
        if source is None:
            raise HTTPException(status_code=404, detail="Source price list not found")

    pl = await create_price_list(body.name, body.copy_from)

    return {
        "data": {
            "id": str(pl.id),
            "name": pl.name,
            "is_active": pl.is_active,
            "customer_count": 0,
        }
    }


@router.patch("/price-lists/{price_list_id}")
async def rename_price_list(price_list_id: UUID, body: PriceListUpdateRequest, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Rename a price list."""
    pl = await PriceList.get_or_none(id=price_list_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Price list not found")

    # Check uniqueness
    existing = await PriceList.filter(name=body.name).exclude(id=price_list_id).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Price list '{body.name}' already exists",
        )

    pl.name = body.name
    await pl.save()
    count = await Customer.filter(price_list_id=pl.id, is_active=True).count()

    return {
        "data": {
            "id": str(pl.id),
            "name": pl.name,
            "is_active": pl.is_active,
            "customer_count": count,
        }
    }


@router.post("/price-lists/{price_list_id}/archive")
async def archive_price_list_endpoint(price_list_id: UUID, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Archive a price list, converting customer assignments to overrides."""
    result = await archive_price_list(price_list_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Price list not found")
    return {"data": result}


@router.post("/price-lists/{price_list_id}/restore")
async def restore_price_list(price_list_id: UUID, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Restore an archived price list."""
    pl = await PriceList.get_or_none(id=price_list_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Price list not found")
    pl.is_active = True
    await pl.save()
    return {"data": {"id": str(pl.id), "is_active": True}}


# ---------------------------------------------------------------------------
# Matrix
# ---------------------------------------------------------------------------


@router.get("/price-lists/matrix")
async def price_list_matrix(_user: User = Depends(require_permission("pricing", "read"))) -> dict:
    """Get the full price matrix: all active sales items x all active price lists."""
    data = await get_price_list_matrix()
    return {"data": data}


# ---------------------------------------------------------------------------
# Price List Item (cell) Endpoints
# ---------------------------------------------------------------------------


@router.patch("/price-list-items/{price_list_id}/{sales_item_id}")
async def update_price_list_item(
    price_list_id: UUID, sales_item_id: UUID, body: PriceListItemUpdateRequest,
    user: User = Depends(require_permission("pricing", "write")),
) -> dict:
    """Update a single cell in the price list matrix."""
    new_price = Decimal(body.price)

    pli = await PriceListItem.filter(
        price_list_id=price_list_id, sales_item_id=sales_item_id
    ).first()

    if pli is None:
        # Create if not exists
        pl = await PriceList.get_or_none(id=price_list_id)
        si = await SalesItem.get_or_none(id=sales_item_id)
        if pl is None or si is None:
            raise HTTPException(status_code=404, detail="Price list or sales item not found")
        pli = await PriceListItem.create(
            price_list_id=price_list_id,
            sales_item_id=sales_item_id,
            price=new_price,
        )
        await log_price_change(
            change_type="price_list_item",
            action="created",
            sales_item_id=sales_item_id,
            price_list_id=price_list_id,
            old_price=None,
            new_price=new_price,
        )
    else:
        old_price = pli.price
        pli.price = new_price
        await pli.save()
        await log_price_change(
            change_type="price_list_item",
            action="updated",
            sales_item_id=sales_item_id,
            price_list_id=price_list_id,
            old_price=old_price,
            new_price=new_price,
        )

    return {
        "data": {
            "price_list_id": str(price_list_id),
            "sales_item_id": str(sales_item_id),
            "price": str(pli.price),
        }
    }


@router.patch("/price-list-items/bulk")
async def bulk_update_price_list_items(body: BulkPriceListItemRequest, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Bulk set a price for multiple sales items on a price list."""
    pl = await PriceList.get_or_none(id=body.price_list_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Price list not found")

    # M3: Validate all sales_item_ids exist before processing
    existing_items = await SalesItem.filter(id__in=body.sales_item_ids).values_list("id", flat=True)
    existing_ids = {str(sid) for sid in existing_items}
    missing = [str(sid) for sid in body.sales_item_ids if str(sid) not in existing_ids]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Sales items not found: {', '.join(missing[:10])}",
        )

    new_price = Decimal(body.price)
    updated = 0

    async with in_transaction():
        for si_id in body.sales_item_ids:
            pli = await PriceListItem.filter(
                price_list_id=body.price_list_id, sales_item_id=si_id
            ).first()
            if pli:
                old_price = pli.price
                pli.price = new_price
                await pli.save()
                await log_price_change(
                    change_type="price_list_item",
                    action="updated",
                    sales_item_id=si_id,
                    price_list_id=body.price_list_id,
                    old_price=old_price,
                    new_price=new_price,
                )
                updated += 1
            else:
                await PriceListItem.create(
                    price_list_id=body.price_list_id,
                    sales_item_id=si_id,
                    price=new_price,
                )
                await log_price_change(
                    change_type="price_list_item",
                    action="created",
                    sales_item_id=si_id,
                    price_list_id=body.price_list_id,
                    old_price=None,
                    new_price=new_price,
                )
                updated += 1

    return {"data": {"updated_count": updated}}


@router.patch("/price-lists/matrix/retail")
async def update_retail_price(body: RetailPriceUpdateRequest, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Update the retail price for a sales item (edits SalesItem.retail_price)."""
    new_price = Decimal(body.price)

    si = await SalesItem.get_or_none(id=body.sales_item_id)
    if si is None:
        raise HTTPException(status_code=404, detail="Sales item not found")

    old_price = si.retail_price
    si.retail_price = new_price
    await si.save()

    await log_price_change(
        change_type="retail_price",
        action="updated",
        sales_item_id=si.id,
        old_price=old_price,
        new_price=new_price,
    )

    return {
        "data": {
            "sales_item_id": str(si.id),
            "retail_price": str(si.retail_price),
        }
    }


# ---------------------------------------------------------------------------
# Impact Preview
# ---------------------------------------------------------------------------


@router.get("/price-list-items/{price_list_id}/{sales_item_id}/impact")
async def impact_preview(
    price_list_id: UUID, sales_item_id: UUID, new_price: str = "",
    _user: User = Depends(require_permission("pricing", "read")),
) -> dict:
    """Preview the impact of changing a price list item price."""
    if not new_price:
        raise HTTPException(status_code=422, detail="new_price query parameter is required")

    try:
        price_decimal = Decimal(new_price.replace("$", "").replace(",", "").strip())
        if price_decimal < 0:
            raise HTTPException(status_code=422, detail="Price cannot be negative")
    except InvalidOperation:
        raise HTTPException(status_code=422, detail="new_price must be a valid number")

    result = await get_impact_preview(price_list_id, sales_item_id, price_decimal)
    if result is None:
        raise HTTPException(status_code=404, detail="Price list item not found")

    return {"data": result}


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------


@router.get("/price-lists/matrix/export")
async def export_matrix_csv(_user: User = Depends(require_permission("pricing", "read"))) -> StreamingResponse:
    """Export the price list matrix as CSV."""
    matrix = await get_price_list_matrix()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    header = ["Sales Item", "Variety", "Stems", "Retail"]
    for pl in matrix["price_lists"]:
        header.append(pl["name"])
    writer.writerow(header)

    # Data rows
    for item in matrix["items"]:
        row = [
            item["sales_item_name"],
            item["variety_name"],
            item["stems_per_order"],
            item["retail_price"],
        ]
        for pl in matrix["price_lists"]:
            row.append(item["prices"].get(pl["id"], ""))
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=price_list_matrix.csv"},
    )


@router.post("/price-lists/{price_list_id}/import")
async def import_price_list_csv(price_list_id: UUID, file: UploadFile, user: User = Depends(require_permission("pricing", "write"))) -> dict:
    """Import prices for a price list from CSV. Matches by sales item name."""
    # M6: Rate limiting via import lock
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")

    pl = await PriceList.get_or_none(id=price_list_id)
    if pl is None:
        raise HTTPException(status_code=404, detail="Price list not found")

    async with _import_lock:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes.",
            )

        # M4: Handle BOM and non-UTF-8 files gracefully
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=422,
                detail="File is not valid UTF-8. Please save as UTF-8 CSV.",
            )

        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        if len(rows) > MAX_CSV_ROWS:
            raise HTTPException(
                status_code=422,
                detail=f"Too many rows ({len(rows)}). Maximum is {MAX_CSV_ROWS}.",
            )

        updated_count = 0
        not_found_count = 0

        for row in rows:
            name = row.get("Sales Item", "").strip()
            price_str = row.get("Price", "").strip()
            if not name or not price_str:
                continue

            si = await SalesItem.filter(name=name).first()
            if si is None:
                not_found_count += 1
                continue

            try:
                price = Decimal(price_str.replace("$", "").replace(",", ""))
            except InvalidOperation:
                not_found_count += 1
                continue

            if price < 0:
                not_found_count += 1
                continue

            pli = await PriceListItem.filter(
                price_list_id=price_list_id, sales_item_id=si.id
            ).first()

            if pli:
                old_price = pli.price
                pli.price = price
                await pli.save()
                await log_price_change(
                    change_type="price_list_item",
                    action="updated",
                    sales_item_id=si.id,
                    price_list_id=price_list_id,
                    old_price=old_price,
                    new_price=price,
                )
            else:
                await PriceListItem.create(
                    price_list_id=price_list_id,
                    sales_item_id=si.id,
                    price=price,
                )
                await log_price_change(
                    change_type="price_list_item",
                    action="created",
                    sales_item_id=si.id,
                    price_list_id=price_list_id,
                    old_price=None,
                    new_price=price,
                )
            updated_count += 1

    return {"data": {"updated_count": updated_count, "not_found_count": not_found_count}}
