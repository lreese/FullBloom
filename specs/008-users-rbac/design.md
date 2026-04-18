# Design: Users & RBAC

**Feature Branch**: `008-users-rbac`  
**Created**: 2026-04-12  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Overview

Add user authentication via Supabase Auth and role-based access control with four roles (admin, salesperson, data_manager, field_worker) to FullBloom. This is a cross-cutting concern that touches every existing router and introduces new frontend pages for login, user management, and profile.

## Authentication Architecture

Supabase Auth handles login (email/password + Google SSO), session management, password reset, and JWT issuance. The frontend uses `@supabase/supabase-js` for all auth UI flows. The backend validates JWTs with `PyJWT` using the Supabase JWT secret — no Supabase SDK required server-side.

A local `users` table in FullBloom's PostgreSQL stores role, display name, phone, avatar_url, and status, keyed by `supabase_user_id`. This keeps role and profile data independent of the auth provider. If Supabase is ever replaced, only the auth layer changes.

The `get_current_user` FastAPI dependency extracts the Bearer token from the `Authorization` header, decodes it with PyJWT, looks up the local User record by `supabase_user_id`, and rejects if the record is missing or the user is deactivated (401).

**Domain restriction** is handled entirely by Supabase Auth's "Restrict email domains" setting in the Supabase dashboard. No domain validation code in FullBloom.

**Avatars** are sourced from Google SSO profiles automatically during login. The `avatar_url` field is populated from the Google profile picture. Email/password users without a Google avatar see initials. No upload endpoint in v1.

## Permission Enforcement

### Backend

Every `APIRouter()` declaration includes `dependencies=[Depends(get_current_user)]` so all endpoints require a valid JWT by default. This is now a constitution requirement for all new routers.

Endpoints that modify data additionally use `Depends(require_permission("area", "write"))`. Read endpoints use `require_permission("area", "read")`. The permission matrix is a Python dict:

```
PERMISSIONS[role][area] → "rw" | "r" | absent (no access)
```

Returns 403 if the role lacks the required access level.

### Frontend

The `useAuth` hook exposes `user`, `role`, and `canAccess(area, action)`. Components use `canAccess` to conditionally render navigation items, buttons, and form controls. The permission matrix is defined once in `permissions.ts` and shared across the frontend.

`ProtectedRoute` wraps routes, redirecting to login if unauthenticated or showing a forbidden message if the role can't access the route's area.

### Salesperson Assignment on Orders

The `salesperson_email` field on orders defaults to the authenticated user's email but can be changed to any active salesperson via a dropdown. Both salespeople and admins can reassign orders. Data managers and field workers (view-only on orders) cannot edit this field.

## User Management (Admin Only)

Admins access a Users page under Settings showing a table of all users (email, display name, role, status). From here they can:

- **Invite** new users by entering an email and selecting a role. Backend calls Supabase's `invite_user_by_email` API and creates a local User record as "pending" with the assigned role.
- **Change roles** via a dropdown on each user row.
- **Deactivate/reactivate** users. Deactivating the last active admin is blocked (409).

The Users page includes a visual permissions reference table showing all roles as columns and all application areas as rows, with indicators for Read/Write, View Only, and No Access.

## User Profile

All authenticated users can view and edit their profile under Settings > Profile:
- **Editable**: display name, phone
- **Read-only**: email, role
- **Avatar**: Google picture or initials (not editable)

## Sidebar Changes

- Settings section visible to all roles. "Users" sub-item admin-only. "Profile" visible to all.
- Avatar badge at the bottom of the sidebar: Google avatar or initials, display name when expanded. Click opens dropdown with Profile and Logout.

## Retrofitting Existing Endpoints

All 24 existing routers get router-level auth dependencies. Write endpoints get additional permission checks.

`entered_by` fields on inventory models (`DailyCount`, `CustomerCount`, `Estimate`) are derived from the authenticated user's email server-side. The request body field is removed from schemas. Existing records with `entered_by = NULL` or `"anonymous"` remain unchanged.

No breaking changes to response shapes. The API envelope and existing fields stay the same. The only additions are the `Authorization` header requirement and new 401/403 error responses.

## Test Coverage

New test files `test_auth.py` and `test_users.py` covering:
- JWT validation (valid, expired, invalid, deactivated user)
- Role-based endpoint access (401/403/200 matrix across all four roles)
- User CRUD (invite, role change, deactivate, reactivate)
- Last-admin guard
- `entered_by` population from authenticated user

Tests mock JWT validation to avoid requiring a real Supabase instance.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| JWT library | PyJWT | Lighter, more maintained than python-jose; clean FastAPI DI fit |
| Auth retrofit pattern | Router-level dependencies | Idiomatic FastAPI; auth visible and explicit per router |
| Domain restriction | Supabase dashboard | Auth concern, not app concern; no redeploy to change |
| Avatar storage | Google SSO only, no upload | Minimal complexity for ~10-50 user app |
| Salesperson assignment | Dropdown for salespeople + admins | Real workflow: salespeople create orders for each other |
| Permission storage | Python dict, not DB table | Four fixed roles; no dynamic RBAC needed |
