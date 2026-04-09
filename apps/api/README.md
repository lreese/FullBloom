# FullBloom API

FastAPI backend for the FullBloom flower farm CRM.

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e ".[dev]"

# Copy env config
cp .env.example .env
# Edit .env with your DATABASE_URL

# Start local PostgreSQL
docker-compose up -d db

# Run migrations
aerich init -t app.config.TORTOISE_ORM
aerich init-db

# Start the API
uvicorn app.main:app --reload --port 8000
```

## Seed Reference Data

```bash
python -m app.seed --varieties ../../References/Varieties\ -\ Varieties.csv
python -m app.seed --pricing ../../References/New\ Customer\ Prices\ -\ PriceData.csv
python -m app.seed --colors ../../References/Varieties\ -\ Color\ by\ Variety.csv
```

## Run Tests

```bash
pytest
```

## API Health Check

```bash
curl http://localhost:8000/api/v1/health
```
