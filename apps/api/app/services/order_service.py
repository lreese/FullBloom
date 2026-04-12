"""Order service — create orders with duplicate detection."""

from decimal import ROUND_HALF_UP, Decimal

from tortoise.transactions import in_transaction

_TWO_PLACES = Decimal("0.01")


def _to_decimal(value: float | str | None, places: Decimal = _TWO_PLACES) -> Decimal:
    """Convert a value to a quantized Decimal."""
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(places, rounding=ROUND_HALF_UP)

from app.models.customer import Customer
from app.models.order import Order, OrderAuditLog, OrderLine
from app.models.pricing import CustomerPrice
from app.models.product import SalesItem
from app.schemas.order import OrderCreateRequest, OrderUpdateRequest


class DuplicateOrderError(Exception):
    """Raised when a duplicate order is detected and force_duplicate is False."""

    def __init__(self, existing_order_number: str):
        self.existing_order_number = existing_order_number
        super().__init__(
            f"Duplicate order detected. Existing order: {existing_order_number}. "
            "Set force_duplicate=true to override."
        )


async def check_duplicate(
    customer_id: str, order_date: str, lines: list
) -> Order | None:
    """Check for an existing order with the same customer, date, and line items.

    Compares orders by matching the set of (sales_item_id, stems) tuples.
    """
    existing_orders = await Order.filter(
        customer_id=customer_id, order_date=order_date
    ).prefetch_related("lines")

    # Build a signature from the incoming lines for comparison
    incoming_sig = sorted(
        (str(line.sales_item_id), line.stems) for line in lines
    )

    for order in existing_orders:
        existing_sig = sorted(
            (str(line.sales_item_id), line.stems)
            for line in order.lines  # type: ignore[attr-defined]
        )
        if incoming_sig == existing_sig:
            return order

    return None


async def create_order(data: OrderCreateRequest) -> Order:
    """Create a new order with lines.

    Validates customer existence, checks for duplicates (unless force_duplicate),
    resolves pricing, and persists everything in a transaction.
    """
    # Validate customer exists and resolve price type from price list
    customer = await Customer.get_or_none(id=data.customer_id)
    if customer is None:
        raise ValueError(f"Customer {data.customer_id} not found")
    if customer.price_list_id:
        price_list = await customer.price_list
        price_list_name = price_list.name
    else:
        price_list_name = "Retail"

    # Check for duplicates
    if not data.force_duplicate:
        dup = await check_duplicate(data.customer_id, data.order_date, data.lines)
        if dup is not None:
            raise DuplicateOrderError(dup.order_number)

    # Pre-fetch all needed sales items and customer prices
    sales_item_ids = [str(line.sales_item_id) for line in data.lines]
    sales_items = await SalesItem.filter(id__in=sales_item_ids)
    si_map = {str(si.id): si for si in sales_items}

    custom_prices = await CustomerPrice.filter(
        customer_id=data.customer_id, sales_item_id__in=sales_item_ids
    )
    cp_map = {str(cp.sales_item_id): cp for cp in custom_prices}

    order_number = await Order.generate_order_number()

    async with in_transaction():
        order = await Order.create(
            order_number=order_number,
            customer_id=data.customer_id,
            order_date=data.order_date,
            ship_via=data.ship_via,
            price_list=price_list_name,
            freight_charge_included=data.freight_charge_included,
            box_charge=data.box_charge,
            holiday_charge_pct=data.holiday_charge_pct,
            special_charge=data.special_charge,
            freight_charge=data.freight_charge,
            order_notes=data.order_notes,
            po_number=data.po_number,
            salesperson_email=data.salesperson_email,
            order_label=data.order_label,
        )

        for idx, line in enumerate(data.lines, start=1):
            si = si_map.get(str(line.sales_item_id))
            if si is None:
                raise ValueError(f"SalesItem {line.sales_item_id} not found")

            # Determine list price: customer price if exists, else retail
            cp = cp_map.get(str(line.sales_item_id))
            list_price = cp.price if cp else si.retail_price

            # Calculate effective price with fees
            fee_pct = Decimal(str(line.item_fee_pct)) if line.item_fee_pct else Decimal("0")
            fee_dollar = Decimal(str(line.item_fee_dollar)) if line.item_fee_dollar else Decimal("0")
            price = Decimal(str(line.price_per_stem))
            effective_price = (price * (1 + fee_pct)) + fee_dollar

            await OrderLine.create(
                order=order,
                sales_item_id=line.sales_item_id,
                assorted=line.assorted,
                color_variety=line.color_variety,
                stems=line.stems,
                list_price_per_stem=list_price,
                price_per_stem=price,
                item_fee_pct=line.item_fee_pct,
                item_fee_dollar=line.item_fee_dollar,
                effective_price_per_stem=effective_price,
                notes=line.notes,
                box_quantity=line.box_quantity,
                bunches_per_box=line.bunches_per_box,
                stems_per_bunch=line.stems_per_bunch,
                box_reference=line.box_reference,
                is_special=line.is_special,
                sleeve=line.sleeve,
                upc=line.upc,
                line_number=idx,
            )

        await OrderAuditLog.create(
            order=order,
            action="created",
            changes=[],
            entered_by=data.salesperson_email,
        )

    # Re-fetch with prefetched relations for response
    order = await Order.get(id=order.id).prefetch_related("lines", "customer")
    return order


# Header fields that can be updated
_HEADER_FIELDS = [
    "order_date",
    "ship_via",
    "order_label",
    "freight_charge_included",
    "box_charge",
    "holiday_charge_pct",
    "special_charge",
    "freight_charge",
    "order_notes",
    "po_number",
    "salesperson_email",
]


async def update_order(
    order_id: str, data: OrderUpdateRequest, entered_by: str | None = None
) -> Order:
    """Update an existing order's header fields and/or line items."""
    order = await Order.get_or_none(id=order_id, is_deleted=False).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    if order is None:
        raise ValueError("Order not found")

    changes: list[dict] = []

    async with in_transaction():
        # --- Update header fields ---
        update_data = data.model_dump(exclude_unset=True)
        lines_data = update_data.pop("lines", None)

        for field in _HEADER_FIELDS:
            if field in update_data:
                old_val = getattr(order, field)
                new_val = update_data[field]
                # Normalize Decimal to str for comparison
                old_str = str(old_val) if old_val is not None else None
                new_str = str(new_val) if new_val is not None else None
                if old_str != new_str:
                    changes.append({
                        "field": field,
                        "old_value": old_str,
                        "new_value": new_str,
                    })
                    setattr(order, field, new_val)

        if update_data:
            await order.save()

        # --- Handle line items ---
        if lines_data is not None:
            existing_lines = {str(l.id): l for l in order.lines}  # type: ignore[attr-defined]
            incoming_ids = {str(l["id"]) for l in lines_data if l.get("id")}

            # Validate that all submitted line IDs belong to this order
            invalid_ids = incoming_ids - set(existing_lines.keys())
            if invalid_ids:
                raise ValueError(f"Line IDs do not belong to this order: {', '.join(invalid_ids)}")

            # Delete removed lines
            for line_id, line in existing_lines.items():
                if line_id not in incoming_ids:
                    changes.append({
                        "field": "line_removed",
                        "old_value": {
                            "id": line_id,
                            "sales_item_id": str(line.sales_item_id),
                            "stems": line.stems,
                        },
                        "new_value": None,
                    })
                    await line.delete()

            # Pre-fetch sales items and customer prices for new/modified lines
            si_ids = [str(l["sales_item_id"]) for l in lines_data]
            sales_items = await SalesItem.filter(id__in=si_ids)
            si_map = {str(si.id): si for si in sales_items}

            custom_prices = await CustomerPrice.filter(
                customer_id=order.customer_id, sales_item_id__in=si_ids
            )
            cp_map = {str(cp.sales_item_id): cp for cp in custom_prices}

            for idx, line_data in enumerate(lines_data, start=1):
                si = si_map.get(str(line_data["sales_item_id"]))
                if si is None:
                    raise ValueError(
                        f"SalesItem {line_data['sales_item_id']} not found"
                    )

                cp = cp_map.get(str(line_data["sales_item_id"]))
                list_price = cp.price if cp else si.retail_price

                fee_pct = Decimal(str(line_data.get("item_fee_pct") or 0))
                fee_dollar = _to_decimal(line_data.get("item_fee_dollar") or 0)
                price = _to_decimal(line_data["price_per_stem"])
                effective_price = ((price * (1 + fee_pct)) + fee_dollar).quantize(
                    _TWO_PLACES, rounding=ROUND_HALF_UP
                )

                line_id = str(line_data["id"]) if line_data.get("id") else None
                if line_id and line_id in existing_lines:
                    # Update existing line — track per-field diffs
                    existing = existing_lines[line_id]
                    line_diffs: dict[str, dict] = {}
                    new_values = {
                        "stems": line_data["stems"],
                        "price_per_stem": float(price),
                        "color_variety": line_data.get("color_variety"),
                        "assorted": line_data.get("assorted", False),
                        "notes": line_data.get("notes"),
                        "box_quantity": line_data.get("box_quantity"),
                        "bunches_per_box": line_data.get("bunches_per_box"),
                        "stems_per_bunch": line_data.get("stems_per_bunch"),
                        "box_reference": line_data.get("box_reference"),
                        "is_special": line_data.get("is_special", False),
                        "sleeve": line_data.get("sleeve"),
                        "upc": line_data.get("upc"),
                    }
                    for field, new_val in new_values.items():
                        old_val = getattr(existing, field)
                        # Normalize Decimals to float for comparison
                        if hasattr(old_val, "quantize"):
                            old_val = float(old_val)
                        if str(old_val) != str(new_val):
                            line_diffs[field] = {"old": str(old_val) if old_val is not None else None, "new": str(new_val) if new_val is not None else None}

                    existing.sales_item_id = line_data["sales_item_id"]
                    existing.assorted = line_data.get("assorted", False)
                    existing.color_variety = line_data.get("color_variety")
                    existing.stems = line_data["stems"]
                    existing.list_price_per_stem = list_price
                    existing.price_per_stem = price
                    existing.item_fee_pct = _to_decimal(line_data.get("item_fee_pct"), Decimal("0.0001")) if line_data.get("item_fee_pct") is not None else None
                    existing.item_fee_dollar = _to_decimal(line_data.get("item_fee_dollar")) if line_data.get("item_fee_dollar") is not None else None
                    existing.effective_price_per_stem = effective_price
                    existing.notes = line_data.get("notes")
                    existing.box_quantity = line_data.get("box_quantity")
                    existing.bunches_per_box = line_data.get("bunches_per_box")
                    existing.stems_per_bunch = line_data.get("stems_per_bunch")
                    existing.box_reference = line_data.get("box_reference")
                    existing.is_special = line_data.get("is_special", False)
                    existing.sleeve = line_data.get("sleeve")
                    existing.upc = line_data.get("upc")
                    existing.line_number = idx
                    await existing.save()
                    if line_diffs:
                        changes.append({
                            "field": "line_modified",
                            "line_id": line_id,
                            "old_value": {k: v["old"] for k, v in line_diffs.items()},
                            "new_value": {k: v["new"] for k, v in line_diffs.items()},
                        })
                else:
                    # Create new line
                    await OrderLine.create(
                        order=order,
                        sales_item_id=str(line_data["sales_item_id"]),
                        assorted=line_data.get("assorted", False),
                        color_variety=line_data.get("color_variety"),
                        stems=line_data["stems"],
                        list_price_per_stem=list_price,
                        price_per_stem=price,
                        item_fee_pct=_to_decimal(line_data.get("item_fee_pct"), Decimal("0.0001")) if line_data.get("item_fee_pct") is not None else None,
                        item_fee_dollar=_to_decimal(line_data.get("item_fee_dollar")) if line_data.get("item_fee_dollar") is not None else None,
                        effective_price_per_stem=effective_price,
                        notes=line_data.get("notes"),
                        box_quantity=line_data.get("box_quantity"),
                        bunches_per_box=line_data.get("bunches_per_box"),
                        stems_per_bunch=line_data.get("stems_per_bunch"),
                        box_reference=line_data.get("box_reference"),
                        is_special=line_data.get("is_special", False),
                        sleeve=line_data.get("sleeve"),
                        upc=line_data.get("upc"),
                        line_number=idx,
                    )
                    changes.append({
                        "field": "line_added",
                        "old_value": None,
                        "new_value": {
                            "sales_item_id": str(line_data["sales_item_id"]),
                            "stems": line_data["stems"],
                        },
                    })

        # Create audit log entry only if something actually changed
        if changes:
            await OrderAuditLog.create(
                order=order,
                action="updated",
                changes=changes,
                entered_by=entered_by,
            )

    # Re-fetch with prefetched relations
    order = await Order.get(id=order.id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    return order


async def delete_order(
    order_id: str, entered_by: str | None = None
) -> str:
    """Delete an order. Returns the order_number."""
    order = await Order.get_or_none(id=order_id, is_deleted=False).prefetch_related("lines")
    if order is None:
        raise ValueError("Order not found")

    order_number = order.order_number

    # Build snapshot for audit log
    snapshot = {
        "order_number": order.order_number,
        "customer_id": str(order.customer_id),
        "order_date": str(order.order_date),
        "lines": [
            {
                "sales_item_id": str(line.sales_item_id),
                "stems": line.stems,
                "price_per_stem": str(line.price_per_stem),
            }
            for line in order.lines  # type: ignore[attr-defined]
        ],
    }

    async with in_transaction():
        await OrderAuditLog.create(
            order=order,
            action="deleted",
            changes=[{"field": "snapshot", "old_value": snapshot, "new_value": None}],
            entered_by=entered_by,
        )
        order.is_deleted = True
        await order.save()

    return order_number
