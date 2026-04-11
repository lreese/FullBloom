# Implementation Plan: Product Management

**Branch**: `003-product-management` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-product-management/spec.md`

## Summary

Build a product management section within the existing FullBloom web app. Three sub-pages (Varieties, Product Lines, Colors) accessible via a sidebar dropdown under Products. Varieties is the primary view with a filterable table, slide-out drawer for edit/add (including inline sales item management), bulk update toolbar, and archive/restore. Product Lines and Colors are simpler CRUD pages. Backend adds `is_active` fields to Variety, SalesItem, and VarietyColor, plus full CRUD + bulk endpoints.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend)
**Storage**: PostgreSQL (local dev), Neon (production)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Web application (monorepo: `apps/api` + `apps/web`)
**Performance Goals**: Page load < 2s, search/filter response < 500ms (client-side filtering)
**Constraints**: Single-user system, no auth, ~300 varieties, ~50 product lines
**Scale/Scope**: ~300 variety records, ~50 product lines, ~10 product types, ~500 sales items, 3 new pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Frontend: React + Vite + Tailwind + shadcn/ui | PASS | Using existing stack |
| Backend: FastAPI + Tortoise ORM + Aerich | PASS | Using existing stack |
| Database: PostgreSQL | PASS | Using existing stack |
| Color palette: Slate + Rose | PASS | Reusing customer management patterns |
| App shell: collapsible sidebar | PASS | Extending sidebar with dropdown |
| API conventions: REST, `/api/v1/`, envelope | PASS | Extending existing router |
| DB naming: snake_case, `is_` booleans, `_at` timestamps | PASS | `is_active` follows convention |
| Dependencies: justified | PASS | No new dependencies needed |
| Secrets: `.env.example` | PASS | No new secrets |
| Error handling: structured JSON logging | DEFERRED | Systemic gap, tracked separately |
| Auth: Clerk | DEFERRED | Single-user, no auth for this feature |

## Project Structure

### Documentation (this feature)

```text
specs/003-product-management/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-v1.md        # Variety, ProductLine, Color, SalesItem endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── models/
│   │   └── product.py        # Add is_active to Variety, SalesItem, VarietyColor
│   ├── routers/
│   │   ├── products.py       # Rewrite: variety CRUD, bulk, archive/restore
│   │   ├── product_lines.py  # New: product line CRUD + archive
│   │   ├── colors.py         # New: variety color CRUD + archive
│   │   └── sales_items.py    # New: sales item CRUD + soft-delete (nested under varieties)
│   ├── schemas/
│   │   ├── product.py        # Extend: variety create/update/list, bulk update
│   │   ├── product_line.py   # New: product line schemas
│   │   ├── color.py          # New: variety color schemas
│   │   └── sales_item.py     # New: sales item schemas
│   └── services/
│       └── product_service.py  # New: dropdown options, bulk update logic
├── migrations/
│   └── models/               # New migration: is_active on 3 tables
└── tests/

apps/web/
└── src/
    ├── components/
    │   ├── product/
    │   │   ├── VarietyTable.tsx           # Table with toolbar, filters, bulk select
    │   │   ├── VarietyDrawer.tsx          # Drawer: variety edit/add + sales items section
    │   │   ├── VarietyBulkToolbar.tsx     # Bulk action toolbar (field + value + apply)
    │   │   ├── SalesItemList.tsx          # Inline sales item management in drawer
    │   │   ├── ProductLineTable.tsx       # Product lines table
    │   │   ├── ProductLineDrawer.tsx      # Product line edit/add drawer
    │   │   ├── ColorTable.tsx             # Colors table with swatches
    │   │   ├── ColorDrawer.tsx            # Color edit/add drawer
    │   │   └── ProductArchiveDialog.tsx   # Shared archive confirmation dialog
    │   ├── layout/
    │   │   └── Sidebar.tsx               # Modify: add dropdown under Products
    │   └── common/
    │       └── ColumnFilter.tsx          # Extract from CustomerColumnFilter → reusable
    ├── pages/
    │   ├── VarietiesPage.tsx             # Varieties page (primary products view)
    │   ├── ProductLinesPage.tsx          # Product lines page
    │   └── ColorsPage.tsx                # Colors page
    ├── services/
    │   └── api.ts                        # Extend with product endpoints
    └── types/
        └── index.ts                      # Add variety, product line, color, sales item types
```

**Structure Decision**: Extends existing `apps/api` and `apps/web`. Product-specific components in `components/product/`. Three new page components. The `CustomerColumnFilter` pattern gets extracted to `common/ColumnFilter` for reuse across both customer and product tables.

## Complexity Tracking

No constitution violations to justify. All gates pass or are explicitly deferred.
