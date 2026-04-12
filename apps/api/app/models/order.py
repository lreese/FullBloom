"""Order and OrderLine models."""

import uuid
from datetime import date

from tortoise import fields
from tortoise.models import Model


class Order(Model):
    """A customer order."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    order_number = fields.CharField(max_length=20, unique=True)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="orders", on_delete=fields.CASCADE
    )
    order_date = fields.DateField()
    ship_via = fields.CharField(max_length=100, null=True)
    price_list = fields.CharField(max_length=50)  # Frozen snapshot of customer's price list name at order time
    freight_charge_included = fields.BooleanField(default=False)
    box_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    holiday_charge_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    special_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    freight_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    order_notes = fields.TextField(null=True)
    po_number = fields.CharField(max_length=100, null=True)
    salesperson_email = fields.CharField(max_length=255, null=True)
    order_label = fields.CharField(max_length=255, null=True)
    is_deleted = fields.BooleanField(default=False)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "orders"

    def __str__(self) -> str:
        return self.order_number

    @classmethod
    async def generate_order_number(cls) -> str:
        """Generate the next order number in format ORD-YYYYMMDD-NNN.

        Finds the highest sequence number for today and increments it.
        """
        today = date.today()
        prefix = f"ORD-{today.strftime('%Y%m%d')}-"
        last_order = (
            await cls.filter(order_number__startswith=prefix)
            .order_by("-order_number")
            .first()
        )
        if last_order:
            last_seq = int(last_order.order_number.split("-")[-1])
            next_seq = last_seq + 1
        else:
            next_seq = 1
        return f"{prefix}{next_seq:03d}"


class OrderLine(Model):
    """A single line item on an order."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    order = fields.ForeignKeyField(
        "models.Order", related_name="lines", on_delete=fields.CASCADE
    )
    sales_item = fields.ForeignKeyField(
        "models.SalesItem", related_name="order_lines", on_delete=fields.CASCADE
    )
    assorted = fields.BooleanField(default=False)
    color_variety = fields.CharField(max_length=100, null=True)
    stems = fields.IntField()
    list_price_per_stem = fields.DecimalField(max_digits=10, decimal_places=2)
    price_per_stem = fields.DecimalField(max_digits=10, decimal_places=2)
    item_fee_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    item_fee_dollar = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    effective_price_per_stem = fields.DecimalField(max_digits=10, decimal_places=2)
    notes = fields.TextField(null=True)
    box_quantity = fields.IntField(null=True)
    bunches_per_box = fields.IntField(null=True)
    stems_per_bunch = fields.IntField(null=True)
    box_reference = fields.CharField(max_length=50, null=True)
    is_special = fields.BooleanField(default=False)
    sleeve = fields.CharField(max_length=255, null=True)
    upc = fields.CharField(max_length=50, null=True)
    line_number = fields.IntField()

    class Meta:
        table = "order_lines"
        unique_together = (("order", "line_number"),)

    def __str__(self) -> str:
        return f"Line {self.line_number} on {self.order_id}"


class OrderAuditLog(Model):
    """Audit trail for order changes. One entry per save operation."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    order = fields.ForeignKeyField(
        "models.Order", related_name="audit_logs", on_delete=fields.CASCADE
    )
    action = fields.CharField(max_length=10)  # "created", "updated", "deleted"
    changes = fields.JSONField(default=list)  # [{field, old_value, new_value}]
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "order_audit_logs"

    def __str__(self) -> str:
        return f"OrderAuditLog({self.order_id}, {self.action})"
