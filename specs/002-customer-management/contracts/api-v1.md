# API Contract: Customer Management v1

Base path: `/api/v1`

## Endpoints

### GET /customers

List customers with optional filters.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `active` | bool | `true` | Filter by active status. `true` = active only, `false` = archived only, omit for all. |

**Response** `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "customer_number": 260,
      "name": "Baisch & Skinner",
      "salesperson": "JR",
      "contact_name": "Ashley",
      "default_ship_via": "SW - STL",
      "phone": "314-664-1212",
      "location": "St Louis, MO",
      "payment_terms": "30 days",
      "email": null,
      "notes": "All locations under this item #",
      "price_type": "Retail",
      "is_active": true
    }
  ]
}
```

### GET /customers/{id}

Get a single customer with stores.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "customer_number": 260,
    "name": "Baisch & Skinner",
    "salesperson": "JR",
    "contact_name": "Ashley",
    "default_ship_via": "SW - STL",
    "phone": "314-664-1212",
    "location": "St Louis, MO",
    "payment_terms": "30 days",
    "email": null,
    "notes": "All locations under this item #",
    "price_type": "Retail",
    "is_active": true,
    "stores": [
      { "id": "uuid", "name": "Main" }
    ]
  }
}
```

**Response** `404`: `{ "error": "Customer not found" }`

### GET /customers/next-number

Get the next suggested customer number.

**Response** `200`:
```json
{
  "data": {
    "next_number": 2620
  }
}
```

### POST /customers

Create a new customer.

**Request Body**:
```json
{
  "customer_number": 2620,
  "name": "New Customer",
  "salesperson": "JR",
  "contact_name": "John",
  "default_ship_via": "Pick Up",
  "phone": "503-555-0100",
  "location": "Portland, OR",
  "payment_terms": "30 days",
  "email": "john@example.com",
  "notes": null
}
```

Required fields: `customer_number`, `name`. All others optional/nullable.

**Response** `201`:
```json
{
  "data": {
    "id": "uuid",
    "customer_number": 2620,
    "name": "New Customer",
    ...
  }
}
```

**Response** `422`: `{ "error": "Customer number 2620 already exists" }`

### PATCH /customers/{id}

Update a customer's fields. Only include fields to change.

**Request Body**:
```json
{
  "name": "Updated Name",
  "salesperson": "TM"
}
```

`customer_number` is NOT accepted in PATCH — it's immutable after creation.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "customer_number": 260,
    "name": "Updated Name",
    ...
  }
}
```

**Response** `404`: `{ "error": "Customer not found" }`
**Response** `422`: `{ "error": "Name cannot be empty" }`

### POST /customers/{id}/archive

Soft-delete (archive) a customer by setting `is_active = false`.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "is_active": false
  }
}
```

**Response** `404`: `{ "error": "Customer not found" }`

### POST /customers/{id}/restore

Restore an archived customer by setting `is_active = true`.

**Response** `200`:
```json
{
  "data": {
    "id": "uuid",
    "is_active": true
  }
}
```

**Response** `404`: `{ "error": "Customer not found" }`

### GET /customers/dropdown-options

Get distinct values for dropdown fields (used to populate Salesperson, Ship Via, Terms selects).

**Response** `200`:
```json
{
  "data": {
    "salesperson": ["JR", "TM", "MM", "JEN"],
    "default_ship_via": ["Pick Up", "SW", "Prime", "Delta", "Fed Ex", ...],
    "payment_terms": ["30 days", "Pay Per P/S", "15 days", "10 Days", ...]
  }
}
```
