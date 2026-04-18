# RBAC and Test Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing and shallow tests identified in the RBAC review, and address related security/edge case bugs.

**Architecture:** 
1.  **Test Infrastructure:** Use existing `pytest` fixtures and `AsyncClient` for integration tests.
2.  **RBAC Logic:** Update router deactivation logic and auth dependencies to handle `pending` users more robustly.
3.  **Audit/Defaults:** Ensure `salesperson_email` auto-population is verified.

**Tech Stack:** Python, FastAPI, Tortoise ORM, Pytest, Supabase Auth.

---

### Task 1: Cross-Role integration tests (403 Forbidden)

**Files:**
- Modify: `apps/api/tests/test_role_access.py`

- [ ] **Step 1: Add tests for 403 Forbidden on restricted areas**

Add tests to verify that lower-privilege roles cannot access write endpoints for areas they only have read access to (or no access).

```python
    async def test_salesperson_cannot_update_counts(
        self, async_client: AsyncClient, auth_headers_salesperson: dict
    ):
        # salesperson has 'r' on inventory_counts, not 'rw'
        resp = await async_client.post(
            "/api/v1/inventory/counts",
            headers=auth_headers_salesperson,
            json={"variety_id": "uuid", "count": 10}
        )
        assert resp.status_code == 403
        assert "cannot write 'inventory_counts'" in resp.json()["detail"]

    async def test_field_worker_cannot_access_users(
        self, async_client: AsyncClient, auth_headers_field_worker: dict
    ):
        # field_worker has no access to users
        resp = await async_client.get("/api/v1/users", headers=auth_headers_field_worker)
        assert resp.status_code == 403
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pytest apps/api/tests/test_role_access.py -v`

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_role_access.py
git commit -m "test: add cross-role RBAC integration tests (403 Forbidden)"
```

### Task 2: Order Salesperson Auto-Population Test

**Files:**
- Modify: `apps/api/tests/test_orders.py`

- [ ] **Step 1: Add test for order creation without salesperson_email**

```python
    async def test_create_order_defaults_salesperson_email(
        self, async_client: AsyncClient, auth_headers_salesperson, salesperson_user, customer, variety, sales_item
    ):
        data = {
            "customer_id": str(customer.id),
            "order_date": "2026-04-18",
            "ship_via": "FedEx",
            "lines": [
                {
                    "sales_item_id": str(sales_item.id),
                    "stems": 100,
                    "price_per_stem": "1.50"
                }
            ]
        }
        # Note: salesperson_email is OMITTED
        resp = await async_client.post("/api/v1/orders", json=data, headers=auth_headers_salesperson)
        assert resp.status_code == 201
        
        # Verify salesperson_email was set to the authenticated user's email
        order_id = resp.json()["data"]["id"]
        from app.models.order import Order
        order = await Order.get(id=order_id)
        assert order.salesperson_email == salesperson_user.email
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pytest apps/api/tests/test_orders.py -v`

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_orders.py
git commit -m "test: verify salesperson_email auto-population when omitted"
```

### Task 3: JWT Claims and Error Handling

**Files:**
- Modify: `apps/api/tests/test_jwt.py`
- Modify: `apps/api/app/auth/supabase.py` (if needed, but spec says just add test)

- [ ] **Step 1: Add tests for missing JWT claims**

```python
    def test_decode_jwt_missing_sub(self):
        # Token with exp and aud but missing sub
        claims = {"exp": time.time() + 3600, "aud": "authenticated"}
        token = jwt.encode(claims, TEST_PRIVATE_KEY_PEM, algorithm="ES256")
        
        with pytest.raises(HTTPException) as exc:
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
        assert exc.value.status_code == 401
        assert "sub" in str(exc.value.detail)

    def test_decode_jwt_missing_exp(self):
        # Token with sub and aud but missing exp
        claims = {"sub": "user-123", "aud": "authenticated"}
        token = jwt.encode(claims, TEST_PRIVATE_KEY_PEM, algorithm="ES256")
        
        with pytest.raises(HTTPException) as exc:
            decode_supabase_jwt(token, _jwks_client_override=_test_jwk_client)
        assert exc.value.status_code == 401
        assert "exp" in str(exc.value.detail)
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pytest apps/api/tests/test_jwt.py -v`

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_jwt.py
git commit -m "test: add JWT decoding tests for missing required claims"
```

### Task 4: Pending User Auth and Admin Deactivation Fixes

**Files:**
- Modify: `apps/api/app/routers/users.py`
- Modify: `apps/api/app/auth/dependencies.py`
- Modify: `apps/api/tests/test_users.py`
- Modify: `apps/api/tests/test_auth.py`

- [ ] **Step 1: Fix last-admin guard for pending admins**

In `apps/api/app/routers/users.py`, update `deactivate_user` to check for last admin even if target is `pending`.

```python
    # Before
    if target.role == "admin" and target.status == "active":
        active_admin_count = await User.filter(role="admin", status="active").count()
        if active_admin_count <= 1:
            raise HTTPException(status_code=409, detail="Cannot deactivate the last active admin")

    # After (robust check)
    if target.role == "admin":
        # Any admin that is NOT deactivated is considered a "live" admin (either active or pending activation)
        live_admin_count = await User.filter(role="admin", status__in=["active", "pending"]).count()
        if live_admin_count <= 1:
             raise HTTPException(status_code=409, detail="Cannot deactivate the last administrator")
```

- [ ] **Step 2: Refine pending user check in auth dependencies (H6)**

In `apps/api/app/auth/dependencies.py`, be more explicit about status checks.

```python
    # Ensure pending users are ALWAYS activated before being allowed through
    if user.status == "pending":
        user.status = "active"
        # ... existing metadata logic ...
        await user.save()
    
    if user.status != "active":
        raise HTTPException(status_code=401, detail="Account not active")
```

- [ ] **Step 3: Add tests for these fixes**

In `apps/api/tests/test_users.py`, add a test for deactivating a pending admin when they are the only admin.

In `apps/api/tests/test_auth.py`, add a test that explicitly checks a user that somehow stays `pending` (if that were possible) is blocked or activated.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest apps/api/tests/test_users.py apps/api/tests/test_auth.py -v`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/users.py apps/api/app/auth/dependencies.py apps/api/tests/test_users.py apps/api/tests/test_auth.py
git commit -m "fix: robust last-admin guard and explicit pending user activation"
```

### Task 5: Update Security Review Documentation

**Files:**
- Modify: `specs/008-users-rbac/review-security.md`

- [ ] **Step 1: Document fixes for H6 and others**

Ensure H6 and any other issues addressed are marked as "Fixed" in the summary table and descriptions.

- [ ] **Step 2: Commit**

```bash
git add specs/008-users-rbac/review-security.md
git commit -m "docs: mark security issues as fixed in review-security.md"
```
