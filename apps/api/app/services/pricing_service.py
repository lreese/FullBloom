"""Pricing service — resolves customer-specific pricing for all sales items."""

from app.models.pricing import CustomerPrice
from app.models.product import SalesItem


async def get_customer_pricing(customer_id: str) -> list[dict]:
    """Return pricing for every sales item, with customer overrides applied.

    For each SalesItem, checks whether a CustomerPrice exists for the given
    customer. If so, uses that price and marks is_custom=True. Otherwise
    falls back to the SalesItem's retail_price.
    """
    sales_items = await SalesItem.all()

    # Fetch all custom prices for this customer in one query, keyed by sales_item_id
    custom_prices = await CustomerPrice.filter(customer_id=customer_id).all()
    price_map: dict[str, CustomerPrice] = {
        str(cp.sales_item_id): cp for cp in custom_prices
    }

    result: list[dict] = []
    for si in sales_items:
        si_id = str(si.id)
        custom = price_map.get(si_id)
        result.append(
            {
                "sales_item_id": si_id,
                "sales_item_name": si.name,
                "stems_per_order": si.stems_per_order,
                "customer_price": str(custom.price) if custom else str(si.retail_price),
                "retail_price": str(si.retail_price),
                "is_custom": custom is not None,
            }
        )

    return result
