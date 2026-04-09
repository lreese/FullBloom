# Quickstart: Customer Management

## Prerequisites

- Python 3.11+ with `pip`
- Node.js 18+ with `npm`
- Running PostgreSQL (Neon or local via Docker)
- Existing FullBloom API and web app set up (see `apps/api/README.md` and `apps/web/README.md`)

## Backend Setup

```bash
cd apps/api

# Activate virtual environment
source .venv/bin/activate

# Run migrations (adds new customer fields)
aerich upgrade

# Start the API
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd apps/web

# Install dependencies (if new ones added)
npm install

# Start dev server
npm run dev
```

## Verify

1. Open `http://localhost:5173` in your browser
2. Click "Customers" in the sidebar
3. You should see the customer table with all columns
4. Click a row to open the edit drawer
5. Try the column filters on Name, Salesperson, Ship Via, Terms, Location

## Key API Endpoints

```bash
# List active customers
curl http://localhost:8000/api/v1/customers

# List archived customers
curl http://localhost:8000/api/v1/customers?active=false

# Get next available customer number
curl http://localhost:8000/api/v1/customers/next-number

# Get dropdown options
curl http://localhost:8000/api/v1/customers/dropdown-options

# Create a customer
curl -X POST http://localhost:8000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"customer_number": 9999, "name": "Test Customer"}'

# Update a customer
curl -X PATCH http://localhost:8000/api/v1/customers/{id} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Archive a customer
curl -X POST http://localhost:8000/api/v1/customers/{id}/archive

# Restore a customer
curl -X POST http://localhost:8000/api/v1/customers/{id}/restore
```

## Import Customer Info Data

The customer info CSV (`References/Customer Info - Customer Info.csv`) populates the new fields. This will be handled by extending the existing import service — run the import from the Import tab once the feature is complete.
