# API Contract: Price Management v1

Base path: `/api/v1`

## Price List Endpoints

### GET /price-lists

List all price lists.

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
      "name": "Wholesale High",
      "is_active": true,
      "customer_count": 42
    }
  ]
}
```

### POST /price-lists

Create a new price list. Pre-populates PriceListItems from a source.

**Request Body**:
```json
{
  "name": "Wholesale Medium",
  "copy_from": "uuid or null"
}
```

`copy_from`: UUID of an existing price list to copy prices from. If null, copies from retail (SalesItem.retail_price).

**Response** `201`: Full price list object with `customer_count: 0`
**Response** `422`: `{ "error": "Price list 'Wholesale Medium' already exists" }`

### PATCH /price-lists/{id}

Rename a price list.

**Request Body**: `{ "name": "New Name" }`
**Response** `200`: Updated price list object

### POST /price-lists/{id}/archive

Archive a price list. Converts customer prices to overrides.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "is_active": false,
    "customers_converted": 12
  }
}
```

### POST /price-lists/{id}/restore

Restore an archived price list.

**Response** `200`: `{ "data": { "id": "uuid", "is_active": true } }`

---

## Price List Matrix Endpoints

### GET /price-lists/matrix

Get the full price matrix: all sales items × all active price lists.

**Response** `200`:
```json
{
  "data": {
    "price_lists": [
      { "id": "uuid", "name": "Wholesale High" },
      { "id": "uuid", "name": "Wholesale Low" }
    ],
    "items": [
      {
        "sales_item_id": "uuid",
        "sales_item_name": "Tulips Standard x10",
        "variety_name": "Standard Tulips",
        "stems_per_order": 10,
        "retail_price": "0.70",
        "prices": {
          "uuid-wholesale-high": "0.60",
          "uuid-wholesale-low": "0.55"
        }
      }
    ]
  }
}
```

### PATCH /price-list-items/{price_list_id}/{sales_item_id}

Update a single cell in the matrix.

**Request Body**: `{ "price": "0.55" }`
**Response** `200`: `{ "data": { "price_list_id": "uuid", "sales_item_id": "uuid", "price": "0.55" } }`

### PATCH /price-list-items/bulk

Bulk set a price for multiple sales items on a price list.

**Request Body**:
```json
{
  "price_list_id": "uuid",
  "sales_item_ids": ["uuid1", "uuid2"],
  "price": "0.50"
}
```

**Response** `200`: `{ "data": { "updated_count": 2 } }`

### PATCH /price-lists/matrix/retail

Update the retail price for a sales item (edits SalesItem.retail_price directly).

**Request Body**: `{ "sales_item_id": "uuid", "price": "0.75" }`
**Response** `200`: `{ "data": { "sales_item_id": "uuid", "retail_price": "0.75" } }`

---

## Customer Price Endpoints

### GET /customers/{customer_id}/pricing

Get a customer's complete pricing grid with effective prices.

**Response** `200`:
```json
{
  "data": {
    "customer": {
      "id": "uuid",
      "name": "Baisch & Skinner",
      "price_list_id": "uuid",
      "price_list_name": "Wholesale High"
    },
    "items": [
      {
        "sales_item_id": "uuid",
        "sales_item_name": "Tulips Standard x10",
        "variety_name": "Standard Tulips",
        "stems_per_order": 10,
        "retail_price": "0.70",
        "price_list_price": "0.60",
        "customer_override": "0.55",
        "effective_price": "0.55",
        "source": "override",
        "anomaly": false
      }
    ],
    "summary": {
      "total_items": 120,
      "override_count": 15,
      "override_percentage": 12.5
    }
  }
}
```

`source`: "override" | "price_list" | "retail"
`anomaly`: true if effective price differs >20% from price_list_price

### GET /sales-items/{sales_item_id}/customer-pricing

Get all customers' pricing for a single sales item (item-centric view).

**Response** `200`:
```json
{
  "data": {
    "sales_item": {
      "id": "uuid",
      "name": "Tulips Standard x10",
      "retail_price": "0.70"
    },
    "customers": [
      {
        "customer_id": "uuid",
        "customer_name": "Baisch & Skinner",
        "price_list_name": "Wholesale High",
        "price_list_price": "0.60",
        "customer_override": "0.55",
        "effective_price": "0.55",
        "source": "override",
        "anomaly": false
      }
    ]
  }
}
```

### POST /customers/{customer_id}/prices

Set a customer price override.

**Request Body**: `{ "sales_item_id": "uuid", "price": "0.55" }`
**Response** `201`: `{ "data": { "customer_id": "uuid", "sales_item_id": "uuid", "price": "0.55" } }`
**Response** `200` (if updating existing): Same shape

### DELETE /customers/{customer_id}/prices/{sales_item_id}

Remove a customer price override.

**Response** `204`

### POST /customers/{customer_id}/prices/bulk

Bulk customer price operations.

**Request Body**:
```json
{
  "action": "set_price",
  "sales_item_ids": ["uuid1", "uuid2"],
  "price": "0.50"
}
```

Actions: `set_price` (set custom price), `remove_overrides` (delete overrides), `reset_to_list` (set override = price list price, making it explicit)

**Response** `200`: `{ "data": { "affected_count": 5 } }`

---

## Sales Item Extensions

### GET /sales-items (extended response)

The existing sales items list endpoint returns additional price list columns.

**Extended fields per sales item**:
```json
{
  "price_list_prices": {
    "uuid-wholesale-high": "0.60",
    "uuid-wholesale-low": "0.55"
  },
  "customer_prices_count": 42,
  "cost_price": "0.30",
  "margin": "0.40"
}
```

---

## Price Change Impact Preview

### GET /price-list-items/{price_list_id}/{sales_item_id}/impact

Preview the impact of changing a price list item price.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `new_price` | string | The proposed new price |

**Response** `200`:
```json
{
  "data": {
    "customers_on_list": 42,
    "customers_with_overrides": 5,
    "customers_affected": 37,
    "current_price": "0.60",
    "new_price": "0.55"
  }
}
```

---

## Export Endpoints

### GET /customers/{customer_id}/pricing/export

Export a customer's pricing grid as CSV.

**Response** `200`: CSV file download (Content-Type: text/csv)

Columns: Sales Item, Variety, Stems, Price List Price, Customer Override, Effective Price

### GET /price-lists/matrix/export

Export the price list matrix as CSV.

**Response** `200`: CSV file download

Columns: Sales Item, Variety, Stems, Retail, [one column per price list]

---

## Import Endpoints

### POST /price-lists/{id}/import

Import prices for a price list from CSV. Matches by sales item name.

**Request**: Multipart file upload (CSV with columns: Sales Item, Price)
**Response** `200`: `{ "data": { "updated_count": 85, "not_found_count": 3 } }`

### POST /customers/{customer_id}/prices/import

Import customer price overrides from CSV.

**Request**: Multipart file upload (CSV with columns: Sales Item, Price)
**Response** `200`: `{ "data": { "created_count": 10, "updated_count": 5, "not_found_count": 2 } }`
