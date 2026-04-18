# Quickstart: Users & RBAC

## Prerequisites

- Python 3.11+ with virtualenv
- Node.js 18+
- PostgreSQL running locally
- Supabase project created (free tier) with:
  - Email/password auth enabled
  - Google OAuth provider configured (optional for dev)
  - JWT secret available

## Environment Variables

Add to `apps/api/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

Add to `apps/web/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate
pip install supabase PyJWT[crypto]

# Run migrations
aerich migrate --name add_users
aerich upgrade

# Create first admin user (seed script or manual)
python -m app.seed_admin --email admin@oregonflowers.com

# Run tests
python -m pytest tests/test_auth.py tests/test_users.py -v

# Start dev server
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd apps/web
npm install @supabase/supabase-js
npm run dev
```

## Verification

1. **Login**: Navigate to app — should redirect to login page. Enter credentials or click Google SSO.
2. **Role-based nav**: Log in as each role — verify sidebar shows only permitted items.
3. **API auth**: Call any endpoint without token — should get 401. Call with wrong role — 403.
4. **User management**: Log in as admin, go to Settings > Users. Invite a user, change a role, deactivate.
5. **Profile**: Go to Settings > Profile. Edit display name, upload avatar. Verify avatar shows in sidebar.
6. **Password reset**: Click "Forgot Password" on login page. Check email, reset, log in with new password.
7. **Domain allowlist**: Configured in Supabase dashboard (Authentication > Providers > Email > Restrict email domains) — not in app code.

## Key Files

| Area | File | What It Does |
|------|------|-------------|
| Auth utilities | `apps/api/app/auth/supabase.py` | Supabase client, JWT validation |
| Auth dependencies | `apps/api/app/auth/dependencies.py` | get_current_user, require_permission |
| Permission matrix | `apps/api/app/auth/permissions.py` | Role → area → access level mapping |
| User model | `apps/api/app/models/user.py` | Local user profile + role |
| Auth router | `apps/api/app/routers/auth.py` | /auth/me endpoint |
| Users router | `apps/api/app/routers/users.py` | Admin user management CRUD |
| User schemas | `apps/api/app/schemas/user.py` | Request/response schemas |
| Auth tests | `apps/api/tests/test_auth.py` | Authentication + authorization tests |
| User tests | `apps/api/tests/test_users.py` | User management tests |
| Auth provider | `apps/web/src/auth/AuthProvider.tsx` | Supabase session context |
| Login page | `apps/web/src/auth/LoginPage.tsx` | Email/password + Google SSO |
| Auth hook | `apps/web/src/auth/useAuth.ts` | user, role, canAccess() |
| Protected route | `apps/web/src/auth/ProtectedRoute.tsx` | Route guard |
| Users admin | `apps/web/src/components/settings/UsersPage.tsx` | User management |
| Profile | `apps/web/src/components/settings/ProfilePage.tsx` | Self-service profile |
| Permissions matrix | `apps/web/src/components/settings/PermissionsMatrix.tsx` | Visual reference table |
