# Test Coverage Report — 007 Standing Orders

**Date:** 2026-04-12  
**Test file:** `apps/api/tests/test_standing_orders.py`  
**Run:** `cd apps/api && python -m pytest tests/test_standing_orders.py -v`  
**Result:** 37 passed, 0 failed (0.31s)

---

## Passing Tests

All 37 tests green. Coverage spans every endpoint and the main service paths:

| Area | Tests |
|---|---|
| POST /standing-orders | happy path, invalid customer (422), empty lines (422), invalid frequency (422), invalid days_of_week (422) |
| GET /standing-orders | default active filter, status=all, status=paused, search by customer name, filter by salesperson |
| GET /standing-orders/{id} | happy path (lines + cadence_description + days_of_week_names), 404 |
| PUT /standing-orders/{id} | header field update, line update (drop + modify + stems), audit log written with reason + field diffs, 409 when paused, 409 when cancelled |
| POST /{id}/pause | happy path, 409 when already paused, audit log with reason |
| POST /{id}/resume | happy path, 409 when active, 409 when cancelled, audit log entry |
| POST /{id}/cancel | happy path, 409 when already cancelled, cancel from paused, audit log with reason |
| POST /generate-preview | weekly Mon/Wed/Fri match, biweekly cycle (week 0 match, week 1 skip, week 2 match), already_generated flag |
| POST /generate | creates linked order with lines, skips duplicates (skip_already_generated=true), excludes paused orders, multi-day range creates correct count |
| GET /{id}/audit-log | list returns entries, 404 |

---

## Missing Tests

**1. PUT /standing-orders/{id} — 404 case**  
`apps/api/app/routers/standing_orders.py:192` — the router handles `"not found" in msg.lower()` and raises HTTP 404. No test covers `PUT /api/v1/standing-orders/<nonexistent-uuid>`.

**2. POST /standing-orders/{id}/pause — 404 case**  
`apps/api/app/routers/standing_orders.py:210` — 404 branch present, not tested.

**3. POST /standing-orders/{id}/resume — 404 case**  
`apps/api/app/routers/standing_orders.py:224` — 404 branch present, not tested.

**4. POST /standing-orders/{id}/cancel — 404 case**  
`apps/api/app/routers/standing_orders.py:238` — 404 branch present, not tested.

**5. Zero stems validator — StandingOrderLineUpdateRequest**  
`apps/api/app/schemas/standing_order.py:75-79` — `stems_must_be_positive` validator exists on `StandingOrderLineUpdateRequest` (the update path). Only the create path (`StandingOrderLineCreateRequest`) is exercised via the invalid-customer and invalid-frequency tests (which use stems=10). No test submits `stems=0` through `PUT /standing-orders/{id}`.

**6. 4-week cadence matching**  
`apps/api/app/services/standing_order_service.py:46-53` — `matches_cadence` is tested for 1-week and 2-week. The 4-week path (`frequency_weeks=4`) hits the same modulo branch as 2-week but is never exercised. A biweekly test exists; a 4-week test does not.

**7. generate with no matching active orders**  
`apps/api/app/services/standing_order_service.py:451-557` — no test calls `POST /generate` against a date range where no standing order cadence matches (e.g., requesting Tuesday only when only Mon/Wed/Fri orders exist). The response should be `orders_created=0, orders_skipped=0, order_ids=[]`.

**8. apply_to_future_orders=true**  
`apps/api/app/services/standing_order_service.py:271-330` — the `apply_to_future` branch rewrites order lines for all future linked orders. This is a significant code path (~60 lines) with no test coverage at all.

**9. generate with skip_already_generated=false**  
`apps/api/app/services/standing_order_service.py:477-479` — the `skip_already_generated=False` branch (create a duplicate order) is untested. The test `test_generate_orders_skips_duplicates` only verifies the default `true` behavior.

---

## Failing Tests

None. All 37 pass.

---

## Shallow Tests

**1. test_generate_orders_creates_linked_orders** (`test_standing_orders.py:612`)  
Verifies `order.standing_order_id` and `len(order.lines) == 2` but does not assert line field values — `price_per_stem`, `effective_price_per_stem`, `stems`, or `list_price_per_stem`. The effective price calculation (fee_pct + fee_dollar) in `generate_orders` at `standing_order_service.py:521-533` is not validated by any test.

**2. test_update_creates_audit_log** (`test_standing_orders.py:325`)  
Checks that `reason` and one changed field (`ship_via`) appear in the audit log. Does not verify the `old_value`/`new_value` structure in `changes`, which is the format external consumers depend on.

**3. test_update_lines** (`test_standing_orders.py:294`)  
Drops one line and modifies stems on another, but does not test adding a brand-new line (no `id` on the incoming line). The "new line" branch at `standing_order_service.py:231-259` is untouched.

**4. test_generate_preview_two_week_cycle** (`test_standing_orders.py:563`)  
Solid cadence check, but `already_generated` is always `False` in this test. The combination of biweekly cadence + already_generated detection is not exercised together.

**5. test_audit_log_list** (`test_standing_orders.py:684`)  
Only asserts that at least one entry exists and the oldest is `"created"`. Does not verify the `changes` field structure or that `entered_by` is captured correctly on creation.
