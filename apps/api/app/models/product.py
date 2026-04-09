"""Product hierarchy models: ProductType -> ProductLine -> Variety -> SalesItem."""

import uuid

from tortoise import fields
from tortoise.models import Model


class ProductType(Model):
    """Top-level product category (e.g. Cut Flower, Potted Plant)."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    name = fields.CharField(max_length=100, unique=True)

    class Meta:
        table = "product_types"

    def __str__(self) -> str:
        return self.name


class ProductLine(Model):
    """A product line within a product type (e.g. Rose, Tulip)."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    product_type = fields.ForeignKeyField(
        "models.ProductType", related_name="product_lines", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=100)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "product_lines"
        unique_together = (("product_type", "name"),)

    def __str__(self) -> str:
        return self.name


class Variety(Model):
    """A specific variety within a product line."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    product_line = fields.ForeignKeyField(
        "models.ProductLine", related_name="varieties", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=100)
    color = fields.CharField(max_length=100, null=True)
    hex_color = fields.CharField(max_length=7, null=True)
    flowering_type = fields.CharField(max_length=50, null=True)
    can_replace = fields.BooleanField(default=False)
    show = fields.BooleanField(default=True)
    is_active = fields.BooleanField(default=True)
    weekly_sales_category = fields.CharField(max_length=100, null=True)
    item_group_id = fields.IntField(null=True)
    item_group_description = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "varieties"
        unique_together = (("product_line", "name"),)

    def __str__(self) -> str:
        return self.name


class SalesItem(Model):
    """A purchasable SKU tied to a variety (defines stem count and retail price)."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    variety = fields.ForeignKeyField(
        "models.Variety", related_name="sales_items", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=100, unique=True)
    stems_per_order = fields.IntField()
    retail_price = fields.DecimalField(max_digits=10, decimal_places=2)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "sales_items"

    def __str__(self) -> str:
        return self.name


class VarietyColor(Model):
    """Helper table for tracking known color names for a variety."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    variety = fields.ForeignKeyField(
        "models.Variety", related_name="variety_colors", on_delete=fields.CASCADE
    )
    color_name = fields.CharField(max_length=100)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "variety_colors"
        unique_together = (("variety", "color_name"),)

    def __str__(self) -> str:
        return self.color_name
