# Quickstart: Price Management

## Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`
- Running PostgreSQL (local via Docker)
- Existing FullBloom API and web app set up
- 002-customer-management and 003-product-management merged

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate

# Run migrations (creates price_lists, price_list_items tables; migrates customer.price_type → price_list_id)
aerich upgrade

# Start the API
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd apps/web
npm install
npm run dev
```

## Verify

1. Open `http://localhost:5173`
2. Click "Pricing" in the sidebar — should expand to show Sales Items, Price Lists, Customer Prices
3. Click Sales Items — see the table with retail price + price list columns
4. Click Price Lists — see the matrix with inline-editable cells
5. Click Customer Prices — select a customer, see their pricing grid with overrides highlighted

## Key API Endpoints

```bash
# Price Lists
curl http://localhost:8000/api/v1/price-lists
curl http://localhost:8000/api/v1/price-lists/matrix

# Customer Pricing (customer-centric)
curl http://localhost:8000/api/v1/customers/{id}/pricing

# Customer Pricing (item-centric)
curl http://localhost:8000/api/v1/sales-items/{id}/customer-pricing

# Set customer price override
curl -X POST http://localhost:8000/api/v1/customers/{id}/prices \
  -H "Content-Type: application/json" \
  -d '{"sales_item_id": "uuid", "price": "0.55"}'

# Update a matrix cell
curl -X PATCH http://localhost:8000/api/v1/price-list-items/{price_list_id}/{sales_item_id} \
  -H "Content-Type: application/json" \
  -d '{"price": "0.55"}'
```

## Seed Data

Price lists are auto-seeded from existing `Customer.price_type` values during migration. Price list items need to be imported from the Price Lists CSV:

```bash
curl -X POST http://localhost:8000/api/v1/import/price-lists \
  -F "file=@References/Price Lists.csv"
```
