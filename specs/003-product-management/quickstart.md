# Quickstart: Product Management

## Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`
- Running PostgreSQL (local via Docker)
- Existing FullBloom API and web app set up (see `apps/api/README.md` and `apps/web/README.md`)
- 002-customer-management merged (react-router-dom, shadcn Popover/Checkbox already installed)

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate

# Run migrations (adds is_active to varieties, sales_items, product_lines, variety_colors)
aerich upgrade

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
2. Click "Products" in the sidebar — should expand to show Varieties, Product Lines, Colors
3. Click Varieties — see the variety table with filters and bulk select
4. Click a variety row — drawer opens with fields and sales items section
5. Navigate to Product Lines and Colors via the sidebar dropdown

## Key API Endpoints

```bash
# List active varieties
curl http://localhost:8000/api/v1/varieties

# List archived varieties
curl "http://localhost:8000/api/v1/varieties?active=false"

# Get variety with sales items
curl http://localhost:8000/api/v1/varieties/{id}

# Get dropdown options
curl http://localhost:8000/api/v1/varieties/dropdown-options

# Bulk update (set show=false on 3 varieties)
curl -X PATCH http://localhost:8000/api/v1/varieties/bulk \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"], "field": "show", "value": false}'

# List product lines
curl http://localhost:8000/api/v1/product-lines

# List variety colors
curl http://localhost:8000/api/v1/variety-colors

# Sales items for a variety
curl http://localhost:8000/api/v1/varieties/{id}/sales-items
```
