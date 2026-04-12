"""Inventory models: counts, estimates, templates, and audit logs."""

import uuid

from tortoise import fields
from tortoise.models import Model


class DailyCount(Model):
    """A single variety's count value on a given date."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    variety = fields.ForeignKeyField(
        "models.Variety", related_name="daily_counts", on_delete=fields.CASCADE
    )
    product_type = fields.ForeignKeyField(
        "models.ProductType", related_name="daily_counts", on_delete=fields.CASCADE
    )
    count_date = fields.DateField()
    count_value = fields.IntField(null=True)
    is_done = fields.BooleanField(default=False)
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "daily_counts"
        unique_together = (("variety", "count_date"),)

    def __str__(self) -> str:
        return f"DailyCount({self.variety_id}, {self.count_date})"


class CustomerCount(Model):
    """A customer-specific bunch count for a variety on a given date."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    variety = fields.ForeignKeyField(
        "models.Variety", related_name="customer_counts", on_delete=fields.CASCADE
    )
    product_type = fields.ForeignKeyField(
        "models.ProductType", related_name="customer_counts", on_delete=fields.CASCADE
    )
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="customer_counts", on_delete=fields.CASCADE
    )
    count_date = fields.DateField()
    bunch_size = fields.IntField()
    sleeve_type = fields.CharField(max_length=20)
    bunch_count = fields.IntField(null=True)
    is_done = fields.BooleanField(default=False)
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "customer_counts"
        unique_together = (("variety", "customer", "count_date", "bunch_size", "sleeve_type"),)

    def __str__(self) -> str:
        return f"CustomerCount({self.variety_id}, {self.customer_id}, {self.count_date})"


class Estimate(Model):
    """A weekly harvest estimate for a variety on a specific pull day."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    variety = fields.ForeignKeyField(
        "models.Variety", related_name="estimates", on_delete=fields.CASCADE
    )
    product_type = fields.ForeignKeyField(
        "models.ProductType", related_name="estimates", on_delete=fields.CASCADE
    )
    week_start = fields.DateField()
    pull_day = fields.DateField()
    estimate_value = fields.IntField(null=True)
    is_done = fields.BooleanField(default=False)
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "estimates"
        unique_together = (("variety", "pull_day"),)

    def __str__(self) -> str:
        return f"Estimate({self.variety_id}, {self.pull_day})"


class CountSheetTemplate(Model):
    """Column configuration for a product type's customer count sheet."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    product_type = fields.ForeignKeyField(
        "models.ProductType",
        related_name="count_sheet_templates",
        on_delete=fields.CASCADE,
        unique=True,
    )
    columns = fields.JSONField(default=[])
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "count_sheet_templates"

    def __str__(self) -> str:
        return f"CountSheetTemplate({self.product_type_id})"


class PullDaySchedule(Model):
    """Pull day schedule: default (week_start=None) or week-specific override."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    week_start = fields.DateField(null=True, unique=True)
    pull_days = fields.JSONField(default=[1, 3, 5])
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "pull_day_schedules"

    def __str__(self) -> str:
        return f"PullDaySchedule({self.week_start})"


class SheetCompletion(Model):
    """Tracks whether a count/estimate sheet has been marked complete."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    product_type = fields.ForeignKeyField(
        "models.ProductType", related_name="sheet_completions", on_delete=fields.CASCADE
    )
    sheet_type = fields.CharField(max_length=20)
    sheet_date = fields.DateField()
    is_complete = fields.BooleanField(default=False)
    completed_by = fields.CharField(max_length=100, null=True)
    completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "sheet_completions"
        unique_together = (("product_type", "sheet_type", "sheet_date"),)

    def __str__(self) -> str:
        return f"SheetCompletion({self.product_type_id}, {self.sheet_type}, {self.sheet_date})"


class CountAuditLog(Model):
    """Audit trail for daily count changes."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    daily_count = fields.ForeignKeyField(
        "models.DailyCount", related_name="audit_logs", on_delete=fields.CASCADE
    )
    action = fields.CharField(max_length=10)
    amount = fields.IntField()
    resulting_total = fields.IntField()
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "count_audit_logs"

    def __str__(self) -> str:
        return f"CountAuditLog({self.daily_count_id}, {self.action})"
