"""Order endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from tortoise.expressions import Q

from app.schemas.order import (
    OrderAuditLogResponse,
    OrderCreateRequest,
    OrderCreateResponse,
    OrderCustomerResponse,
    OrderDetailResponse,
    OrderLineResponse,
    OrderLineSalesItemResponse,
    OrderListItemResponse,
    OrderListResponse,
    OrderUpdateRequest,
)
from app.models.order import Order, OrderAuditLog
from app.services.order_service import (
    DuplicateOrderError,
    create_order,
    delete_order,
    update_order,
)

router = APIRouter(prefix="/api/v1", tags=["orders"])


@router.get("/orders")
async def list_orders(
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    customer_id: str | None = Query(None),
    salesperson_email: str | None = Query(None),
    search: str | None = Query(None),
    from_standing_order: bool | None = Query(None),
) -> dict:
    """List orders with pagination and filtering."""
    qs = Order.filter(is_deleted=False)

    if from_standing_order is True:
        qs = qs.filter(standing_order_id__isnull=False)
    elif from_standing_order is False:
        qs = qs.filter(standing_order_id__isnull=True)

    if date_from:
        qs = qs.filter(order_date__gte=date_from)
    if date_to:
        qs = qs.filter(order_date__lte=date_to)
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
    if salesperson_email:
        qs = qs.filter(salesperson_email__icontains=salesperson_email)
    if search:
        qs = qs.filter(
            Q(order_number__icontains=search)
            | Q(customer__name__icontains=search)
            | Q(po_number__icontains=search)
        )

    total = await qs.count()

    orders = (
        await qs.select_related("customer")
        .prefetch_related("lines")
        .order_by("-order_date", "-created_at")
        .offset(offset)
        .limit(limit)
    )

    items = []
    for o in orders:
        lines = list(o.lines)  # type: ignore[attr-defined]
        items.append(
            OrderListItemResponse(
                id=str(o.id),
                order_number=o.order_number,
                customer_id=str(o.customer_id),
                customer_name=o.customer.name,  # type: ignore[attr-defined]
                order_date=str(o.order_date),
                ship_via=o.ship_via,
                lines_count=len(lines),
                total_stems=sum(l.stems for l in lines),
                salesperson_email=o.salesperson_email,
                standing_order_id=str(o.standing_order_id) if o.standing_order_id else None,
                po_number=o.po_number,
                created_at=o.created_at.isoformat(),
            )
        )

    return {
        "data": OrderListResponse(
            items=items,
            total=total,
            offset=offset,
            limit=limit,
        )
    }


@router.post("/orders", status_code=201)
async def create_order_endpoint(data: OrderCreateRequest) -> dict:
    """Create a new order. Returns 409 if duplicate detected."""
    try:
        order = await create_order(data)
    except DuplicateOrderError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "data": OrderCreateResponse(
            id=str(order.id),
            order_number=order.order_number,
            customer_id=str(order.customer_id),
            order_date=str(order.order_date),
            lines_count=len(order.lines),  # type: ignore[arg-type]
            created_at=order.created_at.isoformat(),
        )
    }


@router.put("/orders/{order_id}")
async def update_order_endpoint(order_id: UUID, data: OrderUpdateRequest) -> dict:
    """Update an existing order."""
    try:
        order = await update_order(order_id, data)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=422, detail=str(e))

    customer = order.customer  # type: ignore[attr-defined]
    lines = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]

    return {
        "data": OrderDetailResponse(
            id=str(order.id),
            order_number=order.order_number,
            customer=OrderCustomerResponse(
                id=str(customer.id),
                customer_number=customer.customer_number,
                name=customer.name,
            ),
            order_date=str(order.order_date),
            ship_via=order.ship_via,
            price_list=order.price_list,
            freight_charge_included=order.freight_charge_included,
            box_charge=str(order.box_charge) if order.box_charge is not None else None,
            holiday_charge_pct=str(order.holiday_charge_pct) if order.holiday_charge_pct is not None else None,
            special_charge=str(order.special_charge) if order.special_charge is not None else None,
            freight_charge=str(order.freight_charge) if order.freight_charge is not None else None,
            order_notes=order.order_notes,
            po_number=order.po_number,
            salesperson_email=order.salesperson_email,
            order_label=order.order_label,
            created_at=order.created_at.isoformat(),
            updated_at=order.updated_at.isoformat(),
            lines=[
                OrderLineResponse(
                    id=str(line.id),
                    line_number=line.line_number,
                    sales_item=OrderLineSalesItemResponse(
                        id=str(line.sales_item.id),
                        name=line.sales_item.name,
                    ),
                    assorted=line.assorted,
                    color_variety=line.color_variety,
                    stems=line.stems,
                    list_price_per_stem=str(line.list_price_per_stem),
                    price_per_stem=str(line.price_per_stem),
                    item_fee_pct=str(line.item_fee_pct) if line.item_fee_pct is not None else None,
                    item_fee_dollar=str(line.item_fee_dollar) if line.item_fee_dollar is not None else None,
                    effective_price_per_stem=str(line.effective_price_per_stem),
                    notes=line.notes,
                    box_quantity=line.box_quantity,
                    bunches_per_box=line.bunches_per_box,
                    stems_per_bunch=line.stems_per_bunch,
                    box_reference=line.box_reference,
                    is_special=line.is_special,
                    sleeve=line.sleeve,
                    upc=line.upc,
                )
                for line in lines
            ],
        )
    }


@router.delete("/orders/{order_id}")
async def delete_order_endpoint(order_id: UUID) -> dict:
    """Delete an order."""
    try:
        order_number = await delete_order(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"data": {"deleted": True, "order_number": order_number}}


@router.get("/orders/{order_id}/audit-log")
async def get_order_audit_log(order_id: UUID) -> dict:
    """Return the last 50 audit log entries for an order."""
    # Verify the order exists
    order = await Order.get_or_none(id=order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    entries = (
        await OrderAuditLog.filter(order_id=order_id)
        .order_by("-created_at")
        .limit(50)
    )

    return {
        "data": [
            OrderAuditLogResponse(
                id=str(e.id),
                action=e.action,
                changes=e.changes,
                entered_by=e.entered_by,
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ]
    }


@router.get("/orders/{order_id}")
async def get_order(order_id: UUID) -> dict:
    """Get a single order with all lines and customer info."""
    order = await Order.get_or_none(id=order_id, is_deleted=False).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    customer = order.customer  # type: ignore[attr-defined]
    lines = sorted(order.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]

    return {
        "data": OrderDetailResponse(
            id=str(order.id),
            order_number=order.order_number,
            customer=OrderCustomerResponse(
                id=str(customer.id),
                customer_number=customer.customer_number,
                name=customer.name,
            ),
            order_date=str(order.order_date),
            ship_via=order.ship_via,
            price_list=order.price_list,
            freight_charge_included=order.freight_charge_included,
            box_charge=str(order.box_charge) if order.box_charge is not None else None,
            holiday_charge_pct=str(order.holiday_charge_pct) if order.holiday_charge_pct is not None else None,
            special_charge=str(order.special_charge) if order.special_charge is not None else None,
            freight_charge=str(order.freight_charge) if order.freight_charge is not None else None,
            order_notes=order.order_notes,
            po_number=order.po_number,
            salesperson_email=order.salesperson_email,
            order_label=order.order_label,
            created_at=order.created_at.isoformat(),
            updated_at=order.updated_at.isoformat(),
            lines=[
                OrderLineResponse(
                    id=str(line.id),
                    line_number=line.line_number,
                    sales_item=OrderLineSalesItemResponse(
                        id=str(line.sales_item.id),
                        name=line.sales_item.name,
                    ),
                    assorted=line.assorted,
                    color_variety=line.color_variety,
                    stems=line.stems,
                    list_price_per_stem=str(line.list_price_per_stem),
                    price_per_stem=str(line.price_per_stem),
                    item_fee_pct=str(line.item_fee_pct) if line.item_fee_pct is not None else None,
                    item_fee_dollar=str(line.item_fee_dollar) if line.item_fee_dollar is not None else None,
                    effective_price_per_stem=str(line.effective_price_per_stem),
                    notes=line.notes,
                    box_quantity=line.box_quantity,
                    bunches_per_box=line.bunches_per_box,
                    stems_per_bunch=line.stems_per_bunch,
                    box_reference=line.box_reference,
                    is_special=line.is_special,
                    sleeve=line.sleeve,
                    upc=line.upc,
                )
                for line in lines
            ],
        )
    }
