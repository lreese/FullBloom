# Code Review: Users & RBAC

**Reviewed**: 2026-04-12 | **Branch**: `008-users-rbac` | **Base**: `00fe38e`

## Overall Assessment

Well-structured, disciplined implementation that closely follows the spec and design. The permission matrix is clean and DRY, the auth dependency pattern is idiomatic FastAPI, and the retrofit across 22 routers was consistent. Solid test coverage on the new auth code. A few issues to address before merging.

---

## Critical Issues

### 1. No database migration for the `users` table - Fixed

The User model was added and registered in `TORTOISE_ORM`, but no aerich migration exists in `apps/api/migrations/models/`. Tests pass because they use SQLite `:memory:`, but deploying to PostgreSQL will fail. Per project constitution, migrations must always be generated via `aerich migrate`.

Fix: `cd apps/api && aerich migrate --name add_users_table && aerich upgrade`

### 2. Invite endpoint does not call Supabase's invite API - Fixed

`POST /api/v1/users/invite` creates a local User with `supabase_user_id=f"pending-{body.email}"` but never calls Supabase's `invite_user_by_email` admin API. Invited users have no way to set up credentials and log in. The placeholder `supabase_user_id` will never match a real JWT's `sub` claim.

Fix: Add HTTP call to Supabase Admin API using `SUPABASE_SERVICE_ROLE_KEY`, or redesign the flow with a registration/linking step.

### 3. Salespeople fetch double-unwraps the API response (Bug) - Fixed

In `OrderForm.tsx`:
```typescript
const resp = await api.get<{ data: Salesperson[] }>("/api/v1/users/salespeople");
setSalespeople(resp.data);
```

`api.get` already unwraps the `{data: ...}` envelope, so `resp` is already the array. `resp.data` is `undefined`, meaning the dropdown never populates — it always falls back to the text input.

Fix: `const resp = await api.get<Salesperson[]>("/api/v1/users/salespeople"); setSalespeople(resp);`

---

## Important Issues

### 4. Read permission checks missing on most GET endpoints - Fixed

Only pricing-related routers (price_lists, pricing, sales_items) apply `require_permission("area", "read")` on GET endpoints. All other routers rely solely on router-level `get_current_user`, which authenticates but doesn't authorize reads. Any authenticated user can read any area's data. (Overlaps with security review C2/C3.)

### 5. No `data_manager` test fixture or role-specific tests - Fixed

No `data_manager_user` fixture in conftest.py. The role is only tested at the pure-function level in `test_permissions.py`, not at the HTTP integration level.

### 6. Frontend `ProtectedRoute` only checks authentication, not authorization - Fixed

A field worker can navigate to `/settings/users` via URL and see the page skeleton (API call will 403, but the component renders). Design doc says ProtectedRoute should show a forbidden message for unauthorized areas.

---

## Suggestions

### 7. Role validation could use `Literal` type instead of `model_post_init` - Fixed

`InviteUserRequest` and `ChangeRoleRequest` use `model_post_init` for role validation. A `Literal["admin", "salesperson", "data_manager", "field_worker"]` type would give validation for free plus better OpenAPI schema generation.

### 8. `ProfilePage` state doesn't sync with auth context updates - Fixed

`displayName` and `phone` are initialized from `user` via `useState` but won't update if the auth context re-fetches. Minor — unlikely to cause issues in practice.

### 9. No error handling on role change/deactivate in UsersPage - Fixed

`handleRoleChange` and `handleDeactivate` call API without try/catch. The 409 last-admin guard error won't be displayed to the user. The invite handler correctly uses try/catch.

### 10. `UserWithPermissionsResponse` missing `created_at` - Fixed

`UserResponse` includes `created_at` but `UserWithPermissionsResponse` does not. Minor — only matters if profile page needs "Member since."

---

## Plan Adherence Summary

| Plan Item | Status | Notes |
|---|---|---|
| Auth config | Done | |
| Permission matrix | Done | Matches spec exactly |
| JWT validation (PyJWT) | Done | Clean implementation |
| User model | Done | Fixed missing aerich migration |
| Auth dependencies | Done | Idiomatic FastAPI pattern |
| Auth/users/profile routers | Done | Fixed missing Supabase invite |
| Auth retrofit (22 routers) | Done | Consistent pattern |
| entered_by migration | Done | Correctly server-side |
| salesperson_email defaulting | Done | |
| Frontend auth flow | Done | Clean AuthProvider → useAuth → ProtectedRoute |
| Login page | Done | Email/password + Google SSO + reset |
| Role-based sidebar | Done | Correct NAV_AREA_MAP filtering |
| Users admin page | Done | Fixed missing error handling |
| Profile page | Done | |
| Salesperson dropdown | Done | Fixed double-unwrapped API response |
| Database migration | Done | |
| Supabase invite integration | Done | |

## What Was Done Well

The permission matrix is the backbone and it's implemented cleanly — single Python dict and single TypeScript object, both identical. The auth dependency pattern is idiomatic FastAPI. Test coverage for auth, permissions, users, and JWT is thorough with good edge cases. The retrofit was done consistently. The frontend auth flow is clean and standard.
