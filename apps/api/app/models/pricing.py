"""Customer-specific pricing overrides."""

import uuid

from tortoise import fields
from tortoise.models import Model


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
