# Research: Users & RBAC

## R1: Authentication Architecture — Supabase Auth + Local User Table

**Decision**: Use Supabase Auth for authentication (JWT issuance, session management, password reset, Google SSO). Maintain a local `users` table in FullBloom's PostgreSQL database that stores the role, display name, phone, avatar URL, and active status. The local table is keyed by `supabase_user_id` (the UUID from Supabase).

**Rationale**: Supabase handles the hard parts (password hashing, token refresh, email delivery, OAuth flows). FullBloom owns the role and profile data in its own DB, keeping the permission model independent of the auth provider. If we ever switch from Supabase, only the auth layer changes — roles and profiles stay.

**Alternatives considered**:
- Store roles in Supabase user metadata — couples role logic to the auth provider; harder to query and enforce server-side
- Custom auth from scratch — enormous security surface area; Supabase does it better
- Clerk — previously considered but Supabase Auth chosen for multi-tenant SaaS flexibility

## R2: JWT Validation on Backend

**Decision**: Create a FastAPI dependency (`get_current_user`) that extracts the Supabase JWT from the `Authorization: Bearer <token>` header, validates it using Supabase's JWT secret (or JWKS endpoint), and looks up the local User record by `supabase_user_id`. If no local record exists or the user is deactivated, return 401.

**Rationale**: Every API request must identify the user and their role. A FastAPI dependency is the standard pattern — it can be added to individual endpoints or router-level dependencies. The local User lookup ensures deactivated users are rejected even if their Supabase token is still valid.

**Alternatives considered**:
- Validate JWT only (no local lookup) — can't enforce deactivation or local role checks
- Middleware-based auth — less granular; dependency injection is more Pythonic for FastAPI

## R3: Permission Enforcement Pattern

**Decision**: Define a permission matrix as a Python dict mapping `(role, area, action)` → `bool`. Create a `require_permission(area, action)` FastAPI dependency that checks the current user's role against the matrix. Use this on every endpoint.

**Rationale**: Centralizes permission logic in one place. Easy to audit and test. The matrix matches the spec's permission table exactly. Adding a new area or role is a single dict update.

**Alternatives considered**:
- Decorator-based permissions — less composable with FastAPI's dependency injection
- Per-endpoint hardcoded role checks — duplicates logic, hard to audit
- External policy engine (OPA, Casbin) — overkill for four fixed roles

## R4: Frontend Role-Based UI

**Decision**: The `useAuth` hook exposes `user`, `role`, and helper functions like `canAccess(area, action)`. Components use `canAccess` to conditionally render nav items, buttons, and form controls. `ProtectedRoute` wraps routes and redirects to login if unauthenticated or to a "forbidden" page if the role lacks access.

**Rationale**: Centralized permission check via hook. Components don't need to know the permission matrix — they just ask "can this user do this?" The same matrix definition can be shared or mirrored between frontend and backend.

**Alternatives considered**:
- Per-component role checks with hardcoded strings — brittle, hard to maintain
- Separate route config per role — duplicates route definitions

## R5: User Invitation Flow

**Decision**: Admin enters email + role in the Users page. Backend calls Supabase's `invite_user_by_email` API which sends an invitation email. A local User record is created with status "pending" and the assigned role. When the invited user clicks the link and sets their password (or signs in with Google), a webhook or the next login triggers the local record to be marked "active".

**Rationale**: Supabase handles the invitation email and account creation. The local record pre-assigns the role so the user gets the right permissions from their first login. "Pending" status lets admins see who hasn't accepted yet.

**Alternatives considered**:
- Manual account creation (admin sets password) — poor UX, security risk
- Self-registration with admin approval — adds complexity without clear benefit at this scale

## R6: Domain Allowlist

**Decision**: Delegate email domain restriction entirely to Supabase Auth's built-in "Restrict email domains" setting (Authentication > Providers > Email). No domain validation code in FullBloom.

**Rationale**: Domain restriction is an auth concern, not an app concern. Supabase handles it at signup/invitation time. Managed via the Supabase dashboard — no redeploy needed to change allowed domains. If programmatic control is needed later, Supabase has an admin API.

**Alternatives considered**:
- Environment variable (`ALLOWED_EMAIL_DOMAINS`) — requires redeploy to change; duplicates auth-layer logic
- Database table for domains — over-engineered for this scale

## R7: Avatar Storage

**Decision**: No avatar upload in v1. The `avatar_url` field on the User model is populated automatically from the Google SSO profile picture during login. Email/password users without Google SSO see initials. No Supabase Storage dependency.

**Rationale**: For ~10-50 users, avatar upload adds meaningful complexity (file validation, storage bucket config, size limits, cleanup) with minimal payoff. Google avatars cover most users since Oregon Flowers uses Google Workspace. Initials are a clean fallback.

**Alternatives considered**:
- Supabase Storage upload — works but adds an endpoint, file validation, and storage config for marginal benefit
- Base64 in database — bloats the DB; bad practice

## R8: Migrating Existing `entered_by` and `salesperson_email`

**Decision**: After auth is in place, all endpoints that currently accept `entered_by` or `salesperson_email` from the request body will instead derive it from the authenticated user's email. The request body fields will be ignored (or removed from schemas). Existing data with `entered_by = NULL` or `"anonymous"` remains unchanged.

**Rationale**: The whole point of auth is knowing who did what. Trusting client-supplied identity fields undermines that. Both salespeople and admins can set `salesperson_email` on orders to any active salesperson via a dropdown (defaults to current user). This supports the real workflow of salespeople creating orders on behalf of each other.

**Alternatives considered**:
- Keep accepting from request body — defeats the purpose of auth
- Backfill old records — unnecessary; old data is historical
