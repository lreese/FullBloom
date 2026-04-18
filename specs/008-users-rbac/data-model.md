# Data Model: Users & RBAC

## New Entities

### User

Local user profile linked to Supabase Auth. Stores role and profile data.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | Local FullBloom ID |
| supabase_user_id | CharField(255) | Unique, required | Links to Supabase Auth user |
| email | CharField(255) | Unique, required | Denormalized from Supabase for queries |
| display_name | CharField(255) | Nullable | User-editable display name |
| phone | CharField(50) | Nullable | User-editable phone number |
| avatar_url | CharField(500) | Nullable | Profile picture URL (Supabase Storage or Google) |
| role | CharField(20) | Required | One of: "admin", "salesperson", "data_manager", "field_worker" |
| status | CharField(10) | Required, default "pending" | "pending", "active", "deactivated" |
| created_at | DatetimeField | Auto-set | |
| updated_at | DatetimeField | Auto-set | |

**Table name**: `users`

**Unique constraints**: `supabase_user_id`, `email`

### Permission Matrix (not a table — defined in code)

```python
PERMISSIONS = {
    "admin": {
        "users": "rw",
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "rw",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "salesperson": {
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
        "pricing": "rw",
    },
    "data_manager": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "field_worker": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "r",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
    },
}
```

`"rw"` = read/write, `"r"` = read-only, absent = no access.

## User Status Transitions

```
invite ──► pending ──► active ──► deactivated
                         ▲            │
                         └────────────┘
                          reactivate
```

- `pending` → `active`: user completes registration (sets password or signs in via Google)
- `active` → `deactivated`: admin deactivates user
- `deactivated` → `active`: admin reactivates user
- `pending` can be removed (delete invitation)

## Modified Entities

No existing models are modified. The `entered_by` fields on existing models (OrderAuditLog, StandingOrderAuditLog, CountAuditLog, etc.) remain as `CharField` — they will now be populated from the authenticated user's email instead of request body or NULL.

## Entity Relationships

```
Supabase Auth User (external)
        │
        │ supabase_user_id
        ▼
  User (local) ── role (string enum)
        │
        └── referenced by entered_by fields across all audit logs
```

## Migrations Required

1. Create `users` table with all fields
