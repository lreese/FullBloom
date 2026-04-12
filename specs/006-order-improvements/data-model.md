# Data Model: Order Management Improvements

## Changed Entities

### Customer (existing — no schema change)

The `default_ship_via` field already exists. No migration needed. The frontend needs to read and use this field when selecting a customer.

| Field | Type | Notes |
|-------|------|-------|
| default_ship_via | CharField(100), nullable | Already exists; needs to be wired into ShipViaSelector |

### Order (existing — no schema change)

No changes to the Order model. All fields remain as-is. The new PUT endpoint uses the same fields.

### OrderLine (existing — no schema change)

No changes to the OrderLine model. Line items are managed through the order update flow.

## New Entities

### OrderAuditLog

Tracks all changes to orders — creation, updates, and deletions. One row per save operation.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| order | ForeignKey(Order) | CASCADE on delete, related_name="audit_logs" | Links to the order being tracked |
| action | CharField(10) | Required | "created", "updated", or "deleted" |
| changes | JSONField | Default empty list | Array of `{field, old_value, new_value}` for updates; full order snapshot for deletes |
| entered_by | CharField(100) | Nullable | Who made the change (salesperson email or "anonymous") |
| created_at | DatetimeField | Auto-set | When the change occurred |

**Table name**: `order_audit_logs`

**Unique constraints**: None (multiple audit entries per order expected)

**Indexes**: `order_id` (implicit via FK), `created_at` (for chronological display)

### Changes JSON Structure

For "created" actions:
```json
[]
```

For "updated" actions:
```json
[
  {"field": "ship_via", "old_value": "FedEx", "new_value": "UPS"},
  {"field": "line_added", "old_value": null, "new_value": {"sales_item": "Rose Red 10s", "stems": 50}},
  {"field": "line_removed", "old_value": {"sales_item": "Lily White 10s", "stems": 25}, "new_value": null},
  {"field": "line_modified", "old_value": {"stems": 50}, "new_value": {"stems": 75}, "line_id": "uuid"}
]
```

For "deleted" actions:
```json
[
  {"field": "order_snapshot", "old_value": {"order_number": "ORD-20260412-001", "customer": "Oregon Flowers", "lines_count": 3}, "new_value": null}
]
```

## Entity Relationships

```
Customer 1 ──── * Order 1 ──── * OrderLine
                       │
                       └──── * OrderAuditLog
```

## Migration Required

One migration: add `order_audit_logs` table. Generate via `aerich migrate --name add_order_audit_log`.
