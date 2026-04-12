# API Contracts: Standing Orders

All endpoints follow the project convention: `{ "data": ... }` for success, `{ "error": "message" }` for failure.

## Standing Order CRUD

### POST /api/v1/standing-orders

Create a new standing order.

**Request**:
```json
{
  "customer_id": "uuid",
  "frequency_weeks": 1,
  "days_of_week": [1, 2, 4],
  "reference_date": "2026-04-14",
  "ship_via": "FedEx",
  "box_charge": 5.00,
  "holiday_charge_pct": 0.15,
  "special_charge": null,
  "freight_charge": null,
  "freight_charge_included": false,
  "notes": "Weekly Tuesday order",
  "lines": [
    {
      "sales_item_id": "uuid",
      "stems": 50,
      "price_per_stem": 0.75,
      "item_fee_pct": 0.05,
      "item_fee_dollar": null,
      "color_variety": "Red",
      "notes": null
    }
  ]
}
```

**Response** (201):
```json
{
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "customer_name": "Oregon Flowers",
    "status": "active",
    "frequency_weeks": 1,
    "days_of_week": [1, 2, 4],
    "reference_date": "2026-04-14",
    "lines_count": 1,
    "created_at": "2026-04-12T10:00:00Z"
  }
}
```

---

### GET /api/v1/standing-orders

List standing orders with filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No (default: "active") | "active", "paused", "cancelled", or "all" |
| customer_id | UUID | No | Filter by customer |
| search | string | No | Partial match on customer name |

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "Oregon Flowers",
      "status": "active",
      "frequency_weeks": 1,
      "days_of_week": [1, 2, 4],
      "cadence_description": "Every week on Mon, Tue, Thu",
      "lines_count": 3,
      "updated_at": "2026-04-12T10:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/standing-orders/{id}

Get a single standing order with all line items.

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "customer_name": "Oregon Flowers",
    "status": "active",
    "frequency_weeks": 1,
    "days_of_week": [1, 2, 4],
    "days_of_week_names": ["Monday", "Tuesday", "Thursday"],
    "reference_date": "2026-04-14",
    "cadence_description": "Every week on Mon, Tue, Thu",
    "ship_via": "FedEx",
    "box_charge": "5.00",
    "holiday_charge_pct": "0.1500",
    "special_charge": null,
    "freight_charge": null,
    "freight_charge_included": false,
    "notes": "Weekly Tuesday order",
    "created_at": "2026-04-12T10:00:00Z",
    "updated_at": "2026-04-12T10:00:00Z",
    "lines": [
      {
        "id": "uuid",
        "line_number": 1,
        "sales_item_id": "uuid",
        "sales_item_name": "Rose Red 10s",
        "stems": 50,
        "price_per_stem": "0.75",
        "item_fee_pct": "0.0500",
        "item_fee_dollar": null,
        "color_variety": "Red",
        "notes": null
      }
    ]
  }
}
```

---

### PUT /api/v1/standing-orders/{id}

Update a standing order. Requires status "active". Includes required reason.

**Request**:
```json
{
  "frequency_weeks": 2,
  "days_of_week": [1, 2, 4],
  "ship_via": "UPS",
  "notes": "Changed to biweekly",
  "reason": "Customer requested biweekly instead of weekly",
  "apply_to_future_orders": true,
  "lines": [
    {
      "id": "uuid-or-null",
      "sales_item_id": "uuid",
      "stems": 75,
      "price_per_stem": 0.70,
      "item_fee_pct": null,
      "item_fee_dollar": null,
      "color_variety": "Red",
      "notes": null
    }
  ]
}
```

**Response** (200): Same as GET /api/v1/standing-orders/{id}

**Errors**: 404 (not found), 409 (not active — must resume first), 422 (validation)

---

## Status Transitions

### POST /api/v1/standing-orders/{id}/pause

**Request**: `{ "reason": "Customer on vacation until May" }`

**Response** (200): `{ "data": { "id": "uuid", "status": "paused" } }`

**Errors**: 409 (not active)

---

### POST /api/v1/standing-orders/{id}/resume

**Request**: `{}` (reason optional)

**Response** (200): `{ "data": { "id": "uuid", "status": "active" } }`

**Errors**: 409 (not paused)

---

### POST /api/v1/standing-orders/{id}/cancel

**Request**: `{ "reason": "Customer account closed" }`

**Response** (200): `{ "data": { "id": "uuid", "status": "cancelled" } }`

**Errors**: 409 (already cancelled)

---

## Order Generation

### POST /api/v1/standing-orders/generate-preview

Preview which standing orders would generate orders for a date range.

**Request**:
```json
{
  "date_from": "2026-04-14",
  "date_to": "2026-04-18"
}
```

**Response** (200):
```json
{
  "data": {
    "date_from": "2026-04-14",
    "date_to": "2026-04-18",
    "matches": [
      {
        "standing_order_id": "uuid",
        "customer_name": "Oregon Flowers",
        "cadence_description": "Every week on Mon, Tue, Thu",
        "generate_date": "2026-04-14",
        "lines_count": 3,
        "total_stems": 125,
        "already_generated": false
      }
    ]
  }
}
```

---

### POST /api/v1/standing-orders/generate

Generate orders from standing orders for the specified dates.

**Request**:
```json
{
  "date_from": "2026-04-14",
  "date_to": "2026-04-18",
  "skip_already_generated": true
}
```

**Response** (201):
```json
{
  "data": {
    "orders_created": 5,
    "orders_skipped": 1,
    "order_ids": ["uuid", "uuid", "uuid", "uuid", "uuid"]
  }
}
```

---

## Audit Log

### GET /api/v1/standing-orders/{id}/audit-log

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "action": "updated",
      "reason": "Customer requested biweekly",
      "changes": [
        {"field": "frequency_weeks", "old_value": "1", "new_value": "2"}
      ],
      "entered_by": "sales@example.com",
      "created_at": "2026-04-12T14:30:00Z"
    }
  ]
}
```

---

## Modified Endpoints

### GET /api/v1/orders (existing)

Add filter parameter:

| Parameter | Type | Description |
|-----------|------|-------------|
| from_standing_order | bool | If true, show only orders generated from standing orders. If false, show only manual orders. Omit for all. |

Response items include new field:
```json
{
  "standing_order_id": "uuid or null",
  "standing_order_badge": true
}
```
