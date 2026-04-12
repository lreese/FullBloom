# API Contract: Inventory Management v1

Base path: `/api/v1`

---

## Daily Count Endpoints

### GET /counts

List daily counts for a product type on a date.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | Filter by product type |
| `count_date` | string (YYYY-MM-DD) | today | Date to retrieve counts for |

**Response** `200`:
```json
{
  "data": {
    "count_date": "2026-04-15",
    "product_type_id": "uuid",
    "product_type_name": "Lilies",
    "sheet_complete": false,
    "completed_by": null,
    "completed_at": null,
    "product_lines": [
      {
        "product_line_id": "uuid",
        "product_line_name": "Orientals",
        "varieties": [
          {
            "variety_id": "uuid",
            "variety_name": "Santander",
            "count_value": 69,
            "is_done": true,
            "entered_by": "Tyler",
            "updated_at": "2026-04-15T10:30:00Z"
          }
        ]
      }
    ]
  }
}
```

### PUT /counts

Save or update daily counts for a product type on a date. Accepts a batch of variety counts.

**Request Body**:
```json
{
  "product_type_id": "uuid",
  "count_date": "2026-04-15",
  "entered_by": "Tyler",
  "counts": [
    { "variety_id": "uuid", "count_value": 69, "is_done": true },
    { "variety_id": "uuid", "count_value": 0, "is_done": true },
    { "variety_id": "uuid", "count_value": null, "is_done": false }
  ]
}
```

**Response** `200`: `{ "data": { "saved_count": 3 } }`

### GET /counts/recent/{variety_id}

Get last 5 counts for a variety (for sanity check warnings).

**Response** `200`:
```json
{
  "data": [
    { "count_date": "2026-04-14", "count_value": 65 },
    { "count_date": "2026-04-11", "count_value": 70 }
  ]
}
```

---

## Customer Count Endpoints

### GET /customer-counts

List customer counts for a product type on a date.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | Filter by product type |
| `count_date` | string (YYYY-MM-DD) | today | Date to retrieve counts for |

**Response** `200`:
```json
{
  "data": {
    "count_date": "2026-04-15",
    "product_type_id": "uuid",
    "product_type_name": "Lilies",
    "sheet_complete": false,
    "template_columns": [
      { "customer_id": "uuid", "customer_name": "HFM Trader Joe", "bunch_size": 5, "sleeve_type": "Paper" },
      { "customer_id": "uuid", "customer_name": "SAFEWAY", "bunch_size": 3, "sleeve_type": "Plastic" }
    ],
    "product_lines": [
      {
        "product_line_id": "uuid",
        "product_line_name": "Orientals",
        "varieties": [
          {
            "variety_id": "uuid",
            "variety_name": "Santander",
            "is_done": true,
            "counts": {
              "uuid-customer|3|Plastic": 100,
              "uuid-customer|5|Paper": null
            }
          }
        ],
        "totals": {
          "total_5_stem": 0,
          "total_3_stem": 60,
          "total_2_stem": 0,
          "total_1_stem": 0
        }
      }
    ],
    "grand_totals": {
      "total_5_stem": 199,
      "total_3_stem": 448,
      "total_2_stem": 0,
      "total_1_stem": 0,
      "total_customer_bunched": 647,
      "total_remaining": 33,
      "total_all_bunched": 680
    }
  }
}
```

### PUT /customer-counts

Save or update customer counts for a product type on a date.

**Request Body**:
```json
{
  "product_type_id": "uuid",
  "count_date": "2026-04-15",
  "entered_by": "Tyler",
  "counts": [
    {
      "variety_id": "uuid",
      "customer_id": "uuid",
      "bunch_size": 3,
      "sleeve_type": "Plastic",
      "bunch_count": 100,
      "is_done": true
    }
  ]
}
```

**Response** `200`: `{ "data": { "saved_count": 15 } }`

---

## Estimate Endpoints

### GET /estimates

List estimates for a product type for a week.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | Filter by product type |
| `week_start` | string (YYYY-MM-DD) | current week's Monday | Monday of the week |

**Response** `200`:
```json
{
  "data": {
    "week_start": "2026-04-06",
    "product_type_id": "uuid",
    "product_type_name": "Lilies",
    "sheet_complete": false,
    "pull_days": ["2026-04-06", "2026-04-08", "2026-04-10"],
    "last_week_actuals": {
      "uuid-variety": { "2026-03-30": 50, "2026-04-01": 45, "2026-04-03": 40 }
    },
    "product_lines": [
      {
        "product_line_id": "uuid",
        "product_line_name": "Orientals",
        "varieties": [
          {
            "variety_id": "uuid",
            "variety_name": "Helvetia",
            "estimates": {
              "2026-04-06": 300,
              "2026-04-08": 150,
              "2026-04-10": 300
            },
            "is_done": true
          }
        ]
      }
    ]
  }
}
```

### PUT /estimates

Save or update estimates for a week.

**Request Body**:
```json
{
  "product_type_id": "uuid",
  "week_start": "2026-04-06",
  "entered_by": "Tyler",
  "estimates": [
    {
      "variety_id": "uuid",
      "pull_day": "2026-04-06",
      "estimate_value": 300,
      "is_done": true
    }
  ]
}
```

**Response** `200`: `{ "data": { "saved_count": 45 } }`

---

## Comparison Endpoint

### GET /counts/comparison

Get estimate vs. actual comparison for a week.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | |
| `week_start` | string (YYYY-MM-DD) | required | Monday of the week |

**Response** `200`:
```json
{
  "data": {
    "week_start": "2026-04-06",
    "pull_days": ["2026-04-06", "2026-04-08", "2026-04-10"],
    "product_lines": [
      {
        "product_line_name": "Orientals",
        "varieties": [
          {
            "variety_name": "Helvetia",
            "days": {
              "2026-04-06": { "estimate": 300, "actual": 280, "variance": -20 },
              "2026-04-08": { "estimate": 150, "actual": null, "variance": null }
            }
          }
        ]
      }
    ],
    "summary": {
      "total_estimated": 1500,
      "total_actual": 1200,
      "variance_pct": -20.0
    }
  }
}
```

---

## Availability Endpoint (Sales View)

### GET /availability

Read-only view of current availability for sales.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | today | Date to check |

**Response** `200`:
```json
{
  "data": {
    "date": "2026-04-15",
    "product_types": [
      {
        "product_type_id": "uuid",
        "product_type_name": "Lilies",
        "data_source": "actual_counts",
        "counts_completed_at": "2026-04-15T10:30:00Z",
        "counts_completed_by": "Tyler",
        "product_lines": [
          {
            "product_line_name": "Orientals",
            "varieties": [
              {
                "variety_name": "Santander",
                "remaining_count": 69,
                "estimate": 75
              }
            ]
          }
        ]
      }
    ]
  }
}
```

`data_source`: `"actual_counts"` | `"estimates_only"` — tells sales whether they're looking at real counts or just estimates.

---

## Sheet Completion Endpoints

### POST /sheets/complete

Mark a sheet as complete. Requires all per-variety `is_done` flags to be true.

**Request Body**:
```json
{
  "product_type_id": "uuid",
  "sheet_type": "daily_count",
  "sheet_date": "2026-04-15",
  "completed_by": "Tyler"
}
```

**Response** `200`:
```json
{
  "data": {
    "is_complete": true,
    "completed_by": "Tyler",
    "completed_at": "2026-04-15T10:30:00Z"
  }
}
```

**Response** `422`: `{ "error": "Cannot complete sheet: 5 varieties not marked as done" }`

### POST /sheets/uncomplete

Reopen a completed sheet (e.g., lead needs to make corrections).

**Request Body**: Same as complete.
**Response** `200`: `{ "data": { "is_complete": false } }`

---

## Harvest Status Endpoints

### GET /varieties/harvest-status

Get harvest status for all active varieties of a product type.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | Filter by product type |

**Response** `200`:
```json
{
  "data": [
    {
      "variety_id": "uuid",
      "variety_name": "Santander",
      "product_line_name": "Orientals",
      "in_harvest": true,
      "stems_per_bunch": 10
    }
  ]
}
```

### PATCH /varieties/harvest-status/bulk

Bulk toggle harvest status.

**Request Body**:
```json
{
  "updates": [
    { "variety_id": "uuid", "in_harvest": false },
    { "variety_id": "uuid", "in_harvest": true }
  ]
}
```

**Response** `200`: `{ "data": { "updated_count": 2 } }`

---

## Count Sheet Template Endpoints

### GET /count-sheet-templates/{product_type_id}

Get the column configuration for a product type's customer count sheet.

**Response** `200`:
```json
{
  "data": {
    "product_type_id": "uuid",
    "columns": [
      { "customer_id": "uuid", "customer_name": "HFM Trader Joe", "bunch_size": 5, "sleeve_type": "Paper" },
      { "customer_id": "uuid", "customer_name": "SAFEWAY", "bunch_size": 3, "sleeve_type": "Plastic" }
    ]
  }
}
```

### PUT /count-sheet-templates/{product_type_id}

Save or update the column configuration.

**Request Body**:
```json
{
  "columns": [
    { "customer_id": "uuid", "bunch_size": 5, "sleeve_type": "Paper" },
    { "customer_id": "uuid", "bunch_size": 3, "sleeve_type": "Plastic" }
  ]
}
```

**Response** `200`: Full template object with customer names resolved.

---

## Pull Day Schedule Endpoints

### GET /pull-day-schedules

Get the pull day schedule for a week (falls back to default if no override).

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `week_start` | string (YYYY-MM-DD) | current week | Monday of the week |

**Response** `200`:
```json
{
  "data": {
    "week_start": "2026-04-06",
    "pull_days": [1, 3, 5],
    "pull_dates": ["2026-04-06", "2026-04-08", "2026-04-10"],
    "is_default": true
  }
}
```

### PUT /pull-day-schedules

Set pull days for a specific week (or update default).

**Request Body**:
```json
{
  "week_start": "2026-04-06",
  "pull_days": [1, 3]
}
```

`week_start: null` updates the default schedule.

**Response** `200`: Full schedule object.

---

## Print Endpoints

### GET /print/count-sheet

Generate a print-optimized blank count sheet.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `product_type_id` | UUID | required | |
| `sheet_type` | string | required | "daily_count", "customer_count", or "estimate" |
| `date` | string (YYYY-MM-DD) | today | For estimates, the week_start date |

**Response** `200`: HTML page optimized for print (CSS `@media print`), filtered to in-harvest varieties with correct groupings and column headers.
