"""Pricing service — effective price resolution, analytics, bulk operations."""

from decimal import Decimal
from uuid import UUID

from tortoise.exceptions import IntegrityError

from app.models.customer import Customer
from app.models.pricing import (
    CustomerPrice,
    PriceChangeLog,
    PriceList,
    PriceListItem,
)
from app.models.product import SalesItem

ANOMALY_THRESHOLD = Decimal("0.20")  # 20% variance from list price


async def log_price_change(
    change_type: str,
    action: str,
    sales_item_id: UUID | None = None,
    price_list_id: UUID | None = None,
    customer_id: UUID | None = None,
    old_price: Decimal | None = None,
    new_price: Decimal | None = None,
) -> None:
    """Write an entry to the PriceChangeLog audit trail."""
    await PriceChangeLog.create(
        change_type=change_type,
        action=action,
        sales_item_id=sales_item_id,
        price_list_id=price_list_id,
        customer_id=customer_id,
        old_price=old_price,
        new_price=new_price,
    )


def _is_anomaly(
    effective_price: Decimal, list_price: Decimal | None
) -> bool:
    """Return True if effective price differs >20% from list price."""
    if list_price is None or list_price == 0:
        return False
    variance = abs(effective_price - list_price) / list_price
    return variance > ANOMALY_THRESHOLD


async def get_effective_price(
    customer: Customer, sales_item: SalesItem
) -> dict:
    """Resolve the effective price for a customer+sales_item pair.

    Priority: customer override > price list > retail.
    Returns dict with price, source, and related prices.
    """
    override = await CustomerPrice.filter(
        customer_id=customer.id, sales_item_id=sales_item.id
    ).first()

    price_list_price = None
    if customer.price_list_id:
        pli = await PriceListItem.filter(
            price_list_id=customer.price_list_id, sales_item_id=sales_item.id
        ).first()
        if pli:
            price_list_price = pli.price

    if override:
        return {
            "price": override.price,
            "source": "override",
            "price_list_price": price_list_price,
            "customer_override": override.price,
        }
    elif price_list_price is not None:
        return {
            "price": price_list_price,
            "source": "price_list",
            "price_list_price": price_list_price,
            "customer_override": None,
        }
    else:
        return {
            "price": sales_item.retail_price,
            "source": "retail",
            "price_list_price": None,
            "customer_override": None,
        }


async def get_customer_pricing(customer_id: UUID) -> dict:
    """Return the full pricing grid for a customer with effective prices and summary."""
    customer = await Customer.get_or_none(id=customer_id).prefetch_related("price_list")
    if customer is None:
        return None

    # Get price list name
    price_list_name = None
    if customer.price_list_id:
        price_list = await PriceList.get_or_none(id=customer.price_list_id)
        if price_list:
            price_list_name = price_list.name

    # Active sales items with variety
    sales_items = await SalesItem.filter(is_active=True).prefetch_related("variety").order_by("name")

    # All customer overrides in one query
    overrides = await CustomerPrice.filter(customer_id=customer_id).all()
    override_map: dict[str, CustomerPrice] = {
        str(cp.sales_item_id): cp for cp in overrides
    }

    # All price list items for this customer's list in one query
    pli_map: dict[str, PriceListItem] = {}
    if customer.price_list_id:
        plis = await PriceListItem.filter(price_list_id=customer.price_list_id).all()
        pli_map = {str(pli.sales_item_id): pli for pli in plis}

    items = []
    override_count = 0

    for si in sales_items:
        si_id = str(si.id)
        override = override_map.get(si_id)
        pli = pli_map.get(si_id)

        price_list_price = pli.price if pli else None
        customer_override_price = override.price if override else None

        if override:
            effective = override.price
            source = "override"
            override_count += 1
        elif pli:
            effective = pli.price
            source = "price_list"
        else:
            effective = si.retail_price
            source = "retail"

        anomaly = _is_anomaly(effective, price_list_price)

        items.append({
            "sales_item_id": si_id,
            "sales_item_name": si.name,
            "variety_name": si.variety.name if si.variety else "",
            "stems_per_order": si.stems_per_order,
            "retail_price": str(si.retail_price),
            "price_list_price": str(price_list_price) if price_list_price is not None else None,
            "customer_override": str(customer_override_price) if customer_override_price is not None else None,
            "effective_price": str(effective),
            "source": source,
            "anomaly": anomaly,
        })

    total_items = len(items)
    override_pct = round((override_count / total_items * 100), 1) if total_items > 0 else 0.0

    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.name,
            "price_list_id": str(customer.price_list_id) if customer.price_list_id else None,
            "price_list_name": price_list_name,
        },
        "items": items,
        "summary": {
            "total_items": total_items,
            "override_count": override_count,
            "override_percentage": override_pct,
        },
    }


async def get_item_pricing(sales_item_id: UUID) -> dict | None:
    """Return all customers' pricing for a single sales item (item-centric view)."""
    sales_item = await SalesItem.get_or_none(id=sales_item_id)
    if sales_item is None:
        return None

    customers = await Customer.filter(is_active=True).prefetch_related("price_list").order_by("name")

    # All overrides for this sales item
    overrides = await CustomerPrice.filter(sales_item_id=sales_item_id).all()
    override_map: dict[str, CustomerPrice] = {
        str(cp.customer_id): cp for cp in overrides
    }

    # All price list items for this sales item
    plis = await PriceListItem.filter(sales_item_id=sales_item_id).all()
    pli_map: dict[str, PriceListItem] = {
        str(pli.price_list_id): pli for pli in plis
    }

    # Price list names
    price_lists = await PriceList.all()
    pl_name_map: dict[str, str] = {str(pl.id): pl.name for pl in price_lists}

    customer_rows = []
    for c in customers:
        c_id = str(c.id)
        override = override_map.get(c_id)
        pli = pli_map.get(str(c.price_list_id)) if c.price_list_id else None

        price_list_price = pli.price if pli else None
        customer_override_price = override.price if override else None
        pl_name = pl_name_map.get(str(c.price_list_id)) if c.price_list_id else None

        if override:
            effective = override.price
            source = "override"
        elif pli:
            effective = pli.price
            source = "price_list"
        else:
            effective = sales_item.retail_price
            source = "retail"

        anomaly = _is_anomaly(effective, price_list_price)

        customer_rows.append({
            "customer_id": c_id,
            "customer_name": c.name,
            "price_list_name": pl_name,
            "price_list_price": str(price_list_price) if price_list_price is not None else None,
            "customer_override": str(customer_override_price) if customer_override_price is not None else None,
            "effective_price": str(effective),
            "source": source,
            "anomaly": anomaly,
        })

    return {
        "sales_item": {
            "id": str(sales_item.id),
            "name": sales_item.name,
            "retail_price": str(sales_item.retail_price),
        },
        "customers": customer_rows,
    }


async def get_price_list_matrix() -> dict:
    """Return the full price matrix: all active sales items x all active price lists."""
    price_lists = await PriceList.filter(is_active=True).order_by("name")
    sales_items = await SalesItem.filter(is_active=True).prefetch_related("variety").order_by("name")

    # Count customers per price list
    customer_counts: dict[str, int] = {}
    for pl in price_lists:
        count = await Customer.filter(price_list_id=pl.id, is_active=True).count()
        customer_counts[str(pl.id)] = count

    # All price list items in one query
    plis = await PriceListItem.filter(
        price_list_id__in=[pl.id for pl in price_lists]
    ).all()

    # Build lookup: (price_list_id, sales_item_id) -> price
    pli_lookup: dict[tuple[str, str], str] = {}
    for pli in plis:
        pli_lookup[(str(pli.price_list_id), str(pli.sales_item_id))] = str(pli.price)

    pl_responses = []
    for pl in price_lists:
        pl_responses.append({
            "id": str(pl.id),
            "name": pl.name,
            "is_active": pl.is_active,
            "customer_count": customer_counts.get(str(pl.id), 0),
        })

    item_rows = []
    for si in sales_items:
        prices = {}
        for pl in price_lists:
            key = (str(pl.id), str(si.id))
            if key in pli_lookup:
                prices[str(pl.id)] = pli_lookup[key]

        item_rows.append({
            "sales_item_id": str(si.id),
            "sales_item_name": si.name,
            "variety_name": si.variety.name if si.variety else "",
            "stems_per_order": si.stems_per_order,
            "retail_price": str(si.retail_price),
            "prices": prices,
        })

    return {
        "price_lists": pl_responses,
        "items": item_rows,
    }


async def create_price_list(name: str, copy_from: UUID | None = None) -> PriceList:
    """Create a new price list and pre-populate PriceListItems.

    If copy_from is a UUID, copies prices from that price list.
    If copy_from is None, copies from retail (SalesItem.retail_price).
    """
    pl = await PriceList.create(name=name)

    sales_items = await SalesItem.filter(is_active=True).all()

    if copy_from:
        # Copy from existing price list
        source_items = await PriceListItem.filter(price_list_id=copy_from).all()
        source_map: dict[str, Decimal] = {
            str(si.sales_item_id): si.price for si in source_items
        }
        for si in sales_items:
            price = source_map.get(str(si.id), si.retail_price)
            await PriceListItem.create(
                price_list=pl, sales_item=si, price=price
            )
    else:
        # Copy from retail
        for si in sales_items:
            await PriceListItem.create(
                price_list=pl, sales_item=si, price=si.retail_price
            )

    return pl


async def archive_price_list(price_list_id: UUID) -> dict:
    """Archive a price list: convert customer assignments to overrides.

    For each customer on this list:
    1. Copy PriceListItem prices to CustomerPrice overrides (skip if override exists)
    2. Set customer.price_list_id = NULL
    """
    pl = await PriceList.get_or_none(id=price_list_id)
    if pl is None:
        return None

    customers = await Customer.filter(price_list_id=price_list_id).all()
    plis = await PriceListItem.filter(price_list_id=price_list_id).all()
    pli_map: dict[str, Decimal] = {str(pli.sales_item_id): pli.price for pli in plis}

    customers_converted = 0
    for customer in customers:
        existing_overrides = await CustomerPrice.filter(customer_id=customer.id).all()
        existing_override_items = {str(cp.sales_item_id) for cp in existing_overrides}

        for si_id, price in pli_map.items():
            if si_id not in existing_override_items:
                try:
                    await CustomerPrice.create(
                        customer_id=customer.id,
                        sales_item_id=si_id,
                        price=price,
                    )
                    await log_price_change(
                        change_type="customer_override",
                        action="created",
                        sales_item_id=UUID(si_id),
                        customer_id=customer.id,
                        old_price=None,
                        new_price=price,
                    )
                except IntegrityError:
                    pass  # Race condition safety

        customer.price_list_id = None
        await customer.save()
        customers_converted += 1

    pl.is_active = False
    await pl.save()

    return {
        "id": str(pl.id),
        "is_active": False,
        "customers_converted": customers_converted,
    }


async def get_impact_preview(
    price_list_id: UUID, sales_item_id: UUID, new_price: Decimal
) -> dict | None:
    """Preview the impact of changing a price list item price."""
    pli = await PriceListItem.filter(
        price_list_id=price_list_id, sales_item_id=sales_item_id
    ).first()
    if pli is None:
        return None

    current_price = pli.price

    # Customers on this list
    customers_on_list = await Customer.filter(
        price_list_id=price_list_id, is_active=True
    ).count()

    # Customers with overrides for this sales item
    customer_ids_on_list = await Customer.filter(
        price_list_id=price_list_id, is_active=True
    ).values_list("id", flat=True)

    customers_with_overrides = await CustomerPrice.filter(
        customer_id__in=customer_ids_on_list,
        sales_item_id=sales_item_id,
    ).count()

    customers_affected = customers_on_list - customers_with_overrides

    return {
        "customers_on_list": customers_on_list,
        "customers_with_overrides": customers_with_overrides,
        "customers_affected": customers_affected,
        "current_price": str(current_price),
        "new_price": str(new_price),
    }
