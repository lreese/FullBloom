"""Customer and Store models."""

import uuid

from tortoise import fields
from tortoise.models import Model


class Customer(Model):
    """A customer (buyer) in the system."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer_id = fields.IntField(unique=True)
    name = fields.CharField(max_length=255)
    price_type = fields.CharField(max_length=50, default="Retail")
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "customers"

    def __str__(self) -> str:
        return self.name


class Store(Model):
    """A store / ship-to location belonging to a customer."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="stores", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=255)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "stores"
        unique_together = (("customer", "name"),)

    def __str__(self) -> str:
        return self.name
