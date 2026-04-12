# Quickstart: Inventory Management

## Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`
- Running PostgreSQL (local via Docker)
- Existing FullBloom API and web app set up (see `apps/api/README.md` and `apps/web/README.md`)
- 004-price-management merged (all existing models, routers, shadcn components available)

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate

# Run migrations (adds in_harvest + stems_per_bunch to varieties, creates inventory tables)
aerich upgrade

# Seed default pull day schedule
python -c "from app.seed import seed_pull_days; import asyncio; asyncio.run(seed_pull_days())"

# Start the API
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd apps/web
npm install   # if any new deps
npm run dev
```

## Verify

1. Open `http://localhost:5173` in your browser
2. Click "Inventory" in the sidebar — should expand to show Counts, Estimates, Availability
3. Navigate to Counts — select a product type and date, see the variety list
4. Enter some count values, mark varieties as done, save
5. Navigate to Estimates — select a week, see varieties with pull-day columns
6. Navigate to Availability — see the read-only sales view with data source indicators

## Key API Endpoints

```bash
# List daily counts for Lilies today
curl "http://localhost:8000/api/v1/counts?product_type_id={id}"

# Save daily counts
curl -X PUT http://localhost:8000/api/v1/counts \
  -H "Content-Type: application/json" \
  -d '{"product_type_id": "id", "count_date": "2026-04-15", "entered_by": "Tyler", "counts": [{"variety_id": "id", "count_value": 69, "is_done": true}]}'

# List customer counts
curl "http://localhost:8000/api/v1/customer-counts?product_type_id={id}&count_date=2026-04-15"

# List estimates for current week
curl "http://localhost:8000/api/v1/estimates?product_type_id={id}"

# Get availability (sales view)
curl "http://localhost:8000/api/v1/availability"

# Get harvest status for a product type
curl "http://localhost:8000/api/v1/varieties/harvest-status?product_type_id={id}"

# Toggle harvest status
curl -X PATCH http://localhost:8000/api/v1/varieties/harvest-status/bulk \
  -H "Content-Type: application/json" \
  -d '{"updates": [{"variety_id": "id", "in_harvest": false}]}'

# Get count sheet template
curl "http://localhost:8000/api/v1/count-sheet-templates/{product_type_id}"

# Print blank count sheet
curl "http://localhost:8000/api/v1/print/count-sheet?product_type_id={id}&sheet_type=daily_count"
```

## New Sidebar Navigation

```
Inventory
├── Counts          → /inventory/counts
├── Estimates       → /inventory/estimates
├── Availability    → /inventory/availability
└── Harvest Status  → /inventory/harvest-status
```

Configuration pages (Count Sheet Templates, Pull Day Schedules) are accessible from within the Counts and Estimates pages respectively, or from a Settings section.
