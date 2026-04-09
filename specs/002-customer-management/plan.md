# Implementation Plan: Customer Management

**Branch**: `002-customer-management` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-customer-management/spec.md`

## Summary

Build a customer management page within the existing FullBloom web app. The page displays all customers in a filterable, searchable table with Excel-style column filters. Users can add, edit (via slide-out drawer), archive (soft-delete), and restore customers. The backend extends the existing Customer model with 7 new fields and adds CRUD + archive/restore endpoints.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui (frontend)
**Storage**: PostgreSQL via Neon (serverless, free tier)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (monorepo: `apps/api` + `apps/web`)
**Performance Goals**: Page load < 2s, search/filter response < 500ms (client-side filtering after initial load)
**Constraints**: Single-user system, no auth required for this feature, ~180 customers
**Scale/Scope**: ~180 customer records, 10 visible columns, 6 filterable columns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Frontend: React + Vite + Tailwind + shadcn/ui | PASS | Using existing stack |
| Backend: FastAPI + Tortoise ORM + Aerich | PASS | Using existing stack |
| Database: PostgreSQL via Neon | PASS | Using existing stack |
| Color palette: Slate + Rose | PASS | Will use existing theme variables |
| App shell: collapsible sidebar | PASS | Reusing existing AppShell + Sidebar |
| API conventions: REST, `/api/v1/`, envelope | PASS | Extending existing router |
| DB naming: snake_case, `_number` for business IDs | PASS | `customer_number` already renamed |
| Dependencies: justified | PASS | No new dependencies needed |
| Secrets: `.env.example` | PASS | No new secrets |
| Error handling: structured JSON logging | DEFERRED | structlog not yet integrated; out of scope |
| Auth: Clerk | DEFERRED | Single-user, no auth for this feature |

## Project Structure

### Documentation (this feature)

```text
specs/002-customer-management/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-v1.md        # Customer CRUD + archive/restore endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── models/
│   │   └── customer.py       # Extend with 7 new fields
│   ├── routers/
│   │   └── customers.py      # Add CRUD, PATCH, archive, restore endpoints
│   ├── schemas/
│   │   └── customer.py       # Add create/update/detail schemas
│   └── services/
│       └── customer_service.py  # Next-number generation, validation
├── migrations/
│   └── models/               # New migration for added fields
└── tests/
    └── test_customers.py     # Endpoint tests

apps/web/
└── src/
    ├── components/
    │   └── customer/
    │       ├── CustomerTable.tsx         # Table with column filters
    │       ├── CustomerColumnFilter.tsx  # Excel-style filter dropdown
    │       ├── CustomerDrawer.tsx        # Slide-out edit/add form
    │       └── CustomerArchiveDialog.tsx # Confirmation dialog
    ├── pages/
    │   └── CustomersPage.tsx            # Page component (wired into router)
    ├── services/
    │   └── api.ts                       # Extend with customer endpoints
    └── types/
        └── index.ts                     # Extend Customer type
```

**Structure Decision**: Extends existing `apps/api` and `apps/web` directories. New customer-specific components go in `components/customer/`. A new `pages/` directory is introduced for top-level page components (the Orders page should eventually follow this pattern too).

## Complexity Tracking

No constitution violations to justify. All gates pass or are explicitly deferred (auth, structured logging) with spec-level justification (single-user system).
