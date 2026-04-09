# Quickstart: Order Management

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (for local PostgreSQL)
- A Neon account (free tier) for production DB

## Backend Setup (apps/api)

```bash
cd apps/api

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy environment config
cp .env.example .env
# Edit .env with your DATABASE_URL (local Docker or Neon)

# Start local PostgreSQL
docker-compose up -d

# Run migrations
aerich init -t app.config.TORTOISE_ORM
aerich init-db

# Seed reference data from CSVs
python -m app.seed --varieties ../../References/Varieties\ -\ Varieties.csv
python -m app.seed --pricing ../../References/New\ Customer\ Prices\ -\ PriceData.csv
python -m app.seed --colors ../../References/Varieties\ -\ Color\ by\ Variety.csv

# Run the API server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest
```

## Frontend Setup (apps/web)

```bash
cd apps/web

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with VITE_API_URL=http://localhost:8000

# Start dev server
npm run dev

# Run tests
npm test
```

## Verify Setup

1. **Health check**: `curl http://localhost:8000/api/v1/health`
   - Expected: `{"data":{"status":"healthy","database":"connected"}}`

2. **Check customers loaded**: `curl http://localhost:8000/api/v1/customers`
   - Expected: list of customers from PriceData CSV

3. **Check products loaded**: `curl http://localhost:8000/api/v1/products`
   - Expected: product catalog with varieties and sales items

4. **Open frontend**: `http://localhost:5173`
   - Expected: Order entry form with customer selector and product list

## Environment Variables

### Backend (apps/api/.env)

```env
DATABASE_URL=postgres://user:pass@localhost:5432/fullbloom
# For Neon: postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/fullbloom?sslmode=require
ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

### Frontend (apps/web/.env)

```env
VITE_API_URL=http://localhost:8000
```

## Docker (local development)

```bash
# Start everything (API + PostgreSQL)
cd apps/api
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop
docker-compose down
```
