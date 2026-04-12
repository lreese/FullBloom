# Code Review Report: 006-order-improvements

**Reviewer**: Claude Opus 4.6 (automated)
**Date**: 2026-04-12
**Branch**: `006-order-improvements` (uncommitted working tree changes)
**Tests**: 25/25 passing

---

## Overall Assessment

Solid implementation that closely follows the spec and implementation plan. The backend is well-structured with proper transaction usage, audit logging, and thorough test coverage. The frontend correctly extends OrderForm for edit mode, adds a functional OrdersPage with filters and expandable rows, and rewrites ProductPickerPanel to use customer pricing. The code is clean, consistent with existing patterns, and ready for use with a few issues to address.

---

## What Was Done Well

- **Spec alignment is excellent.** Every user story (1-6) and functional requirement (FR-001 through FR-019) has corresponding implementation. No scope creep detected.
- **Backend service layer** uses `in_transaction()` correctly in both `update_order` and `delete_order`, preventing partial writes.
- **Audit logging** is consistent: created on create, update, and delete -- with structured change tracking that captures field-level diffs.
- **Test coverage** is comprehensive: 20 order tests + 5 customer tests covering list/pagination/filters, CRUD operations, audit log creation, effective price calculation, and 404 cases.
- **Frontend dirty tracking** with `beforeunload` handler and `initialLoadDone` ref is a clean pattern that avoids false-positive dirty warnings on initial load.
- **ProductPickerPanel rewrite** is a significant simplification -- removed the broken `/api/v1/products` fetch and derives everything from the `customerPricing` prop.
- **OrderContextRow** properly threads `customerLocked` and `customerDefaultShipVia` without cluttering OrderForm.

---

## Critical Issues (Must Fix)

### C-1: OrderAuditLog CASCADE deletes audit history when order is deleted

`OrderAuditLog.order` uses `on_delete=fields.CASCADE`, which means deleting an order also deletes all its audit log entries. The `delete_order` service creates an audit entry *then* deletes the order in the same transaction -- so the audit log entry is immediately destroyed by the cascade.

The spec (FR-014 through FR-017, User Story 5) requires audit entries to persist as a record of what happened. The test `test_delete_order_creates_audit_log` acknowledges this in its comments but doesn't actually verify the audit log survives -- it only checks the order is gone.

**Fix**: Change the FK to `on_delete=fields.SET_NULL` and make the `order` field nullable. This lets the audit entry survive after the order is deleted. The "deleted" action entry already captures a snapshot of the order, so the FK back to the order isn't needed for the log to be useful. This requires a new migration.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/models/order.py` line 100-102

### C-2: `create_order` references `customer.price_type` which doesn't exist on the Customer model

Line 96 of `order_service.py` sets `price_type=customer.price_type`, but `Customer` has no `price_type` field (confirmed via grep). The test `test_create_order_audit_log_written` works around this with `unittest.mock.patch` to inject `price_type = "Retail"` on the fly. This means order creation via the API will fail in production for any customer without the mock.

This is a pre-existing bug that the 006 implementation didn't introduce, but the test's workaround masks it and should be noted.

**Fix**: Either add `price_type` to the Customer model, or derive it from the customer's price list, or hardcode a default. The mock in the test should be removed once the underlying issue is fixed.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/order_service.py` line 96

---

## Important Issues (Should Fix)

### I-1: `update_order` always creates an audit log entry, even when nothing changed

In `order_service.py` lines 317-323, the audit log entry is created unconditionally with `action="updated"` and `changes=changes`. When no fields actually changed (e.g., PUT with identical values), this creates a noise entry with `changes=[]`. The implementation plan (Task 3, Step 2) says "Create audit log if there were changes" with a conditional `if changes:`.

**Fix**: Wrap the `OrderAuditLog.create` call in `if changes:`.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/order_service.py` lines 317-323

### I-2: `create_order` audit log has `entered_by=None` instead of the salesperson

Line 145-150 of `order_service.py`:
```python
await OrderAuditLog.create(
    order=order,
    action="created",
    changes=[],
    entered_by=None,  # should be data.salesperson_email
)
```

The implementation plan explicitly shows `entered_by=data.salesperson_email`. This means created orders won't show who created them in the audit log.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/order_service.py` line 149

### I-3: `update_order` line change tracking is overly broad

When an existing line is updated, the audit log always records a `line_updated` change (lines 277-284) even if no fields on that line actually changed. The change entry contains `"old_value": line_id` and `"new_value": {sales_item_id, stems}` -- it doesn't capture *which* fields changed on the line.

Compare to the implementation plan which tracks per-field diffs on lines and only appends when `line_changes` is non-empty.

**Fix**: Compare old vs new values for each line field and only emit a `line_updated` change when at least one field differs. Include the specific field diffs in the change entry.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/services/order_service.py` lines 256-284

### I-4: Frontend new-line ID detection is fragile

In `OrderForm.tsx` line 351:
```typescript
id: l.id.length === 36 ? l.id : null,
```

This uses string length (36 chars) to distinguish DB UUIDs from `crypto.randomUUID()` IDs. But `crypto.randomUUID()` also returns a 36-character string (standard UUID format with hyphens). So newly-added lines will be sent with their random UUID as an existing line ID, causing the backend to try to look them up in `existing_lines` -- they won't be found, so they'll be treated as new lines anyway. This works by accident but is confusing.

**Fix**: Track which lines are new explicitly. Either use a separate `isNew` flag on `OrderLineState`, or set `id` to `""` or a prefixed value like `"new-..."` for locally-created lines.

**File**: `/Users/landonreese/Dev/FullBloom/apps/web/src/components/order/OrderForm.tsx` line 351

### I-5: `list_orders` response serialization is inconsistent

The `list_orders` endpoint uses `str(o.created_at)` for `created_at` (line 81 of `orders.py`), while `get_order` and `update_order_endpoint` also use `str(...)`. Python's `str()` on a datetime produces `2026-04-12 10:30:00+00:00` which is not ISO-8601 format. The frontend `OrderAuditLog.tsx` passes `created_at` to `new Date(iso)` which expects ISO format.

**Fix**: Use `.isoformat()` instead of `str()` for all datetime serializations, or better, define a consistent serializer in the Pydantic schemas.

**File**: `/Users/landonreese/Dev/FullBloom/apps/api/app/routers/orders.py` lines 81, 151, 255

---

## Suggestions (Nice to Have)

### S-1: Duplicated OrderDetailResponse construction

The response construction logic for `OrderDetailResponse` is copy-pasted between `update_order_endpoint` (lines 130-181) and `get_order` (lines 236-286). This is ~50 lines of identical code.

**Fix**: Extract a helper function like `_build_order_detail_response(order) -> dict` and call it from both endpoints.

### S-2: `list_orders` date params should use `date` type, not `str`

The `date_from` and `date_to` parameters are typed as `str | None` (line 33-34), so FastAPI won't validate them as dates. Invalid strings like `date_from=banana` will pass through to the ORM and cause a runtime error.

**Fix**: Use `from datetime import date` and type them as `date | None`. FastAPI will auto-parse and validate.

### S-3: Customer dropdown in OrdersPage loads all customers eagerly

`OrdersPage.tsx` line 68 fetches all active customers on mount for the filter dropdown. With hundreds of customers this is fine, but consider adding a search/autocomplete pattern consistent with `CustomerSelector` if the list grows.

### S-4: No test for salesperson filter on list endpoint

The `salesperson_email` filter is implemented but not tested. All other filters (date range, customer, search) have dedicated tests.

### S-5: ProductPickerPanel grouping uses regex parsing of item names

`parseGroupName` in `ProductPickerPanel.tsx` uses a regex to strip bunch-size suffixes from sales item names. This works for names like "Solidago 10s" but will mis-group items with names that don't follow the pattern (e.g., "Mixed Bouquet" stays as-is, which is fine, but "Lily 3s Gold" would parse to "Lily 3s Gold" instead of grouping with other Lilies).

This is acceptable for the current data but is worth noting if item naming conventions change.

### S-6: `OrdersPage` detail cache never expires

The `detailCache` ref in `OrdersPage.tsx` caches expanded order details forever within the page lifecycle. If a user edits an order in another tab and returns, they'll see stale data. Consider clearing the cache on `fetchOrders()` calls, or at minimum when returning from the edit page.

### S-7: Missing error toasts

Several catch blocks have `// TODO: toast` comments (OrdersPage lines 88, 119, 143). These should be addressed before shipping to production so users know when operations fail.

---

## Spec Compliance Matrix

| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-001: Customer search | PASS | Backend + test coverage |
| FR-002: Ship-via auto-populate | PASS | ShipViaSelector + OrderContextRow |
| FR-003: Product picker requires customer | PASS | Button disabled when no customer |
| FR-004: Product picker customer pricing | PASS | ProductPickerPanel rewritten |
| FR-005: Paginated order list | PASS | Server-side pagination |
| FR-006: Filterable by date/customer/salesperson | PASS | All filters implemented |
| FR-007: Searchable by order#/customer | PASS | Also searches PO number (bonus) |
| FR-008: Expandable rows with line items | PASS | Price override highlighting works |
| FR-009: PUT update endpoint | PASS | |
| FR-010: Reuse OrderForm for edit | PASS | |
| FR-011: Add/remove/modify lines | PASS | |
| FR-012: Recalculate effective prices | PASS | Tested in test_update_order_effective_price_calculation |
| FR-013: Unsaved changes warning | PASS | beforeunload handler |
| FR-013a: DELETE endpoint | PASS | |
| FR-013b: Delete confirmation dialog | PASS | |
| FR-014: Audit on create | PARTIAL | Entry created but entered_by is None (I-2) |
| FR-015: Audit on edit | PARTIAL | Always writes even when no changes (I-1) |
| FR-016: Line-level changes in audit | PARTIAL | Records line changes but doesn't diff fields (I-3) |
| FR-017: Audit viewable in edit view | PASS | OrderAuditLog component |
| FR-018: Backend test coverage | PASS | 25 tests passing |
| FR-019: Customer search tests | PASS | 5 tests |

---

## Summary

Two critical issues need attention: the CASCADE delete destroying audit history (C-1) is a data integrity problem that undermines the purpose of audit logging, and the `customer.price_type` bug (C-2) will crash order creation in production. The important issues (I-1 through I-5) are about audit log quality and consistency. The suggestions are polish items.

Recommended action: fix C-1 and C-2, then address I-1 through I-3 (audit log accuracy) before committing. I-4 and I-5 can be deferred.
