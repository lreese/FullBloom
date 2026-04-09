# API Contract: Product Management v1

Base path: `/api/v1`

## Variety Endpoints

### GET /varieties

List varieties with optional filters.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | bool | `true` | Filter by is_active. `true` = active only, `false` = archived only. |

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Albatros",
      "product_line_id": "uuid",
      "product_line_name": "Standard Tulips",
      "product_type_name": "Tulips",
      "color": "White",
      "hex_color": "#FFFFFF",
      "flowering_type": "Single",
      "can_replace": false,
      "show": true,
      "is_active": true,
      "weekly_sales_category": "A-List",
      "item_group_id": 100,
      "item_group_description": "Tulips Standard",
      "sales_items_count": 3
    }
  ]
}
```

### GET /varieties/{id}

Get a single variety with sales items.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "name": "Albatros",
    "product_line_id": "uuid",
    "product_line_name": "Standard Tulips",
    "product_type_name": "Tulips",
    "color": "White",
    "hex_color": "#FFFFFF",
    "flowering_type": "Single",
    "can_replace": false,
    "show": true,
    "is_active": true,
    "weekly_sales_category": "A-List",
    "item_group_id": 100,
    "item_group_description": "Tulips Standard",
    "sales_items": [
      {
        "id": "uuid",
        "name": "Albatros x10",
        "stems_per_order": 10,
        "retail_price": "1.50",
        "is_active": true,
        "customer_prices_count": 42
      }
    ]
  }
}
```

**Response** `404`: `{ "error": "Variety not found" }`

### GET /varieties/dropdown-options

Get distinct values for dropdown and bulk-update fields.

**Response** `200`:
```json
{
  "data": {
    "product_lines": [{ "id": "uuid", "name": "Standard Tulips", "product_type": "Tulips" }],
    "colors": ["White", "Red", "Pink"],
    "flowering_types": ["Single", "Double", "Parrot"],
    "weekly_sales_categories": ["A-List", "B-List", "Seasonal"]
  }
}
```

### POST /varieties

Create a new variety.

**Request Body**:
```json
{
  "name": "New Variety",
  "product_line_id": "uuid",
  "color": "Pink",
  "hex_color": "#FFC0CB",
  "flowering_type": "Single",
  "can_replace": false,
  "show": true,
  "weekly_sales_category": "B-List",
  "item_group_id": null,
  "item_group_description": null
}
```

Required: `name`, `product_line_id`. All others optional.

**Response** `201`: Full variety object
**Response** `422`: `{ "error": "Variety 'New Variety' already exists in product line 'Standard Tulips'" }`

### PATCH /varieties/{id}

Update a variety's fields. Only include fields to change.

**Request Body**: Partial variety object (same fields as create, all optional)
**Response** `200`: Full updated variety object
**Response** `404`: `{ "error": "Variety not found" }`

### PATCH /varieties/bulk

Bulk update a field across multiple varieties.

**Request Body**:
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"],
  "field": "show",
  "value": false
}
```

Allowed fields: `show`, `weekly_sales_category`, `product_line_id`, `color`, `flowering_type`.

**Response** `200`:
```json
{
  "data": {
    "updated_count": 3
  }
}
```

**Response** `422`: `{ "error": "Field 'name' is not bulk-updatable" }`

### POST /varieties/{id}/archive

Archive a variety (set `is_active = false`).

**Response** `200`: `{ "data": { "id": "uuid", "is_active": false } }`

### POST /varieties/{id}/restore

Restore an archived variety.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": true } }`

---

## Sales Item Endpoints (nested under varieties)

### GET /varieties/{variety_id}/sales-items

List sales items for a variety (includes inactive for management).

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `include_inactive` | bool | `false` | Include soft-deleted sales items |

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Albatros x10",
      "stems_per_order": 10,
      "retail_price": "1.50",
      "is_active": true,
      "customer_prices_count": 42
    }
  ]
}
```

### POST /varieties/{variety_id}/sales-items

Create a new sales item.

**Request Body**:
```json
{
  "name": "Albatros x25",
  "stems_per_order": 25,
  "retail_price": "1.25"
}
```

**Response** `201`: Full sales item object
**Response** `422`: `{ "error": "Sales item name 'Albatros x25' already exists" }`

### PATCH /sales-items/{id}

Update a sales item.

**Request Body**: Partial (name, stems_per_order, retail_price — all optional)
**Response** `200`: Updated sales item object

### POST /sales-items/{id}/archive

Soft-delete a sales item. Returns warning with customer price count.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "is_active": false,
    "customer_prices_count": 42
  }
}
```

### POST /sales-items/{id}/restore

Restore a soft-deleted sales item.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": true } }`

---

## Product Line Endpoints

### GET /product-lines

List all product lines with variety counts.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | bool | `true` | Filter by is_active |

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Standard Tulips",
      "product_type_id": "uuid",
      "product_type_name": "Tulips",
      "is_active": true,
      "variety_count": 24
    }
  ]
}
```

### GET /product-lines/dropdown-options

Get product types for the dropdown.

**Response** `200`:
```json
{
  "data": {
    "product_types": [{ "id": "uuid", "name": "Tulips" }]
  }
}
```

### POST /product-lines

Create a product line.

**Request Body**: `{ "name": "...", "product_type_id": "uuid" }`
**Response** `201`: Full product line object

### PATCH /product-lines/{id}

Update a product line.

**Request Body**: Partial (name, product_type_id)
**Response** `200`: Updated product line object

### POST /product-lines/{id}/archive

Archive a product line. Returns warning if it has varieties.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "is_active": false,
    "variety_count": 24
  }
}
```

### POST /product-lines/{id}/restore

Restore an archived product line.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": true } }`

---

## Color Endpoints

### GET /variety-colors

List all variety colors.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | bool | `true` | Filter by is_active |

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "variety_id": "uuid",
      "variety_name": "Albatros",
      "color_name": "White",
      "is_active": true
    }
  ]
}
```

### POST /variety-colors

Create a color entry.

**Request Body**: `{ "variety_id": "uuid", "color_name": "White" }`
**Response** `201`: Full color object

### PATCH /variety-colors/{id}

Update a color entry.

**Request Body**: Partial (color_name)
**Response** `200`: Updated color object

### POST /variety-colors/{id}/archive

Soft-delete a color entry.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": false } }`

### POST /variety-colors/{id}/restore

Restore a color entry.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": true } }`
