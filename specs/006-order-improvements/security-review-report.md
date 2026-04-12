# Security Review: 006-order-improvements

**Date:** 2026-04-12
**Scope:** New and modified files in the 006-order-improvements branch.
**Auth posture:** No authentication. Clerk is planned but not yet implemented.

---

## CRITICAL

None found.

---

## HIGH

**H1 — Import endpoints are unauthenticated and accept raw bulk database writes** — DEFERRED

`apps/api/app/routers/import_data.py` lines 55-107. Pre-existing issue. Will be addressed when users/accounts/RBAC are added with Clerk.

**~~H2 — Raw SQL in import service uses f-strings~~** — CLOSED

Added module-level security docstring and inline `# SAFE:` comments on all 6 SQL blocks documenting that only `$N` placeholders are interpolated, never user-controlled values.

---

## MEDIUM

**~~M1 — `date_from` and `date_to` accept arbitrary strings; malformed input produces 500~~** — CLOSED

Typed as `datetime.date | None` in the list endpoint. FastAPI/Pydantic now validates and returns 422 on bad input.

**M2 — Line ID ownership not verified during order update** — OPEN

`apps/api/app/services/order_service.py`. A client-supplied line ID not belonging to the target order silently creates a new line instead of rejecting.

**~~M3 — `salesperson_email` has no email format validation~~** — CLOSED (was L1)

Changed `salesperson_email` to `EmailStr` in both `OrderCreateRequest` and `OrderUpdateRequest`. Installed `email-validator` dependency.

**~~M4 — `OrderAuditLog` CASCADE-deletes the audit trail on order deletion~~** — CLOSED

Orders now use soft delete (`is_deleted=True`). Audit logs are preserved since the order row is never actually removed.

**M5 — No rate limiting on any endpoint** — DEFERRED

Pre-existing. Will be addressed with `slowapi` when multi-user support is added.

**M6 — CORS misconfiguration risk in production** — DEFERRED

Pre-existing. Will add startup assertion when deploying to production.

---

## LOW

**L1** — Merged into M3 (closed).

**L2** — `customer_id` and `sales_item_id` are `str` instead of `UUID` in request schemas. Invalid UUIDs produce 500s. OPEN.

**L3** — `order_id` route parameters are `str` not `UUID`. Same issue as L2. OPEN.

**L4** — `detailCache` in OrdersPage never invalidated after edit. Stale data shown on return. OPEN.

**L5** — `order_date` accepted as `str` in request schemas. Should be `datetime.date`. OPEN.

---

## Cleared (Not a Finding)

- **XSS** — all order fields rendered as React text nodes. No `dangerouslySetInnerHTML`.
- **Mass assignment** — `update_order` explicitly iterates allowed fields. `customer_id` cannot be changed via PUT.
- **Customer lock bypass** — `OrderUpdateRequest` has no `customer_id` field server-side.
- **SQL injection** — all ORM filter calls use parameterised queries.
- **ProductPickerPanel data exposure** — only renders current customer's pricing.
- **CSRF** — stateless API, no session cookies. Re-review when Clerk is added.
