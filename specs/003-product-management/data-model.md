# Data Model: Product Management

## Entity: Variety (extended)

Extends the existing `varieties` table with `is_active`.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `product_line_id` | UUID FK | NOT NULL, references product_lines | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique per product_line | Existing |
| `color` | VARCHAR(100) | NULL | Existing |
| `hex_color` | VARCHAR(7) | NULL | Existing |
| `flowering_type` | VARCHAR(50) | NULL | Existing |
| `can_replace` | BOOL | NOT NULL, default false | Existing |
| `show` | BOOL | NOT NULL, default true | Existing — order form visibility |
| `is_active` | BOOL | NOT NULL, default true | **New** — archive flag |
| `weekly_sales_category` | VARCHAR(100) | NULL | Existing |
| `item_group_id` | INT | NULL | Existing |
| `item_group_description` | VARCHAR(255) | NULL | Existing |

### State Transitions

```
Active (is_active=true, show=true)   ──hide──▶  Hidden (is_active=true, show=false)
                                     ◀──show──
Active (is_active=true)              ──archive──▶  Archived (is_active=false)
                                     ◀──restore──
```

`show` and `is_active` are independent. Archiving does not change `show`.

## Entity: SalesItem (extended)

Extends the existing `sales_items` table with `is_active`.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `variety_id` | UUID FK | NOT NULL, references varieties | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique | Existing |
| `stems_per_order` | INT | NOT NULL, > 0 | Existing |
| `retail_price` | DECIMAL(10,2) | NOT NULL | Existing |
| `is_active` | BOOL | NOT NULL, default true | **New** — soft-delete flag |

### Soft-delete behavior

When a sales item is soft-deleted:
- `is_active` is set to false
- Associated `CustomerPrice` records are preserved (not deleted)
- CustomerPrice records for inactive sales items are excluded from pricing lookups
- Restoring sets `is_active` back to true; customer prices become active again

## Entity: ProductLine (extended)

Extends the existing `product_lines` table with `is_active`.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `product_type_id` | UUID FK | NOT NULL, references product_types | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique per product_type | Existing |
| `is_active` | BOOL | NOT NULL, default true | **New** — archive flag |

### Archive cascade

Archiving a product line does NOT set `is_active=false` on its varieties. Instead, the API filters out varieties whose product line is inactive when listing active varieties. Restoring the product line makes all its varieties visible again.

## Entity: VarietyColor (extended)

Extends the existing `variety_colors` table with `is_active`.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `variety_id` | UUID FK | NOT NULL, references varieties | Existing |
| `color_name` | VARCHAR(100) | NOT NULL, unique per variety | Existing |
| `is_active` | BOOL | NOT NULL, default true | **New** — soft-delete flag |

## Entity: ProductType (unchanged)

No changes. Product types are managed inline via dropdown when creating/editing product lines.

## Relationships

```
ProductType  ──1:N──▶  ProductLine  ──1:N──▶  Variety  ──1:N──▶  SalesItem  ──1:N──▶  CustomerPrice
                                              Variety  ──1:N──▶  VarietyColor
```

## Migration

Single migration: `ALTER TABLE ... ADD COLUMN is_active BOOL NOT NULL DEFAULT true` on four tables:
- `varieties`
- `sales_items`
- `product_lines`
- `variety_colors`
