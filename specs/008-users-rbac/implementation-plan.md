# Users & RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Auth authentication and four-role RBAC to FullBloom, covering backend JWT validation, per-endpoint permission enforcement, frontend auth flows, and admin user management.

**Architecture:** Supabase Auth handles login/signup/password-reset. Backend validates JWTs with PyJWT, looks up a local User record for role/profile data, and enforces permissions via a centralized matrix. Frontend uses `@supabase/supabase-js` for auth state and conditionally renders UI based on role.

**Tech Stack:** PyJWT (backend JWT), @supabase/supabase-js (frontend auth), FastAPI dependencies (permission enforcement), Tortoise ORM (User model)

---

## File Structure

### Backend — New Files

```
apps/api/app/
├── auth/
│   ├── __init__.py
│   ├── supabase.py          # JWT decode with PyJWT
│   ├── dependencies.py      # get_current_user, require_permission FastAPI deps
│   └── permissions.py       # PERMISSIONS dict + helper functions
├── models/user.py           # User Tortoise model
├── routers/auth.py          # GET /auth/me
├── routers/users.py         # Admin user CRUD
├── routers/profile.py       # Self-service profile
├── schemas/user.py          # User Pydantic schemas
└── seed_admin.py            # CLI seed script

apps/api/tests/
├── test_auth.py             # Auth + permission tests
└── test_users.py            # User management tests
```

### Backend — Modified Files

```
apps/api/app/config.py                    # Add Supabase env vars
apps/api/app/main.py                      # Register new routers, add User to ORM config
apps/api/app/routers/*.py                 # Add auth dependencies to all 22 routers
apps/api/app/routers/orders.py            # salesperson_email from auth user
apps/api/app/routers/standing_orders.py   # salesperson_email from auth user
apps/api/app/routers/counts.py            # entered_by from auth user
apps/api/app/routers/customer_counts.py   # entered_by from auth user
apps/api/app/routers/estimates.py         # entered_by from auth user
apps/api/app/routers/sheet_completion.py  # completed_by from auth user
apps/api/app/schemas/inventory.py         # Remove entered_by from request schemas
apps/api/tests/conftest.py               # Add auth fixtures (mock JWT, mock users)
```

### Frontend — New Files

```
apps/web/src/
├── lib/supabase.ts                              # Supabase client init
├── auth/
│   ├── AuthProvider.tsx                          # Auth context + session management
│   ├── useAuth.ts                                # Hook: user, role, canAccess()
│   ├── ProtectedRoute.tsx                        # Route guard
│   └── LoginPage.tsx                             # Login form
├── lib/permissions.ts                            # Permission matrix (mirrors backend)
├── types/user.ts                                 # User types
├── components/settings/
│   ├── UsersPage.tsx                             # Admin user management
│   ├── ProfilePage.tsx                           # Self-service profile
│   └── PermissionsMatrix.tsx                     # Visual reference table
└── components/layout/UserBadge.tsx               # Sidebar avatar badge + dropdown
```

### Frontend — Modified Files

```
apps/web/src/services/api.ts              # Inject Authorization header
apps/web/src/components/layout/Sidebar.tsx # Role-based nav filtering + UserBadge
apps/web/src/components/layout/AppShell.tsx # Wrap with AuthProvider
apps/web/src/App.tsx                       # Add auth routes, ProtectedRoute wrapper
apps/web/src/components/order/OrderForm.tsx # salesperson_email dropdown
```

---

## Phase 1: Backend Auth Foundation

### Task 1: Auth Configuration

**Files:**
- Modify: `apps/api/app/config.py`

- [ ] **Step 1: Add Supabase env vars to config**

Add to `apps/api/app/config.py` after the existing env var declarations:

```python
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
```

- [ ] **Step 2: Update .env.example**

Add to `apps/api/.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/config.py apps/api/.env.example
git commit -m "feat: add supabase auth environment variables"
```

---

### Task 2: Permission Matrix

**Files:**
- Create: `apps/api/app/auth/__init__.py`
- Create: `apps/api/app/auth/permissions.py`
- Create: `apps/api/tests/test_permissions.py`

- [ ] **Step 1: Create auth package**

Create empty `apps/api/app/auth/__init__.py`.

- [ ] **Step 2: Write failing test for permission checks**

Create `apps/api/tests/test_permissions.py`:

```python
import pytest
from app.auth.permissions import has_permission, PERMISSIONS


class TestPermissionMatrix:
    def test_admin_has_full_access_to_all_areas(self):
        areas = [
            "users", "orders", "standing_orders", "customers",
            "inventory_counts", "inventory_estimates", "inventory_harvest",
            "inventory_availability", "products", "pricing", "import",
        ]
        for area in areas:
            assert has_permission("admin", area, "read")
            assert has_permission("admin", area, "write")

    def test_salesperson_can_read_and_write_orders(self):
        assert has_permission("salesperson", "orders", "read")
        assert has_permission("salesperson", "orders", "write")

    def test_salesperson_cannot_write_products(self):
        assert has_permission("salesperson", "products", "read")
        assert not has_permission("salesperson", "products", "write")

    def test_salesperson_has_no_access_to_users(self):
        assert not has_permission("salesperson", "users", "read")
        assert not has_permission("salesperson", "users", "write")

    def test_salesperson_has_no_access_to_import(self):
        assert not has_permission("salesperson", "import", "read")
        assert not has_permission("salesperson", "import", "write")

    def test_data_manager_can_read_orders_not_write(self):
        assert has_permission("data_manager", "orders", "read")
        assert not has_permission("data_manager", "orders", "write")

    def test_data_manager_can_write_products(self):
        assert has_permission("data_manager", "products", "read")
        assert has_permission("data_manager", "products", "write")

    def test_data_manager_can_write_import(self):
        assert has_permission("data_manager", "import", "read")
        assert has_permission("data_manager", "import", "write")

    def test_field_worker_can_write_inventory_counts(self):
        assert has_permission("field_worker", "inventory_counts", "read")
        assert has_permission("field_worker", "inventory_counts", "write")

    def test_field_worker_cannot_write_orders(self):
        assert has_permission("field_worker", "orders", "read")
        assert not has_permission("field_worker", "orders", "write")

    def test_field_worker_has_no_access_to_pricing(self):
        assert not has_permission("field_worker", "pricing", "read")
        assert not has_permission("field_worker", "pricing", "write")

    def test_invalid_role_has_no_access(self):
        assert not has_permission("nonexistent", "orders", "read")

    def test_invalid_area_has_no_access(self):
        assert not has_permission("admin", "nonexistent", "read")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_permissions.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.auth.permissions'`

- [ ] **Step 4: Implement permission matrix**

Create `apps/api/app/auth/permissions.py`:

```python
PERMISSIONS: dict[str, dict[str, str]] = {
    "admin": {
        "users": "rw",
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "rw",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "salesperson": {
        "orders": "rw",
        "standing_orders": "rw",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
        "pricing": "rw",
    },
    "data_manager": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "rw",
        "inventory_counts": "r",
        "inventory_estimates": "r",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "rw",
        "pricing": "rw",
        "import": "rw",
    },
    "field_worker": {
        "orders": "r",
        "standing_orders": "r",
        "customers": "r",
        "inventory_counts": "rw",
        "inventory_estimates": "rw",
        "inventory_harvest": "rw",
        "inventory_availability": "r",
        "products": "r",
    },
}

VALID_ROLES = list(PERMISSIONS.keys())


def has_permission(role: str, area: str, action: str) -> bool:
    """Check if a role has permission for an action on an area.

    action: "read" or "write"
    Returns True if the role has the required access level.
    """
    role_perms = PERMISSIONS.get(role)
    if role_perms is None:
        return False
    access = role_perms.get(area)
    if access is None:
        return False
    if action == "read":
        return access in ("r", "rw")
    if action == "write":
        return access == "rw"
    return False
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && python -m pytest tests/test_permissions.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/auth/ apps/api/tests/test_permissions.py
git commit -m "feat: add RBAC permission matrix with has_permission helper"
```

---

### Task 3: User Model

**Files:**
- Create: `apps/api/app/models/user.py`
- Modify: `apps/api/app/config.py` (add to Tortoise models list)

- [ ] **Step 1: Create User model**

Create `apps/api/app/models/user.py`:

```python
from tortoise import fields
from tortoise.models import Model


class User(Model):
    id = fields.UUIDField(pk=True)
    supabase_user_id = fields.CharField(max_length=255, unique=True)
    email = fields.CharField(max_length=255, unique=True)
    display_name = fields.CharField(max_length=255, null=True)
    phone = fields.CharField(max_length=50, null=True)
    avatar_url = fields.CharField(max_length=500, null=True)
    role = fields.CharField(max_length=20)  # admin, salesperson, data_manager, field_worker
    status = fields.CharField(max_length=15, default="pending")  # pending, active, deactivated
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "users"
```

- [ ] **Step 2: Add User model to Tortoise ORM config**

In `apps/api/app/config.py`, add `"app.models.user"` to the models list in `TORTOISE_ORM`:

```python
"models": [
    "app.models.customer",
    "app.models.product",
    "app.models.pricing",
    "app.models.order",
    "app.models.inventory",
    "app.models.standing_order",
    "app.models.user",
    "aerich.models",
],
```

- [ ] **Step 3: Generate migration**

Run: `cd apps/api && aerich migrate --name add_users_table`

- [ ] **Step 4: Apply migration**

Run: `cd apps/api && aerich upgrade`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/models/user.py apps/api/app/config.py apps/api/migrations/
git commit -m "feat: add User model with role and status fields"
```

---

### Task 4: User Schemas

**Files:**
- Create: `apps/api/app/schemas/user.py`

- [ ] **Step 1: Create user schemas**

Create `apps/api/app/schemas/user.py`:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.auth.permissions import VALID_ROLES


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    phone: str | None
    avatar_url: str | None
    role: str
    status: str
    created_at: datetime


class UserWithPermissionsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    phone: str | None
    avatar_url: str | None
    role: str
    status: str
    permissions: dict[str, str]


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str

    def model_post_init(self, __context: object) -> None:
        if self.role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")


class ChangeRoleRequest(BaseModel):
    role: str

    def model_post_init(self, __context: object) -> None:
        if self.role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    phone: str | None = None
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/schemas/user.py
git commit -m "feat: add user request/response schemas"
```

---

### Task 5: JWT Validation

**Files:**
- Create: `apps/api/app/auth/supabase.py`
- Create: `apps/api/tests/test_jwt.py`

- [ ] **Step 1: Install PyJWT**

Run: `cd apps/api && pip install PyJWT[crypto] supabase`

Add `PyJWT[crypto]` and `supabase` to `apps/api/requirements.txt` (or `pyproject.toml`).

- [ ] **Step 2: Write failing test for JWT decoding**

Create `apps/api/tests/test_jwt.py`:

```python
import time

import jwt
import pytest

from app.auth.supabase import decode_supabase_jwt

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


def _make_token(payload: dict, secret: str = TEST_JWT_SECRET) -> str:
    return jwt.encode(payload, secret, algorithm="HS256")


class TestDecodeSupabaseJWT:
    def test_valid_token(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
        payload = decode_supabase_jwt(token, TEST_JWT_SECRET)
        assert payload["sub"] == "user-uuid-123"

    def test_expired_token_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() - 100})
        with pytest.raises(Exception, match="expired"):
            decode_supabase_jwt(token, TEST_JWT_SECRET)

    def test_invalid_token_raises(self):
        with pytest.raises(Exception):
            decode_supabase_jwt("not-a-jwt", TEST_JWT_SECRET)

    def test_wrong_secret_raises(self):
        token = _make_token({"sub": "user-uuid-123", "exp": time.time() + 3600})
        with pytest.raises(Exception):
            decode_supabase_jwt(token, "wrong-secret")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_jwt.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.auth.supabase'`

- [ ] **Step 4: Implement JWT decode**

Create `apps/api/app/auth/supabase.py`:

```python
import jwt
from fastapi import HTTPException


def decode_supabase_jwt(token: str, secret: str) -> dict:
    """Decode and validate a Supabase JWT token."""
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && python -m pytest tests/test_jwt.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/auth/supabase.py apps/api/tests/test_jwt.py apps/api/requirements.txt
git commit -m "feat: add JWT validation with PyJWT"
```

---

### Task 6: Auth Dependencies

**Files:**
- Create: `apps/api/app/auth/dependencies.py`
- Modify: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_auth.py`

- [ ] **Step 1: Write failing tests for auth dependencies**

Create `apps/api/tests/test_auth.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.mark.anyio
class TestAuthDependency:
    async def test_no_token_returns_401(self, async_client: AsyncClient):
        """Any protected endpoint without a token should return 401."""
        resp = await async_client.get("/api/v1/orders")
        assert resp.status_code == 401

    async def test_invalid_token_returns_401(self, async_client: AsyncClient):
        """A malformed token should return 401."""
        resp = await async_client.get(
            "/api/v1/orders",
            headers={"Authorization": "Bearer bad-token"},
        )
        assert resp.status_code == 401

    async def test_valid_token_with_active_user_succeeds(
        self, async_client: AsyncClient, auth_headers_admin: dict
    ):
        """A valid token for an active user should pass auth."""
        resp = await async_client.get("/api/v1/orders", headers=auth_headers_admin)
        assert resp.status_code == 200

    async def test_deactivated_user_returns_401(
        self, async_client: AsyncClient, auth_headers_deactivated: dict
    ):
        """A valid token for a deactivated user should return 401."""
        resp = await async_client.get(
            "/api/v1/orders", headers=auth_headers_deactivated
        )
        assert resp.status_code == 401


@pytest.mark.anyio
class TestPermissionDependency:
    async def test_field_worker_cannot_create_order(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        """Field workers have read-only access to orders."""
        resp = await async_client.post(
            "/api/v1/orders",
            headers=auth_headers_field_worker,
            json={},
        )
        assert resp.status_code == 403

    async def test_salesperson_can_create_order(
        self, async_client: AsyncClient, auth_headers_salesperson: dict, customer, sales_item
    ):
        """Salespeople have read/write access to orders."""
        resp = await async_client.post(
            "/api/v1/orders",
            headers=auth_headers_salesperson,
            json={
                "customer_id": customer.id,
                "order_date": "2026-04-12",
                "ship_via": "FedEx",
                "lines": [
                    {
                        "sales_item_id": sales_item.id,
                        "stems": 100,
                        "price_per_stem": 0.50,
                    }
                ],
            },
        )
        assert resp.status_code == 201

    async def test_field_worker_cannot_access_pricing(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        """Field workers have no access to pricing."""
        resp = await async_client.get(
            "/api/v1/sales-items",
            headers=auth_headers_field_worker,
        )
        assert resp.status_code == 403
```

- [ ] **Step 2: Add auth fixtures to conftest.py**

Add to `apps/api/tests/conftest.py`:

```python
import time
from unittest.mock import patch

import jwt

from app.models.user import User

TEST_JWT_SECRET = "test-secret-key-for-unit-tests-only"


def _make_test_token(supabase_user_id: str) -> str:
    return jwt.encode(
        {"sub": supabase_user_id, "exp": time.time() + 3600},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture(autouse=True)
def mock_jwt_secret():
    with patch("app.auth.dependencies.SUPABASE_JWT_SECRET", TEST_JWT_SECRET):
        yield


@pytest.fixture
async def admin_user():
    return await User.create(
        supabase_user_id="admin-uuid",
        email="admin@oregonflowers.com",
        display_name="Admin User",
        role="admin",
        status="active",
    )


@pytest.fixture
async def salesperson_user():
    return await User.create(
        supabase_user_id="sales-uuid",
        email="sales@oregonflowers.com",
        display_name="Sales User",
        role="salesperson",
        status="active",
    )


@pytest.fixture
async def field_worker_user():
    return await User.create(
        supabase_user_id="field-uuid",
        email="field@oregonflowers.com",
        display_name="Field Worker",
        role="field_worker",
        status="active",
    )


@pytest.fixture
async def deactivated_user():
    return await User.create(
        supabase_user_id="deactivated-uuid",
        email="deactivated@oregonflowers.com",
        display_name="Deactivated User",
        role="salesperson",
        status="deactivated",
    )


@pytest.fixture
def auth_headers_admin(admin_user):
    return {"Authorization": f"Bearer {_make_test_token(admin_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_salesperson(salesperson_user):
    return {"Authorization": f"Bearer {_make_test_token(salesperson_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_field_worker(field_worker_user):
    return {"Authorization": f"Bearer {_make_test_token(field_worker_user.supabase_user_id)}"}


@pytest.fixture
def auth_headers_deactivated(deactivated_user):
    return {"Authorization": f"Bearer {_make_test_token(deactivated_user.supabase_user_id)}"}
```

- [ ] **Step 3: Implement auth dependencies**

Create `apps/api/app/auth/dependencies.py`:

```python
from fastapi import Depends, HTTPException, Request

from app.auth.permissions import has_permission
from app.auth.supabase import decode_supabase_jwt
from app.config import SUPABASE_JWT_SECRET
from app.models.user import User


async def get_current_user(request: Request) -> User:
    """Extract and validate the JWT, then look up the local User record."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = auth_header.split(" ", 1)[1]
    payload = decode_supabase_jwt(token, SUPABASE_JWT_SECRET)
    supabase_user_id = payload.get("sub")

    user = await User.filter(supabase_user_id=supabase_user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status == "deactivated":
        raise HTTPException(status_code=401, detail="Account deactivated")

    return user


def require_permission(area: str, action: str):
    """Return a FastAPI dependency that checks role permissions."""

    async def _check(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.role, area, action):
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' cannot {action} '{area}'",
            )
        return user

    return _check
```

- [ ] **Step 4: Run tests to verify they fail (routers not yet wired)**

Run: `cd apps/api && python -m pytest tests/test_auth.py -v`
Expected: Tests importing fine, but likely failing because routers don't have auth dependencies yet. This is expected — they'll pass after Task 8.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/auth/dependencies.py apps/api/tests/conftest.py apps/api/tests/test_auth.py
git commit -m "feat: add get_current_user and require_permission dependencies"
```

---

## Phase 2: Backend Auth Endpoints

### Task 7: Auth Router — GET /auth/me

**Files:**
- Create: `apps/api/app/routers/auth.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write failing test**

Add to `apps/api/tests/test_auth.py`:

```python
@pytest.mark.anyio
class TestAuthMe:
    async def test_auth_me_returns_user_with_permissions(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.get("/api/v1/auth/me", headers=auth_headers_salesperson)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "sales@oregonflowers.com"
        assert data["role"] == "salesperson"
        assert "permissions" in data
        assert data["permissions"]["orders"] == "rw"
        assert "users" not in data["permissions"]

    async def test_auth_me_without_token_returns_401(self, async_client: AsyncClient):
        resp = await async_client.get("/api/v1/auth/me")
        assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_auth.py::TestAuthMe -v`
Expected: FAIL — 404 (route doesn't exist)

- [ ] **Step 3: Implement auth router**

Create `apps/api/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.permissions import PERMISSIONS
from app.models.user import User
from app.schemas.user import UserWithPermissionsResponse

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
    dependencies=[Depends(get_current_user)],
)


@auth_router.get("/me")
async def get_me(user: User = Depends(get_current_user)) -> dict:
    permissions = PERMISSIONS.get(user.role, {})
    return {
        "data": UserWithPermissionsResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            permissions=permissions,
        ).model_dump()
    }
```

- [ ] **Step 4: Register router in main.py**

Add to `apps/api/app/main.py` imports:

```python
from app.routers.auth import auth_router
```

Add to router registration block:

```python
app.include_router(auth_router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && python -m pytest tests/test_auth.py::TestAuthMe -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/auth.py apps/api/app/main.py
git commit -m "feat: add GET /auth/me endpoint"
```

---

### Task 8: Users Router — Admin CRUD

**Files:**
- Create: `apps/api/app/routers/users.py`
- Create: `apps/api/tests/test_users.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write failing tests for user management**

Create `apps/api/tests/test_users.py`:

```python
import pytest
from httpx import AsyncClient

from app.models.user import User


@pytest.mark.anyio
class TestListUsers:
    async def test_admin_can_list_users(
        self, async_client: AsyncClient, auth_headers_admin: dict
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_admin)
        assert resp.status_code == 200
        assert isinstance(resp.json()["data"], list)

    async def test_non_admin_cannot_list_users(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.get("/api/v1/users", headers=auth_headers_salesperson)
        assert resp.status_code == 403


@pytest.mark.anyio
class TestInviteUser:
    async def test_admin_can_invite_user(
        self, async_client: AsyncClient, auth_headers_admin: dict
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            headers=auth_headers_admin,
            json={"email": "new@oregonflowers.com", "role": "salesperson"},
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["email"] == "new@oregonflowers.com"
        assert data["role"] == "salesperson"
        assert data["status"] == "pending"

    async def test_invite_duplicate_email_fails(
        self, async_client: AsyncClient, auth_headers_admin: dict, salesperson_user
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            headers=auth_headers_admin,
            json={"email": "sales@oregonflowers.com", "role": "salesperson"},
        )
        assert resp.status_code == 422

    async def test_non_admin_cannot_invite(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.post(
            "/api/v1/users/invite",
            headers=auth_headers_salesperson,
            json={"email": "new@oregonflowers.com", "role": "salesperson"},
        )
        assert resp.status_code == 403


@pytest.mark.anyio
class TestChangeRole:
    async def test_admin_can_change_role(
        self, async_client: AsyncClient, auth_headers_admin: dict, salesperson_user
    ):
        resp = await async_client.put(
            f"/api/v1/users/{salesperson_user.id}/role",
            headers=auth_headers_admin,
            json={"role": "data_manager"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["role"] == "data_manager"

    async def test_invalid_role_fails(
        self, async_client: AsyncClient, auth_headers_admin: dict, salesperson_user
    ):
        resp = await async_client.put(
            f"/api/v1/users/{salesperson_user.id}/role",
            headers=auth_headers_admin,
            json={"role": "superadmin"},
        )
        assert resp.status_code == 422


@pytest.mark.anyio
class TestDeactivateUser:
    async def test_admin_can_deactivate_user(
        self, async_client: AsyncClient, auth_headers_admin: dict, salesperson_user
    ):
        resp = await async_client.post(
            f"/api/v1/users/{salesperson_user.id}/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "deactivated"

    async def test_cannot_deactivate_last_admin(
        self, async_client: AsyncClient, auth_headers_admin: dict, admin_user
    ):
        resp = await async_client.post(
            f"/api/v1/users/{admin_user.id}/deactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 409

    async def test_admin_can_reactivate_user(
        self, async_client: AsyncClient, auth_headers_admin: dict, deactivated_user
    ):
        resp = await async_client.post(
            f"/api/v1/users/{deactivated_user.id}/reactivate",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "active"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && python -m pytest tests/test_users.py -v`
Expected: FAIL — 404 (routes don't exist)

- [ ] **Step 3: Implement users router**

Create `apps/api/app/routers/users.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.user import (
    ChangeRoleRequest,
    InviteUserRequest,
    UserResponse,
)

users_router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)


@users_router.get("")
async def list_users(
    _user: User = Depends(require_permission("users", "read")),
) -> dict:
    users = await User.all().order_by("-created_at")
    return {
        "data": [
            UserResponse.model_validate(u).model_dump() for u in users
        ]
    }


@users_router.post("/invite", status_code=201)
async def invite_user(
    body: InviteUserRequest,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    existing = await User.filter(email=body.email).first()
    if existing:
        raise HTTPException(status_code=422, detail="Email already exists")

    # Create local user record as pending.
    # In production, also call Supabase invite_user_by_email here.
    user = await User.create(
        supabase_user_id=f"pending-{body.email}",
        email=body.email,
        role=body.role,
        status="pending",
    )
    return {"data": UserResponse.model_validate(user).model_dump()}


@users_router.put("/{user_id}/role")
async def change_role(
    user_id: UUID,
    body: ChangeRoleRequest,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.role = body.role
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}


@users_router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: UUID,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deactivating the last active admin
    if target.role == "admin" and target.status == "active":
        active_admin_count = await User.filter(role="admin", status="active").count()
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=409,
                detail="Cannot deactivate the last active admin",
            )

    target.status = "deactivated"
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}


@users_router.post("/{user_id}/reactivate")
async def reactivate_user(
    user_id: UUID,
    _user: User = Depends(require_permission("users", "write")),
) -> dict:
    target = await User.filter(id=user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.status = "active"
    await target.save()
    return {"data": UserResponse.model_validate(target).model_dump()}
```

- [ ] **Step 4: Register router in main.py**

Add import and registration:

```python
from app.routers.users import users_router
# ...
app.include_router(users_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && python -m pytest tests/test_users.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/users.py apps/api/tests/test_users.py apps/api/app/main.py
git commit -m "feat: add admin user management endpoints (invite, role change, deactivate)"
```

---

### Task 9: Profile Router

**Files:**
- Create: `apps/api/app/routers/profile.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Write failing tests**

Add to `apps/api/tests/test_auth.py`:

```python
@pytest.mark.anyio
class TestProfile:
    async def test_get_profile(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.get("/api/v1/profile", headers=auth_headers_salesperson)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["email"] == "sales@oregonflowers.com"

    async def test_update_profile(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        resp = await async_client.put(
            "/api/v1/profile",
            headers=auth_headers_salesperson,
            json={"display_name": "Updated Name", "phone": "503-555-9999"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["display_name"] == "Updated Name"
        assert data["phone"] == "503-555-9999"
```

- [ ] **Step 2: Implement profile router**

Create `apps/api/app/routers/profile.py`:

```python
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.permissions import PERMISSIONS
from app.models.user import User
from app.schemas.user import UpdateProfileRequest, UserWithPermissionsResponse

profile_router = APIRouter(
    prefix="/api/v1/profile",
    tags=["profile"],
    dependencies=[Depends(get_current_user)],
)


@profile_router.get("")
async def get_profile(user: User = Depends(get_current_user)) -> dict:
    permissions = PERMISSIONS.get(user.role, {})
    return {
        "data": UserWithPermissionsResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            permissions=permissions,
        ).model_dump()
    }


@profile_router.put("")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
) -> dict:
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.phone is not None:
        user.phone = body.phone
    await user.save()
    permissions = PERMISSIONS.get(user.role, {})
    return {
        "data": UserWithPermissionsResponse(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            permissions=permissions,
        ).model_dump()
    }
```

- [ ] **Step 3: Register router in main.py**

```python
from app.routers.profile import profile_router
# ...
app.include_router(profile_router)
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && python -m pytest tests/test_auth.py::TestProfile -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/profile.py apps/api/app/main.py apps/api/tests/test_auth.py
git commit -m "feat: add self-service profile endpoints"
```

---

### Task 10: Permissions Reference Endpoint

**Files:**
- Modify: `apps/api/app/routers/auth.py`

- [ ] **Step 1: Write failing test**

Add to `apps/api/tests/test_auth.py`:

```python
@pytest.mark.anyio
class TestPermissionsEndpoint:
    async def test_get_permissions_matrix(
        self, async_client: AsyncClient, auth_headers_admin: dict
    ):
        resp = await async_client.get("/api/v1/auth/permissions", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "roles" in data
        assert "areas" in data
        assert "matrix" in data
        assert "admin" in data["roles"]
        assert data["matrix"]["admin"]["orders"] == "rw"
```

- [ ] **Step 2: Implement endpoint**

Add to `apps/api/app/routers/auth.py`:

```python
AREA_LABELS = {
    "users": "User Management",
    "orders": "Orders & Standing Orders",
    "customers": "Customers",
    "inventory_counts": "Inventory (Counts, Estimates)",
    "inventory_harvest": "Inventory (Harvest Status)",
    "inventory_availability": "Inventory (Availability, Comparison)",
    "products": "Products",
    "pricing": "Pricing",
    "import": "Import",
}


@auth_router.get("/permissions")
async def get_permissions(_user: User = Depends(get_current_user)) -> dict:
    return {
        "data": {
            "roles": list(PERMISSIONS.keys()),
            "areas": [
                {"key": key, "label": label} for key, label in AREA_LABELS.items()
            ],
            "matrix": PERMISSIONS,
        }
    }
```

- [ ] **Step 3: Run test**

Run: `cd apps/api && python -m pytest tests/test_auth.py::TestPermissionsEndpoint -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routers/auth.py apps/api/tests/test_auth.py
git commit -m "feat: add GET /auth/permissions endpoint for admin reference table"
```

---

## Phase 3: Backend Retrofit

### Task 11: Add Auth to All Existing Routers

**Files:**
- Modify: All 22 router files in `apps/api/app/routers/` (excluding `health.py` and the new auth/users/profile routers)

This is a mechanical change. Each router gets:
1. `from app.auth.dependencies import get_current_user, require_permission` added to imports
2. `dependencies=[Depends(get_current_user)]` added to the `APIRouter()` call
3. Write endpoints get `Depends(require_permission("area", "write"))` as a parameter

- [ ] **Step 1: Map each router to its permission area**

| Router file | Permission area | Has write endpoints? |
|-------------|----------------|---------------------|
| `availability.py` | `inventory_availability` | No |
| `colors.py` | `products` | Yes |
| `comparison.py` | `inventory_availability` | No |
| `counts.py` | `inventory_counts` | Yes |
| `customer_counts.py` | `inventory_counts` | Yes |
| `customers.py` | `customers` | Yes |
| `estimates.py` | `inventory_estimates` | Yes |
| `harvest_status.py` | `inventory_harvest` | Yes |
| `import_data.py` | `import` | Yes (all writes) |
| `orders.py` | `orders` | Yes |
| `price_lists.py` | `pricing` | Yes |
| `pricing.py` | `pricing` | Yes |
| `print_sheets.py` | `inventory_counts` | No |
| `product_lines.py` | `products` | Yes |
| `product_types.py` | `products` | Yes |
| `products.py` | `products` | Yes |
| `pull_days.py` | `inventory_counts` | Yes |
| `sales_items.py` | `pricing` | Yes |
| `sheet_completion.py` | `inventory_counts` | Yes |
| `sheet_templates.py` | `inventory_counts` | Yes |
| `standing_orders.py` | `standing_orders` | Yes |

- [ ] **Step 2: Add router-level auth to each file**

For each router file, add the import and dependency. Example pattern for a router with writes:

```python
# Add to imports:
from fastapi import Depends
from app.auth.dependencies import get_current_user, require_permission

# Change APIRouter declaration:
orders_router = APIRouter(
    prefix="/api/v1/orders",
    tags=["orders"],
    dependencies=[Depends(get_current_user)],
)

# Add to write endpoints (POST, PUT, PATCH, DELETE):
@orders_router.post("", status_code=201)
async def create_order(
    body: OrderCreateRequest,
    user: User = Depends(require_permission("orders", "write")),
):
    ...
```

For read-only routers (availability, comparison, print_sheets), the router-level `get_current_user` is sufficient — no per-endpoint permission checks needed since all authenticated users with area access can read.

For routers where the read permission might restrict access (e.g., field workers can't access pricing at all), add `Depends(require_permission("area", "read"))` to GET endpoints:

```python
@sales_items_router.get("")
async def list_sales_items(
    _user: User = Depends(require_permission("pricing", "read")),
):
    ...
```

- [ ] **Step 3: Update existing tests to include auth headers**

All existing test files need to use the `auth_headers_admin` fixture (or appropriate role) when calling endpoints. This is a mechanical change — add `headers=auth_headers_admin` to every `async_client.get/post/put/patch/delete` call.

Example for `tests/test_orders.py`:

```python
# Before:
resp = await async_client.get("/api/v1/orders")

# After:
resp = await async_client.get("/api/v1/orders", headers=auth_headers_admin)
```

- [ ] **Step 4: Run full test suite**

Run: `cd apps/api && python -m pytest -v`
Expected: All tests PASS (including the auth tests from Task 6)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/ apps/api/tests/
git commit -m "feat: add auth dependencies to all existing routers"
```

---

### Task 12: Migrate entered_by and salesperson_email

**Files:**
- Modify: `apps/api/app/routers/counts.py`
- Modify: `apps/api/app/routers/customer_counts.py`
- Modify: `apps/api/app/routers/estimates.py`
- Modify: `apps/api/app/routers/sheet_completion.py`
- Modify: `apps/api/app/routers/orders.py`
- Modify: `apps/api/app/routers/standing_orders.py`
- Modify: `apps/api/app/schemas/inventory.py`

- [ ] **Step 1: Remove entered_by from inventory request schemas**

In `apps/api/app/schemas/inventory.py`, remove `entered_by` from `CountSaveRequest`, `CustomerCountSaveRequest`, `EstimateSaveRequest`, and `completed_by` from `SheetCompleteRequest`.

- [ ] **Step 2: Update inventory routers to use authenticated user's email**

In each inventory router's save/update endpoint, replace usage of `body.entered_by` with `user.email` from the auth dependency:

```python
# counts.py — in the batch save endpoint:
async def save_counts(
    body: CountSaveRequest,
    user: User = Depends(require_permission("inventory_counts", "write")),
):
    # ... existing logic ...
    # Where entered_by is set on DailyCount or CountAuditLog:
    entered_by = user.email
```

Apply the same pattern to `customer_counts.py`, `estimates.py`, and `sheet_completion.py` (using `completed_by = user.email`).

- [ ] **Step 3: Update order routers for salesperson_email**

In `apps/api/app/routers/orders.py`, the `salesperson_email` field stays in the request schema but defaults to the authenticated user's email when not provided:

```python
async def create_order(
    body: OrderCreateRequest,
    user: User = Depends(require_permission("orders", "write")),
):
    salesperson_email = body.salesperson_email or user.email
    # ... use salesperson_email when creating the order ...
```

Same pattern for `standing_orders.py`.

For the `OrderAuditLog` and `StandingOrderAuditLog`, set `entered_by = user.email`.

- [ ] **Step 4: Update tests to verify entered_by comes from auth user**

Add test to `tests/test_auth.py`:

```python
@pytest.mark.anyio
class TestEnteredByFromAuth:
    async def test_count_entered_by_from_authenticated_user(
        self, async_client: AsyncClient, auth_headers_field_worker: dict,
        variety, product_type
    ):
        resp = await async_client.put(
            "/api/v1/counts",
            headers=auth_headers_field_worker,
            json={
                "product_type_id": product_type.id,
                "count_date": "2026-04-12",
                "counts": [
                    {"variety_id": str(variety.id), "count_value": 50, "is_done": False}
                ],
            },
        )
        assert resp.status_code == 200
        # Verify the count was saved with the auth user's email
        from app.models.inventory import DailyCount
        count = await DailyCount.filter(variety=variety).first()
        assert count.entered_by == "field@oregonflowers.com"

    async def test_order_salesperson_defaults_to_auth_user(
        self, async_client: AsyncClient, auth_headers_salesperson: dict,
        customer, sales_item
    ):
        resp = await async_client.post(
            "/api/v1/orders",
            headers=auth_headers_salesperson,
            json={
                "customer_id": customer.id,
                "order_date": "2026-04-12",
                "ship_via": "FedEx",
                "lines": [{"sales_item_id": sales_item.id, "stems": 100, "price_per_stem": 0.50}],
            },
        )
        assert resp.status_code == 201
        from app.models.order import Order
        order = await Order.all().first()
        assert order.salesperson_email == "sales@oregonflowers.com"
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && python -m pytest tests/test_auth.py::TestEnteredByFromAuth -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/ apps/api/app/schemas/inventory.py apps/api/tests/test_auth.py
git commit -m "feat: populate entered_by and salesperson_email from authenticated user"
```

---

## Phase 4: Frontend Auth Foundation

### Task 13: Install Dependencies and Supabase Client

**Files:**
- Create: `apps/web/src/lib/supabase.ts`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Install @supabase/supabase-js**

Run: `cd apps/web && npm install @supabase/supabase-js`

- [ ] **Step 2: Create Supabase client**

Create `apps/web/src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 3: Update .env.example**

Add to `apps/web/.env.example`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/supabase.ts apps/web/.env.example apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add supabase client and environment config"
```

---

### Task 14: User Types and Permission Matrix (Frontend)

**Files:**
- Create: `apps/web/src/types/user.ts`
- Create: `apps/web/src/lib/permissions.ts`

- [ ] **Step 1: Create user types**

Create `apps/web/src/types/user.ts`:

```typescript
export type Role = "admin" | "salesperson" | "data_manager" | "field_worker";
export type UserStatus = "pending" | "active" | "deactivated";
export type AccessLevel = "rw" | "r";

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  status: UserStatus;
  permissions: Record<string, AccessLevel>;
}

export interface UserListItem {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  status: UserStatus;
  avatar_url: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create frontend permission matrix**

Create `apps/web/src/lib/permissions.ts`:

```typescript
import type { AccessLevel, Role } from "@/types/user";

export const PERMISSIONS: Record<Role, Record<string, AccessLevel>> = {
  admin: {
    users: "rw",
    orders: "rw",
    standing_orders: "rw",
    customers: "rw",
    inventory_counts: "rw",
    inventory_estimates: "rw",
    inventory_harvest: "rw",
    inventory_availability: "rw",
    products: "rw",
    pricing: "rw",
    import: "rw",
  },
  salesperson: {
    orders: "rw",
    standing_orders: "rw",
    customers: "rw",
    inventory_counts: "r",
    inventory_estimates: "r",
    inventory_harvest: "rw",
    inventory_availability: "r",
    products: "r",
    pricing: "rw",
  },
  data_manager: {
    orders: "r",
    standing_orders: "r",
    customers: "rw",
    inventory_counts: "r",
    inventory_estimates: "r",
    inventory_harvest: "rw",
    inventory_availability: "r",
    products: "rw",
    pricing: "rw",
    import: "rw",
  },
  field_worker: {
    orders: "r",
    standing_orders: "r",
    customers: "r",
    inventory_counts: "rw",
    inventory_estimates: "rw",
    inventory_harvest: "rw",
    inventory_availability: "r",
    products: "r",
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  salesperson: "Salesperson",
  data_manager: "Data Manager",
  field_worker: "Field Worker",
};

export const AREA_LABELS: Record<string, string> = {
  users: "User Management",
  orders: "Orders & Standing Orders",
  customers: "Customers",
  inventory_counts: "Inventory (Counts, Estimates)",
  inventory_harvest: "Inventory (Harvest Status)",
  inventory_availability: "Inventory (Availability, Comparison)",
  products: "Products",
  pricing: "Pricing",
  import: "Import",
};

export function canAccess(role: Role, area: string, action: "read" | "write"): boolean {
  const access = PERMISSIONS[role]?.[area];
  if (!access) return false;
  if (action === "read") return access === "r" || access === "rw";
  if (action === "write") return access === "rw";
  return false;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/user.ts apps/web/src/lib/permissions.ts
git commit -m "feat: add user types and frontend permission matrix"
```

---

### Task 15: AuthProvider and useAuth Hook

**Files:**
- Create: `apps/web/src/auth/AuthProvider.tsx`
- Create: `apps/web/src/auth/useAuth.ts`

- [ ] **Step 1: Create AuthProvider**

Create `apps/web/src/auth/AuthProvider.tsx`:

```tsx
import { createContext, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { User } from "@/types/user";
import { api } from "@/services/api";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get<User>("/api/v1/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        fetchUser().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        fetchUser();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Create useAuth hook**

Create `apps/web/src/auth/useAuth.ts`:

```typescript
import { useContext } from "react";

import { AuthContext } from "@/auth/AuthProvider";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@/types/user";

export function useAuth() {
  const context = useContext(AuthContext);

  return {
    ...context,
    role: context.user?.role ?? null,
    canAccess: (area: string, action: "read" | "write") => {
      if (!context.user) return false;
      return canAccess(context.user.role as Role, area, action);
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/auth/
git commit -m "feat: add AuthProvider context and useAuth hook"
```

---

### Task 16: API Service — Inject Auth Header

**Files:**
- Modify: `apps/web/src/services/api.ts`

- [ ] **Step 1: Update the request function to inject the Supabase token**

Modify the `request` function in `apps/web/src/services/api.ts` to get the current session token and add it as an Authorization header:

```typescript
import { supabase } from "@/lib/supabase";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = {};
  if (session?.access_token) {
    authHeaders["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });
  // ... rest of existing error handling
}
```

Also update `postFile` to include the auth header similarly (without Content-Type since it's FormData).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/services/api.ts
git commit -m "feat: inject supabase auth token into all API requests"
```

---

### Task 17: ProtectedRoute and LoginPage

**Files:**
- Create: `apps/web/src/auth/ProtectedRoute.tsx`
- Create: `apps/web/src/auth/LoginPage.tsx`

- [ ] **Step 1: Create ProtectedRoute**

Create `apps/web/src/auth/ProtectedRoute.tsx`:

```tsx
import { Navigate } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create LoginPage**

Create `apps/web/src/auth/LoginPage.tsx`:

```tsx
import { useState } from "react";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(err.message);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setResetSent(true);
    }
  }

  if (showReset) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f1ec]">
        <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Reset Password</h1>
            <p className="text-sm text-[#94a3b8] mt-1">
              Enter your email to receive a reset link
            </p>
          </div>
          {resetSent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-[#334155]">
                Check your email for the reset link.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setShowReset(false); setResetSent(false); }}
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowReset(false)}
              >
                Back to Login
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f4f1ec]">
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">FullBloom</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#e0ddd8]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#94a3b8]">or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
        >
          Sign in with Google
        </Button>

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-[#c27890] hover:underline"
            onClick={() => setShowReset(true)}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/auth/ProtectedRoute.tsx apps/web/src/auth/LoginPage.tsx
git commit -m "feat: add ProtectedRoute guard and LoginPage"
```

---

## Phase 5: Frontend Integration

### Task 18: App.tsx — Auth Routing

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Wrap app with AuthProvider and add auth routes**

Modify `apps/web/src/App.tsx`:

1. Import `AuthProvider`, `ProtectedRoute`, `LoginPage`, and new settings pages
2. Add `/login` route (outside ProtectedRoute)
3. Wrap all existing routes with `ProtectedRoute`
4. Add settings routes: `/settings/profile` → `ProfilePage`, `/settings/users` → `UsersPage`

```tsx
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { LoginPage } from "@/auth/LoginPage";
import { ProfilePage } from "@/components/settings/ProfilePage";
import { UsersPage } from "@/components/settings/UsersPage";

// In the router:
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                {/* ... all existing routes ... */}
                <Route path="/settings/profile" element={<ProfilePage />} />
                <Route path="/settings/users" element={<UsersPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: add auth routing with login page and protected routes"
```

---

### Task 19: Sidebar — Role-Based Navigation and Avatar Badge

**Files:**
- Create: `apps/web/src/components/layout/UserBadge.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create UserBadge component**

Create `apps/web/src/components/layout/UserBadge.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, UserCircle } from "lucide-react";

import { useAuth } from "@/auth/useAuth";

interface UserBadgeProps {
  expanded: boolean;
}

export function UserBadge({ expanded }: UserBadgeProps) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = (user.display_name || user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded hover:bg-[#2d4a2d] transition-colors"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#c27890] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
            {initials}
          </div>
        )}
        {expanded && (
          <span className="text-sm text-white truncate">
            {user.display_name || user.email}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-md shadow-lg border border-[#e0ddd8] py-1 z-50">
          <Link
            to="/settings/profile"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#334155] hover:bg-[#f4f1ec]"
            onClick={() => setOpen(false)}
          >
            <UserCircle className="w-4 h-4" />
            Profile
          </Link>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#334155] hover:bg-[#f4f1ec]"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modify Sidebar for role-based navigation**

In `apps/web/src/components/layout/Sidebar.tsx`:

1. Import `useAuth` and `canAccess`
2. Filter nav items based on user role
3. Add `UserBadge` at the bottom of the sidebar
4. Conditionally show "Users" under Settings (admin only)

Map each nav section to a permission area:

```typescript
const NAV_AREA_MAP: Record<string, string> = {
  Orders: "orders",
  Customers: "customers",
  Products: "products",
  Pricing: "pricing",
  Inventory: "inventory_counts",  // base inventory access
  Import: "import",
  Settings: "users",  // always visible, but "Users" sub-item is admin-only
};
```

Filter the nav items array:

```typescript
const { canAccess, role } = useAuth();

const filteredNavItems = NAV_ITEMS.filter((item) => {
  const area = NAV_AREA_MAP[item.label];
  if (!area) return true;
  if (item.label === "Settings") return true; // always show, filter children
  return canAccess(area, "read");
});
```

For the Settings section, conditionally include "Users" child:

```typescript
// Settings children
const settingsChildren = [
  { label: "Profile", icon: UserCircle, href: "/settings/profile" },
  ...(role === "admin"
    ? [{ label: "Users", icon: Users, href: "/settings/users" }]
    : []),
];
```

Add `UserBadge` as the last element in the sidebar, before the closing `</nav>` or `</div>`:

```tsx
<div className="mt-auto border-t border-[#2d4a2d] pt-2">
  <UserBadge expanded={expanded} />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/UserBadge.tsx apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add role-based sidebar navigation and user avatar badge"
```

---

### Task 20: Users Admin Page

**Files:**
- Create: `apps/web/src/components/settings/UsersPage.tsx`
- Create: `apps/web/src/components/settings/PermissionsMatrix.tsx`

- [ ] **Step 1: Create PermissionsMatrix**

Create `apps/web/src/components/settings/PermissionsMatrix.tsx`:

```tsx
import { PERMISSIONS, ROLE_LABELS, AREA_LABELS } from "@/lib/permissions";
import type { Role } from "@/types/user";
import { Check, Eye, X } from "lucide-react";

export function PermissionsMatrix() {
  const roles = Object.keys(ROLE_LABELS) as Role[];
  const areas = Object.keys(AREA_LABELS);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e0ddd8]">
            <th className="text-left py-2 px-3 text-[#1e3a5f] font-medium">Area</th>
            {roles.map((role) => (
              <th key={role} className="text-center py-2 px-3 text-[#1e3a5f] font-medium">
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area} className="border-b border-[#e0ddd8]">
              <td className="py-2 px-3 text-[#334155]">{AREA_LABELS[area]}</td>
              {roles.map((role) => {
                const access = PERMISSIONS[role]?.[area];
                return (
                  <td key={role} className="text-center py-2 px-3">
                    {access === "rw" && (
                      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
                        <Check className="w-3 h-3" /> Full
                      </span>
                    )}
                    {access === "r" && (
                      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                        <Eye className="w-3 h-3" /> View
                      </span>
                    )}
                    {!access && (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                        <X className="w-3 h-3" /> None
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create UsersPage**

Create `apps/web/src/components/settings/UsersPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";

import { api } from "@/services/api";
import { ROLE_LABELS } from "@/lib/permissions";
import { PermissionsMatrix } from "@/components/settings/PermissionsMatrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role, UserListItem } from "@/types/user";

export function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("salesperson");
  const [error, setError] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const fetchUsers = useCallback(async () => {
    const data = await api.get<UserListItem[]>("/api/v1/users");
    setUsers(data);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/v1/users/invite", { email: inviteEmail, role: inviteRole });
      setShowInvite(false);
      setInviteEmail("");
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    await api.put(`/api/v1/users/${userId}/role`, { role: newRole });
    fetchUsers();
  }

  async function handleToggleActive(userId: string, currentStatus: string) {
    const endpoint = currentStatus === "active" ? "deactivate" : "reactivate";
    try {
      await api.post(`/api/v1/users/${userId}/${endpoint}`, {});
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Users</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMatrix(!showMatrix)}>
            {showMatrix ? "Hide" : "Show"} Permissions
          </Button>
          <Button onClick={() => setShowInvite(true)}>Invite User</Button>
        </div>
      </div>

      {showMatrix && (
        <div className="bg-white rounded-lg border border-[#e0ddd8] p-4">
          <h2 className="text-lg font-medium text-[#1e3a5f] mb-3">Role Permissions</h2>
          <PermissionsMatrix />
        </div>
      )}

      {showInvite && (
        <div className="bg-white rounded-lg border border-[#e0ddd8] p-4">
          <h2 className="text-lg font-medium text-[#1e3a5f] mb-3">Invite User</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-[#334155]">Email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm text-[#334155]">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Send Invite</Button>
            <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </form>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#e0ddd8]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e0ddd8]">
              <th className="text-left py-3 px-4 text-[#1e3a5f] font-medium">User</th>
              <th className="text-left py-3 px-4 text-[#1e3a5f] font-medium">Role</th>
              <th className="text-left py-3 px-4 text-[#1e3a5f] font-medium">Status</th>
              <th className="text-right py-3 px-4 text-[#1e3a5f] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#e0ddd8]">
                <td className="py-3 px-4">
                  <div>
                    <p className="text-[#334155] font-medium">
                      {u.display_name || u.email}
                    </p>
                    {u.display_name && (
                      <p className="text-xs text-[#94a3b8]">{u.email}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      u.status === "active"
                        ? "bg-green-50 text-green-700"
                        : u.status === "pending"
                          ? "bg-yellow-50 text-yellow-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {u.status !== "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(u.id, u.status)}
                    >
                      {u.status === "active" ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

The bottom of the Users page includes an "About Roles" informational section with color-coded cards describing each role in plain language:

- **Admin** (rose): Full access. Manages users, assigns roles. For owners and office managers.
- **Salesperson** (blue): Orders, customers, pricing. Views inventory/products. No user management or import.
- **Data Manager** (purple): Products, customers, pricing, imports. Views orders. For office staff maintaining catalog and pricing.
- **Field Worker** (green): Inventory counts, estimates, harvest status. Views orders/customers/products. No pricing or import.

This is always visible (not toggled like the permissions matrix).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/UsersPage.tsx apps/web/src/components/settings/PermissionsMatrix.tsx
git commit -m "feat: add admin Users page with invite, role change, and permissions matrix"
```

---

### Task 21: Profile Page

**Files:**
- Create: `apps/web/src/components/settings/ProfilePage.tsx`

- [ ] **Step 1: Create ProfilePage**

Create `apps/web/src/components/settings/ProfilePage.tsx`:

```tsx
import { useState } from "react";

import { useAuth } from "@/auth/useAuth";
import { api } from "@/services/api";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role, User } from "@/types/user";

export function ProfilePage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const initials = (user.display_name || user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api.put<User>("/api/v1/profile", {
      display_name: displayName,
      phone: phone,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-[#1e3a5f]">Profile</h1>

      <div className="flex items-center gap-4">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#c27890] flex items-center justify-center text-white text-xl font-medium">
            {initials}
          </div>
        )}
        <div>
          <p className="font-medium text-[#334155]">{user.display_name || user.email}</p>
          <p className="text-sm text-[#94a3b8]">{ROLE_LABELS[user.role as Role]}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-[#334155]">Email</label>
          <Input value={user.email} disabled className="bg-[#f4f1ec]" />
        </div>
        <div>
          <label className="text-sm font-medium text-[#334155]">Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#334155]">Phone</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#334155]">Role</label>
          <Input value={ROLE_LABELS[user.role as Role]} disabled className="bg-[#f4f1ec]" />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/settings/ProfilePage.tsx
git commit -m "feat: add self-service profile page"
```

---

### Task 22: Salesperson Dropdown on Orders

**Files:**
- Modify: `apps/web/src/components/order/OrderForm.tsx`

- [ ] **Step 1: Add salesperson dropdown**

In the OrderForm, replace the `salesperson_email` text input with a dropdown of active salespeople. Fetch the user list from `/api/v1/users` (only available to admins) or use a lighter endpoint. Since salespeople also need this, add a simple endpoint or filter client-side.

Approach: Add a `GET /api/v1/users/salespeople` endpoint that returns active users with the salesperson role (accessible to anyone with `orders` write permission). Then use it in OrderForm as a `<select>` defaulting to the current user's email.

Add to `apps/api/app/routers/users.py`:

```python
@users_router.get("/salespeople")
async def list_salespeople(
    _user: User = Depends(require_permission("orders", "read")),
) -> dict:
    salespeople = await User.filter(
        role__in=["salesperson", "admin"], status="active"
    ).order_by("email")
    return {
        "data": [
            {"id": str(u.id), "email": u.email, "display_name": u.display_name}
            for u in salespeople
        ]
    }
```

In the frontend OrderForm, fetch salespeople on mount and render as a dropdown:

```tsx
const [salespeople, setSalespeople] = useState<Array<{id: string; email: string; display_name: string | null}>>([]);

useEffect(() => {
  api.get<Array<{id: string; email: string; display_name: string | null}>>("/api/v1/users/salespeople")
    .then(setSalespeople)
    .catch(() => {}); // fail silently if user can't access
}, []);

// In the form, replace salesperson_email input with:
<select
  value={form.salesperson_email || user?.email || ""}
  onChange={(e) => setForm({ ...form, salesperson_email: e.target.value })}
>
  {salespeople.map((sp) => (
    <option key={sp.id} value={sp.email}>
      {sp.display_name || sp.email}
    </option>
  ))}
</select>
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routers/users.py apps/web/src/components/order/OrderForm.tsx
git commit -m "feat: add salesperson dropdown on order form"
```

---

### Task 23: Seed Admin Script

**Files:**
- Create: `apps/api/app/seed_admin.py`

- [ ] **Step 1: Create seed script**

Create `apps/api/app/seed_admin.py`:

```python
"""Create the first admin user in the local database.

Usage:
    python -m app.seed_admin --email admin@oregonflowers.com --supabase-id <uuid>

The supabase-id is the UUID of the user created in the Supabase dashboard.
"""
import argparse
import asyncio

from tortoise import Tortoise

from app.config import TORTOISE_ORM
from app.models.user import User


async def seed(email: str, supabase_id: str) -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    existing = await User.filter(email=email).first()
    if existing:
        print(f"User {email} already exists (role={existing.role}, status={existing.status})")
        return
    user = await User.create(
        supabase_user_id=supabase_id,
        email=email,
        display_name="Admin",
        role="admin",
        status="active",
    )
    print(f"Created admin user: {user.email} (id={user.id})")
    await Tortoise.close_connections()


def main():
    parser = argparse.ArgumentParser(description="Seed the first admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--supabase-id", required=True, help="Supabase Auth user UUID")
    args = parser.parse_args()
    asyncio.run(seed(args.email, args.supabase_id))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/seed_admin.py
git commit -m "feat: add admin seed script for initial setup"
```

---

## Phase 6: Final Verification

### Task 24: Full Test Suite

- [ ] **Step 1: Run all backend tests**

Run: `cd apps/api && python -m pytest -v`
Expected: All tests PASS

- [ ] **Step 2: Run frontend build**

Run: `cd apps/web && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Manual smoke test checklist**

1. Start backend: `cd apps/api && uvicorn app.main:app --reload`
2. Start frontend: `cd apps/web && npm run dev`
3. Navigate to app — should redirect to login
4. Log in with Google SSO or email/password
5. Verify sidebar shows role-appropriate items
6. Navigate to Settings > Profile — verify display name and phone are editable
7. (Admin only) Navigate to Settings > Users — verify user list, invite, role change, deactivate
8. Create an order — verify salesperson_email defaults to current user
9. Submit an inventory count — verify entered_by is populated from auth user
10. Log out — verify redirect to login

- [ ] **Step 4: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
