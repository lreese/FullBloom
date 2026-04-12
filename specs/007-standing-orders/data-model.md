# Data Model: Standing Orders

## New Entities

### StandingOrder

A recurring order template for a customer.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| customer | ForeignKey(Customer) | CASCADE, required | The customer this standing order is for |
| status | CharField(10) | Required, one of: "active", "paused", "cancelled" | Lifecycle state |
| frequency_weeks | IntField | Required, one of: 1, 2, 4 | How often orders are generated |
| days_of_week | JSONField | Required, array of ints 0-6 (Mon-Sun) | Which days of the week (e.g., [1, 2, 4] for Mon, Tue, Thu) |
| reference_date | DateField | Required | Start date for computing multi-week cycles |
| ship_via | CharField(100) | Nullable | Default ship-via for generated orders |
| box_charge | DecimalField(10,2) | Nullable | Order-level fee |
| holiday_charge_pct | DecimalField(5,4) | Nullable | Order-level percentage |
| special_charge | DecimalField(10,2) | Nullable | Order-level flat fee |
| freight_charge | DecimalField(10,2) | Nullable | Order-level flat fee |
| freight_charge_included | BooleanField | Default False | |
| notes | TextField | Nullable | Freeform notes copied to generated orders |
| created_at | DatetimeField | Auto-set | |
| updated_at | DatetimeField | Auto-set | |

**Table name**: `standing_orders`

### StandingOrderLine

A single sales item within a standing order template.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| standing_order | ForeignKey(StandingOrder) | CASCADE, related_name="lines" | |
| sales_item | ForeignKey(SalesItem) | CASCADE | The product being ordered |
| stems | IntField | Required, > 0 | Quantity |
| price_per_stem | DecimalField(10,2) | Required | Price snapshot |
| item_fee_pct | DecimalField(5,4) | Nullable | Line-level percentage fee |
| item_fee_dollar | DecimalField(10,2) | Nullable | Line-level flat fee |
| color_variety | CharField(100) | Nullable | Color/variety preference |
| notes | TextField | Nullable | Line-level notes |
| line_number | IntField | Required | Display order |

**Table name**: `standing_order_lines`

**Unique constraint**: (standing_order, line_number)

### StandingOrderAuditLog

Tracks all changes to standing orders with required reasons.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| standing_order | ForeignKey(StandingOrder) | CASCADE, related_name="audit_logs" | |
| action | CharField(10) | Required | "created", "updated", "paused", "resumed", "cancelled" |
| reason | TextField | Nullable | Required for update/pause/cancel; optional for create/resume |
| changes | JSONField | Default empty list | Structured diff of what changed |
| entered_by | CharField(100) | Nullable | Who made the change |
| created_at | DatetimeField | Auto-set | |

**Table name**: `standing_order_audit_logs`

## Modified Entities

### Order (existing)

Add one nullable FK to link generated orders back to their source standing order.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| standing_order | ForeignKey(StandingOrder) | SET_NULL, nullable, related_name="generated_orders" | Null for manually created orders; set when generated from a standing order |

## State Transitions

```
                    ┌──────────┐
       create ──►   │  active  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │ pause     │ cancel   │
              ▼          │          ▼
        ┌──────────┐    │    ┌────────────┐
        │  paused  │    │    │ cancelled  │
        └────┬─────┘    │    └────────────┘
             │          │          ▲
     resume  │          │  cancel  │
             ▼          │          │
        ┌──────────┐    │          │
        │  active  │◄───┘          │
        └────┬─────┘               │
             │      cancel         │
             └─────────────────────┘
```

Valid transitions:
- active → paused (requires reason)
- active → cancelled (requires reason)
- paused → active (resume)
- paused → cancelled (requires reason)
- cancelled → (terminal, no transitions out)

## Entity Relationships

```
Customer 1 ──── * StandingOrder 1 ──── * StandingOrderLine
                       │                      │
                       ├──── * StandingOrderAuditLog
                       │
                       └──── * Order (via standing_order_id FK)
```

## Migrations Required

1. Create `standing_orders`, `standing_order_lines`, `standing_order_audit_logs` tables
2. Add nullable `standing_order_id` FK to `orders` table
