"""StandingOrder, StandingOrderLine, and StandingOrderAuditLog models."""

import uuid

from tortoise import fields
from tortoise.models import Model


class StandingOrder(Model):
    """A recurring order template for a customer."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="standing_orders", on_delete=fields.CASCADE
    )
    status = fields.CharField(max_length=10, default="active")  # active, paused, cancelled
    frequency_weeks = fields.IntField()  # 1, 2, or 4
    days_of_week = fields.JSONField(default=list)  # [0,1,2,...6] Mon=0, Sun=6
    reference_date = fields.DateField()
    ship_via = fields.CharField(max_length=100, null=True)
    salesperson_email = fields.CharField(max_length=255, null=True)
    box_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    holiday_charge_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    special_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    freight_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    freight_charge_included = fields.BooleanField(default=False)
    notes = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "standing_orders"

    def __str__(self) -> str:
        return f"StandingOrder({self.id}, {self.status})"


class StandingOrderLine(Model):
    """A single sales item within a standing order template."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    standing_order = fields.ForeignKeyField(
        "models.StandingOrder", related_name="lines", on_delete=fields.CASCADE
    )
    sales_item = fields.ForeignKeyField(
        "models.SalesItem", related_name="standing_order_lines", on_delete=fields.CASCADE
    )
    stems = fields.IntField()
    price_per_stem = fields.DecimalField(max_digits=10, decimal_places=2)
    item_fee_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    item_fee_dollar = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    color_variety = fields.CharField(max_length=100, null=True)
    notes = fields.TextField(null=True)
    line_number = fields.IntField()

    class Meta:
        table = "standing_order_lines"
        unique_together = (("standing_order", "line_number"),)

    def __str__(self) -> str:
        return f"StandingOrderLine({self.standing_order_id}, #{self.line_number})"


class StandingOrderAuditLog(Model):
    """Audit trail for standing order changes with required reasons."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    standing_order = fields.ForeignKeyField(
        "models.StandingOrder", related_name="audit_logs", on_delete=fields.CASCADE
    )
    action = fields.CharField(max_length=10)  # created, updated, paused, resumed, cancelled
    reason = fields.TextField(null=True)
    changes = fields.JSONField(default=list)
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "standing_order_audit_logs"

    def __str__(self) -> str:
        return f"StandingOrderAuditLog({self.standing_order_id}, {self.action})"
