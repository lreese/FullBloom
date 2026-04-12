# Implementation Plan: Standing Orders

**Branch**: `007-standing-orders` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-standing-orders/spec.md`

## Summary

Add standing orders — recurring order templates that generate regular orders on a cadence. Salespeople can create, edit, pause, resume, and cancel standing orders with full audit trail. A "Generate Orders" feature creates regular orders from active standing orders for selected dates. Generated orders link back to their source standing order.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend)
**Storage**: PostgreSQL (local dev), Neon (production)
**Testing**: pytest with httpx AsyncClient (backend)
**Target Platform**: Web application (desktop-first, mobile-responsive)
**Project Type**: Web service + SPA frontend
**Performance Goals**: Generation preview under 2 seconds; status transitions under 3 seconds
**Constraints**: Single-user editing; no auth until Supabase Auth is added
**Scale/Scope**: Personal-project scale; tens of standing orders, not thousands

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First | PASS | Spec at `specs/007-standing-orders/spec.md` with status draft |
| II. Simplicity Over Cleverness | PASS | Reuses existing order patterns; manual generation (no Celery/background jobs) |
| III. Multi-Agent Architecture | N/A | No AI features |
| IV. App Isolation | PASS | All changes within `apps/api/` and `apps/web/` |
| V. Deep Observability | PASS | Audit logging on all changes; structlog in routers |
| Test Coverage | PASS | Spec includes test coverage story (P8) |
| Coding Standards | PASS | Following existing patterns |
| API Conventions | PASS | REST, versioned `/api/v1/`, envelope convention |

## Project Structure

### Documentation (this feature)

```text
specs/007-standing-orders/
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
│   ├── models/standing_order.py    # New — StandingOrder, StandingOrderLine, StandingOrderAuditLog
│   ├── routers/standing_orders.py  # New — CRUD, status transitions, generation, audit log
│   ├── services/standing_order_service.py # New — business logic, cadence matching, order generation
│   ├── schemas/standing_order.py   # New — request/response schemas
│   └── models/order.py            # Modified — add standing_order_id FK to Order
├── migrations/models/              # New migration for standing order tables + Order FK
└── tests/
    └── test_standing_orders.py     # New — comprehensive tests

apps/web/src/
├── components/standing-orders/
│   ├── StandingOrderForm.tsx       # New — create/edit form (reuses patterns from OrderForm)
│   ├── StandingOrderAuditLog.tsx   # New — audit trail display
│   └── GenerateOrdersDialog.tsx    # New — date picker + preview + confirm
├── pages/
│   └── StandingOrdersPage.tsx      # New — list view with filters
├── types/standing-order.ts         # New — TypeScript types
└── App.tsx                         # Modified — add routes
```

**Structure Decision**: Follows existing monorepo layout. Standing orders get their own model file (not crammed into order.py) since they're a distinct entity with their own lifecycle. The Order model gets a nullable FK added.
