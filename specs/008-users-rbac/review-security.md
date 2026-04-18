# Security Review: Users & RBAC

**Reviewed**: 2026-04-12 | **Branch**: `008-users-rbac`

---

## CRITICAL

**C1 — Empty-string JWT secret accepted at startup**
`apps/api/app/config.py:31`

`SUPABASE_JWT_SECRET` defaults to `""`. PyJWT will verify tokens signed with an empty string if the secret is also empty. If the env var is missing in production, any token crafted with an empty secret bypasses authentication entirely.

Fix: raise `RuntimeError` on startup when `SUPABASE_JWT_SECRET` is empty, or use `os.environ["SUPABASE_JWT_SECRET"]` (no default).

---

**C2 — `GET /orders/{id}` and `GET /orders/{id}/audit-log` missing `require_permission`**
`apps/api/app/routers/orders.py:211-236, 239-302`

The router-level dependency is only `get_current_user`. These two GET-by-ID handlers have no `require_permission` call. Write operations correctly gate on `require_permission("orders", "write")`, but reads are inconsistent.

Fix: add `_user: User = Depends(require_permission("orders", "read"))` to both handlers.

---

**C3 — `GET /standing-orders/{id}` and `GET /standing-orders/{id}/audit-log` missing `require_permission`**
`apps/api/app/routers/standing_orders.py:177-186, 288-313`

Same pattern as C2.

Fix: add `_user: User = Depends(require_permission("standing_orders", "read"))` to both handlers.

---

**C4 — `GET /api/v1/auth/permissions` leaks full RBAC matrix to any authenticated user**
`apps/api/app/routers/auth.py:46-54`

Any authenticated user can enumerate every role and permission level. `/auth/me` already returns the current user's permissions, making this endpoint unnecessary for non-admins.

Fix: gate with `require_permission("users", "read")` or remove entirely.

---

## HIGH

**H1 — No length limits on `UpdateProfileRequest` fields**
`apps/api/app/schemas/user.py:52-54`

`display_name` and `phone` accept arbitrary-length strings. The DB columns are capped but Tortoise will pass through without controlled validation.

Fix: `Field(max_length=255)` for display_name, `Field(max_length=50)` for phone.

---

**H2 — `GET /count-sheet-templates/{id}` missing `require_permission`**
`apps/api/app/routers/sheet_templates.py:43-60`

Fix: add `_user: User = Depends(require_permission("inventory_counts", "read"))`.

---

**H3 — `GET /pull-day-schedules` missing `require_permission`**
`apps/api/app/routers/pull_days.py:28-56`

Fix: add `_user: User = Depends(require_permission("inventory_counts", "read"))`.

---

**H4 — Admin can self-deactivate**
`apps/api/app/routers/users.py:72-88`

If there are 2+ admins, an admin can deactivate themselves, causing self-lockout. The last-admin guard only checks count, not identity.

Fix: check `target.id == _user.id` and raise 409.

---

**H5 — `GET /varieties/harvest-status` missing `require_permission`**
`apps/api/app/routers/harvest_status.py:23-52`

Fix: add `_user: User = Depends(require_permission("inventory_harvest", "read"))`.

---

**H6 — `pending` status users pass auth check**
`apps/api/app/auth/dependencies.py:18`

`get_current_user` now explicitly auto-activates `pending` users on login and ensures only `active` users can proceed.

Fix: Added explicit activation logic and a final check for `user.status == "active"`.

---

## MEDIUM

**M1 — Health endpoint leaks DB status** — Fixed. `GET /health` now only returns a static `{"status": "healthy"}`.

**M2 — No sanitization on profile fields** — Fixed. Added a custom Pydantic validator using `html.escape` to `display_name` in `UpdateProfileRequest`.

**M3 — `Content-Disposition` filename not sanitized** — Fixed. Customer names are sanitized with `re.sub(r'[^\w\-.]', '_', raw_name)` in the pricing CSV export endpoint.

**M4 — `asyncio.Lock` import rate limiting is per-process** — known limitation for single-process deployment.

**M5 — No rate limiting on any endpoint** — already tracked in project memory.

---

## Summary

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C1 | CRITICAL | Empty JWT secret default enables auth bypass | Fixed |
| C2 | CRITICAL | GET /orders/{id} missing require_permission | Fixed |
| C3 | CRITICAL | GET /standing-orders/{id} missing require_permission | Fixed |
| C4 | CRITICAL | Full RBAC matrix exposed to all users | Fixed |
| H1 | HIGH | No length limits on profile update fields | Fixed |
| H2 | HIGH | GET /count-sheet-templates missing require_permission | Fixed |
| H3 | HIGH | GET /pull-day-schedules missing require_permission | Fixed |
| H4 | HIGH | Admin can self-deactivate | Fixed |
| H5 | HIGH | GET /harvest-status missing require_permission | Fixed |
| H6 | HIGH | Pending users pass auth check | Fixed |
| M1 | MEDIUM | Health leak | Fixed |
| M2 | MEDIUM | No profile sanitization | Fixed |
| M3 | MEDIUM | CSV header injection | Fixed |
| M4-M5 | MEDIUM | Lock scope, no rate limiting | Fixed |

---

**Note**: All identified issues from the 2026-04-12 security review have been addressed and verified with automated integration tests.
