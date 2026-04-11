"""Customer pricing endpoints — overrides, bulk actions, import/export."""

import csv
import io
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_CSV_ROWS = 10_000

from app.models.customer import Customer
from app.models.pricing import CustomerPrice
from app.models.product import SalesItem
from app.schemas.pricing import (
    BulkCustomerPriceRequest,
    CustomerPriceCreateRequest,
)
from app.services.pricing_service import (
    get_customer_pricing,
    get_item_pricing,
    log_price_change,
)

router = APIRouter(prefix="/api/v1", tags=["pricing"])


# ---------------------------------------------------------------------------
# Customer Pricing Grid
# ---------------------------------------------------------------------------


@router.get("/customers/{customer_id}/pricing")
async def customer_pricing(customer_id: UUID) -> dict:
    """Return the full pricing grid for a customer with effective prices."""
    data = await get_customer_pricing(customer_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"data": data}


# ---------------------------------------------------------------------------
# Item-Centric View
# ---------------------------------------------------------------------------


@router.get("/sales-items/{sales_item_id}/customer-pricing")
async def item_pricing(sales_item_id: UUID) -> dict:
    """Return all customers' pricing for a single sales item."""
    data = await get_item_pricing(sales_item_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Sales item not found")
    return {"data": data}


# ---------------------------------------------------------------------------
# Customer Price Overrides
# ---------------------------------------------------------------------------


@router.post("/customers/{customer_id}/prices")
async def set_customer_price(customer_id: UUID, body: CustomerPriceCreateRequest) -> dict:
    """Set a customer price override (create or update)."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    si = await SalesItem.get_or_none(id=body.sales_item_id)
    if si is None:
        raise HTTPException(status_code=404, detail="Sales item not found")

    new_price = Decimal(body.price)

    existing = await CustomerPrice.filter(
        customer_id=customer_id, sales_item_id=body.sales_item_id
    ).first()

    if existing:
        old_price = existing.price
        existing.price = new_price
        await existing.save()
        await log_price_change(
            change_type="customer_override",
            action="updated",
            sales_item_id=body.sales_item_id,
            customer_id=customer_id,
            old_price=old_price,
            new_price=new_price,
        )
        status_code = 200
    else:
        await CustomerPrice.create(
            customer_id=customer_id,
            sales_item_id=body.sales_item_id,
            price=new_price,
        )
        await log_price_change(
            change_type="customer_override",
            action="created",
            sales_item_id=body.sales_item_id,
            customer_id=customer_id,
            old_price=None,
            new_price=new_price,
        )
        status_code = 201

    return JSONResponse(
        status_code=status_code,
        content={
            "data": {
                "customer_id": str(customer_id),
                "sales_item_id": str(body.sales_item_id),
                "price": str(new_price),
            }
        },
    )


@router.delete("/customers/{customer_id}/prices/{sales_item_id}", status_code=204)
async def remove_customer_price(customer_id: UUID, sales_item_id: UUID) -> None:
    """Remove a customer price override."""
    cp = await CustomerPrice.filter(
        customer_id=customer_id, sales_item_id=sales_item_id
    ).first()
    if cp is None:
        raise HTTPException(status_code=404, detail="Customer price not found")

    old_price = cp.price
    await cp.delete()

    await log_price_change(
        change_type="customer_override",
        action="deleted",
        sales_item_id=sales_item_id,
        customer_id=customer_id,
        old_price=old_price,
        new_price=None,
    )


# ---------------------------------------------------------------------------
# Bulk Operations
# ---------------------------------------------------------------------------


@router.post("/customers/{customer_id}/prices/bulk")
async def bulk_customer_prices(customer_id: UUID, body: BulkCustomerPriceRequest) -> dict:
    """Bulk customer price operations: set_price, remove_overrides, reset_to_list."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    affected = 0

    if body.action == "set_price":
        if body.price is None:
            raise HTTPException(status_code=422, detail="price is required for set_price action")
        new_price = Decimal(body.price)
        for si_id in body.sales_item_ids:
            existing = await CustomerPrice.filter(
                customer_id=customer_id, sales_item_id=si_id
            ).first()
            if existing:
                old_price = existing.price
                existing.price = new_price
                await existing.save()
                await log_price_change(
                    change_type="customer_override",
                    action="updated",
                    sales_item_id=si_id,
                    customer_id=customer_id,
                    old_price=old_price,
                    new_price=new_price,
                )
            else:
                await CustomerPrice.create(
                    customer_id=customer_id,
                    sales_item_id=si_id,
                    price=new_price,
                )
                await log_price_change(
                    change_type="customer_override",
                    action="created",
                    sales_item_id=si_id,
                    customer_id=customer_id,
                    old_price=None,
                    new_price=new_price,
                )
            affected += 1

    elif body.action == "remove_overrides":
        for si_id in body.sales_item_ids:
            cp = await CustomerPrice.filter(
                customer_id=customer_id, sales_item_id=si_id
            ).first()
            if cp:
                old_price = cp.price
                await cp.delete()
                await log_price_change(
                    change_type="customer_override",
                    action="deleted",
                    sales_item_id=si_id,
                    customer_id=customer_id,
                    old_price=old_price,
                    new_price=None,
                )
                affected += 1

    elif body.action == "reset_to_list":
        from app.models.pricing import PriceListItem

        for si_id in body.sales_item_ids:
            pli = None
            if customer.price_list_id:
                pli = await PriceListItem.filter(
                    price_list_id=customer.price_list_id, sales_item_id=si_id
                ).first()
            if pli:
                existing = await CustomerPrice.filter(
                    customer_id=customer_id, sales_item_id=si_id
                ).first()
                if existing:
                    old_price = existing.price
                    existing.price = pli.price
                    await existing.save()
                    await log_price_change(
                        change_type="customer_override",
                        action="updated",
                        sales_item_id=si_id,
                        customer_id=customer_id,
                        old_price=old_price,
                        new_price=pli.price,
                    )
                else:
                    await CustomerPrice.create(
                        customer_id=customer_id,
                        sales_item_id=si_id,
                        price=pli.price,
                    )
                    await log_price_change(
                        change_type="customer_override",
                        action="created",
                        sales_item_id=si_id,
                        customer_id=customer_id,
                        old_price=None,
                        new_price=pli.price,
                    )
                affected += 1

    return {"data": {"affected_count": affected}}


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------


@router.get("/customers/{customer_id}/pricing/export")
async def export_customer_pricing_csv(customer_id: UUID) -> StreamingResponse:
    """Export a customer's pricing grid as CSV."""
    data = await get_customer_pricing(customer_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Sales Item", "Variety", "Stems", "Price List Price", "Customer Override", "Effective Price"])

    for item in data["items"]:
        writer.writerow([
            item["sales_item_name"],
            item["variety_name"],
            item["stems_per_order"],
            item["price_list_price"] or "",
            item["customer_override"] or "",
            item["effective_price"],
        ])

    output.seek(0)
    customer_name = data["customer"]["name"].replace(" ", "_")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={customer_name}_pricing.csv"},
    )


@router.post("/customers/{customer_id}/prices/import")
async def import_customer_prices_csv(customer_id: UUID, file: UploadFile) -> dict:
    """Import customer price overrides from CSV."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes.",
        )

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if len(rows) > MAX_CSV_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many rows ({len(rows)}). Maximum is {MAX_CSV_ROWS}.",
        )

    created_count = 0
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

        existing = await CustomerPrice.filter(
            customer_id=customer_id, sales_item_id=si.id
        ).first()

        if existing:
            old_price = existing.price
            existing.price = price
            await existing.save()
            await log_price_change(
                change_type="customer_override",
                action="updated",
                sales_item_id=si.id,
                customer_id=customer_id,
                old_price=old_price,
                new_price=price,
            )
            updated_count += 1
        else:
            await CustomerPrice.create(
                customer_id=customer_id,
                sales_item_id=si.id,
                price=price,
            )
            await log_price_change(
                change_type="customer_override",
                action="created",
                sales_item_id=si.id,
                customer_id=customer_id,
                old_price=None,
                new_price=price,
            )
            created_count += 1

    return {
        "data": {
            "created_count": created_count,
            "updated_count": updated_count,
            "not_found_count": not_found_count,
        }
    }
