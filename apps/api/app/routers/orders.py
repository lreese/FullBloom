"""Order endpoints."""

from fastapi import APIRouter, HTTPException

from app.schemas.order import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderCustomerResponse,
    OrderDetailResponse,
    OrderLineResponse,
    OrderLineSalesItemResponse,
)
from app.models.order import Order
from app.services.order_service import DuplicateOrderError, create_order

router = APIRouter(prefix="/api/v1", tags=["orders"])


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
            created_at=str(order.created_at),
        )
    }


@router.get("/orders/{order_id}")
async def get_order(order_id: str) -> dict:
    """Get a single order with all lines and customer info."""
    order = await Order.get_or_none(id=order_id).prefetch_related(
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
                customer_id=customer.customer_id,
                name=customer.name,
            ),
            order_date=str(order.order_date),
            ship_via=order.ship_via,
            price_type=order.price_type,
            freight_charge_included=order.freight_charge_included,
            box_charge=str(order.box_charge) if order.box_charge is not None else None,
            holiday_charge_pct=str(order.holiday_charge_pct) if order.holiday_charge_pct is not None else None,
            special_charge=str(order.special_charge) if order.special_charge is not None else None,
            freight_charge=str(order.freight_charge) if order.freight_charge is not None else None,
            order_notes=order.order_notes,
            po_number=order.po_number,
            salesperson_email=order.salesperson_email,
            order_label=order.order_label,
            created_at=str(order.created_at),
            updated_at=str(order.updated_at),
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
