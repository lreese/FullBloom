# Code Review: 007-Standing-Orders

**Reviewer**: Claude Opus 4.6  
**Date**: 2026-04-12  
**Branch**: `007-standing-orders`  
**Backend Tests**: 210 passing (37 standing-order-specific)

---

## Overall Assessment

This is a well-structured implementation that closely follows the spec and existing codebase patterns. The data model, service layer, router, and frontend are all consistent with the established architecture from order management. The cadence matching, status transitions, audit logging, and order generation all work correctly. Test coverage is solid across happy paths and edge cases.

What follows are issues worth addressing, roughly in priority order.

---

## Critical Issues

### C1. `matches_cadence` produces incorrect results for dates before `reference_date`

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/standing_order_service.py`, line 52

```python
weeks_diff = (target_date - so.reference_date).days // 7
return weeks_diff % so.frequency_weeks == 0
```

Python's `//` operator does floor division, so when `target_date` is before `reference_date`, `days` is negative. For example, if `reference_date` is April 13 and `target_date` is April 6 (7 days earlier): `(-7) // 7 = -1`, and `-1 % 2 = 1` in Python (not 0). This means a biweekly cadence would **not** match the week before the reference date, which is probably fine for forward generation but could cause confusing behavior if someone sets a reference date in the future and generates for earlier dates.

More critically, `(-3) // 7 = -1` (not 0), which means a date 3 days before the reference date in the same week gets `weeks_diff = -1`. For a biweekly cadence: `-1 % 2 = 1`, so it won't match -- even though it's in the same "week" as the reference date.

**Recommendation**: Use `abs()` on the day difference, or ensure the division rounds toward zero:

```python
weeks_diff = abs((target_date - so.reference_date).days) // 7
return weeks_diff % so.frequency_weeks == 0
```

This is low-risk today since generation typically runs forward from a reference date in the past, but it's a correctness issue that will bite if usage patterns change.

---

## Important Issues

### I1. Frontend `GenerateOrdersDialog` sends extra fields the backend ignores

**File**: `/Users/landonreese/Dev/FullBloom/apps/web/src/components/standing-orders/GenerateOrdersDialog.tsx`, line 206-212

The dialog sends `standing_order_ids` and `dates` in the generate request, but the backend `GenerateRequest` schema only accepts `date_from`, `date_to`, and `skip_already_generated`. Pydantic silently strips the extra fields (default behavior), so the backend generates for **all** active standing orders in the range, not just the ones the user selected in the UI.

This means if a user unchecks a specific standing order row in the preview, it still gets generated. The selection UI is misleading.

**Recommendation**: Either (a) add `standing_order_ids: list[str] | None = None` to the `GenerateRequest` schema and filter by it in `generate_orders`, or (b) remove the per-row checkbox from the dialog and only allow date-range control. Option (a) is the better UX.

### I2. `StatusChangeRequest.reason` is optional, but spec says pause and cancel require a reason

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/schemas/standing_order.py`, line 118-119

```python
class StatusChangeRequest(BaseModel):
    reason: str | None = None
```

The spec (FR-020, FR-022) states pause requires a reason and cancel requires a reason. The data model doc also says "Required for update/pause/cancel." The backend accepts `null` reasons for both. The frontend's pause dialog also labels the reason as "(optional)".

**Recommendation**: Make `reason` required (non-None `str`) on pause and cancel. You could either add separate schemas (`PauseRequest` with required reason, `ResumeRequest` with optional reason) or validate in the service layer. The frontend pause dialog label should also drop "(optional)".

### I3. `standing_order_badge` field specified in API contract is not implemented

The API contract (`contracts/api-v1.md`) specifies that the orders list response should include `"standing_order_badge": true`. The backend returns `standing_order_id` (which is correct and sufficient), but `standing_order_badge` is missing. The frontend correctly derives the badge from `standing_order_id` being non-null, so functionality works.

**Recommendation**: Either add `standing_order_badge: bool` to `OrderListItemResponse` or update the API contract to remove it. Since the frontend already works without it, updating the contract is simplest.

### I4. `salesperson_email` filter on standing orders list extracts options from the currently-filtered results

**File**: `/Users/landonreese/Dev/FullBloom/apps/web/src/pages/StandingOrdersPage.tsx`, lines 96-100

The salesperson dropdown is populated from the current query results. If you filter to "active" status and an email only appears on paused orders, that email won't show in the dropdown. Changing status filters changes the available salesperson options, which is confusing.

**Recommendation**: Fetch salesperson options from an "all" status query, or add a dedicated endpoint/query. Low priority since the user count is small, but it's a UX rough edge.

### I5. `update_standing_order` saves header even when only `reason` changes

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/standing_order_service.py`, line 154

```python
if update_data:
    await so.save()
```

After popping `lines`, `reason`, and `apply_to_future_orders`, `update_data` may still contain fields that haven't changed. The `so.save()` always fires if any fields were sent in the request, even if values are identical. This triggers an `updated_at` change on every PUT even if nothing actually changed.

This isn't a bug per se, but it means the audit log can record "updated" entries with empty changes lists when only the reason field was meaningfully submitted. The `changes` list will be empty because the string comparison catches identical values, but the save still updates `updated_at`.

**Recommendation**: Only call `so.save()` when `changes` is non-empty for header fields, or skip the save when no actual header diffs are detected.

---

## Suggestions

### S1. `generate_preview` and `generate_orders` iterate day-by-day with DB queries per day per standing order

Both functions use a `while current <= date_to` loop, and `generate_preview` runs an `Order.filter()` query inside the inner loop for each standing order + date combination. For a 2-week range with 10 standing orders, that's potentially 140 DB queries just for the preview.

At personal-project scale this is fine (the spec calls for preview under 2 seconds, which it'll hit easily). But if usage grows, batch the duplicate-check query: fetch all existing orders for the date range + standing order IDs in one query, then check the result set in memory.

### S2. No date validation on generate endpoints

`GeneratePreviewRequest` and `GenerateRequest` don't validate that `date_from <= date_to`. Swapped dates silently return zero matches (the while loop never executes), which isn't harmful but could confuse users.

### S3. `apply_to_future_orders` logic re-fetches customer and sales items individually per line per order

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/standing_order_service.py`, lines 284-330

In the "apply to future orders" path, each future order loops through each standing order line and does individual `SalesItem.get()` and `CustomerPrice.get_or_none()` calls. The main `generate_orders` path is smarter about this -- it batch-fetches customer prices with `filter(sales_item_id__in=si_ids)`. The apply-to-future path should use the same pattern.

### S4. Missing pagination on standing orders list

The orders list has pagination (`offset`/`limit`). Standing orders list does not. Fine for tens of records, but worth noting as a gap if the feature sees heavy use.

### S5. No `structlog` usage in the new router

Per the project memory note about the structlog gap, the new `standing_orders.py` router doesn't use structlog. Consistent with the rest of the codebase (no routers use it yet), so this is a known tech debt item, not specific to this feature.

### S6. Audit log `entered_by` is only set on create (from `salesperson_email`)

The `create_standing_order` function sets `entered_by=data.salesperson_email`. The `update_standing_order` accepts an `entered_by` parameter but the router doesn't pass it. Status change endpoints (`pause_standing_order`, `resume_standing_order`, `cancel_standing_order`) also accept `entered_by` but it's never populated. This means most audit entries have `entered_by = None`.

This is a known gap -- the auth security fixes memory note already flags this for when Clerk is added. Just calling it out for completeness.

---

## Spec Compliance Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-001 Create with all fields | PASS | |
| FR-002 Single status at a time | PASS | |
| FR-003 Default active | PASS | |
| FR-004 Edit active only | PASS | Returns 409 for non-active |
| FR-005 Soft delete (cancel) | PASS | |
| FR-006 Dedicated list view | PASS | |
| FR-007 Filter by status | PASS | |
| FR-007a Filter by salesperson | PASS | |
| FR-008 Search by customer | PASS | |
| FR-009 Row displays | PASS | |
| FR-010 Default active filter | PASS | |
| FR-011 Generate orders | PASS | |
| FR-012 Cadence matching | PASS (see C1 for edge case) | |
| FR-013 Generation preview | PASS | |
| FR-014 Linked orders | PASS | |
| FR-015 Filter + badge | PASS | Badge derived from standing_order_id |
| FR-016 Duplicate detection | PASS | |
| FR-017 Exclude paused/cancelled | PASS | |
| FR-018 Apply to future | PASS | |
| FR-019 Choose apply or not | PASS | |
| FR-020 Pause with reason | PARTIAL (I2) | Reason not enforced server-side |
| FR-021 Resume | PASS | |
| FR-022 Cancel with reason | PARTIAL (I2) | Reason not enforced server-side |
| FR-023 Audit on every change | PASS | |
| FR-024 Audit captures who/when/what/why | PARTIAL (S6) | `entered_by` not populated (known, pre-auth) |
| FR-025 Audit viewable | PASS | |
| FR-026 Test coverage | PASS | 37 tests covering all major flows |

---

## Files Reviewed

- `/Users/landonreese/Dev/FullBloom/apps/api/app/models/standing_order.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/schemas/standing_order.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/services/standing_order_service.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/routers/standing_orders.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/routers/orders.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/schemas/order.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/models/order.py`
- `/Users/landonreese/Dev/FullBloom/apps/api/tests/test_standing_orders.py`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/pages/StandingOrdersPage.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/components/standing-orders/StandingOrderForm.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/components/standing-orders/CadencePicker.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/components/standing-orders/GenerateOrdersDialog.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/components/standing-orders/StandingOrderAuditLog.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/pages/OrdersPage.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/types/standing-order.ts`
- `/Users/landonreese/Dev/FullBloom/apps/web/src/App.tsx`
- `/Users/landonreese/Dev/FullBloom/apps/api/app/main.py`
- `/Users/landonreese/Dev/FullBloom/specs/007-standing-orders/spec.md`
- `/Users/landonreese/Dev/FullBloom/specs/007-standing-orders/data-model.md`
- `/Users/landonreese/Dev/FullBloom/specs/007-standing-orders/contracts/api-v1.md`
- `/Users/landonreese/Dev/FullBloom/specs/007-standing-orders/plan.md`
