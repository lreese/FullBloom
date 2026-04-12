# Implementation Plan: Order Management Improvements

**Branch**: `006-order-improvements` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-order-improvements/spec.md`

## Summary

Fix the broken order submission form (customer search, product picker, ship-via defaults), add an order list view with filtering, enable order editing and deletion, add audit logging on all order changes, and build comprehensive backend test coverage. The existing `OrderForm` component is extended for editing; a new `OrdersPage` provides the list view.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend)
**Storage**: PostgreSQL (local dev), Neon (production)
**Testing**: pytest with httpx AsyncClient (backend)
**Target Platform**: Web application (desktop-first, mobile-responsive)
**Project Type**: Web service + SPA frontend
**Performance Goals**: Customer search results within 300ms; order list page load under 1 second
**Constraints**: Single-user editing (last-save-wins); no auth until Clerk is added
**Scale/Scope**: Personal-project scale; hundreds of orders, not millions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First | PASS | Spec exists at `specs/006-order-improvements/spec.md` with status draft |
| II. Simplicity Over Cleverness | PASS | Reuses existing OrderForm; no new abstractions beyond what's needed |
| III. Multi-Agent Architecture | N/A | No AI features in this spec |
| IV. App Isolation | PASS | All changes within `apps/api/` and `apps/web/` |
| V. Deep Observability | PASS | Audit logging satisfies user-behavior observability; structlog already in use |
| Test Coverage | PASS | Spec includes explicit test coverage story (P6) |
| Coding Standards | PASS | Following existing patterns (Ruff, Prettier, strict TS) |
| API Conventions | PASS | REST, versioned `/api/v1/`, envelope `{ "data": ... }` / `{ "error": ... }` |

## Project Structure

### Documentation (this feature)

```text
specs/006-order-improvements/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-v1.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── models/order.py          # Existing — add OrderAuditLog model
│   ├── routers/orders.py        # Existing — add list, update, delete endpoints
│   ├── routers/customers.py     # Existing — add search parameter
│   ├── services/order_service.py # Existing — add update, delete, audit logic
│   └── schemas/order.py         # Existing — add list/update/audit schemas
├── migrations/models/           # New migration for OrderAuditLog
└── tests/
    ├── test_orders.py           # New — order CRUD tests
    └── test_customers.py        # New — customer search tests

apps/web/src/
├── components/order/
│   ├── OrderForm.tsx            # Existing — extend for edit mode
│   ├── CustomerSelector.tsx     # Existing — fix search integration
│   ├── ShipViaSelector.tsx      # Existing — add customer default support
│   ├── ProductPickerPanel.tsx   # Existing — rewrite to use customer pricing
│   └── OrderAuditLog.tsx        # New — audit log display component
├── pages/
│   └── OrdersPage.tsx           # New — order list view
└── types/index.ts               # Existing — fix ProductListResponse type
```

**Structure Decision**: Follows existing monorepo layout. All backend changes in `apps/api/`, all frontend changes in `apps/web/`. No new apps or packages needed.
