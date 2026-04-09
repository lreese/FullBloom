# Data Model: Customer Management

## Entity: Customer (extended)

Extends the existing `customers` table with 7 new nullable fields.

### Fields

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | Existing |
| `customer_number` | INT | UNIQUE, NOT NULL | Existing (renamed from customer_id) |
| `name` | VARCHAR(255) | NOT NULL | Existing |
| `price_type` | VARCHAR(50) | NOT NULL, default "Retail" | Existing, retained for pricing |
| `is_active` | BOOL | NOT NULL, default true | Existing, used for soft-delete |
| `salesperson` | VARCHAR(10) | NULL | New — initials (JR, TM, MM, etc.) |
| `contact_name` | VARCHAR(255) | NULL | New — primary contact person |
| `default_ship_via` | VARCHAR(100) | NULL | New — default shipping method |
| `phone` | VARCHAR(50) | NULL | New — may include extensions |
| `location` | VARCHAR(255) | NULL | New — city, state as free text |
| `payment_terms` | VARCHAR(50) | NULL | New — e.g., "30 days", "Pay Per P/S" |
| `email` | VARCHAR(255) | NULL | New — may contain multiple addresses |
| `notes` | TEXT | NULL | New — free-form notes |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto | Existing |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto | Existing |

### Validation Rules

- `customer_number`: must be unique, positive integer, immutable after creation
- `name`: must not be empty
- `email`: no format validation (data contains semicolon-separated addresses and non-standard formats)
- `phone`: no format validation (data contains extensions, multiple numbers, parenthesized area codes)
- All new fields are nullable — no required fields beyond customer_number and name

### State Transitions

```
Active (is_active=true)  ──archive──▶  Archived (is_active=false)
                         ◀──restore──
```

No other states. No permanent deletion via the UI.

## Relationships

- **Customer → Store**: One-to-many (existing, unchanged). Stores are visible but not editable in this feature.
- **Customer → Order**: One-to-many (existing, unchanged). Orders reference customer by FK. Archiving a customer does NOT cascade to orders.
- **Customer → CustomerPrice**: One-to-many (existing, unchanged). Pricing references customer by FK.

## Migration

Single migration: `ALTER TABLE customers ADD COLUMN ...` for each of the 7 new fields. All nullable, no data backfill required (import service handles that separately).
