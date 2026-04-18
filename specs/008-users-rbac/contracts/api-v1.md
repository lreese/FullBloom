# API Contracts: Users & RBAC

All endpoints follow the project convention: `{ "data": ... }` for success, `{ "error": "message" }` for failure. All endpoints except auth endpoints require `Authorization: Bearer <supabase_jwt>` header.

## Authentication

### GET /api/v1/auth/me

Returns the current authenticated user's profile and role.

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "email": "user@oregonflowers.com",
    "display_name": "Jane Smith",
    "phone": "503-555-0100",
    "avatar_url": "https://storage.supabase.co/...",
    "role": "salesperson",
    "status": "active",
    "permissions": {
      "orders": "rw",
      "standing_orders": "rw",
      "customers": "rw",
      "inventory_counts": "r",
      "inventory_estimates": "r",
      "inventory_harvest": "rw",
      "inventory_availability": "r",
      "products": "r",
      "pricing": "rw"
    }
  }
}
```

**Errors**: 401 (no/invalid token), 401 (deactivated user)

---

## User Management (Admin only)

### GET /api/v1/users

List all users.

**Response** (200):
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@oregonflowers.com",
      "display_name": "Jane Smith",
      "role": "salesperson",
      "status": "active",
      "avatar_url": "https://...",
      "created_at": "2026-04-12T10:00:00Z"
    }
  ]
}
```

**Errors**: 401, 403 (non-admin)

---

### POST /api/v1/users/invite

Invite a new user by email with a role.

**Request**:
```json
{
  "email": "newuser@oregonflowers.com",
  "role": "field_worker"
}
```

**Response** (201):
```json
{
  "data": {
    "id": "uuid",
    "email": "newuser@oregonflowers.com",
    "role": "field_worker",
    "status": "pending"
  }
}
```

**Errors**: 401, 403 (non-admin), 422 (invalid email, email already exists)

---

### PUT /api/v1/users/{user_id}/role

Change a user's role.

**Request**:
```json
{
  "role": "data_manager"
}
```

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "email": "user@oregonflowers.com",
    "role": "data_manager"
  }
}
```

**Errors**: 401, 403 (non-admin), 404, 422 (invalid role)

---

### POST /api/v1/users/{user_id}/deactivate

Deactivate a user.

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "status": "deactivated"
  }
}
```

**Errors**: 401, 403 (non-admin), 404, 409 (last active admin)

---

### POST /api/v1/users/{user_id}/reactivate

Reactivate a deactivated user.

**Response** (200):
```json
{
  "data": {
    "id": "uuid",
    "status": "active"
  }
}
```

**Errors**: 401, 403 (non-admin), 404

---

## User Profile (self-service)

### GET /api/v1/profile

Get the current user's profile.

**Response** (200): Same as GET /api/v1/auth/me

---

### PUT /api/v1/profile

Update the current user's profile.

**Request**:
```json
{
  "display_name": "Jane Smith",
  "phone": "503-555-0100"
}
```

**Response** (200): Updated profile

**Errors**: 401

---

## Permissions Reference

### GET /api/v1/permissions

Returns the full permission matrix (for the admin Users page visual reference).

**Response** (200):
```json
{
  "data": {
    "roles": ["admin", "salesperson", "data_manager", "field_worker"],
    "areas": [
      { "key": "users", "label": "User Management" },
      { "key": "orders", "label": "Orders & Standing Orders" },
      { "key": "customers", "label": "Customers" },
      { "key": "inventory_counts", "label": "Inventory (Counts, Estimates)" },
      { "key": "inventory_harvest", "label": "Inventory (Harvest Status)" },
      { "key": "inventory_availability", "label": "Inventory (Availability, Comparison)" },
      { "key": "products", "label": "Products" },
      { "key": "pricing", "label": "Pricing" },
      { "key": "import", "label": "Import" }
    ],
    "matrix": {
      "admin": { "users": "rw", "orders": "rw", "customers": "rw", "...": "..." },
      "salesperson": { "orders": "rw", "...": "..." },
      "data_manager": { "...": "..." },
      "field_worker": { "...": "..." }
    }
  }
}
```

---

## Modified Endpoints

All existing endpoints gain:
- **401** response when no valid JWT is provided
- **403** response when the user's role lacks permission for the action
- `entered_by` populated from authenticated user's email (not request body)

The `Authorization: Bearer <token>` header is required on every request except `/api/v1/auth/me` (which still requires the header but is the entry point for the frontend to verify the session).
