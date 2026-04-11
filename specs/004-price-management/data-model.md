# Data Model: Price Management

## Entity: PriceList (new)

Named pricing tier that customers can be assigned to.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | e.g., "Wholesale High", "Local Plus" |
| `is_active` | BOOL | NOT NULL, default true | Soft-delete flag |

### Notes

- Retail is NOT a PriceList record — it's the SalesItem's `retail_price` field.
- "Not Managed" customers get `price_list_id = NULL` (same as retail).
- Seeded from distinct `Customer.price_type` values: "Wholesale High", "Wholesale Low", "Local Plus". "Retail" and "Not Managed" are NOT seeded as PriceList records.

## Entity: PriceListItem (new)

Per-sales-item price within a price list. This is the matrix cell data.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `price_list_id` | UUID FK | NOT NULL, references price_lists | |
| `sales_item_id` | UUID FK | NOT NULL, references sales_items | |
| `price` | DECIMAL(10,2) | NOT NULL | Absolute price, independent of retail |

### Constraints

- Unique together: (`price_list_id`, `sales_item_id`)
- Every active PriceList has a PriceListItem for every active SalesItem (invariant maintained by create flows)

## Entity: Customer (modified)

### Changes

| Change | Before | After |
|--------|--------|-------|
| Remove `price_type` | VARCHAR(50), free text | Dropped |
| Add `price_list_id` | — | UUID FK, NULL, references price_lists, ON DELETE SET NULL |

### Migration

1. Create `price_lists` table
2. Seed PriceList records from distinct `Customer.price_type` values (excluding "Retail" and "Not Managed")
3. Add `price_list_id` FK column to customers (nullable)
4. Backfill: `UPDATE customers SET price_list_id = pl.id FROM price_lists pl WHERE customers.price_type = pl.name`
5. Drop `price_type` column

Customers with price_type = "Retail", "Not Managed", empty, or NULL get `price_list_id = NULL` (default to retail pricing).

## Entity: CustomerPrice (unchanged)

Already exists. No schema changes needed.

### Fields (reference)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | Existing |
| `customer_id` | UUID FK | NOT NULL, references customers | Existing |
| `sales_item_id` | UUID FK | NOT NULL, references sales_items | Existing |
| `price` | DECIMAL(10,2) | NOT NULL | Existing |

### Unique together: (`customer_id`, `sales_item_id`)

## Entity: SalesItem (extended)

Adds `cost_price` for margin tracking.

### New Field

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `cost_price` | DECIMAL(10,2) | NULL | Per-stem cost (what Oregon Flowers pays). Backend only in v1 — no UI. |

### Margin Calculation

When `cost_price` is set, the API can compute margin for any customer-sales item combination:
- `margin = effective_price - cost_price`
- `margin_pct = (effective_price - cost_price) / effective_price * 100`

Included in API responses when `cost_price` is not null. No UI in v1.

## Entity: PriceChangeLog (new)

Append-only audit trail capturing every price change. No UI in v1 — data capture only.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `changed_at` | TIMESTAMPTZ | NOT NULL, auto | When the change occurred |
| `change_type` | VARCHAR(50) | NOT NULL | "retail_price", "price_list_item", "customer_override" |
| `action` | VARCHAR(20) | NOT NULL | "created", "updated", "deleted" |
| `sales_item_id` | UUID FK | NULL, references sales_items | Always set |
| `price_list_id` | UUID FK | NULL, references price_lists | Set for price_list_item changes |
| `customer_id` | UUID FK | NULL, references customers | Set for customer_override changes |
| `old_price` | DECIMAL(10,2) | NULL | NULL on create |
| `new_price` | DECIMAL(10,2) | NULL | NULL on delete |

### Notes

- Append-only — rows are never updated or deleted
- No FK cascade deletes — if a referenced entity is archived, the log rows remain
- Entries written server-side whenever a price is created, updated, or removed
- No UI for viewing logs in v1 — future reporting feature will consume this data

## Effective Price Resolution

```
For a given (customer, sales_item):

1. CustomerPrice override exists?  → use override price (source: "override")
2. Customer has price_list_id AND PriceListItem exists?  → use PriceListItem price (source: "price_list")
3. Otherwise  → use SalesItem.retail_price (source: "retail")
```

## Relationships

```
PriceList  ──1:N──▶  PriceListItem  ──N:1──▶  SalesItem
PriceList  ──1:N──▶  Customer (via price_list_id FK)
Customer   ──1:N──▶  CustomerPrice  ──N:1──▶  SalesItem
SalesItem  ──N:1──▶  Variety
```

## Archive Behaviors

**PriceList archived**:
1. For each customer on this list, copy their PriceListItem prices to CustomerPrice overrides (skip if override already exists)
2. Set customer.price_list_id = NULL
3. PriceListItems are preserved but hidden (list is_active = false)

**SalesItem archived**:
- CustomerPrices preserved but hidden
- PriceListItems preserved but hidden
- Item disappears from matrix and grids
- Restoring brings everything back
