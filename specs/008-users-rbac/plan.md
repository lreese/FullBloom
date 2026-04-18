# Implementation Plan: Users & RBAC

**Branch**: `008-users-rbac` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-users-rbac/spec.md`

## Summary

Add user authentication via Supabase Auth (email/password + Google SSO) and role-based access control with four roles (admin, salesperson, data_manager, field_worker). Backend validates Supabase JWTs and enforces permissions per-endpoint. Frontend adapts navigation and controls based on role. Admin user management under Settings. User profiles with avatar badges. Domain allowlist for invitations.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x (frontend)
**Primary Dependencies**: FastAPI, Tortoise ORM, Supabase Auth (backend); React, Vite, Tailwind CSS, shadcn/ui, @supabase/supabase-js (frontend)
**Storage**: PostgreSQL (local dev), Neon (production), Supabase (auth provider)
**Testing**: pytest with httpx AsyncClient (backend)
**Target Platform**: Web application (desktop-first, mobile-responsive)
**Project Type**: Web service + SPA frontend
**Performance Goals**: Login under 5 seconds; JWT validation under 50ms per request
**Constraints**: Single-tenant (Oregon Flowers); domain allowlist managed by platform operator
**Scale/Scope**: ~10-50 users; four fixed roles

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First | PASS | Spec at `specs/008-users-rbac/spec.md` |
| II. Simplicity Over Cleverness | PASS | Fixed roles as strings, no dynamic RBAC engine |
| III. Multi-Agent Architecture | N/A | No AI features |
| IV. App Isolation | PASS | All changes within `apps/api/` and `apps/web/` |
| V. Deep Observability | PASS | Audit trail integration captures authenticated user identity |
| Test Coverage | PASS | Spec includes test coverage story (P7) |
| Role Access | PASS | Permission matrix defined in spec FR-008 |
| Data Tables | N/A | Users list will use DataTable pattern |
| API Conventions | PASS | REST, versioned, envelope convention |

## Project Structure

### Documentation (this feature)

```text
specs/008-users-rbac/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-v1.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── auth/                        # New — auth utilities
│   │   ├── __init__.py
│   │   ├── supabase.py              # Supabase client, JWT validation
│   │   ├── dependencies.py          # FastAPI dependencies (get_current_user, require_role)
│   │   └── permissions.py           # Permission matrix definition
│   ├── models/user.py               # New — User model (local profile + role)
│   ├── routers/auth.py              # New — login status, user info endpoints
│   ├── routers/users.py             # New — admin user management CRUD
│   ├── schemas/user.py              # New — user schemas
│   └── routers/*.py                 # Modified — add auth dependencies to all existing routers
├── migrations/models/               # New migration for users table
└── tests/
    ├── test_auth.py                 # New — authentication tests
    └── test_users.py                # New — user management tests

apps/web/src/
├── auth/                            # New — auth context and utilities
│   ├── AuthProvider.tsx             # Supabase auth context, session management
│   ├── ProtectedRoute.tsx           # Route guard component
│   ├── LoginPage.tsx                # Login form (email/password + Google SSO)
│   └── useAuth.ts                   # Auth hook (user, role, permissions)
├── components/settings/
│   ├── UsersPage.tsx                # New — admin user management
│   ├── ProfilePage.tsx              # New — user profile editor
│   └── PermissionsMatrix.tsx        # New — visual permissions reference table
├── components/layout/
│   ├── Sidebar.tsx                  # Modified — role-based nav filtering + avatar badge
│   └── AppShell.tsx                 # Modified — wrap with AuthProvider
├── App.tsx                          # Modified — add auth routes, wrap with ProtectedRoute
└── types/user.ts                    # New — user TypeScript types
```

**Structure Decision**: Auth logic gets its own `auth/` directory in both backend and frontend. The User model is separate from the Supabase auth user — it stores the local profile (display name, phone, role, avatar) keyed by Supabase user ID. This keeps FullBloom's role/profile data independent of the auth provider.
