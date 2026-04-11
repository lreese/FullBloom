"""Pricing models: PriceList, PriceListItem, CustomerPrice, PriceChangeLog."""

import uuid

from tortoise import fields
from tortoise.models import Model


class PriceList(Model):
    """Named pricing tier that customers can be assigned to."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    name = fields.CharField(max_length=100, unique=True)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "price_lists"

    def __str__(self) -> str:
        return self.name


class PriceListItem(Model):
    """Per-sales-item price within a price list (matrix cell data)."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    price_list = fields.ForeignKeyField(
        "models.PriceList", related_name="items", on_delete=fields.CASCADE
    )
    sales_item = fields.ForeignKeyField(
        "models.SalesItem", related_name="price_list_items", on_delete=fields.CASCADE
    )
    price = fields.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        table = "price_list_items"
        unique_together = (("price_list", "sales_item"),)

    def __str__(self) -> str:
        return f"{self.price_list_id} / {self.sales_item_id}: {self.price}"


class CustomerPrice(Model):
    """A per-customer price override for a sales item."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="prices", on_delete=fields.CASCADE
    )
    sales_item = fields.ForeignKeyField(
        "models.SalesItem", related_name="customer_prices", on_delete=fields.CASCADE
    )
    price = fields.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        table = "customer_prices"
        unique_together = (("customer", "sales_item"),)

    def __str__(self) -> str:
        return f"{self.customer_id} -> {self.sales_item_id}: {self.price}"


class PriceChangeLog(Model):
    """Append-only audit trail for all price changes."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    changed_at = fields.DatetimeField(auto_now_add=True)
    change_type = fields.CharField(max_length=50)  # retail_price, price_list_item, customer_override
    action = fields.CharField(max_length=20)  # created, updated, deleted
    sales_item_id = fields.UUIDField(null=True)
    price_list_id = fields.UUIDField(null=True)
    customer_id = fields.UUIDField(null=True)
    old_price = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    new_price = fields.DecimalField(max_digits=10, decimal_places=2, null=True)

    class Meta:
        table = "price_change_logs"

    def __str__(self) -> str:
        return f"{self.change_type} {self.action} at {self.changed_at}"
