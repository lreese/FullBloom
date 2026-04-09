"""Order service — create orders with duplicate detection."""

from decimal import Decimal

from tortoise.transactions import in_transaction

from app.models.customer import Customer
from app.models.order import Order, OrderLine
from app.models.pricing import CustomerPrice
from app.models.product import SalesItem
from app.schemas.order import OrderCreateRequest


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
        (line.sales_item_id, line.stems) for line in lines
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
    # Validate customer exists
    customer = await Customer.get_or_none(id=data.customer_id)
    if customer is None:
        raise ValueError(f"Customer {data.customer_id} not found")

    # Check for duplicates
    if not data.force_duplicate:
        dup = await check_duplicate(data.customer_id, data.order_date, data.lines)
        if dup is not None:
            raise DuplicateOrderError(dup.order_number)

    # Pre-fetch all needed sales items and customer prices
    sales_item_ids = [line.sales_item_id for line in data.lines]
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
            price_type=customer.price_type,
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
            si = si_map.get(line.sales_item_id)
            if si is None:
                raise ValueError(f"SalesItem {line.sales_item_id} not found")

            # Determine list price: customer price if exists, else retail
            cp = cp_map.get(line.sales_item_id)
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

    # Re-fetch with prefetched relations for response
    order = await Order.get(id=order.id).prefetch_related("lines", "customer")
    return order
