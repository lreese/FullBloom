from tortoise import fields
from tortoise.models import Model


class User(Model):
    id = fields.UUIDField(pk=True)
    supabase_user_id = fields.CharField(max_length=255, unique=True)
    email = fields.CharField(max_length=255, unique=True)
    display_name = fields.CharField(max_length=255, null=True)
    phone = fields.CharField(max_length=50, null=True)
    avatar_url = fields.CharField(max_length=500, null=True)
    role = fields.CharField(max_length=20)  # admin, salesperson, data_manager, field_worker
    status = fields.CharField(max_length=15, default="pending")  # pending, active, deactivated
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "users"
