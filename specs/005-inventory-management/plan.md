# Implementation Plan: Inventory Management

**Branch**: `005-inventory-management` | **Date**: 2026-04-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-inventory-management/spec.md`

## Summary

Inventory management for Oregon Flowers: daily remaining counts (10-stem equivalents after priority customer bunching), customer-specific priority bunch counts with auto-calculated 10-stem equivalent summaries, and weekly estimates broken down by pull day. Mobile-first data entry for field leads, with a read-only sales availability view and completion notifications for the field→sales handoff. Extends the existing Variety model with `in_harvest` and `stems_per_bunch` fields.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend)
**Storage**: PostgreSQL (local dev), Neon (production)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web application — tablets and large phones for field leads, desktop for sales/admin
**Project Type**: Web application (FastAPI API + React SPA)
**Performance Goals**: Count form save < 1 second, form load < 2 seconds, 30+ variety count entry in < 5 minutes
**Constraints**: Mobile-first UX for count/estimate forms, must be faster than paper workflow, connectivity required (no offline)
**Scale/Scope**: Single farm, ~200 varieties across product types, ~20 customer-bunch columns max, 3-5 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Spec-First | ✅ Pass | Spec exists at `specs/005-inventory-management/spec.md`, status Draft (will promote to in-progress at implementation) |
| II. Simplicity | ✅ Pass | No unnecessary abstractions — flat models, batch save endpoints, client-side calculations for totals |
| III. Multi-Agent | ✅ N/A | No AI features in this feature |
| IV. App Isolation | ✅ Pass | Extends existing `apps/api` and `apps/web` — no new apps needed |
| V. Deep Observability | ✅ Pass | Will use structlog for backend logging, /health already exists, no AI calls |
| Color Palette | ✅ Will follow | All UI uses existing FullBloom Slate+Rose palette |
| App Shell | ✅ Will follow | New "Inventory" section in existing collapsible sidebar |
| API Conventions | ✅ Will follow | REST, /api/v1 prefix, envelope responses, standard status codes |
| Coding Standards | ✅ Will follow | Prettier (TS), Ruff (Python), naming conventions per constitution |
| Auth | ⚠️ Deferred | Clerk not yet implemented — `entered_by` is free text for v1 per spec assumptions |

## Project Structure

### Documentation (this feature)

```text
specs/005-inventory-management/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-v1.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── models/
│   │   ├── product.py          # Extended: Variety gets in_harvest, stems_per_bunch
│   │   └── inventory.py        # NEW: DailyCount, CustomerCount, Estimate, CountSheetTemplate, PullDaySchedule, SheetCompletion
│   ├── routers/
│   │   ├── counts.py           # NEW: daily count + customer count endpoints
│   │   ├── estimates.py        # NEW: estimate endpoints
│   │   ├── availability.py     # NEW: sales availability view
│   │   ├── harvest_status.py   # NEW: harvest toggle endpoints
│   │   ├── sheet_templates.py  # NEW: count sheet template config
│   │   ├── pull_days.py        # NEW: pull day schedule config
│   │   └── print_sheets.py     # NEW: print-optimized blank sheets
│   ├── schemas/
│   │   └── inventory.py        # NEW: all inventory request/response schemas
│   ├── services/
│   │   └── inventory_service.py # NEW: 10-stem conversion, sanity checks, copy logic
│   └── main.py                 # Updated: register new routers
├── migrations/                 # Aerich-generated
└── tests/
    └── test_inventory.py       # NEW

apps/web/
├── src/
│   ├── pages/
│   │   ├── CountsPage.tsx          # NEW: daily remaining counts entry
│   │   ├── CustomerCountsPage.tsx  # NEW: customer-specific count grid
│   │   ├── EstimatesPage.tsx       # NEW: weekly estimate entry
│   │   ├── AvailabilityPage.tsx    # NEW: sales read-only view
│   │   ├── HarvestStatusPage.tsx   # NEW: toggle in-harvest/dormant
│   │   └── ComparisonPage.tsx      # NEW: estimate vs actual
│   ├── components/
│   │   └── inventory/             # NEW directory
│   │       ├── CountForm.tsx       # Variety list with count inputs
│   │       ├── CustomerCountGrid.tsx # Wide grid with customer columns
│   │       ├── EstimateForm.tsx    # Pull-day columns with last-week reference
│   │       ├── SheetCompletionBar.tsx # Done progress + complete button
│   │       ├── SanityWarning.tsx   # Inline warning badge
│   │       ├── CopyButtons.tsx     # Copy last count / Copy from estimate
│   │       └── PrintSheet.tsx      # Print-optimized layout
│   ├── types/
│   │   └── inventory.ts           # NEW: inventory TypeScript interfaces
│   └── App.tsx                    # Updated: add inventory routes
```

**Structure Decision**: Extends existing `apps/api` and `apps/web` following established patterns. New inventory models in a dedicated `inventory.py` model file. New routers split by domain (counts, estimates, availability, etc.) following the existing convention of one router per resource group. Frontend gets a new `inventory/` component directory and dedicated page components.
