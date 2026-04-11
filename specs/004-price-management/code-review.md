# Code Review: 004-price-management

**Reviewer**: Claude Opus 4.6 (automated)  
**Date**: 2026-04-09  
**Branch**: `004-price-management` (20 commits, 39 files, +6006/-127 lines)  
**Artifacts reviewed**: spec.md, plan.md, data-model.md, contracts/api-v1.md, frontend-design.md, constitution.md

---

## Executive Summary

The implementation covers the majority of the 31 functional requirements and closely follows the spec architecture. The backend is solid -- models, schemas, services, and routers are well-structured with proper audit logging and effective price resolution. The frontend delivers all three pages with the correct component architecture. However, there are several Critical and Important issues that need attention before merging, including a broken sales item create flow, stale `price_type` references throughout the customer management frontend, and a missing `variety_name`/`variety_id` in the sales item API response.

---

## Critical Issues (must fix)

### C-1. Sales item create endpoint mismatch (frontend will 404)

The frontend at `SalesItemsPage.tsx:82` POSTs to `/api/v1/sales-items` with `variety_id` in the body. But the backend create endpoint is `POST /api/v1/varieties/{variety_id}/sales-items` -- there is no flat `POST /api/v1/sales-items` route. Every attempt to create a sales item from the UI will fail.

**Fix**: Either add a flat `POST /api/v1/sales-items` endpoint that accepts `variety_id` in the body, or change the frontend to POST to `/api/v1/varieties/${data.variety_id}/sales-items`.

**Files**: `apps/web/src/pages/SalesItemsPage.tsx:82`, `apps/api/app/routers/sales_items.py`

### C-2. Frontend still references `price_type` (removed field)

The migration drops the `price_type` column from customers and replaces it with `price_list_id`. But the frontend types and customer management components still reference `price_type` extensively:

- `apps/web/src/types/index.ts:30` -- `Customer.price_type: string`
- `apps/web/src/types/index.ts:39,52` -- `CustomerCreateRequest.price_type`, `CustomerUpdateRequest.price_type`
- `apps/web/src/types/index.ts:66` -- `DropdownOptions.price_type: string[]`
- `apps/web/src/components/customer/CustomerDrawer.tsx` -- form uses `price_type`, sends it in create/update
- `apps/web/src/components/customer/CustomerTable.tsx:14` -- column def references `price_type`
- `apps/web/src/pages/CustomerPricesPage.tsx:238-240` -- renders `c.price_type` as the badge

The backend API now returns `price_list_id` and `price_list_name` instead. The Customer types need to be updated to `price_list_id: string | null` and `price_list_name: string | null`, and `CustomerDrawer` needs to be rewritten to use a PriceList dropdown instead of the old free-text `price_type` dropdown.

**Files**: `apps/web/src/types/index.ts`, `apps/web/src/components/customer/CustomerDrawer.tsx`, `apps/web/src/components/customer/CustomerTable.tsx`, `apps/web/src/pages/CustomerPricesPage.tsx`

### C-3. SalesItem API response missing `variety_name` and `variety_id`

The `SalesItemResponse` schema (`apps/api/app/schemas/sales_item.py:8-18`) does not include `variety_name` or `variety_id`. The `_build_sales_item_response` helper also omits them. The `list_all_sales_items` endpoint does `prefetch_related("variety")` but never includes the variety data in the response. The frontend `SalesItemTable` expects `variety_name` in column data and `SalesItemDrawer` expects `variety_id` for the variety dropdown.

**Fix**: Add `variety_id: str | None` and `variety_name: str | None` to `SalesItemResponse`, and populate them in `_build_sales_item_response`.

**Files**: `apps/api/app/schemas/sales_item.py`, `apps/api/app/routers/sales_items.py`

---

## Important Issues (should fix)

### I-1. `set_customer_price` always returns 200, never 201

The API contract (`contracts/api-v1.md`) specifies 201 for creating a new override and 200 for updating an existing one. The implementation computes `status_code = 200` or `status_code = 201` (lines 89/104 of `pricing.py`) but never uses the variable -- the function always returns a plain dict which FastAPI defaults to 200.

**Fix**: Use `fastapi.responses.JSONResponse` with the computed status code, or set `status_code=201` on the route decorator and use a `Response` parameter to override when updating.

**File**: `apps/api/app/routers/pricing.py:60-112`

### I-2. Sales item query param mismatch: `active` vs `include_inactive`

The frontend sends `?active=true` or `?active=false` (`SalesItemsPage.tsx:33`). The backend `list_all_sales_items` uses `include_inactive: bool = False` as the query parameter. These don't match -- `?active=false` would be ignored by the backend, which only looks for `include_inactive`. The archived view will show active items instead.

**Fix**: Change the backend to accept `active: bool | None = True` (matching the customers endpoint pattern) or change the frontend to send `?include_inactive=true`.

**File**: `apps/api/app/routers/sales_items.py:79`

### I-3. `margin` field missing from API response

The spec (FR data model) and API contract state that `SalesItem` responses should include `cost_price` and computed `margin` when `cost_price` is set. The `cost_price` field is present in `SalesItemResponse`, but `margin` is not computed or returned anywhere.

**Fix**: Add `margin: str | None` to `SalesItemResponse` and compute it in `_build_sales_item_response` as `retail_price - cost_price` when `cost_price` is not null.

**File**: `apps/api/app/schemas/sales_item.py`, `apps/api/app/routers/sales_items.py`

### I-4. `update_price_list_item` accepts raw `dict` instead of Pydantic schema

The `PATCH /price-list-items/{price_list_id}/{sales_item_id}` endpoint (`price_lists.py:149-151`) accepts `body: dict` instead of a typed Pydantic schema. This bypasses FastAPI's automatic validation and is inconsistent with every other endpoint. The `PATCH /price-lists/matrix/retail` endpoint has the same problem (line 259).

**Fix**: Create a `PriceListItemUpdateRequest` schema with a `price: str` field and proper validation. Do the same for the retail endpoint.

**Files**: `apps/api/app/routers/price_lists.py:149-151, 259`

### I-5. PriceListHeaderPopover not wired into PriceListMatrix

The `PriceListHeaderPopover` component exists in `PriceListDialog.tsx` but is never rendered. The matrix column headers have an `onHeaderClick` callback that does nothing (`PriceListsPage.tsx:122-124` is an empty function). Users cannot rename or archive price lists from the matrix view, violating FR-008 and the frontend design spec.

**Fix**: Wrap each price list column header `<th>` in the `PriceListMatrix` with a `PriceListHeaderPopover`, passing `onRename` and `onArchive` callbacks.

**Files**: `apps/web/src/components/pricing/PriceListMatrix.tsx`, `apps/web/src/pages/PriceListsPage.tsx`

### I-6. No search/filter in Price Lists matrix toolbar

The frontend design spec calls for a search input in the PriceListsPage toolbar ("Title 'Price Lists', search input (filters rows by sales item name/variety)"). The `PriceListMatrix` component has its own search, but the page-level toolbar does not include one. Additionally, there is no Export CSV or Import CSV button in the toolbar (FR-029, FR-030).

**Files**: `apps/web/src/pages/PriceListsPage.tsx`

### I-7. No import functionality wired in the frontend

FR-028 through FR-031 require CSV export/import for both customer pricing and price list matrix. The customer pricing export works (`CustomerPricesPage` has an Export CSV button). But:
- No import button for customer pricing
- No export/import buttons on the Price Lists page toolbar
- No export/import buttons on the Sales Items page toolbar (the frontend design specifies these in the toolbar)

**Files**: `apps/web/src/pages/PriceListsPage.tsx`, `apps/web/src/pages/CustomerPricesPage.tsx`, `apps/web/src/pages/SalesItemsPage.tsx`

### I-8. Effective price tooltip incomplete in CustomerPriceGrid

FR-020 specifies: "Effective price tooltip MUST show price list name, list price, and override amount (if any)." The current tooltip shows price list name, list price, and override -- but it does NOT show the delta from retail as specified in User Story 4, Scenario 4. More importantly, the tooltip only appears on override rows. Non-override rows have no tooltip at all.

**File**: `apps/web/src/components/pricing/CustomerPriceGrid.tsx`

---

## Suggestions (nice to have)

### S-1. N+1 query in `list_price_lists`

The `list_price_lists` endpoint (`price_lists.py:36-53`) queries `Customer.filter(...).count()` inside a loop for each price list. At scale, this is N+1. Consider using a single annotated query with `Count` or a subquery.

### S-2. N+1 query in `_get_price_list_prices`

The `list_all_sales_items` and `list_sales_items` endpoints call `_get_price_list_prices(si.id)` in a loop for each sales item, creating N+1 queries. Batch-load all PriceListItems in one query and build the map.

### S-3. Consider using `Literal` type for `action` field

`BulkCustomerPriceRequest.action` is typed as `str` with a validator. Using `Literal["set_price", "remove_overrides", "reset_to_list"]` would give better type safety and auto-generate OpenAPI docs.

### S-4. PriceChangeLog uses plain UUID fields, not FK fields

The `PriceChangeLog` model uses `fields.UUIDField` for `sales_item_id`, `price_list_id`, and `customer_id` instead of FK fields. This is intentional per the data model ("No FK cascade deletes"), which is correct. Just noting it as a conscious design choice.

### S-5. Downgrade migration does not restore `price_type` data

The migration downgrade adds `price_type VARCHAR(50) NOT NULL DEFAULT 'Retail'` back but does not attempt to restore the original values from `price_lists`. This is acceptable for a dev migration but should be noted if production rollback is needed.

### S-6. `CustomerPricesPage` selector shows `c.price_type` but should show `c.price_list_name`

Beyond the type mismatch (C-2), the badge in the customer selector at `CustomerPricesPage.tsx:238-240` displays `c.price_type` which will be `undefined` from the API. It should reference `c.price_list_name` (once the types are fixed).

---

## Functional Requirements Compliance

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR-001 | Sales items table with price list columns | PASS | Dynamic columns generated from price lists |
| FR-002 | CRUD + archive/restore via drawer | PARTIAL | Create broken (C-1), variety not in response (C-3) |
| FR-003 | Validation (unique name, positive int/price) | PASS | Validators in schemas |
| FR-004 | Archive warning with customer price count | PASS | Archive endpoint returns count, dialog shown |
| FR-005 | Matrix view | PASS | Custom PriceListMatrix component |
| FR-006 | Inline editing in matrix | PASS | Click-to-edit with Enter/Escape/Tab |
| FR-007 | Create new price lists | PASS | Dialog with copy-from selector |
| FR-008 | Rename and archive price lists | PARTIAL | Components exist but header popover not wired (I-5) |
| FR-009 | Column header shows customer count | PASS | Displayed in header |
| FR-010 | Absolute price storage | PASS | DECIMAL(10,2) independent of retail |
| FR-011 | Matrix searchable/filterable | PASS | Search in PriceListMatrix component |
| FR-012 | Customer pricing grid | PASS | Customer selector + grid |
| FR-013 | Grid columns (item, variety, stems, list, override, effective) | PASS | All columns present |
| FR-014 | Add/edit/remove overrides | PASS | Inline edit, X button, click-to-set |
| FR-015 | Override rows visually distinct | PASS | Rose background on override rows |
| FR-016 | "Show Only Overrides" filter | PASS | Checkbox toggle |
| FR-017 | Summary bar | PASS | PricingSummaryBar component |
| FR-018 | >20% anomaly badge | PASS | PriceAnomalyBadge with percentage |
| FR-019 | Price spread indicator | PASS | Spread column in matrix |
| FR-020 | Effective price tooltip | PARTIAL | Missing on non-override rows (I-8) |
| FR-021 | Sidebar Pricing dropdown | PASS | Three sub-items |
| FR-022 | Sidebar collapsed/expanded mode | PASS | Popover flyout in collapsed mode |
| FR-023 | Bulk sales item update | PARTIAL | Checkboxes present, no bulk action toolbar |
| FR-024 | Bulk price list matrix update | PASS | Bulk action bar with price list selector |
| FR-025 | Bulk customer pricing actions | PASS | Set price and remove overrides |
| FR-026 | Item-centric customer pricing view | PASS | ItemPriceGrid with selector |
| FR-027 | Impact preview before save | PASS | Tooltip with customer counts |
| FR-028 | Customer pricing CSV export | PASS | Export button + endpoint |
| FR-029 | Price list matrix CSV export | PARTIAL | Backend endpoint exists, no frontend button (I-7) |
| FR-030 | Price list CSV import | PARTIAL | Backend endpoint exists, no frontend button (I-7) |
| FR-031 | Customer pricing CSV import | PARTIAL | Backend endpoint exists, no frontend button (I-7) |

**Summary**: 21 PASS, 8 PARTIAL, 0 FAIL

---

## Constitution Compliance

| Gate | Status | Notes |
|------|--------|-------|
| Spec-first (Principle I) | PASS | Spec exists, status in-progress |
| Simplicity (Principle II) | PASS | No unnecessary abstractions |
| App isolation (Principle IV) | PASS | Changes within apps/api and apps/web |
| API conventions (REST, /api/v1/, envelope) | PARTIAL | `set_customer_price` 201 not honored (I-1) |
| DB naming (snake_case, is_ booleans) | PASS | All fields follow convention |
| Migrations via Aerich | PASS | MODELS_STATE present, data backfill in upgrade() |
| Error handling ({"error": ...}) | PASS | Global handler normalizes responses |
| Color palette (Slate + Rose) | PASS | Consistent use of palette colors |
| Conventional commits | PASS | All commits use `feat:`, `test:`, `docs:` |
| No magic literals | PASS | ANOMALY_THRESHOLD is a named constant |
| Coding standards (formatting, naming) | PASS | Python snake_case, TS camelCase/PascalCase |

---

## Test Coverage Assessment

Backend tests cover the core paths well: price list CRUD, matrix, inline edit, bulk, archive with override conversion, impact preview, customer pricing grid, overrides, anomaly detection, item-centric view, and CSV export. Missing test coverage:

- Customer pricing CSV import
- Price list CSV import
- Price list CSV export content validation (only checks Content-Type)
- PriceChangeLog audit trail verification (no tests confirm log entries are written)
- Retail price update via matrix (endpoint tested, but no log verification)
- Edge case: archiving a price list when customer already has an override for a sales item

Frontend has no tests (Vitest not wired for these components). This is typical for the project at this stage.

---

## Recommended Fix Priority

1. **C-1** (sales item create 404) -- Blocking, users cannot create sales items
2. **C-2** (stale price_type references) -- Blocking, customer management pages will break
3. **C-3** (missing variety in response) -- Blocking, sales item table/drawer display broken
4. **I-2** (active vs include_inactive) -- Archived view shows wrong data
5. **I-5** (header popover not wired) -- No way to rename/archive price lists
6. **I-1** (201 vs 200 status code) -- Contract violation, low risk
7. **I-4** (untyped dict bodies) -- Validation bypass
8. **I-7** (missing import UI) -- Feature incomplete
9. **I-3** (missing margin) -- Spec deviation, backend-only
10. **I-6, I-8** (toolbar/tooltip gaps) -- UX polish
