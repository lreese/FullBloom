# Data Model: Order Management

**Date**: 2026-04-07
**Feature**: 001-order-management

## Entity Relationship Overview

```
Customer 1──* Store
Customer 1──* CustomerPrice
Customer 1──* Order

ProductType 1──* ProductLine
ProductLine 1──* Variety
Variety 1──* SalesItem
SalesItem 1──* CustomerPrice
SalesItem 1──* OrderLine

Order 1──* OrderLine
```

## Entities

### Customer

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | Internal primary key |
| customer_id | INTEGER | UNIQUE, NOT NULL | Preserved from Google Sheets (e.g., 1740) |
| name | VARCHAR(255) | NOT NULL | e.g., "R & B Flowers" |
| price_type | VARCHAR(50) | NOT NULL, DEFAULT 'Retail' | Pricing tier: Retail, Wholesale, etc. |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | From "Active Customer" in PriceData |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

### Store

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| customer_id | UUID | FK → Customer.id, NOT NULL | Parent customer |
| name | VARCHAR(255) | NOT NULL | e.g., "Downtown Branch" |
| created_at | TIMESTAMPTZ | NOT NULL | |

**Unique constraint**: (customer_id, name)

### ProductType

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(100) | UNIQUE, NOT NULL | e.g., "Tulips" |

### ProductLine

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| product_type_id | UUID | FK → ProductType.id, NOT NULL | |
| name | VARCHAR(100) | NOT NULL | e.g., "Standard Tulips" |

**Unique constraint**: (product_type_id, name)

### Variety

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| product_line_id | UUID | FK → ProductLine.id, NOT NULL | |
| name | VARCHAR(100) | NOT NULL | e.g., "Dynasty" |
| color | VARCHAR(100) | NULLABLE | e.g., "Light Pink" |
| hex_color | VARCHAR(7) | NULLABLE | e.g., "#FFC0CB" from Color by Variety CSV |
| flowering_type | VARCHAR(50) | NULLABLE | e.g., "single", "double" |
| can_replace | BOOLEAN | NOT NULL, DEFAULT false | |
| show | BOOLEAN | NOT NULL, DEFAULT true | Controls visibility in order entry UI |
| weekly_sales_category | VARCHAR(100) | NULLABLE | e.g., "Pink", "White" |
| item_group_id | INTEGER | NULLABLE | e.g., 1009 |
| item_group_description | VARCHAR(255) | NULLABLE | e.g., "Dynasty1" |

**Unique constraint**: (product_line_id, name)

### SalesItem

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| variety_id | UUID | FK → Variety.id, NOT NULL | |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Composite: "Dahlia x5", "Tulips Standard x10" |
| stems_per_order | INTEGER | NOT NULL | e.g., 5, 10 |
| retail_price | NUMERIC(10,2) | NOT NULL | Baseline/default price |

### CustomerPrice

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| customer_id | UUID | FK → Customer.id, NOT NULL | |
| sales_item_id | UUID | FK → SalesItem.id, NOT NULL | |
| price | NUMERIC(10,2) | NOT NULL | Customer-specific price per stem |

**Unique constraint**: (customer_id, sales_item_id)

**Behavior**: When no CustomerPrice exists for a customer + sales item, fall back to SalesItem.retail_price.

### Order

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| order_number | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable: "ORD-20260407-001" |
| customer_id | UUID | FK → Customer.id, NOT NULL | |
| order_date | DATE | NOT NULL | |
| ship_via | VARCHAR(100) | NULLABLE | Freeform initially |
| price_type | VARCHAR(50) | NOT NULL | Captured at order time (snapshot) |
| freight_charge_included | BOOLEAN | NOT NULL, DEFAULT false | |
| box_charge | NUMERIC(10,2) | NULLABLE | Order-level flat fee |
| holiday_charge_pct | NUMERIC(5,4) | NULLABLE | Order-level percentage (e.g., 0.15 = 15%) |
| special_charge | NUMERIC(10,2) | NULLABLE | Order-level flat fee |
| freight_charge | NUMERIC(10,2) | NULLABLE | Order-level flat fee |
| order_notes | TEXT | NULLABLE | |
| po_number | VARCHAR(100) | NULLABLE | Customer's purchase order reference |
| salesperson_email | VARCHAR(255) | NULLABLE | |
| store_name | VARCHAR(255) | NULLABLE | Delivery location / branch (order-level) |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

### OrderLine

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | Also serves as RowID |
| order_id | UUID | FK → Order.id, NOT NULL | |
| sales_item_id | UUID | FK → SalesItem.id, NOT NULL | |
| assorted | BOOLEAN | NOT NULL, DEFAULT false | Customer wants assorted colors |
| color_variety | VARCHAR(100) | NULLABLE | Freeform — specific color/variety if picky |
| stems | INTEGER | NOT NULL, CHECK > 0 | Quantity |
| list_price_per_stem | NUMERIC(10,2) | NOT NULL | Original price from price list |
| price_per_stem | NUMERIC(10,2) | NOT NULL | Actual price (may be overridden) |
| item_fee_pct | NUMERIC(5,4) | NULLABLE | Line-level percentage fee |
| item_fee_dollar | NUMERIC(10,2) | NULLABLE | Line-level flat fee |
| effective_price_per_stem | NUMERIC(10,2) | NOT NULL | Calculated: (price * (1 + fee%)) + fee$ |
| notes | TEXT | NULLABLE | Line-level notes |
| box_quantity | INTEGER | NULLABLE | Custom packing |
| bunches_per_box | INTEGER | NULLABLE | Custom packing |
| stems_per_bunch | INTEGER | NULLABLE | Custom packing |
| box_reference | VARCHAR(50) | NULLABLE | Letter grouping: "A", "A, B, C" |
| is_special | BOOLEAN | NOT NULL, DEFAULT false | Special retail order flag |
| sleeve | VARCHAR(255) | NULLABLE | Sleeve name for special orders |
| upc | VARCHAR(50) | NULLABLE | UPC code for special orders |
| line_number | INTEGER | NOT NULL | Display order within the order |

**Unique constraint**: (order_id, line_number)

## Indexes

| Table | Index | Columns | Notes |
|-------|-------|---------|-------|
| Customer | idx_customer_customer_id | customer_id | Lookup by legacy ID |
| CustomerPrice | idx_customerprice_lookup | customer_id, sales_item_id | Price lookup on order entry |
| Order | idx_order_customer_date | customer_id, order_date | Duplicate detection |
| Order | idx_order_number | order_number | Human-readable lookup |
| OrderLine | idx_orderline_order | order_id | Fetch all lines for an order |
| SalesItem | idx_salesitem_variety | variety_id | Product catalog browsing |
| Variety | idx_variety_show | show | Filter visible varieties |

## State Transitions

Orders in this spec have no state machine — they are created and stored. State transitions (submitted → confirmed → fulfilled → shipped) are deferred to future specs (Change Order, Fulfillment/Allocation).

## Calculated Fields

**OrderLine.effective_price_per_stem**: Computed on creation and stored.
Formula: `(price_per_stem * (1 + COALESCE(item_fee_pct, 0))) + COALESCE(item_fee_dollar, 0)`

Order-level fees (box_charge, holiday_charge_pct, special_charge, freight_charge) are stored as-is on the Order. Total order cost calculation is a presentation concern and not stored — it can be derived from line items + order fees.
