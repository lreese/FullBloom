# Test Coverage Report: Users & RBAC

**Reviewed**: 2026-04-12 | **Branch**: `008-users-rbac`  
**Result**: 277 passed, 0 failed

---

## Passing Tests

**test_permissions.py (13 tests)** — `has_permission()` exercised across all four roles for read/write, plus invalid role/area guards. Every branch hit.

**test_jwt.py (4 tests)** — `decode_supabase_jwt()` covers valid token, expired, malformed, and wrong secret.

**test_auth.py (13 tests)** — `/auth/me`, `/auth/permissions`, `/profile` GET/PUT. Covers correct permissions per role, 401 without auth, 401 for deactivated, 401 for invalid token.

**test_users.py (27 tests)** — All six user management endpoints with happy path, 401, 403, 404, 422, and 409 last-admin guard.

**entered_by/salesperson_email migration** — Tests in counts, estimates, customer_counts, and standing_orders assert `entered_by` is set to the auth user's email.

---

## Missing Tests

### 1. `pending` user not blocked from authentication
`apps/api/app/auth/dependencies.py:18`

`get_current_user` only blocks `deactivated`. No test verifies that `pending` users are (or aren't) blocked. Needs either a policy decision + test, or a fix (see security review H6).

### 2. `salesperson_email` auto-population when field omitted
`apps/api/app/routers/orders.py:112-113`

No test submits an order without `salesperson_email` and asserts the authenticated user's email is used as default.

### 3. `data_manager` role has no fixture or integration test
No `data_manager_user` fixture in conftest.py. The role is tested at the pure-function level in `test_permissions.py` but not at the HTTP level.

---

## Shallow Tests

### 1. Existing router tests only use `auth_headers_admin`
All modified test files pass `auth_headers_admin`. The `require_permission` decorators on write endpoints are not exercised with lower-privilege roles. For example, `PUT /counts` requires `inventory_counts:write` — no test proves a `salesperson` gets 403 on it.

### 2. Missing token without required claims
`test_jwt.py` — `decode_supabase_jwt` requires `sub` and `exp` claims but there's no test for a token that omits one.

### 3. Deactivating a pending admin not tested
`apps/api/app/routers/users.py:80` — The last-admin guard only fires when `target.status == "active"`. Deactivating a `pending` admin bypasses the guard. Untested edge case.

---

## Recommendations

1. Add `data_manager_user` and `auth_headers_data_manager` fixtures to conftest.py
2. Add cross-role integration tests: at least one test per restricted area proving the correct role gets 403
3. Add test for order creation without `salesperson_email` field
4. Add test for JWT missing required claims (`sub` or `exp`)
5. Decide on `pending` user policy and add corresponding test
