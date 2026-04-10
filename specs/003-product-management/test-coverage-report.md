# Test Coverage Report: 003-product-management

**Date**: 2026-04-09

## Summary

There are **zero tests** for the product management feature. The `apps/api/tests/` directory contains only an empty `__init__.py`. No frontend test files exist either. The test infrastructure (pytest, pytest-asyncio, httpx) is declared in `pyproject.toml` and configured (`asyncio_mode = "auto"`), but nothing has been written.

This is a significant gap. The feature introduces 4 new routers (products, product_lines, colors, sales_items), 1 service module, 4 schema modules, and 6 models — all untested. Given that this is a data management feature where bugs corrupt the product catalog, backend endpoint tests should be the top priority.

## Backend Coverage

### Existing Tests

None. `apps/api/tests/__init__.py` is empty.

### Missing Tests — Critical

These tests protect against data corruption and broken CRUD operations. They should exist before any real data goes through these endpoints.

**Variety endpoints (`products.py`) — highest risk, most complex logic**

| Test | What it verifies |
|------|-----------------|
| `test_list_varieties_returns_active_only` | `GET /varieties` defaults to active varieties, sorted alphabetically |
| `test_list_varieties_archived` | `GET /varieties?active=false` returns only archived varieties |
| `test_get_variety_detail_with_sales_items` | `GET /varieties/{id}` returns nested sales items with customer_prices_count |
| `test_get_variety_not_found` | `GET /varieties/{id}` returns 404 for nonexistent UUID |
| `test_create_variety_success` | `POST /varieties` creates with required fields, returns 201 |
| `test_create_variety_duplicate_name_same_product_line` | `POST /varieties` returns 422 when name exists in same product line |
| `test_create_variety_duplicate_name_different_product_line` | `POST /varieties` succeeds — uniqueness is per product line, not global |
| `test_create_variety_invalid_product_line` | `POST /varieties` returns 422 when product_line_id doesn't exist |
| `test_update_variety_success` | `PATCH /varieties/{id}` updates fields, returns updated object |
| `test_update_variety_not_found` | `PATCH /varieties/{id}` returns 404 |
| `test_update_variety_empty_body` | `PATCH /varieties/{id}` with no fields returns 422 |
| `test_update_variety_name_uniqueness_check` | `PATCH /varieties/{id}` rejects duplicate name within same product line |
| `test_archive_variety` | `POST /varieties/{id}/archive` sets is_active=false |
| `test_restore_variety` | `POST /varieties/{id}/restore` sets is_active=true |
| `test_archive_variety_not_found` | `POST /varieties/{id}/archive` returns 404 |

**Bulk update (`products.py` + `product_service.py`)**

| Test | What it verifies |
|------|-----------------|
| `test_bulk_update_allowed_field` | `PATCH /varieties/bulk` with `show` field updates all specified IDs |
| `test_bulk_update_disallowed_field` | `PATCH /varieties/bulk` with `name` returns 422 |
| `test_bulk_update_returns_count` | Response includes correct `updated_count` |

**Sales item endpoints (`sales_items.py`)**

| Test | What it verifies |
|------|-----------------|
| `test_list_sales_items_for_variety` | `GET /varieties/{id}/sales-items` returns active items |
| `test_list_sales_items_include_inactive` | `GET /varieties/{id}/sales-items?include_inactive=true` returns all |
| `test_list_sales_items_variety_not_found` | Returns 404 when variety doesn't exist |
| `test_create_sales_item_success` | `POST /varieties/{id}/sales-items` creates with 201 |
| `test_create_sales_item_duplicate_name` | Returns 422 for globally duplicate name |
| `test_update_sales_item_success` | `PATCH /sales-items/{id}` updates fields |
| `test_update_sales_item_not_found` | Returns 404 |
| `test_archive_sales_item_returns_customer_prices_count` | Archive response includes customer_prices_count as a warning |
| `test_restore_sales_item` | Sets is_active=true |

**Product line endpoints (`product_lines.py`)**

| Test | What it verifies |
|------|-----------------|
| `test_list_product_lines_with_variety_count` | Returns variety_count for each product line |
| `test_create_product_line_success` | Creates with 201, returns product_type_name |
| `test_create_product_line_duplicate` | Returns 422 for duplicate name within same product type |
| `test_create_product_line_invalid_product_type` | Returns 422 when product_type_id doesn't exist |
| `test_archive_product_line_returns_variety_count` | Archive response includes variety_count as a warning |

**Color endpoints (`colors.py`)**

| Test | What it verifies |
|------|-----------------|
| `test_list_variety_colors` | Returns colors with variety_name populated |
| `test_create_variety_color_success` | Creates with 201 |
| `test_create_variety_color_duplicate` | Returns 422 for duplicate color_name on same variety |
| `test_create_variety_color_invalid_variety` | Returns 422 when variety_id doesn't exist |

### Missing Tests — Important

These cover edge cases and business logic that could cause subtle bugs.

| Test | What it verifies |
|------|-----------------|
| `test_create_variety_empty_name` | Pydantic validator rejects whitespace-only name |
| `test_create_variety_name_is_trimmed` | Leading/trailing whitespace is stripped before save |
| `test_update_variety_partial_update` | Only specified fields change, others untouched |
| `test_bulk_update_with_empty_ids_list` | Graceful handling of empty ID list |
| `test_bulk_update_with_nonexistent_ids` | Returns updated_count=0, doesn't error |
| `test_sales_item_stems_per_order_must_be_positive` | Pydantic rejects 0 or negative values |
| `test_sales_item_name_trimmed` | Name whitespace handling |
| `test_dropdown_options_returns_active_product_lines_only` | Dropdown excludes archived product lines |
| `test_dropdown_options_distinct_values` | Colors/flowering_types/categories are deduplicated and sorted |
| `test_list_varieties_sales_items_count_excludes_inactive` | sales_items_count only counts active items |
| `test_product_line_name_uniqueness_scoped_to_product_type` | Same name allowed across different product types |
| `test_archive_then_restore_variety_round_trip` | Full cycle: active -> archived -> active |

### Missing Tests — Nice to Have

| Test | What it verifies |
|------|-----------------|
| `test_variety_list_ordering` | Results are sorted alphabetically by name |
| `test_product_line_list_ordering` | Results are sorted alphabetically by name |
| `test_color_list_ordering` | Results are sorted by color_name |
| `test_hex_color_max_length_validation` | Schema rejects hex_color > 7 chars |
| `test_variety_create_all_optional_fields_null` | Variety can be created with only name + product_line_id |
| `test_sales_item_retail_price_format` | Decimal precision is preserved in response |
| `test_concurrent_bulk_update` | No race conditions on overlapping bulk updates |

## Frontend Coverage

No frontend tests exist. The web app uses Vitest (via the React+Vite setup) but no test files have been written.

**What should be tested (prioritized):**

1. **VarietyTable** — Column filter logic, search filtering, row selection state, bulk toolbar visibility toggle. This is the most complex component.
2. **VarietyDrawer** — Form validation (empty name), save/cancel behavior, sales items section CRUD interactions.
3. **SalesItemList** — Add/edit/delete inline interactions, validation (positive stems_per_order), archive warning with customer_prices_count.
4. **ProductLineTable / ProductLineDrawer** — Basic CRUD form behavior.
5. **ColorTable / ColorDrawer** — Basic CRUD form behavior.
6. **Sidebar navigation** — Dropdown expand/collapse, flyout popover in collapsed mode.
7. **API service layer** (`api.ts`) — Mock API calls return expected shapes.

Frontend tests are lower priority than backend tests for this feature since the frontend is thin (CRUD forms over API calls) and the data integrity risk lives in the API layer.

## Recommended Test Plan

Priority order for implementation:

### Phase 1: Test infrastructure + variety endpoints (do first)

**File: `apps/api/tests/conftest.py`**
- Set up Tortoise ORM with in-memory SQLite for test isolation
- Create `AsyncClient` fixture using httpx against the FastAPI app
- Create factory fixtures for ProductType, ProductLine, Variety, SalesItem, VarietyColor

**File: `apps/api/tests/test_varieties.py`**
- All "Critical" variety tests (15 tests)
- All "Critical" bulk update tests (3 tests)
- Key "Important" tests: empty name, trimming, partial update, sales_items_count filtering (4 tests)

### Phase 2: Sales items + product lines

**File: `apps/api/tests/test_sales_items.py`**
- All "Critical" sales item tests (9 tests)
- stems_per_order validation, name trimming (2 tests)

**File: `apps/api/tests/test_product_lines.py`**
- All "Critical" product line tests (5 tests)
- Name uniqueness scoping (1 test)

### Phase 3: Colors + service unit tests

**File: `apps/api/tests/test_colors.py`**
- All "Critical" color tests (4 tests)

**File: `apps/api/tests/test_product_service.py`**
- Unit tests for `bulk_update_varieties` and `get_variety_dropdown_options` in isolation
- Tests for allowed/disallowed fields, empty ID lists, distinct value deduplication

### Phase 4: Frontend (if time permits)

**File: `apps/web/src/components/product/__tests__/VarietyTable.test.tsx`**
- Search filtering, column filter state, bulk selection

This plan produces ~43 backend tests across 5 files. Phase 1 alone (22 tests) covers the highest-risk code paths and should be the minimum bar before shipping.
