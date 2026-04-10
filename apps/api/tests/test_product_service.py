"""Unit tests for app.services.product_service."""

import uuid

import pytest

from app.models.product import ProductLine, ProductType, Variety
from app.services.product_service import bulk_update_varieties, get_variety_dropdown_options


async def _make_variety(product_line, name, color=None, flowering_type=None, weekly_sales_category=None):
    """Helper to create a Variety with optional nullable fields."""
    return await Variety.create(
        product_line=product_line,
        name=name,
        color=color,
        flowering_type=flowering_type,
        weekly_sales_category=weekly_sales_category,
    )


async def test_get_variety_dropdown_options_returns_distinct_sorted_values(product_line):
    """Dropdown options should return sorted, deduplicated values."""
    await _make_variety(product_line, "V1", color="Red", flowering_type="Spray", weekly_sales_category="A")
    await _make_variety(product_line, "V2", color="Red", flowering_type="Hybrid Tea", weekly_sales_category="B")
    await _make_variety(product_line, "V3", color="Blue", flowering_type="Spray", weekly_sales_category="A")

    result = await get_variety_dropdown_options()

    assert result["colors"] == ["Blue", "Red"]
    assert result["flowering_types"] == ["Hybrid Tea", "Spray"]
    assert result["weekly_sales_categories"] == ["A", "B"]
    # product_lines should include the fixture's product line
    assert len(result["product_lines"]) == 1
    assert result["product_lines"][0]["name"] == "Rose"


async def test_get_variety_dropdown_options_excludes_null_values(product_line):
    """Null values for color/flowering_type/weekly_sales_category should be excluded."""
    await _make_variety(product_line, "V1", color="Red", flowering_type=None, weekly_sales_category=None)
    await _make_variety(product_line, "V2", color=None, flowering_type="Spray", weekly_sales_category=None)

    result = await get_variety_dropdown_options()

    assert result["colors"] == ["Red"]
    assert result["flowering_types"] == ["Spray"]
    assert result["weekly_sales_categories"] == []


async def test_bulk_update_varieties_allowed_field(variety):
    """Bulk update should modify the specified field for given variety IDs."""
    updated = await bulk_update_varieties([variety.id], "show", False)
    assert updated == 1

    await variety.refresh_from_db()
    assert variety.show is False


async def test_bulk_update_varieties_disallowed_field_raises(variety):
    """Bulk update should raise ValueError for fields not in BULK_UPDATABLE_FIELDS."""
    with pytest.raises(ValueError, match="not bulk-updatable"):
        await bulk_update_varieties([variety.id], "name", "Hacked")


async def test_bulk_update_varieties_empty_ids():
    """Bulk update with empty ID list should update zero rows without error."""
    updated = await bulk_update_varieties([], "show", True)
    assert updated == 0
