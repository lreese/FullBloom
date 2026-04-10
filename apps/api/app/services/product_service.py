"""Product service — dropdown options and bulk update logic."""

from uuid import UUID

from app.models.product import ProductLine, Variety

BULK_UPDATABLE_FIELDS = {
    "show",
    "weekly_sales_category",
    "product_line_id",
    "color",
    "flowering_type",
}


async def get_variety_dropdown_options() -> dict:
    """Return distinct values for dropdown and bulk-update fields."""
    product_lines = await ProductLine.filter(is_active=True).prefetch_related(
        "product_type"
    ).order_by("name")

    pl_list = [
        {
            "id": str(pl.id),
            "name": pl.name,
            "product_type": pl.product_type.name,  # type: ignore[attr-defined]
        }
        for pl in product_lines
    ]

    varieties = await Variety.filter(is_active=True).values(
        "color", "flowering_type", "weekly_sales_category"
    )

    colors = sorted({v["color"] for v in varieties if v["color"]})
    flowering_types = sorted({v["flowering_type"] for v in varieties if v["flowering_type"]})
    weekly_sales_categories = sorted(
        {v["weekly_sales_category"] for v in varieties if v["weekly_sales_category"]}
    )

    return {
        "product_lines": pl_list,
        "colors": colors,
        "flowering_types": flowering_types,
        "weekly_sales_categories": weekly_sales_categories,
    }


async def bulk_update_varieties(
    ids: list[UUID], field: str, value: str | bool | None
) -> int:
    """Bulk update a single field across multiple varieties.

    Returns the number of updated rows.
    Raises ValueError if the field is not allowed for bulk update or
    the value is invalid for the given field.
    """
    if field not in BULK_UPDATABLE_FIELDS:
        raise ValueError(f"Field '{field}' is not bulk-updatable")

    # Validate field-specific values
    if field == "show" and not isinstance(value, bool):
        raise ValueError("'show' must be true or false")
    if field == "product_line_id":
        if value is None:
            raise ValueError("'product_line_id' cannot be null")
        pl = await ProductLine.filter(id=value, is_active=True).first()
        if pl is None:
            raise ValueError(f"Product line '{value}' not found or archived")

    updated_count = await Variety.filter(id__in=ids).update(**{field: value})
    return updated_count
