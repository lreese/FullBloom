"""Customer service — next-number generation and dropdown options."""

import math

from tortoise.functions import Max

from app.models.customer import Customer


async def get_next_customer_number() -> int:
    """Return the next suggested customer number.

    Uses max(customer_number) + 10, rounded up to the next ten.
    """
    result = await Customer.annotate(max_num=Max("customer_number")).first().values("max_num")
    max_num = result["max_num"] if result and result["max_num"] else 0
    return int(math.ceil((max_num + 10) / 10) * 10)


async def get_dropdown_options() -> dict[str, list[str]]:
    """Return distinct values for dropdown fields from existing data."""
    customers = await Customer.all().values(
        "salesperson", "default_ship_via", "payment_terms", "price_type"
    )

    salesperson = sorted({c["salesperson"] for c in customers if c["salesperson"]})
    default_ship_via = sorted({c["default_ship_via"] for c in customers if c["default_ship_via"]})
    payment_terms = sorted({c["payment_terms"] for c in customers if c["payment_terms"]})
    price_type = sorted({c["price_type"] for c in customers if c["price_type"]})

    return {
        "salesperson": salesperson,
        "default_ship_via": default_ship_via,
        "payment_terms": payment_terms,
        "price_type": price_type,
    }
