"""Customer and Store models."""

import uuid

from tortoise import fields
from tortoise.models import Model


class Customer(Model):
    """A customer (buyer) in the system."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer_number = fields.IntField(unique=True)
    name = fields.CharField(max_length=255)
    price_list = fields.ForeignKeyField(
        "models.PriceList", related_name="customers", on_delete=fields.SET_NULL, null=True
    )
    is_active = fields.BooleanField(default=True)
    salesperson = fields.CharField(max_length=10, null=True)
    contact_name = fields.CharField(max_length=255, null=True)
    default_ship_via = fields.CharField(max_length=100, null=True)
    phone = fields.CharField(max_length=50, null=True)
    location = fields.CharField(max_length=255, null=True)
    payment_terms = fields.CharField(max_length=50, null=True)
    email = fields.CharField(max_length=255, null=True)
    notes = fields.TextField(null=True)
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
