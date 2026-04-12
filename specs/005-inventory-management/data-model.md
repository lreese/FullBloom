# Data Model: Inventory Management

## Entity: Variety (extended)

### New Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `in_harvest` | BOOL | NOT NULL, default true | Toggled by field leads. Only in-harvest varieties appear on count/estimate forms. |
| `stems_per_bunch` | INT | NOT NULL, default 10 | Standard bunch size for 10-stem equivalent conversion. Configurable per variety. |

### State Transitions (updated)

```
Active + In Harvest (is_active=true, in_harvest=true)  ──toggle──▶  Active + Dormant (is_active=true, in_harvest=false)
                                                        ◀──toggle──
Active (is_active=true)                                 ──archive──▶  Archived (is_active=false)
                                                        ◀──restore──
```

Dormant varieties are hidden from count/estimate forms but remain active in the product catalog. Archiving is permanent removal; dormancy is seasonal.

---

## Entity: DailyCount (new)

Remaining count for a single variety on a specific date, in 10-stem equivalents, after priority customer allocation.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `variety_id` | UUID FK | NOT NULL, references varieties, ON DELETE CASCADE | |
| `product_type_id` | UUID FK | NOT NULL, references product_types, ON DELETE CASCADE | Denormalized for query efficiency (avoidance of variety→product_line→product_type join) |
| `count_date` | DATE | NOT NULL | The date this count applies to |
| `count_value` | INT | NULL | 10-stem equivalents remaining. NULL = not counted, 0 = counted as zero. |
| `is_done` | BOOL | NOT NULL, default false | Per-variety completion flag |
| `entered_by` | VARCHAR(100) | NULL | User who entered/last modified (free text until Clerk auth) |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

### Constraints

- UNIQUE: `(variety_id, count_date)` — one count per variety per date

---

## Entity: CustomerCount (new)

Bunch count for a specific variety, customer, and bunch configuration on a specific date.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `variety_id` | UUID FK | NOT NULL, references varieties, ON DELETE CASCADE | |
| `product_type_id` | UUID FK | NOT NULL, references product_types, ON DELETE CASCADE | Denormalized |
| `customer_id` | UUID FK | NOT NULL, references customers, ON DELETE CASCADE | |
| `count_date` | DATE | NOT NULL | |
| `bunch_size` | INT | NOT NULL | Stems per bunch for this column (e.g., 3, 5) |
| `sleeve_type` | VARCHAR(20) | NOT NULL | "Plastic" or "Paper" |
| `bunch_count` | INT | NULL | Number of bunches of this configuration. NULL = not counted. |
| `is_done` | BOOL | NOT NULL, default false | Per-variety-column completion flag |
| `entered_by` | VARCHAR(100) | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

### Constraints

- UNIQUE: `(variety_id, customer_id, count_date, bunch_size, sleeve_type)` — one entry per variety × customer × bunch config × date

### Computed Values (not stored)

- **10-stem equivalent per tier**: `SUM(bunch_count × bunch_size) / 10` grouped by bunch_size, rounded to nearest integer
- **Grand total**: remaining count (from DailyCount) + sum of all tier 10-stem equivalents

---

## Entity: Estimate (new)

Per-pull-day estimate for a variety within a week, in 10-stem equivalents.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `variety_id` | UUID FK | NOT NULL, references varieties, ON DELETE CASCADE | |
| `product_type_id` | UUID FK | NOT NULL, references product_types, ON DELETE CASCADE | Denormalized |
| `week_start` | DATE | NOT NULL | Monday of the estimate week |
| `pull_day` | DATE | NOT NULL | Specific date within the week (e.g., Mon Apr 6, Wed Apr 8) |
| `estimate_value` | INT | NULL | 10-stem equivalents. NULL = not expected to produce, 0 = expected zero. |
| `is_done` | BOOL | NOT NULL, default false | Per-variety-day completion flag |
| `entered_by` | VARCHAR(100) | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

### Constraints

- UNIQUE: `(variety_id, pull_day)` — one estimate per variety per pull day

---

## Entity: CountSheetTemplate (new)

Defines the customer-bunch column layout for a product type's customer count sheet.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `product_type_id` | UUID FK | NOT NULL, references product_types, ON DELETE CASCADE, UNIQUE | One template per product type |
| `columns` | JSON | NOT NULL, default '[]' | Ordered array of `{customer_id, customer_name, bunch_size, sleeve_type}` |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

### Column JSON Schema

```json
[
  {
    "customer_id": "uuid",
    "customer_name": "HFM Trader Joe",
    "bunch_size": 5,
    "sleeve_type": "Paper"
  },
  {
    "customer_id": "uuid",
    "customer_name": "SAFEWAY",
    "bunch_size": 3,
    "sleeve_type": "Plastic"
  }
]
```

---

## Entity: PullDaySchedule (new)

Defines which days of the week are pull days for estimates.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `week_start` | DATE | NULL, UNIQUE | Monday of the week. NULL = default schedule. |
| `pull_days` | JSON | NOT NULL | Array of ISO day numbers: 1=Mon, 3=Wed, 5=Fri. Default: [1, 3, 5] |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

---

## Entity: SheetCompletion (new)

Tracks sheet-level "Done" status. Requires all per-variety `is_done` flags to be true before sheet can be marked complete.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `product_type_id` | UUID FK | NOT NULL, references product_types, ON DELETE CASCADE | |
| `sheet_type` | VARCHAR(20) | NOT NULL | "daily_count", "customer_count", or "estimate" |
| `sheet_date` | DATE | NOT NULL | For counts: the count date. For estimates: the week_start date. |
| `is_complete` | BOOL | NOT NULL, default false | |
| `completed_by` | VARCHAR(100) | NULL | |
| `completed_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto_now_add | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto_now | |

### Constraints

- UNIQUE: `(product_type_id, sheet_type, sheet_date)` — one completion record per sheet

---

## Relationships

```
ProductType  ──1:N──▶  ProductLine  ──1:N──▶  Variety  ──1:N──▶  DailyCount
                                              Variety  ──1:N──▶  CustomerCount
                                              Variety  ──1:N──▶  Estimate
ProductType  ──1:1──▶  CountSheetTemplate
ProductType  ──1:N──▶  SheetCompletion
Customer     ──1:N──▶  CustomerCount
```

## Migration Plan

1. Add `in_harvest` (BOOL, default true) and `stems_per_bunch` (INT, default 10) to `varieties` table
2. Create `daily_counts` table
3. Create `customer_counts` table
4. Create `estimates` table
5. Create `count_sheet_templates` table
6. Create `pull_day_schedules` table with default row (week_start=NULL, pull_days=[1,3,5])
7. Create `sheet_completions` table

All migrations via Aerich. No hand-written SQL.
