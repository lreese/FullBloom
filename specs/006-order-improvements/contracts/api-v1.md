# API Contracts: Order Management Improvements

All endpoints follow the project convention: `{ "data": ... }` for success, `{ "error": "message" }` for failure.

## Modified Endpoints

### GET /api/v1/customers

**Change**: Add optional `search` query parameter.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| active | bool | No (default: true) | Filter by active status |
| search | string | No | Case-insensitive partial match on customer name or customer_number |

**Response**: Same as current — array of Customer objects.

**Example**: `GET /api/v1/customers?search=oregon&active=true`

---

## New Endpoints

### GET /api/v1/orders

List orders with optional filters and pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| offset | int | No (default: 0) | Pagination offset |
| limit | int | No (default: 25) | Page size (max 100) |
| date_from | date | No | Filter orders on or after this date |
| date_to | date | No | Filter orders on or before this date |
| customer_id | UUID | No | Filter by customer |
| salesperson_email | string | No | Filter by salesperson |
| search | string | No | Partial match on order_number or customer name |

**Response** (200):
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "order_number": "ORD-20260412-001",
        "customer_name": "Oregon Flowers",
        "customer_id": "uuid",
        "order_date": "2026-04-12",
        "ship_via": "FedEx",
        "lines_count": 5,
        "total_stems": 250,
        "salesperson_email": "sales@example.com",
        "created_at": "2026-04-12T10:00:00Z"
      }
    ],
    "total": 150,
    "offset": 0,
    "limit": 25
  }
}
```

---

### GET /api/v1/orders/{order_id}

Fetch a single order with all line items (for edit form population).

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260412-001",
    "customer_id": "uuid",
    "customer_name": "Oregon Flowers",
    "order_date": "2026-04-12",
    "ship_via": "FedEx",
    "order_label": "Store #5",
    "price_type": "Wholesale",
    "freight_charge_included": false,
    "box_charge": 5.00,
    "holiday_charge_pct": 0.15,
    "special_charge": 10.00,
    "freight_charge": 25.00,
    "order_notes": "Handle with care",
    "po_number": "PO-12345",
    "salesperson_email": "sales@example.com",
    "created_at": "2026-04-12T10:00:00Z",
    "updated_at": "2026-04-12T10:00:00Z",
    "lines": [
      {
        "id": "uuid",
        "line_number": 1,
        "sales_item_id": "uuid",
        "sales_item_name": "Rose Red 10s",
        "stems": 50,
        "list_price_per_stem": 0.75,
        "price_per_stem": 0.70,
        "item_fee_pct": 0.05,
        "item_fee_dollar": 0.02,
        "effective_price_per_stem": 0.755,
        "color_variety": "Red",
        "assorted": false,
        "notes": null,
        "box_quantity": null,
        "bunches_per_box": null,
        "stems_per_bunch": null,
        "box_reference": "A",
        "is_special": false,
        "sleeve": null,
        "upc": null
      }
    ]
  }
}
```

**Error** (404): `{ "error": "Order not found" }`

---

### PUT /api/v1/orders/{order_id}

Update an existing order. Customer cannot be changed.

**Request**:
```json
{
  "order_date": "2026-04-12",
  "ship_via": "UPS",
  "order_label": "Store #5",
  "freight_charge_included": false,
  "box_charge": 5.00,
  "holiday_charge_pct": 0.15,
  "special_charge": 10.00,
  "freight_charge": 25.00,
  "order_notes": "Updated notes",
  "po_number": "PO-12345",
  "salesperson_email": "sales@example.com",
  "lines": [
    {
      "id": "uuid-or-null",
      "sales_item_id": "uuid",
      "stems": 50,
      "price_per_stem": 0.70,
      "item_fee_pct": 0.05,
      "item_fee_dollar": 0.02,
      "color_variety": "Red",
      "assorted": false,
      "notes": null,
      "box_quantity": null,
      "bunches_per_box": null,
      "stems_per_bunch": null,
      "box_reference": "A",
      "is_special": false,
      "sleeve": null,
      "upc": null
    }
  ]
}
```

**Behavior**:
- Lines with an existing `id` are updated
- Lines with `id: null` are created as new
- Existing lines not present in the array are deleted
- Effective prices are recalculated server-side
- An OrderAuditLog entry is created with the diff

**Response** (200): Same as GET /api/v1/orders/{order_id}

**Errors**:
- 404: Order not found
- 422: Validation error

---

### DELETE /api/v1/orders/{order_id}

Delete an order and all its line items. Creates an audit log entry before deletion.

**Response** (200):
```json
{
  "data": {
    "deleted": true,
    "order_number": "ORD-20260412-001"
  }
}
```

**Error** (404): `{ "error": "Order not found" }`

---

### GET /api/v1/orders/{order_id}/audit-log

Fetch audit trail for an order.

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "action": "updated",
      "changes": [
        {"field": "ship_via", "old_value": "FedEx", "new_value": "UPS"},
        {"field": "line_modified", "old_value": {"stems": 50}, "new_value": {"stems": 75}, "line_id": "uuid"}
      ],
      "entered_by": "sales@example.com",
      "created_at": "2026-04-12T14:30:00Z"
    }
  ]
}
```
