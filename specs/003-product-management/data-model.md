# Data Model: Product Management

## Entity: Color (new, replaces VarietyColor)

Standalone reference table for color names. Varieties point to a Color via FK.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | New |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Color name (e.g., "White", "Red") |
| `hex_color` | VARCHAR(7) | NULL | Optional hex code for display |
| `is_active` | BOOL | NOT NULL, default true | Soft-delete flag |

Replaces the old `variety_colors` table (which was a per-variety color mapping). Colors are now a flat reference list. The old `varieties.color` free-text field and `variety_colors` table are dropped.

## Entity: Variety (extended)

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `product_line_id` | UUID FK | NOT NULL, references product_lines | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique per product_line | Existing |
| `color_id` | UUID FK | NULL, references colors | **New** — replaces free-text `color` field |
| `hex_color` | VARCHAR(7) | NULL | Existing — variety-level hex override (kept for backward compat) |
| `flowering_type` | VARCHAR(50) | NULL | Existing |
| `can_replace` | BOOL | NOT NULL, default false | Existing |
| `show` | BOOL | NOT NULL, default true | Existing — order form visibility |
| `is_active` | BOOL | NOT NULL, default true | Archive flag |
| `weekly_sales_category` | VARCHAR(100) | NULL | Existing |
| `item_group_id` | INT | NULL | Existing |
| `item_group_description` | VARCHAR(255) | NULL | Existing |

### Changes from previous model
- **Removed**: `color` (VARCHAR free-text) — replaced by `color_id` FK
- **Added**: `color_id` (UUID FK, nullable) — references `colors` table

### State Transitions

```
Active (is_active=true, show=true)   ──hide──▶  Hidden (is_active=true, show=false)
                                     ◀──show──
Active (is_active=true)              ──archive──▶  Archived (is_active=false)
                                     ◀──restore──
```

## Entity: SalesItem (extended)

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `variety_id` | UUID FK | NOT NULL, references varieties | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique | Existing |
| `stems_per_order` | INT | NOT NULL, > 0 | Existing |
| `retail_price` | DECIMAL(10,2) | NOT NULL | Existing |
| `is_active` | BOOL | NOT NULL, default true | Soft-delete flag |

### Soft-delete behavior

When a sales item is soft-deleted:
- `is_active` is set to false
- Associated `CustomerPrice` records are preserved (not deleted)
- CustomerPrice records for inactive sales items are excluded from pricing lookups
- Restoring sets `is_active` back to true; customer prices become active again

## Entity: ProductLine (extended)

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `product_type_id` | UUID FK | NOT NULL, references product_types | Existing |
| `name` | VARCHAR(100) | NOT NULL, unique per product_type | Existing |
| `is_active` | BOOL | NOT NULL, default true | Archive flag |

### Archive cascade

Archiving a product line does NOT set `is_active=false` on its varieties. Instead, the API filters out varieties whose product line is inactive when listing active varieties. Restoring the product line makes all its varieties visible again.

## Entity: ProductType (extended)

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Existing |
| `is_active` | BOOL | NOT NULL, default true | Archive flag |

## Removed Entities

- **VarietyColor**: Dropped. Replaced by the standalone `colors` table + `varieties.color_id` FK.

## Relationships

```
ProductType  ──1:N──▶  ProductLine  ──1:N──▶  Variety  ──1:N──▶  SalesItem  ──1:N──▶  CustomerPrice
                                              Variety  ──N:1──▶  Color
```

## Migration Plan

1. Create `colors` table with `id`, `name` (UNIQUE), `hex_color`, `is_active`
2. Populate `colors` from `SELECT DISTINCT color FROM varieties WHERE color IS NOT NULL AND color != ''`
3. Add `color_id` FK column to `varieties` (nullable)
4. Backfill `varieties.color_id` by matching `varieties.color` to `colors.name`
5. Drop `varieties.color` column
6. Drop `variety_colors` table
