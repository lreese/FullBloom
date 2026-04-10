"""Unit tests for app.services.product_service."""

import uuid

import pytest

from app.models.product import Color, ProductLine, ProductType, Variety
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


async def test_get_variety_dropdown_options_returns_colors_from_color_table(product_line):
    """Dropdown options should return colors from the Color model."""
    red = await Color.create(name="Red")
    blue = await Color.create(name="Blue")
    await _make_variety(product_line, "V1", color=red, flowering_type="Spray", weekly_sales_category="A")
    await _make_variety(product_line, "V2", color=red, flowering_type="Hybrid Tea", weekly_sales_category="B")
    await _make_variety(product_line, "V3", color=blue, flowering_type="Spray", weekly_sales_category="A")

    result = await get_variety_dropdown_options()

    # Colors come from the Color table, sorted by name
    assert len(result["colors"]) == 2
    assert result["colors"][0]["name"] == "Blue"
    assert result["colors"][1]["name"] == "Red"
    assert "id" in result["colors"][0]

    assert result["flowering_types"] == ["Hybrid Tea", "Spray"]
    assert result["weekly_sales_categories"] == ["A", "B"]
    # product_lines should include the fixture's product line
    assert len(result["product_lines"]) == 1
    assert result["product_lines"][0]["name"] == "Rose"


async def test_get_variety_dropdown_options_excludes_inactive_colors(product_line):
    """Archived colors should be excluded from dropdown options."""
    await Color.create(name="Red")
    await Color.create(name="Blue", is_active=False)

    result = await get_variety_dropdown_options()

    assert len(result["colors"]) == 1
    assert result["colors"][0]["name"] == "Red"


async def test_get_variety_dropdown_options_excludes_null_values(product_line):
    """Null values for flowering_type/weekly_sales_category should be excluded."""
    red = await Color.create(name="Red")
    await _make_variety(product_line, "V1", color=red, flowering_type=None, weekly_sales_category=None)
    await _make_variety(product_line, "V2", color=None, flowering_type="Spray", weekly_sales_category=None)

    result = await get_variety_dropdown_options()

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


async def test_bulk_update_color_id_validates(variety):
    """Bulk update with color_id should validate that the color exists."""
    with pytest.raises(ValueError, match="not found or archived"):
        await bulk_update_varieties([variety.id], "color_id", str(uuid.uuid4()))
