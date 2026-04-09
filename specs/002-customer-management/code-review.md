# Code Review: 002-customer-management

**Date**: 2026-04-09
**Reviewer**: Claude Code Review Agent
**Branch**: 002-customer-management
**Commits reviewed**: 16

## Summary

The branch implements the customer management feature with solid spec adherence across backend and frontend. The model, schemas, service, router, frontend types, API client, page shell, table, drawer, column filters, and archive dialog are all present and structurally match the spec, API contract, and frontend design. There are several issues ranging from a likely runtime bug (shadcn `Select` with empty string value) to constitution deviations (error envelope format, branch naming, missing structured logging in the router). An out-of-scope CSV import endpoint was also added without a corresponding spec update.

## Constitution Compliance

| Rule | Status | Notes |
|------|--------|-------|
| Spec-First (I) | PASS | Spec exists at `in-progress` status. Implementation matches spec. |
| Simplicity Over Cleverness (II) | PASS | Code is straightforward — no premature abstractions. |
| Multi-Agent Architecture (III) | N/A | No AI features in this feature. |
| App Isolation (IV) | PASS | All code stays within `apps/api/` and `apps/web/`. |
| Deep Observability (V) | WARN | Customer router has no structured logging via `structlog`. Other routers in the codebase also lack it, so this is a systemic gap, not specific to this branch — but the constitution says it's non-negotiable. |
| Color Palette | PASS | All hardcoded colors match the constitution palette exactly (#1e3a5f headings, #c27890 actions, #e0ddd8 borders, #94a3b8 muted, #334155 body, #f4f1ec warm cream, #fce7f3/#e8f0e8 badge backgrounds). |
| shadcn/ui Only | PASS | All UI components are shadcn/ui (Sheet, Dialog, Popover, Checkbox, Select, Input, Textarea, Button). No alternative libraries. |
| API Envelope `{ "data": ... }` | PASS | All success responses use `{"data": ...}`. |
| API Error Envelope `{ "error": ... }` | FAIL | FastAPI's `HTTPException(detail=...)` returns `{"detail": "..."}` by default, not `{"error": "..."}`. No custom exception handler exists in `main.py` to transform this. The frontend `api.ts` reads `(body as ApiError).error` which will be `undefined` for FastAPI's default `{"detail": "..."}` shape, falling back to the generic message. Error messages from the API (e.g., "Customer number 2620 already exists") will never reach the user. |
| REST Conventions | PASS | Plural nouns, versioned `/api/v1/`, correct HTTP verbs (GET/POST/PATCH), correct status codes (200/201/404/422). |
| DB Column Naming | PASS | `snake_case`, `_id` for FKs, `is_` prefix for booleans, `_at` suffix for timestamps, `_number` for business identifiers, descriptive qualifiers (`contact_name`, `payment_terms`, `default_ship_via`). |
| Naming Conventions (TS) | PASS | `camelCase` functions/variables, `PascalCase` components/types/interfaces, `SCREAMING_SNAKE_CASE` for constants (`ALL_COLUMNS`, `STORAGE_KEY`, `SEARCHABLE_FIELDS`). |
| Naming Conventions (Python) | PASS | `snake_case` functions/variables, `PascalCase` classes. |
| Commit Messages | PASS | All commits follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`), lowercase, imperative. |
| Branch Naming | WARN | Constitution says `feat/<slug>` pattern. Branch is `002-customer-management` — not `feat/customer-management`. This appears to be a deliberate project convention using spec numbers, but it deviates from the written constitution. |
| Secrets | PASS | No secrets committed. |
| Dependencies | PASS | `react-router-dom` added with justification in commit message. |

## Spec Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-001: Display active customers in searchable table | PASS | Table displays active customers, sorted by name via `order_by("name")` in backend. |
| FR-002: Excel-style filter dropdowns on filterable columns | PASS | `CustomerColumnFilter` with checkboxes on Name, Salesperson, Ship Via, Terms, Location. Active status column is filterable per spec but is handled via the Active/Archived toggle instead of a column filter — this is a reasonable design decision since it's a toggle in the toolbar. |
| FR-003: Edit all fields except customer_number via drawer | PASS | Drawer form with all fields; customer_number is read-only in edit mode. Salesperson, Ship Via, Terms are `Select` dropdowns. |
| FR-004: Validate name not empty on save | PASS | Frontend validation in `handleSave`; backend `field_validator` on both create and update schemas. |
| FR-005: Create new customer; customer_number pre-filled | PASS | `GET /customers/next-number` called on add click, pre-fills customer_number field. |
| FR-006: Validate customer_number uniqueness on create | PASS | Backend checks `Customer.filter(customer_number=...)` before create, returns 422. |
| FR-007: Soft-delete by setting inactive | PASS | `POST /customers/{id}/archive` sets `is_active = False`. |
| FR-008: Confirmation before archiving | PASS | `CustomerArchiveDialog` with confirm/cancel. |
| FR-009: View archived customers separately | PASS | Active/Archived toggle in toolbar, fetches with `?active=false`. |
| FR-010: Restore archived customer | PASS | `POST /customers/{id}/restore`, "Restore" button in drawer header for archived customers. |
| FR-012: Column filters combine with AND | PASS | Filter loop applies each column filter sequentially (AND logic). |
| FR-013: Clear Filters resets all | PASS | `clearAllFilters` resets `searchTerm` and `columnFilters`. |
| FR-014: Visual indicator on filtered columns | PASS | `CustomerColumnFilter` shows rose pink icon when filter is active. |
| FR-015: Customer number read-only after creation | PASS | Displayed as static `div` in edit mode; `CustomerUpdateRequest` does not include `customer_number`. |
| FR-016: Search matches all text fields | PASS | `SEARCHABLE_FIELDS` covers name, contact_name, location, email, phone, notes. |

## API Contract Compliance

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /customers` | PASS | Query param `active` with default `True`, returns `{"data": [...]}` with all specified fields. |
| `GET /customers/{id}` | PASS | Returns customer with nested `stores` array. 404 on not found. |
| `GET /customers/next-number` | PASS | Returns `{"data": {"next_number": N}}`. Algorithm matches spec (max + 10, rounded to next ten). |
| `GET /customers/dropdown-options` | PASS | Returns distinct values for salesperson, default_ship_via, payment_terms. |
| `POST /customers` | PASS | Status 201, validates uniqueness, returns customer data. |
| `PATCH /customers/{id}` | PASS | Uses `exclude_unset=True` for partial updates. |
| `POST /customers/{id}/archive` | PASS | Returns `{"data": {"id": ..., "is_active": false}}`. |
| `POST /customers/{id}/restore` | PASS | Returns `{"data": {"id": ..., "is_active": true}}`. |
| Error envelope shape | FAIL | See Constitution Compliance — returns `{"detail": "..."}` instead of `{"error": "..."}`. |

## Frontend Design Compliance

| Component/Feature | Status | Notes |
|-------------------|--------|-------|
| Component structure | PASS | Matches design spec exactly: `CustomerTable`, `CustomerColumnFilter`, `CustomerDrawer`, `CustomerArchiveDialog` in `components/customer/`, `CustomersPage` in `pages/`. |
| Toolbar layout | PASS | Title, search, active/archived toggle, clear filters, columns popover, add button — all present in correct order. |
| Default visible columns (6) | PASS | Customer Number, Name, Salesperson, Ship Via, Location, Terms. |
| Hidden by default columns (4) | PASS | Contact, Phone, Email, Notes — togglable via Columns popover. |
| Column visibility persistence | PASS | `localStorage` with key `fullbloom:customer-columns`. |
| Filter icon states | PASS | Muted gray inactive, rose pink active. |
| Filter popover | PASS | Select All / Clear shortcuts, checkboxes for each distinct value. |
| Table row click opens drawer | PASS | `onRowClick` opens edit drawer. |
| Footer count | PASS | Shows `{count} active/archived customer(s)`. |
| Drawer — Sheet from right | PASS | shadcn/ui `Sheet` with `SheetContent`, ~520px max width. |
| Drawer — Header | PASS | Title, subtitle (#number · name), archive/restore button. |
| Drawer — Two-column form sections | PASS | Identity (number + salesperson / name full-width), Contact (contact + phone / email full-width), Shipping (ship via + terms / location full-width), Notes (full-width textarea). |
| Drawer — Dropdown fields | PASS | Salesperson, Ship Via, Terms use `Select` from dropdown-options endpoint. |
| Drawer — Footer buttons | PASS | Cancel (outline) + Save/Create (rose pink filled). Sticky at bottom. |
| Drawer — Archived read-only | PASS | `isReadOnly` disables all inputs when viewing archived customer. No Save/Cancel footer. |
| Drawer — Validation | PASS | Name required with inline error. |
| Archive dialog | PASS | Matches design: title "Archive {name}?", description text, Cancel + Archive buttons. |
| Active/Archived toggle resets filters | PASS | `handleViewChange` calls `clearAllFilters`. |
| State management | PASS | Local React state in `CustomersPage`, no global store. Refetch after mutations. |
| No drag-to-reorder columns | MINOR GAP | Design spec mentions "drag-to-reorder" in the Columns popover. Not implemented. Column visibility toggle works but ordering is fixed by `ALL_COLUMNS` definition. |

## Issues Found

### Critical (blocks release)

None.

### Major (should fix before merge)

1. **Error envelope mismatch between API and frontend** — FastAPI's `HTTPException` returns `{"detail": "Customer not found"}` but the constitution requires `{"error": "..."}` and the frontend `api.ts` reads `(body as ApiError).error`. This means all API error messages (404, 422 validation errors like "Customer number already exists") are lost — the frontend will always show the generic fallback "Request failed with status {code}". Fix: add a custom exception handler in `main.py` that transforms `{"detail": ...}` into `{"error": ...}`, or update the frontend to read `body.detail`. This is a pre-existing issue (orders router has the same pattern) but it directly impacts this feature's UX, particularly FR-006 (customer number uniqueness error shown to user).

2. **shadcn/ui `Select` with empty string value** — `CustomerDrawer.tsx` line 158 uses `<SelectItem value="">None</SelectItem>`. Radix UI's `Select` component (which shadcn wraps) does not support empty string values — it treats `value=""` the same as uncontrolled/placeholder state. This will likely cause the "None" option to not work correctly: selecting it may not clear the field, or it may not appear selectable. Fix: use a sentinel value like `"__none__"` and map it to `null`/`""` in the form handler.

3. **`customer_number` stored as string in form state** — In `CustomerDrawer.tsx`, the `setField` function sets all fields as strings. When the user types a customer number in add mode, `form.customer_number` becomes a string (e.g., `"2620"` not `2620`). The `CustomerCreateRequest` type says `customer_number: number`, but at runtime the value sent to the API will be a string. The backend Pydantic schema will coerce it, but this is fragile and the TypeScript type is wrong at runtime. Fix: parse `parseInt(e.target.value)` in the customer_number input handler, or use a dedicated numeric setter.

### Minor (nice to have)

1. **Out-of-scope import endpoint added** — `POST /api/v1/import/customer-info` and `import_customer_info()` service were added (commit `660b1c3`). This is not in the spec or implementation plan. The constitution says "Do not implement anything not described in the spec." It's useful for data loading but should be documented in the spec's scope or tracked separately.

2. **Migration includes a column rename** — The aerich-generated migration (`1_20260409051354_add_customer_fields.py`) includes `RENAME COLUMN "customer_id" TO "customer_number"` in addition to adding the 7 new fields. This rename wasn't in the spec or plan — it was apparently a pre-existing naming issue in the DB. The fix is correct per constitution naming rules (`_id` reserved for FKs, `_number` for business identifiers), but it's an unplanned schema change that should be noted.

3. **No drag-to-reorder for column visibility** — The frontend design spec mentions "drag-to-reorder" in the Columns popover. Only toggle visibility is implemented. Acceptable for MVP but incomplete vs. the design.

4. **Active column not filterable in table** — FR-002 lists "Active" as a filterable column. The implementation uses an Active/Archived toolbar toggle instead of a column filter, which is a better UX pattern. However, it means `is_active` doesn't appear as a column in the table at all. This is a reasonable deviation — the toggle serves the same purpose.

5. **`salesperson` field max_length is 10** — This is very short. If a salesperson's initials + name ever exceed 10 characters, the field will truncate silently. May want to increase to 50 or 100.

## Positive Observations

- Backend code follows the implementation plan almost verbatim — model, schemas, service, and router match the planned code nearly line-for-line. This is excellent spec discipline.
- Client-side filtering with `useMemo` is the right call for ~180 records. No over-engineering with virtual scrolling or server-side filtering.
- Column visibility persistence in `localStorage` is a nice touch that matches the design spec exactly.
- The drawer's read-only mode for archived customers with Restore button is well-implemented — clean conditional rendering.
- The `exclude_unset=True` pattern in the PATCH endpoint is correct for partial updates.
- Error handling in the drawer's `handleSave` with try/catch and user-facing error display is good, even though the error messages won't flow through due to the envelope mismatch.
- Proper use of shadcn/ui components throughout — no custom or third-party UI components.
- Color palette usage is consistent across all components — no deviations from the constitution's Slate + Rose palette.
