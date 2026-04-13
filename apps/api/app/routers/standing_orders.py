"""Standing order endpoints."""

from uuid import UUID

from fastapi import Depends, APIRouter, HTTPException, Query
from tortoise.expressions import Q

from app.models.standing_order import StandingOrder, StandingOrderAuditLog
from app.schemas.standing_order import (
    GeneratePreviewRequest,
    GeneratePreviewResponse,
    GenerateRequest,
    GenerateResponse,
    StandingOrderAuditLogResponse,
    StandingOrderCreateRequest,
    StandingOrderCreateResponse,
    StandingOrderDetailResponse,
    StandingOrderLineResponse,
    StandingOrderListItemResponse,
    StandingOrderUpdateRequest,
    StatusChangeRequest,
    StatusChangeWithReasonRequest,
)
from app.services.standing_order_service import (
    FULL_DAY_NAMES,
    build_cadence_description,
    cancel_standing_order,
    create_standing_order,
    generate_orders,
    generate_preview,
    pause_standing_order,
    resume_standing_order,
    update_standing_order,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["standing-orders"], dependencies=[Depends(get_current_user)])


def _build_detail_response(so: StandingOrder) -> StandingOrderDetailResponse:
    """Build a detail response from a prefetched StandingOrder."""
    customer = so.customer  # type: ignore[attr-defined]
    lines = sorted(so.lines, key=lambda l: l.line_number)  # type: ignore[attr-defined]

    return StandingOrderDetailResponse(
        id=str(so.id),
        customer_id=str(so.customer_id),
        customer_name=customer.name,
        status=so.status,
        frequency_weeks=so.frequency_weeks,
        days_of_week=so.days_of_week,
        days_of_week_names=[FULL_DAY_NAMES[d] for d in so.days_of_week],
        reference_date=str(so.reference_date),
        cadence_description=build_cadence_description(
            so.frequency_weeks, so.days_of_week
        ),
        ship_via=so.ship_via,
        salesperson_email=so.salesperson_email,
        box_charge=str(so.box_charge) if so.box_charge is not None else None,
        holiday_charge_pct=(
            str(so.holiday_charge_pct) if so.holiday_charge_pct is not None else None
        ),
        special_charge=(
            str(so.special_charge) if so.special_charge is not None else None
        ),
        freight_charge=(
            str(so.freight_charge) if so.freight_charge is not None else None
        ),
        freight_charge_included=so.freight_charge_included,
        notes=so.notes,
        created_at=so.created_at.isoformat(),
        updated_at=so.updated_at.isoformat(),
        lines=[
            StandingOrderLineResponse(
                id=str(line.id),
                line_number=line.line_number,
                sales_item_id=str(line.sales_item_id),
                sales_item_name=line.sales_item.name,
                stems=line.stems,
                price_per_stem=str(line.price_per_stem),
                item_fee_pct=(
                    str(line.item_fee_pct) if line.item_fee_pct is not None else None
                ),
                item_fee_dollar=(
                    str(line.item_fee_dollar)
                    if line.item_fee_dollar is not None
                    else None
                ),
                color_variety=line.color_variety,
                notes=line.notes,
            )
            for line in lines
        ],
    )


@router.post("/standing-orders", status_code=201)
async def create_standing_order_endpoint(
    data: StandingOrderCreateRequest,
    user: User = Depends(require_permission("standing_orders", "write")),
) -> dict:
    """Create a new standing order."""
    if not data.salesperson_email:
        data = data.model_copy(update={"salesperson_email": user.email})
    try:
        so = await create_standing_order(data, entered_by=user.email)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    customer = so.customer  # type: ignore[attr-defined]
    return {
        "data": StandingOrderCreateResponse(
            id=str(so.id),
            customer_id=str(so.customer_id),
            customer_name=customer.name,
            status=so.status,
            frequency_weeks=so.frequency_weeks,
            days_of_week=so.days_of_week,
            reference_date=str(so.reference_date),
            lines_count=len(so.lines),  # type: ignore[arg-type]
            created_at=so.created_at.isoformat(),
        )
    }


@router.get("/standing-orders")
async def list_standing_orders(
    status: str = Query("active"),
    customer_id: str | None = Query(None),
    salesperson_email: str | None = Query(None),
    search: str | None = Query(None),
) -> dict:
    """List standing orders with filters."""
    qs = StandingOrder.all()

    if status != "all":
        qs = qs.filter(status=status)
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
    if salesperson_email:
        qs = qs.filter(salesperson_email__icontains=salesperson_email)
    if search:
        qs = qs.filter(Q(customer__name__icontains=search))

    standing_orders = (
        await qs.select_related("customer")
        .prefetch_related("lines")
        .order_by("-updated_at")
    )

    items = []
    for so in standing_orders:
        lines = list(so.lines)  # type: ignore[attr-defined]
        items.append(
            StandingOrderListItemResponse(
                id=str(so.id),
                customer_id=str(so.customer_id),
                customer_name=so.customer.name,  # type: ignore[attr-defined]
                status=so.status,
                frequency_weeks=so.frequency_weeks,
                days_of_week=so.days_of_week,
                cadence_description=build_cadence_description(
                    so.frequency_weeks, so.days_of_week
                ),
                lines_count=len(lines),
                total_stems=sum(l.stems for l in lines),
                salesperson_email=so.salesperson_email,
                updated_at=so.updated_at.isoformat(),
            )
        )

    return {"data": items}


@router.get("/standing-orders/{so_id}")
async def get_standing_order(so_id: UUID) -> dict:
    """Get a single standing order with all lines."""
    so = await StandingOrder.get_or_none(id=so_id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    if so is None:
        raise HTTPException(status_code=404, detail="Standing order not found")

    return {"data": _build_detail_response(so)}


@router.put("/standing-orders/{so_id}")
async def update_standing_order_endpoint(
    so_id: UUID, data: StandingOrderUpdateRequest,
    user: User = Depends(require_permission("standing_orders", "write")),
) -> dict:
    """Update a standing order. Requires active status."""
    try:
        so = await update_standing_order(str(so_id), data, entered_by=user.email)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        if "must be active" in msg.lower():
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=422, detail=msg)

    return {"data": _build_detail_response(so)}


@router.post("/standing-orders/{so_id}/pause")
async def pause_standing_order_endpoint(
    so_id: UUID, data: StatusChangeWithReasonRequest,
    user: User = Depends(require_permission("standing_orders", "write")),
) -> dict:
    """Pause an active standing order."""
    try:
        so = await pause_standing_order(str(so_id), reason=data.reason, entered_by=user.email)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=409, detail=msg)

    return {"data": {"id": str(so.id), "status": so.status}}


@router.post("/standing-orders/{so_id}/resume")
async def resume_standing_order_endpoint(
    so_id: UUID, data: StatusChangeRequest,
    user: User = Depends(require_permission("standing_orders", "write")),
) -> dict:
    """Resume a paused standing order."""
    try:
        so = await resume_standing_order(str(so_id), entered_by=user.email)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=409, detail=msg)

    return {"data": {"id": str(so.id), "status": so.status}}


@router.post("/standing-orders/{so_id}/cancel")
async def cancel_standing_order_endpoint(
    so_id: UUID, data: StatusChangeWithReasonRequest,
    user: User = Depends(require_permission("standing_orders", "write")),
) -> dict:
    """Cancel a standing order."""
    try:
        so = await cancel_standing_order(str(so_id), reason=data.reason, entered_by=user.email)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=409, detail=msg)

    return {"data": {"id": str(so.id), "status": so.status}}


@router.post("/standing-orders/generate-preview")
async def generate_preview_endpoint(data: GeneratePreviewRequest, user: User = Depends(require_permission("standing_orders", "write"))) -> dict:
    """Preview order generation for a date range."""
    matches = await generate_preview(data.date_from, data.date_to)
    return {
        "data": GeneratePreviewResponse(
            date_from=str(data.date_from),
            date_to=str(data.date_to),
            matches=matches,
        )
    }


@router.post("/standing-orders/generate", status_code=201)
async def generate_orders_endpoint(data: GenerateRequest, user: User = Depends(require_permission("standing_orders", "write"))) -> dict:
    """Generate orders from standing orders for a date range."""
    result = await generate_orders(
        data.date_from, data.date_to, data.skip_already_generated,
        standing_order_ids=data.standing_order_ids,
    )
    return {
        "data": GenerateResponse(
            orders_created=result["orders_created"],
            orders_skipped=result["orders_skipped"],
            order_ids=result["order_ids"],
        )
    }


@router.get("/standing-orders/{so_id}/audit-log")
async def get_standing_order_audit_log(so_id: UUID) -> dict:
    """Return the audit log entries for a standing order."""
    so = await StandingOrder.get_or_none(id=so_id)
    if so is None:
        raise HTTPException(status_code=404, detail="Standing order not found")

    entries = (
        await StandingOrderAuditLog.filter(standing_order_id=so_id)
        .order_by("-created_at")
        .limit(50)
    )

    return {
        "data": [
            StandingOrderAuditLogResponse(
                id=str(e.id),
                action=e.action,
                reason=e.reason,
                changes=e.changes,
                entered_by=e.entered_by,
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ]
    }
