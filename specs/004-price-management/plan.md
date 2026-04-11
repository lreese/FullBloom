# Implementation Plan: Price Management

**Branch**: `004-price-management` | **Date**: 2026-04-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-price-management/spec.md`

## Summary

Build a price management section with three sub-pages: Sales Items (CRUD with price list columns), Price Lists (matrix view with inline editing), and Customer Prices (customer-centric and item-centric views with override management). New PriceList and PriceListItem models. Customer.price_type replaced by price_list_id FK. Pricing analytics integrated into views. Sidebar dropdown under Pricing.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend)
**Storage**: PostgreSQL (local dev), Neon (production)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (monorepo: `apps/api` + `apps/web`)
**Performance Goals**: Page load < 2s, matrix with ~120 rows × 5 columns renders < 2s
**Constraints**: Single-user system, no auth, ~120 sales items, ~5 price lists, ~10k customer prices
**Scale/Scope**: 3 new pages, 2 new models, 1 model migration, price list matrix (custom component), analytics badges

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Frontend: React + Vite + Tailwind + shadcn/ui | PASS | Using existing stack + reusable DataTable |
| Backend: FastAPI + Tortoise ORM + Aerich | PASS | Using existing stack |
| Database: PostgreSQL | PASS | Using existing stack |
| Color palette: Slate + Rose | PASS | Reusing existing patterns |
| App shell: collapsible sidebar | PASS | Extending sidebar with Pricing dropdown |
| API conventions: REST, `/api/v1/`, envelope | PASS | New routers follow convention |
| DB naming: snake_case, `is_` booleans | PASS | `price_list_id` FK follows convention |
| Dependencies: justified | PASS | No new dependencies |
| Migrations: aerich-generated | PASS | Per constitution v1.3.0 |
| Error handling: `{"error": ...}` | PASS | Global exception handler already in place |

## Project Structure

### Documentation (this feature)

```text
specs/004-price-management/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-v1.md
└── tasks.md             # Created by /speckit.tasks
```

### Source Code

```text
apps/api/
├── app/
│   ├── models/
│   │   ├── pricing.py        # Add PriceList, PriceListItem; keep CustomerPrice
│   │   └── customer.py       # Replace price_type with price_list_id FK
│   ├── routers/
│   │   ├── pricing.py        # Rewrite: customer pricing endpoints
│   │   ├── price_lists.py    # New: price list CRUD + matrix data
│   │   └── sales_items.py    # Extend: add price list columns to responses
│   ├── schemas/
│   │   ├── pricing.py        # New: price list, price list item, customer price schemas
│   │   └── sales_item.py     # Extend: add price list prices to responses
│   └── services/
│       └── pricing_service.py  # New: effective price resolution, analytics, bulk ops
├── migrations/
│   └── models/               # Aerich migrations for new tables + price_list_id FK
└── tests/

apps/web/
└── src/
    ├── components/
    │   ├── pricing/
    │   │   ├── SalesItemTable.tsx         # Sales items with price list columns
    │   │   ├── SalesItemDrawer.tsx        # Edit drawer with price list section
    │   │   ├── PriceListMatrix.tsx        # Custom matrix grid with inline editing
    │   │   ├── CustomerPriceGrid.tsx      # Customer-centric pricing grid
    │   │   ├── ItemPriceGrid.tsx          # Item-centric pricing grid (all customers)
    │   │   ├── PricingSummaryBar.tsx      # Analytics summary (overrides count, %)
    │   │   └── PriceAnomalyBadge.tsx      # Warning badge for >20% variance
    │   └── layout/
    │       └── Sidebar.tsx               # Add Pricing dropdown
    ├── pages/
    │   ├── SalesItemsPage.tsx
    │   ├── PriceListsPage.tsx
    │   └── CustomerPricesPage.tsx
    ├── services/
    │   └── api.ts
    └── types/
        └── index.ts
```

## Complexity Tracking

No constitution violations. All gates pass.
