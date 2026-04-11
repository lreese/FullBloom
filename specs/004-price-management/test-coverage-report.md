# 004-Price-Management: Test Coverage Report

**Generated**: 2026-04-09  
**Branch**: `004-price-management`  
**Scope**: Backend API tests only (routers, services, schemas, models)

---

## Test Files Analyzed

| File | Test Count | Focus Area |
|------|-----------|------------|
| `tests/test_price_lists.py` | 14 | Price list CRUD, matrix, inline edit, bulk, impact preview, export |
| `tests/test_customer_pricing.py` | 14 | Customer pricing grid, overrides CRUD, bulk actions, item-centric view, anomaly detection, export |
| `tests/test_sales_items.py` | 10 | Sales item CRUD, archive/restore, price list price inclusion in responses |

**Total price-management-related tests: 38**

---

## Existing Coverage

### test_price_lists.py

| # | Test Name | What It Covers |
|---|-----------|---------------|
| 1 | `test_list_price_lists` | GET active lists with customer counts |
| 2 | `test_list_price_lists_filter_inactive` | GET with `active=false` filter |
| 3 | `test_create_price_list_from_retail` | POST creates list, copies retail prices to PriceListItems |
| 4 | `test_create_price_list_copy_from` | POST with `copy_from` copies from another list |
| 5 | `test_create_price_list_duplicate_name` | POST with duplicate name returns 422 |
| 6 | `test_rename_price_list` | PATCH renames successfully |
| 7 | `test_rename_price_list_not_found` | PATCH on non-existent ID returns 404 |
| 8 | `test_archive_price_list_converts_overrides` | Archive converts customer assignments to CustomerPrice overrides, clears price_list_id |
| 9 | `test_restore_price_list` | Restore sets is_active back to True |
| 10 | `test_matrix_returns_correct_structure` | GET matrix returns correct shape with price_lists and items |
| 11 | `test_update_price_list_item` | PATCH updates existing cell price |
| 12 | `test_update_price_list_item_creates_if_missing` | PATCH creates PriceListItem if not exists |
| 13 | `test_bulk_update_price_list_items` | PATCH bulk sets price for multiple items |
| 14 | `test_update_retail_price` | PATCH retail updates SalesItem.retail_price |
| 15 | `test_impact_preview` | GET impact shows affected customer counts |
| 16 | `test_impact_preview_with_override` | Impact preview correctly excludes customers with overrides |
| 17 | `test_export_matrix_csv` | GET export returns CSV with correct headers |

### test_customer_pricing.py

| # | Test Name | What It Covers |
|---|-----------|---------------|
| 1 | `test_customer_pricing_grid` | Full grid with effective prices, price_list source |
| 2 | `test_customer_pricing_with_override` | Override takes precedence, source = "override" |
| 3 | `test_customer_pricing_retail_fallback` | Customer with no price list falls back to retail |
| 4 | `test_customer_pricing_not_found` | 404 for non-existent customer |
| 5 | `test_set_customer_price_create` | POST creates new override |
| 6 | `test_set_customer_price_update` | POST updates existing override |
| 7 | `test_remove_customer_price` | DELETE removes override, verifies DB deletion |
| 8 | `test_remove_customer_price_not_found` | DELETE returns 404 when no override exists |
| 9 | `test_bulk_set_price` | Bulk set_price creates/updates overrides |
| 10 | `test_bulk_remove_overrides` | Bulk remove_overrides deletes specified overrides |
| 11 | `test_bulk_reset_to_list` | Bulk reset_to_list sets override to price list price |
| 12 | `test_item_pricing_view` | Item-centric view returns all customers' prices |
| 13 | `test_item_pricing_not_found` | 404 for non-existent sales item |
| 14 | `test_anomaly_flag` | Override >20% off from list price flags anomaly=True |
| 15 | `test_no_anomaly_within_threshold` | Override within 20% has anomaly=False |
| 16 | `test_export_customer_pricing_csv` | GET export returns CSV with correct headers |

---

## Missing Tests

### Critical (blocks correctness or data integrity)

| # | Missing Test | Why Critical | File |
|---|-------------|-------------|------|
| C1 | **PriceChangeLog audit trail verification** | Every price mutation (create, update, delete) calls `log_price_change()` but no test verifies that `PriceChangeLog` rows are actually written with correct data. If logging silently fails or writes wrong values, the audit trail is broken. | `test_price_lists.py`, `test_customer_pricing.py` |
| C2 | **Archive price list skips existing overrides** | `archive_price_list()` explicitly skips creating CustomerPrice rows where overrides already exist (line 348 of service). No test covers the case where a customer already has an override for some items — verifying the existing override is preserved and not overwritten. | `test_price_lists.py` |
| C3 | **Archive price list with multiple customers** | The archive test uses a single customer. No test verifies correct behavior when multiple customers are on the same price list — all should be converted, all should get price_list_id=None. | `test_price_lists.py` |
| C4 | **CSV import for price list (happy path + edge cases)** | `POST /price-lists/{id}/import` is completely untested. This endpoint parses CSV, matches sales items by name, creates/updates PriceListItems, and returns updated/not_found counts. | `test_price_lists.py` |
| C5 | **CSV import for customer prices** | `POST /customers/{id}/prices/import` is completely untested. Same risk profile as C4 — CSV parsing, name matching, create vs update logic. | `test_customer_pricing.py` |
| C6 | **Bulk reset_to_list when customer has no price list** | `reset_to_list` only creates overrides when `customer.price_list_id` is set and a PriceListItem exists. No test verifies it returns `affected_count=0` (or handles gracefully) when the customer has no price list assigned. | `test_customer_pricing.py` |
| C7 | **Rename price list to duplicate name** | PATCH rename checks uniqueness but there's no test for the 422 case when renaming to a name that already exists. | `test_price_lists.py` |

### Important (significant functionality gaps)

| # | Missing Test | Why Important | File |
|---|-------------|--------------|------|
| I1 | **Inline edit with negative price** | The endpoint validates `price < 0` returns 422, but no test covers this path. Same for invalid string (e.g., "abc"). | `test_price_lists.py` |
| I2 | **Inline edit with missing price field** | `update_price_list_item()` checks `body.get("price") is None` and returns 422. Not tested. | `test_price_lists.py` |
| I3 | **Inline edit with non-existent price list or sales item** | The 404 path when either entity doesn't exist on create-if-missing is untested. | `test_price_lists.py` |
| I4 | **Retail price update with negative price** | Validation returns 422 for negative prices — not tested. | `test_price_lists.py` |
| I5 | **Retail price update with non-existent sales item** | Returns 404 — not tested. | `test_price_lists.py` |
| I6 | **Bulk price list update with non-existent price list** | Returns 404 — not tested. | `test_price_lists.py` |
| I7 | **Bulk price list update creates items that don't exist yet** | The bulk endpoint creates PriceListItems for sales_item_ids that don't have one. Only the update path is tested. | `test_price_lists.py` |
| I8 | **Impact preview with non-existent PriceListItem** | Returns 404 — not tested. | `test_price_lists.py` |
| I9 | **Impact preview with empty new_price query param** | Returns 422 — not tested. | `test_price_lists.py` |
| I10 | **Impact preview with invalid new_price** | Non-numeric new_price returns 422 — not tested. | `test_price_lists.py` |
| I11 | **Set customer price with non-existent customer** | Returns 404 — not tested. | `test_customer_pricing.py` |
| I12 | **Set customer price with non-existent sales item** | Returns 404 — not tested. | `test_customer_pricing.py` |
| I13 | **Bulk customer prices with non-existent customer** | Returns 404 — not tested. | `test_customer_pricing.py` |
| I14 | **Bulk set_price without providing price** | Returns 422 — not tested. | `test_customer_pricing.py` |
| I15 | **List price lists with active=None (all)** | No test for fetching both active and inactive lists at once. | `test_price_lists.py` |
| I16 | **Matrix with no price lists or no sales items** | Empty state — should return empty arrays. Not tested. | `test_price_lists.py` |
| I17 | **Create price list with copy_from pointing to non-existent list** | Returns 404 — not tested. | `test_price_lists.py` |
| I18 | **Archive a non-existent price list** | Returns 404 — not tested. | `test_price_lists.py` |
| I19 | **Restore a non-existent price list** | Returns 404 — not tested. | `test_price_lists.py` |
| I20 | **Customer pricing grid with inactive sales items excluded** | The service filters `is_active=True` for sales items. No test verifies archived items are excluded from the grid. | `test_customer_pricing.py` |

### Nice-to-Have (completeness, edge cases, robustness)

| # | Missing Test | Rationale | File |
|---|-------------|-----------|------|
| N1 | **Price formatting edge cases** | Prices with `$`, commas, spaces (e.g., "$1,234.56") are cleaned by the endpoint. No test covers this currency-string parsing. | `test_price_lists.py` |
| N2 | **Export CSV content validation** | Both export tests only check headers exist. They don't verify actual price values appear in the CSV body. | Both test files |
| N3 | **Anomaly detection boundary (exactly 20%)** | Tests cover >20% and <20% but not the exact boundary (20.0% variance). | `test_customer_pricing.py` |
| N4 | **Anomaly when list price is zero** | `_is_anomaly()` returns False when `list_price == 0`. Not tested. | `test_customer_pricing.py` |
| N5 | **Anomaly when no list price (retail-only customer)** | `_is_anomaly()` returns False when `list_price is None`. Not tested directly. | `test_customer_pricing.py` |
| N6 | **Item-centric view with override present** | The item-centric test only checks price_list source. No test verifies overrides appear correctly in the item view. | `test_customer_pricing.py` |
| N7 | **Item-centric view with customer with no price list** | Retail fallback in item-centric view. | `test_customer_pricing.py` |
| N8 | **CSV import with malformed CSV** | Missing headers, empty rows, non-UTF8 encoding. | Both test files |
| N9 | **CSV import with duplicate sales item names in file** | Last-write-wins vs first-write behavior. | Both test files |
| N10 | **Bulk operations with empty sales_item_ids list** | Should return affected_count=0. | Both test files |
| N11 | **Concurrent archive of same price list** | Race condition — IntegrityError catch on line 365 of service. | `test_price_lists.py` |
| N12 | **Schema validation: empty name on price list create** | Pydantic validator rejects empty/whitespace name. Not tested at API level. | `test_price_lists.py` |
| N13 | **Schema validation: negative price on customer override** | Pydantic validator rejects negative. Not tested at API level. | `test_customer_pricing.py` |
| N14 | **Schema validation: invalid action on bulk customer prices** | Pydantic validator rejects unknown actions. Not tested at API level. | `test_customer_pricing.py` |
| N15 | **`get_effective_price()` service function** | This standalone function is only used indirectly through the grid endpoint. No unit test calls it directly. | New file or `test_customer_pricing.py` |
| N16 | **Customer pricing summary override_percentage calculation** | The percentage math (override_count/total * 100) is untested in isolation. | `test_customer_pricing.py` |

---

## Recommended Test Plan

### Phase 1: Close Critical Gaps (do first)

1. **Add PriceChangeLog assertion** to at least one test per mutation type:
   - After `test_update_price_list_item`: assert a PriceChangeLog row exists with change_type="price_list_item", action="updated", correct old/new prices.
   - After `test_set_customer_price_create`: assert log with change_type="customer_override", action="created".
   - After `test_remove_customer_price`: assert log with action="deleted".
   - After `test_update_retail_price`: assert log with change_type="retail_price".

2. **Add CSV import tests** (both endpoints):
   - `test_import_price_list_csv_happy_path`: Upload CSV with known sales item names, verify PriceListItems updated, counts correct.
   - `test_import_price_list_csv_not_found_items`: CSV with unknown item names, verify not_found_count incremented.
   - `test_import_customer_prices_csv_happy_path`: Same pattern for customer pricing import.
   - `test_import_customer_prices_csv_creates_and_updates`: Mix of new overrides and existing ones.

3. **Add archive edge case tests**:
   - `test_archive_preserves_existing_overrides`: Customer with existing override on one item, list price on others. Archive should only create overrides for non-override items.
   - `test_archive_multiple_customers`: Two customers on same list, both get converted.

4. **Add rename duplicate name test**:
   - `test_rename_price_list_duplicate_name`: Rename to existing name returns 422.

5. **Add bulk reset_to_list no-list-assigned test**:
   - `test_bulk_reset_to_list_no_price_list`: Customer with no price_list_id, verify affected_count=0.

### Phase 2: Important Validation & 404 Paths

6. Add validation error tests for inline edit (negative price, missing price, invalid string).
7. Add 404 tests for: retail price update, impact preview, create with bad copy_from, archive/restore non-existent.
8. Add empty-state test for matrix endpoint.
9. Add customer pricing grid with archived sales items excluded.

### Phase 3: Robustness & Edge Cases

10. Add price formatting tests (currency strings with $, commas).
11. Add CSV content validation to export tests.
12. Add anomaly boundary tests (exact 20%, zero list price).
13. Add schema validation tests at API level.

---

## Coverage Summary

| Category | Tested | Missing | Coverage Estimate |
|----------|--------|---------|-------------------|
| Price List CRUD | 5/7 endpoints | import CSV, rename-duplicate | ~75% |
| Price List Matrix | 3/3 core paths | empty state, inactive items | ~80% |
| Price List Inline Edit | 2/2 happy paths | validation errors, 404s | ~50% |
| Price List Bulk | 1/1 happy path | 404, create-if-missing | ~40% |
| Impact Preview | 2/2 happy paths | 404, validation errors | ~60% |
| Customer Pricing Grid | 4/4 core paths | archived item exclusion | ~90% |
| Customer Override CRUD | 4/4 happy paths | 404s for customer/sales_item | ~70% |
| Customer Bulk Actions | 3/3 actions | no-list edge case, validation | ~75% |
| Item-Centric View | 2/2 paths | override in item view | ~70% |
| Anomaly Detection | 2/2 paths | boundary, zero, null | ~70% |
| CSV Export | 2/2 endpoints | content validation | ~60% |
| CSV Import | 0/2 endpoints | completely untested | **0%** |
| PriceChangeLog | 0 assertions | completely untested | **0%** |
| Schema Validation | 0 API-level tests | all validators untested | **0%** |

**Overall backend test coverage for 004-price-management: ~55-60%**

The two biggest gaps are CSV import (two entirely untested endpoints) and PriceChangeLog verification (the audit trail is written but never asserted on). These should be the top priority.
