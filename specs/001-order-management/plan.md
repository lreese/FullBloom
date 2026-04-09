# Implementation Plan: Order Management

**Branch**: `001-order-management` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-order-management/spec.md`

## Summary

Build the core order entry and storage system for FullBloom, replacing Oregon Flowers' Google Sheets + Apps Script workflow. The system consists of a FastAPI backend with PostgreSQL (Neon) for order persistence and reference data, and a React frontend for order entry. Reference data (product catalog, customer pricing, variety colors) is seeded via CSV import. Salespeople create orders through a form modeled after the existing Google Sheets "Add Order" tab — product list with pricing on the left, order-level fields on the right.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui (frontend)
**Storage**: PostgreSQL via Neon (serverless, free tier)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web — single DigitalOcean Droplet (Caddy + FastAPI + Celery + Redis)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Customer pricing loads <1s; order submission <2s; CSV import handles ~1MB without timeout
**Constraints**: Single user scale; 2GB RAM Droplet preferred (vertically scalable); no SLA
**Scale/Scope**: Single user (solo operator initially), ~200 customers, ~500 varieties, ~50K price entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First (NON-NEGOTIABLE) | PASS | Spec exists at `specs/001-order-management/spec.md`, status Draft, clarifications complete |
| II. Simplicity Over Cleverness | PASS | No premature abstractions planned; direct CRUD with Tortoise ORM |
| III. Multi-Agent Architecture | N/A | No AI features in this spec; model abstraction not triggered |
| IV. App Isolation | PASS | Backend in `apps/api/`, frontend in `apps/web/`, shared DB types in `packages/db/` |
| V. Deep Observability | DEFERRED | OTEL tracing, `/health` endpoint required by constitution. Will add `/health` endpoint. Full OTEL instrumentation deferred to infra spec — acceptable for first feature. |
| Frontend stack | PASS | TypeScript, React, Vite, Vitest, Tailwind, shadcn/ui — all constitution-compliant |
| Backend stack | PASS | Python, FastAPI, pytest, PostgreSQL, Tortoise ORM, Aerich — all constitution-compliant |
| Auth (Clerk) | N/A | Auth out of scope per spec assumptions; salesperson email is a stored field |
| API Conventions | PASS | REST, `/api/v1/`, plural nouns, consistent envelope `{ "data": ... }` / `{ "error": "..." }` |
| Secrets | PASS | `.env.example` with placeholders; `.env` gitignored; DATABASE_URL via env var |
| Error Handling | PASS | structlog for structured JSON logging; `500` errors logged server-side only |
| Code Style | PASS | Ruff (Python), Prettier (TypeScript), strict tsconfig |

## Project Structure

### Documentation (this feature)

```text
specs/001-order-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-v1.md        # REST API contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/
├── api/                         # FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app entry, CORS, middleware
│   │   ├── config.py            # Settings from env vars
│   │   ├── models/              # Tortoise ORM models
│   │   │   ├── customer.py      # Customer, Store
│   │   │   ├── product.py       # ProductType, ProductLine, Variety, SalesItem
│   │   │   ├── pricing.py       # CustomerPrice (per-customer per-item)
│   │   │   └── order.py         # Order, OrderLine
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   │   ├── customer.py
│   │   │   ├── product.py
│   │   │   ├── pricing.py
│   │   │   └── order.py
│   │   ├── routers/             # API route handlers
│   │   │   ├── customers.py
│   │   │   ├── products.py
│   │   │   ├── pricing.py
│   │   │   ├── orders.py
│   │   │   └── import_data.py   # CSV import endpoints
│   │   ├── services/            # Business logic
│   │   │   ├── order_service.py
│   │   │   ├── pricing_service.py
│   │   │   └── import_service.py
│   │   └── utils/
│   │       └── csv_parser.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_orders.py
│   │   ├── test_pricing.py
│   │   └── test_import.py
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md
│
└── web/                         # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── ui/              # shadcn/ui components
    │   │   ├── order/           # Order entry form components
    │   │   │   ├── OrderForm.tsx
    │   │   │   ├── LineItemTable.tsx
    │   │   │   ├── ProductLookup.tsx
    │   │   │   ├── OrderLevelFields.tsx
    │   │   │   └── PackingFields.tsx
    │   │   └── common/
    │   │       └── Tooltip.tsx
    │   ├── services/
    │   │   └── api.ts           # API client
    │   ├── types/
    │   │   └── index.ts         # Shared TypeScript types
    │   ├── App.tsx
    │   └── main.tsx
    ├── tests/
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── prettier.config.mjs
    ├── .env.example
    └── README.md
```

**Structure Decision**: Web application pattern per constitution (App Isolation principle). Backend in `apps/api/`, frontend in `apps/web/`. No shared packages needed for this first feature — TypeScript types are frontend-only, ORM models are backend-only. `packages/db/` (Prisma) from the constitution is not used here because the constitution specifies Tortoise ORM for Python backends; Prisma is referenced for Node.js apps. If a Node.js backend is added later, Prisma would go in `packages/db/`.

## Complexity Tracking

> No Constitution Check violations requiring justification.
