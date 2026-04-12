"""Standing order service — CRUD, status management, cadence matching, order generation."""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from tortoise.transactions import in_transaction

from app.models.customer import Customer
from app.models.order import Order, OrderLine
from app.models.pricing import CustomerPrice
from app.models.product import SalesItem
from app.models.standing_order import (
    StandingOrder,
    StandingOrderAuditLog,
    StandingOrderLine,
)
from app.schemas.standing_order import (
    GeneratePreviewMatch,
    StandingOrderCreateRequest,
    StandingOrderUpdateRequest,
)

_TWO_PLACES = Decimal("0.01")

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

FULL_DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def build_cadence_description(frequency_weeks: int, days_of_week: list[int]) -> str:
    """Return a human-readable cadence string, e.g. 'Every week on Mon, Tue, Thu'."""
    day_str = ", ".join(DAY_NAMES[d] for d in sorted(days_of_week))
    if frequency_weeks == 1:
        return f"Every week on {day_str}"
    return f"Every {frequency_weeks} weeks on {day_str}"


def matches_cadence(so: StandingOrder, target_date: date) -> bool:
    """Check whether target_date falls on this standing order's cadence."""
    if target_date.weekday() not in so.days_of_week:
        return False
    if so.frequency_weeks == 1:
        return True
    days_diff = abs((target_date - so.reference_date).days)
    weeks_diff = days_diff // 7
    return weeks_diff % so.frequency_weeks == 0


async def create_standing_order(data: StandingOrderCreateRequest) -> StandingOrder:
    """Create a new standing order with lines and audit log."""
    customer = await Customer.get_or_none(id=data.customer_id)
    if customer is None:
        raise ValueError(f"Customer {data.customer_id} not found")

    async with in_transaction():
        so = await StandingOrder.create(
            customer_id=data.customer_id,
            frequency_weeks=data.frequency_weeks,
            days_of_week=data.days_of_week,
            reference_date=data.reference_date,
            ship_via=data.ship_via,
            salesperson_email=data.salesperson_email,
            box_charge=data.box_charge,
            holiday_charge_pct=data.holiday_charge_pct,
            special_charge=data.special_charge,
            freight_charge=data.freight_charge,
            freight_charge_included=data.freight_charge_included,
            notes=data.notes,
        )

        for idx, line in enumerate(data.lines, start=1):
            await StandingOrderLine.create(
                standing_order=so,
                sales_item_id=line.sales_item_id,
                stems=line.stems,
                price_per_stem=line.price_per_stem,
                item_fee_pct=line.item_fee_pct,
                item_fee_dollar=line.item_fee_dollar,
                color_variety=line.color_variety,
                notes=line.notes,
                line_number=idx,
            )

        await StandingOrderAuditLog.create(
            standing_order=so,
            action="created",
            changes=[],
            entered_by=data.salesperson_email,
        )

    so = await StandingOrder.get(id=so.id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    return so


# Header fields that can be updated
_HEADER_FIELDS = [
    "frequency_weeks",
    "days_of_week",
    "reference_date",
    "ship_via",
    "salesperson_email",
    "box_charge",
    "holiday_charge_pct",
    "special_charge",
    "freight_charge",
    "freight_charge_included",
    "notes",
]


async def update_standing_order(
    so_id: str,
    data: StandingOrderUpdateRequest,
    entered_by: str | None = None,
) -> StandingOrder:
    """Update an active standing order's header and/or lines."""
    so = await StandingOrder.get_or_none(id=so_id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    if so is None:
        raise ValueError("Standing order not found")
    if so.status != "active":
        raise ValueError("Standing order must be active to update")

    changes: list[dict] = []
    update_data = data.model_dump(exclude_unset=True)
    lines_data = update_data.pop("lines", None)
    reason = update_data.pop("reason", None)
    apply_to_future = update_data.pop("apply_to_future_orders", False)

    async with in_transaction():
        # --- Header fields ---
        for field in _HEADER_FIELDS:
            if field in update_data:
                old_val = getattr(so, field)
                new_val = update_data[field]
                old_str = str(old_val) if old_val is not None else None
                new_str = str(new_val) if new_val is not None else None
                if old_str != new_str:
                    changes.append(
                        {"field": field, "old_value": old_str, "new_value": new_str}
                    )
                    setattr(so, field, new_val)

        header_changed = bool(changes)

        # --- Line items ---
        if lines_data is not None:
            # Validate all sales_item_ids exist
            si_ids = {str(l["sales_item_id"]) for l in lines_data}
            from app.models.product import SalesItem
            existing_si = set(
                str(sid) for sid in
                await SalesItem.filter(id__in=list(si_ids)).values_list("id", flat=True)
            )
            missing = si_ids - existing_si
            if missing:
                raise ValueError(f"SalesItem(s) not found: {', '.join(missing)}")

            existing_lines = {str(l.id): l for l in so.lines}  # type: ignore[attr-defined]
            incoming_ids = {str(l["id"]) for l in lines_data if l.get("id")}

            # Delete removed lines
            for line_id, line in existing_lines.items():
                if line_id not in incoming_ids:
                    changes.append(
                        {
                            "field": "line_removed",
                            "old_value": {
                                "id": line_id,
                                "sales_item_id": str(line.sales_item_id),
                                "stems": line.stems,
                            },
                            "new_value": None,
                        }
                    )
                    await line.delete()

            for idx, line_data in enumerate(lines_data, start=1):
                line_id = str(line_data["id"]) if line_data.get("id") else None
                if line_id and line_id in existing_lines:
                    existing = existing_lines[line_id]
                    line_diffs: dict[str, dict] = {}
                    new_values = {
                        "stems": line_data["stems"],
                        "price_per_stem": float(line_data["price_per_stem"]),
                        "color_variety": line_data.get("color_variety"),
                    }
                    for fld, new_val in new_values.items():
                        old_val = getattr(existing, fld)
                        if hasattr(old_val, "quantize"):
                            old_val = float(old_val)
                        if str(old_val) != str(new_val):
                            line_diffs[fld] = {
                                "old": str(old_val) if old_val is not None else None,
                                "new": str(new_val) if new_val is not None else None,
                            }

                    existing.sales_item_id = line_data["sales_item_id"]
                    existing.stems = line_data["stems"]
                    existing.price_per_stem = Decimal(str(line_data["price_per_stem"]))
                    existing.item_fee_pct = (
                        Decimal(str(line_data["item_fee_pct"]))
                        if line_data.get("item_fee_pct") is not None
                        else None
                    )
                    existing.item_fee_dollar = (
                        Decimal(str(line_data["item_fee_dollar"]))
                        if line_data.get("item_fee_dollar") is not None
                        else None
                    )
                    existing.color_variety = line_data.get("color_variety")
                    existing.notes = line_data.get("notes")
                    existing.line_number = idx
                    await existing.save()

                    if line_diffs:
                        changes.append(
                            {
                                "field": "line_modified",
                                "line_id": line_id,
                                "old_value": {
                                    k: v["old"] for k, v in line_diffs.items()
                                },
                                "new_value": {
                                    k: v["new"] for k, v in line_diffs.items()
                                },
                            }
                        )
                else:
                    # New line
                    await StandingOrderLine.create(
                        standing_order=so,
                        sales_item_id=line_data["sales_item_id"],
                        stems=line_data["stems"],
                        price_per_stem=Decimal(str(line_data["price_per_stem"])),
                        item_fee_pct=(
                            Decimal(str(line_data["item_fee_pct"]))
                            if line_data.get("item_fee_pct") is not None
                            else None
                        ),
                        item_fee_dollar=(
                            Decimal(str(line_data["item_fee_dollar"]))
                            if line_data.get("item_fee_dollar") is not None
                            else None
                        ),
                        color_variety=line_data.get("color_variety"),
                        notes=line_data.get("notes"),
                        line_number=idx,
                    )
                    changes.append(
                        {
                            "field": "line_added",
                            "old_value": None,
                            "new_value": {
                                "sales_item_id": str(line_data["sales_item_id"]),
                                "stems": line_data["stems"],
                            },
                        }
                    )

        # Save header if anything changed (header or lines)
        if changes:
            await so.save()  # bumps updated_at

            # Audit log
            await StandingOrderAuditLog.create(
                standing_order=so,
                action="updated",
                reason=reason,
                changes=changes,
                entered_by=entered_by,
            )

        # Apply to future orders if requested
        if apply_to_future:
            today = date.today()
            future_orders = await Order.filter(
                standing_order_id=so_id,
                order_date__gt=today,
                is_deleted=False,
            ).prefetch_related("lines")

            # Re-fetch current standing order lines
            so_lines = await StandingOrderLine.filter(
                standing_order_id=so_id
            ).prefetch_related("sales_item")

            for order in future_orders:
                # Delete existing order lines
                await OrderLine.filter(order_id=order.id).delete()

                # Re-fetch customer for price resolution
                customer = await Customer.get(id=order.customer_id)
                if customer.price_list_id:
                    price_list = await customer.price_list
                    price_list_name = price_list.name
                else:
                    price_list_name = "Retail"

                for idx, sol in enumerate(so_lines, start=1):
                    si = await SalesItem.get(id=sol.sales_item_id)
                    cp = await CustomerPrice.get_or_none(
                        customer_id=order.customer_id,
                        sales_item_id=sol.sales_item_id,
                    )
                    list_price = cp.price if cp else si.retail_price
                    price = sol.price_per_stem
                    fee_pct = (
                        Decimal(str(sol.item_fee_pct))
                        if sol.item_fee_pct is not None
                        else Decimal("0")
                    )
                    fee_dollar = (
                        Decimal(str(sol.item_fee_dollar))
                        if sol.item_fee_dollar is not None
                        else Decimal("0")
                    )
                    effective_price = (
                        (price * (1 + fee_pct)) + fee_dollar
                    ).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

                    await OrderLine.create(
                        order=order,
                        sales_item_id=sol.sales_item_id,
                        stems=sol.stems,
                        list_price_per_stem=list_price,
                        price_per_stem=price,
                        item_fee_pct=sol.item_fee_pct,
                        item_fee_dollar=sol.item_fee_dollar,
                        effective_price_per_stem=effective_price,
                        color_variety=sol.color_variety,
                        notes=sol.notes,
                        line_number=idx,
                    )

    so = await StandingOrder.get(id=so.id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    return so


async def pause_standing_order(
    so_id: str, reason: str | None = None, entered_by: str | None = None
) -> StandingOrder:
    """Pause an active standing order."""
    so = await StandingOrder.get_or_none(id=so_id)
    if so is None:
        raise ValueError("Standing order not found")
    if so.status != "active":
        raise ValueError("Only active standing orders can be paused")

    async with in_transaction():
        so.status = "paused"
        await so.save()
        await StandingOrderAuditLog.create(
            standing_order=so,
            action="paused",
            reason=reason,
            changes=[{"field": "status", "old_value": "active", "new_value": "paused"}],
            entered_by=entered_by or so.salesperson_email,
        )

    return so


async def resume_standing_order(
    so_id: str, entered_by: str | None = None
) -> StandingOrder:
    """Resume a paused standing order."""
    so = await StandingOrder.get_or_none(id=so_id)
    if so is None:
        raise ValueError("Standing order not found")
    if so.status != "paused":
        raise ValueError("Only paused standing orders can be resumed")

    async with in_transaction():
        so.status = "active"
        await so.save()
        await StandingOrderAuditLog.create(
            standing_order=so,
            action="resumed",
            changes=[{"field": "status", "old_value": "paused", "new_value": "active"}],
            entered_by=entered_by or so.salesperson_email,
        )

    return so


async def cancel_standing_order(
    so_id: str, reason: str | None = None, entered_by: str | None = None
) -> StandingOrder:
    """Cancel a standing order (terminal state)."""
    so = await StandingOrder.get_or_none(id=so_id)
    if so is None:
        raise ValueError("Standing order not found")
    if so.status == "cancelled":
        raise ValueError("Standing order is already cancelled")

    old_status = so.status
    async with in_transaction():
        so.status = "cancelled"
        await so.save()
        await StandingOrderAuditLog.create(
            standing_order=so,
            action="cancelled",
            reason=reason,
            changes=[
                {"field": "status", "old_value": old_status, "new_value": "cancelled"}
            ],
            entered_by=entered_by or so.salesperson_email,
        )

    return so


async def generate_preview(
    date_from: date, date_to: date
) -> list[GeneratePreviewMatch]:
    """Preview which standing orders would generate orders for a date range."""
    standing_orders = await StandingOrder.filter(status="active").prefetch_related(
        "lines", "customer"
    )

    matches: list[GeneratePreviewMatch] = []
    current = date_from
    while current <= date_to:
        for so in standing_orders:
            if matches_cadence(so, current):
                # Check if an order already exists for this standing order + date
                existing = await Order.filter(
                    standing_order_id=so.id,
                    order_date=current,
                    is_deleted=False,
                ).first()

                lines = list(so.lines)  # type: ignore[attr-defined]
                matches.append(
                    GeneratePreviewMatch(
                        standing_order_id=str(so.id),
                        customer_name=so.customer.name,  # type: ignore[attr-defined]
                        cadence_description=build_cadence_description(
                            so.frequency_weeks, so.days_of_week
                        ),
                        generate_date=str(current),
                        lines_count=len(lines),
                        total_stems=sum(l.stems for l in lines),
                        already_generated=existing is not None,
                    )
                )
        current += timedelta(days=1)

    return matches


async def generate_orders(
    date_from: date,
    date_to: date,
    skip_already_generated: bool = True,
    standing_order_ids: list | None = None,
) -> dict:
    """Generate orders from active standing orders for the given date range."""
    qs = StandingOrder.filter(status="active")
    if standing_order_ids:
        qs = qs.filter(id__in=[str(sid) for sid in standing_order_ids])
    standing_orders = await qs.prefetch_related(
        "lines", "lines__sales_item", "customer"
    )

    order_ids: list[str] = []
    orders_skipped = 0

    current = date_from
    while current <= date_to:
        for so in standing_orders:
            if not matches_cadence(so, current):
                continue

            # Check for existing order
            existing = await Order.filter(
                standing_order_id=so.id,
                order_date=current,
                is_deleted=False,
            ).first()

            if existing:
                if skip_already_generated:
                    orders_skipped += 1
                    continue

            # Resolve price list
            customer = so.customer  # type: ignore[attr-defined]
            if customer.price_list_id:
                price_list = await customer.price_list
                price_list_name = price_list.name
            else:
                price_list_name = "Retail"

            order_number = await Order.generate_order_number()

            async with in_transaction():
                order = await Order.create(
                    order_number=order_number,
                    customer_id=so.customer_id,
                    order_date=current,
                    ship_via=so.ship_via,
                    price_list=price_list_name,
                    freight_charge_included=so.freight_charge_included,
                    box_charge=so.box_charge,
                    holiday_charge_pct=so.holiday_charge_pct,
                    special_charge=so.special_charge,
                    freight_charge=so.freight_charge,
                    order_notes=so.notes,
                    salesperson_email=so.salesperson_email,
                    standing_order_id=so.id,
                )

                lines = list(so.lines)  # type: ignore[attr-defined]
                si_ids = [str(l.sales_item_id) for l in lines]
                custom_prices = await CustomerPrice.filter(
                    customer_id=so.customer_id, sales_item_id__in=si_ids
                )
                cp_map = {str(cp.sales_item_id): cp for cp in custom_prices}

                for idx, sol in enumerate(lines, start=1):
                    si = sol.sales_item  # prefetched
                    cp = cp_map.get(str(sol.sales_item_id))
                    list_price = cp.price if cp else si.retail_price
                    price = sol.price_per_stem
                    fee_pct = (
                        Decimal(str(sol.item_fee_pct))
                        if sol.item_fee_pct is not None
                        else Decimal("0")
                    )
                    fee_dollar = (
                        Decimal(str(sol.item_fee_dollar))
                        if sol.item_fee_dollar is not None
                        else Decimal("0")
                    )
                    effective_price = (
                        (price * (1 + fee_pct)) + fee_dollar
                    ).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

                    await OrderLine.create(
                        order=order,
                        sales_item_id=sol.sales_item_id,
                        stems=sol.stems,
                        list_price_per_stem=list_price,
                        price_per_stem=price,
                        item_fee_pct=sol.item_fee_pct,
                        item_fee_dollar=sol.item_fee_dollar,
                        effective_price_per_stem=effective_price,
                        color_variety=sol.color_variety,
                        notes=sol.notes,
                        line_number=idx,
                    )

            order_ids.append(str(order.id))

        current += timedelta(days=1)

    return {
        "orders_created": len(order_ids),
        "orders_skipped": orders_skipped,
        "order_ids": order_ids,
    }
