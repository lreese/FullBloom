# Test Coverage Report — 006-order-improvements

**Branch:** 006-order-improvements  
**Date:** 2026-04-12  
**Test command:** `cd apps/api && python -m pytest -v`  
**Result:** 158 passed, 0 failed, 0 errors

---

## Summary

All 158 tests pass. The suite runs in under 1 second against an in-memory SQLite database via the conftest `initialize_db` autouse fixture. The 006-order-improvements scope added 18 new tests across two files:

| File | New Tests |
|---|---|
| `tests/test_customers.py` | 5 |
| `tests/test_orders.py` | 13 |

---

## Passing Tests

### Customer search (`tests/test_customers.py`)

All five search tests pass and together provide solid coverage of the `GET /api/v1/customers?search=` parameter added in this branch:

- `test_search_by_name_partial` — partial substring match on name
- `test_search_by_customer_number` — partial substring match on customer_number
- `test_search_case_insensitive` — uppercase query against mixed-case data
- `test_search_no_results` — empty result set when no match
- `test_no_search_returns_all` — baseline; no search param returns only active customers (default active=True)

### Order list (`tests/test_orders.py`)

- `test_list_orders_empty` — empty response structure with correct defaults
- `test_list_orders_with_data` — sorting (newest first), `lines_count`, `total_stems` aggregation
- `test_list_orders_pagination` — offset/limit mechanics, `total` reflects full count
- `test_list_orders_date_range_filter` — `date_from`/`date_to` filtering
- `test_list_orders_customer_filter` — `customer_id` filter isolation
- `test_list_orders_search_by_order_number` — `search` param against `order_number`
- `test_list_orders_search_by_customer_name` — `search` param against related `customer.name`

### Order update (`tests/test_orders.py`)

- `test_update_order_header_fields` — header-only patch (ship_via, order_notes)
- `test_update_order_add_line` — append a new line to existing order
- `test_update_order_remove_line` — omit a line from payload to delete it
- `test_update_order_modify_line` — change stems/price on existing line
- `test_update_order_creates_audit_log` — audit log written with correct action and changed fields
- `test_update_order_not_found` — 404 on unknown order_id
- `test_update_order_effective_price_calculation` — `effective_price = (price * (1 + fee_pct)) + fee_dollar`

### Order delete (`tests/test_orders.py`)

- `test_delete_order_success` — 200 with `deleted: true`, order removed from DB
- `test_delete_order_not_found` — 404 on unknown order_id
- `test_delete_order_creates_audit_log` — test exists, see note in Shallow Tests

### Audit log retrieval (`tests/test_orders.py`)

- `test_audit_log_retrieval` — returns entries in reverse-chronological order, verifies `action`, `entered_by`
- `test_audit_log_not_found` — 404 when order_id does not exist

### Create order (`tests/test_orders.py`)

- `test_create_order_audit_log_written` — verifies `action == "created"` in audit log post-create

---

## Missing Tests

### `GET /api/v1/orders/{order_id}` — no direct test

`apps/api/app/routers/orders.py:223` — The `get_order` endpoint (single order detail) has no test of its own. The update tests indirectly validate that the response structure is correct, but no test hits `GET /api/v1/orders/{id}` directly and asserts the detail fields or a 404 response.

### `force_duplicate=true` bypass — untested

`apps/api/app/services/order_service.py:73` — The `force_duplicate` flag on `OrderCreateRequest` skips the duplicate check. There is no test that submits the same order twice with `force_duplicate=true` and asserts it succeeds (returns 201, not 409).

### Duplicate detection (409) — untested

`apps/api/app/services/order_service.py:76` — `DuplicateOrderError` is raised when the same customer + date + line signature is submitted twice. The router maps this to a 409 response. No test covers this path at the HTTP layer. The `check_duplicate` function itself is also not unit-tested.

### Invalid `sales_item_id` on create — untested

`apps/api/app/services/order_service.py:111` — If a `sales_item_id` in the lines payload does not exist, the service raises `ValueError("SalesItem {id} not found")`, which the router maps to 422. No test covers this.

### Invalid `customer_id` on create — untested

`apps/api/app/services/order_service.py:69-71` — Submitting a non-existent `customer_id` to `POST /api/v1/orders` raises a ValueError → 422. No test covers this path.

### Empty lines on create — untested

`apps/api/app/schemas/order.py:47-51` — The `lines_must_not_be_empty` validator rejects an empty `lines: []` with a 422. No test covers schema-level validation failures.

### Zero/negative stems on create or update — untested

`apps/api/app/schemas/order.py:23-28` and `app/schemas/order.py:149-154` — Both `OrderLineCreateRequest` and `OrderLineUpdateRequest` have `stems_must_be_positive`. No test passes `stems: 0` or `stems: -1` and asserts 422.

### `salesperson_email` list filter — untested

`apps/api/app/routers/orders.py:49` — The `salesperson_email` filter on `GET /api/v1/orders` is implemented but has no corresponding test.

### `search` by `po_number` — untested

`apps/api/app/routers/orders.py:53` — The search filter ORs across `order_number`, `customer.name`, and `po_number`. Only the first two are tested; `po_number` search is not.

### `limit` boundary validation — untested

`apps/api/app/routers/orders.py:31-32` — `limit` has `ge=1, le=100`. Requests with `limit=0` or `limit=101` should return 422. Not tested.

### Update with invalid `sales_item_id` — untested

`apps/api/app/services/order_service.py:238-241` — If a line in the update payload references a non-existent `sales_item_id`, the service raises ValueError → 422. Not tested.

### Audit log cascade on delete — shallow test (see below)

---

## Shallow Tests

### `test_delete_order_creates_audit_log` — does not actually verify the log

`apps/api/tests/test_orders.py:372-387` — This test is named to assert that an audit log entry is created on delete, but because `OrderAuditLog` has `on_delete=CASCADE` on the order FK, the audit log is destroyed when the order is deleted. The test acknowledges this with a comment but then only asserts `Order.get_or_none(id=order_id) is None`, which `test_delete_order_success` already covers. The intent (proving the delete service wrote an audit log before deleting) is not demonstrated. A proper approach is to either use a separate DB-level snapshot, change the cascade behavior to SET_NULL, or restructure the delete to preserve the log entry.

### `test_create_order_audit_log_written` — relies on a mock to work around a bug

`apps/api/tests/test_orders.py:436-479` — This test patches `Customer.get_or_none` to inject a `price_type` attribute that no longer exists on the Customer model. The comment labels this a "pre-existing bug." This means the create-order path is broken in production for real requests not going through the patch, and the test is masking the failure rather than surfacing it. This needs a fix in `order_service.py` (remove the `customer.price_type` reference, default to a hardcoded value, or add the field back) before the mock can be removed.

### `test_update_order_creates_audit_log` — only checks field name presence, not values

`apps/api/tests/test_orders.py:313-329` — The test confirms `ship_via` appears in the `changes` list but does not assert `old_value` (`"FedEx"`) or `new_value` (`"DHL"`). A regression in the change-capture logic (e.g., both values blank) would not be caught.

### Customer search does not test `active=false` combined with `search`

`apps/api/tests/test_customers.py` — All five tests use the default `active=True`. No test verifies that a search across inactive customers works (e.g., `?active=false&search=farm`) or that `active=null` (all customers) combined with search returns results from both active and inactive records. This is a meaningful omission given the OR logic in `customers.py:58`.

---

## Recommendations

Priority order based on risk:

1. **Fix the `customer.price_type` bug** in `order_service.py:96` — the create path is broken without the mock. Decide whether to hardcode a default, remove the field reference, or restore it on the Customer model.

2. **Add `GET /api/v1/orders/{order_id}` test** — verify 200 structure (fields, nested customer, sorted lines) and 404 for an unknown ID.

3. **Add duplicate detection tests** — one test for the 409 on a true duplicate, one for `force_duplicate=true` returning 201.

4. **Add invalid-input tests for create** — unknown `customer_id` → 422, unknown `sales_item_id` → 422, empty `lines` → 422, `stems: 0` → 422.

5. **Add `salesperson_email` filter test and `po_number` search test** to cover the untested branches in `list_orders`.

6. **Strengthen the audit log change-capture assertion** in `test_update_order_creates_audit_log` to include `old_value` and `new_value`.

7. **Add combined `active+search` customer tests** — `active=false&search=...` and `active=null&search=...` to cover the cross-product of those two parameters.

8. **Revisit delete audit log preservation** — the current cascade deletes the log with the order, making the audit log useless for deleted orders. Consider `SET_NULL` or a separate soft-delete audit log table, and update the test to actually verify the log was written.
