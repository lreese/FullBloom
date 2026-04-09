# API Contract: Order Management v1

**Base URL**: `/api/v1`
**Response envelope**: `{ "data": ... }` for success, `{ "error": "message" }` for errors

---

## Customers

### GET /api/v1/customers

List all active customers.

**Query params**: `?search=name` (optional, partial match)

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "customer_id": 1740,
      "name": "R & B Flowers",
      "price_type": "Retail",
      "is_active": true
    }
  ]
}
```

### GET /api/v1/customers/{id}

Get a single customer by UUID.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "customer_id": 1740,
    "name": "R & B Flowers",
    "price_type": "Retail",
    "is_active": true,
    "stores": [
      { "id": "uuid", "name": "Downtown" }
    ]
  }
}
```

---

## Products

### GET /api/v1/products

List product catalog (varieties with show=true by default).

**Query params**:
- `?show_all=true` — include hidden varieties
- `?type=Tulips` — filter by product type
- `?search=dynasty` — partial name match

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "Tulips",
      "product_line": "Standard Tulips",
      "name": "Dynasty",
      "color": "Light Pink",
      "hex_color": "#FFC0CB",
      "flowering_type": "single",
      "show": true,
      "sales_items": [
        {
          "id": "uuid",
          "name": "Tulips Standard x10",
          "stems_per_order": 10,
          "retail_price": "1.50"
        }
      ]
    }
  ]
}
```

---

## Pricing

### GET /api/v1/customers/{customer_id}/pricing

Get all pricing for a specific customer. Returns customer-specific prices with retail fallback.

**Response** `200`:
```json
{
  "data": [
    {
      "sales_item_id": "uuid",
      "sales_item_name": "Tulips Standard x10",
      "stems_per_order": 10,
      "customer_price": "1.30",
      "retail_price": "1.50",
      "is_custom": true
    }
  ]
}
```

**Notes**: `is_custom=false` means no customer-specific price exists and `customer_price` equals `retail_price`.

---

## Orders

### POST /api/v1/orders

Create a new order.

**Request body**:
```json
{
  "customer_id": "uuid",
  "order_date": "2026-04-07",
  "ship_via": "Pick Up - Tues",
  "freight_charge_included": false,
  "box_charge": 2.00,
  "holiday_charge_pct": 0.15,
  "special_charge": 5.00,
  "freight_charge": 10.00,
  "order_notes": "Handle with care",
  "po_number": "PO-12345",
  "salesperson_email": "jane@oregonflowers.com",
  "force_duplicate": false,
  "lines": [
    {
      "sales_item_id": "uuid",
      "assorted": false,
      "color_variety": "Dynasty",
      "stems": 100,
      "price_per_stem": 1.30,
      "item_fee_pct": 0.10,
      "item_fee_dollar": 0.05,
      "store_name": "Downtown",
      "notes": "Prefer light pink",
      "box_quantity": 2,
      "bunches_per_box": 4,
      "stems_per_bunch": 5,
      "box_reference": "A",
      "is_special": false,
      "sleeve": null,
      "upc": null
    }
  ]
}
```

**Response** `201`:
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260407-001",
    "customer_id": "uuid",
    "order_date": "2026-04-07",
    "lines_count": 1,
    "created_at": "2026-04-07T14:30:00Z"
  }
}
```

**Response** `409` (duplicate warning, `force_duplicate=false`):
```json
{
  "error": "Potential duplicate order: existing order ORD-20260407-001 matches this customer, date, and line items. Resubmit with force_duplicate=true to override."
}
```

**Validation errors** `422`:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "lines[0].stems", "message": "Stems must be a positive integer" },
    { "field": "customer_id", "message": "Customer is required" }
  ]
}
```

### GET /api/v1/orders/{id}

Get a single order with all line items.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260407-001",
    "customer": {
      "id": "uuid",
      "customer_id": 1740,
      "name": "R & B Flowers"
    },
    "order_date": "2026-04-07",
    "ship_via": "Pick Up - Tues",
    "price_type": "Retail",
    "freight_charge_included": false,
    "box_charge": "2.00",
    "holiday_charge_pct": "0.1500",
    "special_charge": "5.00",
    "freight_charge": "10.00",
    "order_notes": "Handle with care",
    "po_number": "PO-12345",
    "salesperson_email": "jane@oregonflowers.com",
    "created_at": "2026-04-07T14:30:00Z",
    "lines": [
      {
        "id": "uuid",
        "line_number": 1,
        "sales_item": {
          "id": "uuid",
          "name": "Tulips Standard x10"
        },
        "assorted": false,
        "color_variety": "Dynasty",
        "stems": 100,
        "list_price_per_stem": "1.50",
        "price_per_stem": "1.30",
        "item_fee_pct": "0.1000",
        "item_fee_dollar": "0.05",
        "effective_price_per_stem": "1.48",
        "store_name": "Downtown",
        "notes": "Prefer light pink",
        "box_quantity": 2,
        "bunches_per_box": 4,
        "stems_per_bunch": 5,
        "box_reference": "A",
        "is_special": false,
        "sleeve": null,
        "upc": null
      }
    ]
  }
}
```

---

## CSV Import

### POST /api/v1/import/varieties

Import product catalog from Varieties CSV.

**Request**: `multipart/form-data` with file field `file`

**Response** `200`:
```json
{
  "data": {
    "types_created": 5,
    "types_updated": 0,
    "lines_created": 12,
    "lines_updated": 3,
    "varieties_created": 450,
    "varieties_updated": 10
  }
}
```

### POST /api/v1/import/pricing

Import customer pricing from PriceData CSV.

**Request**: `multipart/form-data` with file field `file`

**Response** `200`:
```json
{
  "data": {
    "customers_created": 50,
    "customers_updated": 5,
    "prices_created": 48000,
    "prices_updated": 2000,
    "sales_items_created": 100,
    "sales_items_updated": 0
  }
}
```

### POST /api/v1/import/colors

Import variety hex colors from Color by Variety CSV.

**Request**: `multipart/form-data` with file field `file`

**Response** `200`:
```json
{
  "data": {
    "varieties_updated": 350,
    "varieties_not_found": 5
  }
}
```

---

## Health

### GET /api/v1/health

Constitution requirement: every service MUST expose `/health`.

**Response** `200`:
```json
{
  "data": {
    "status": "healthy",
    "database": "connected"
  }
}
```
