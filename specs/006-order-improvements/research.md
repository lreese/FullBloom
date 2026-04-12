# Research: Order Management Improvements

## R1: Customer Search Implementation

**Decision**: Add `search` query parameter to `GET /api/v1/customers` that filters by `icontains` on both `name` and `customer_number`.

**Rationale**: The frontend `CustomerSelector` already sends a `search` param and debounces at 300ms. The backend just needs to accept and filter on it. Tortoise ORM supports `Q` objects for OR-based filtering with `icontains`.

**Alternatives considered**:
- Full-text search (pg_trgm) — overkill for ~100 customers
- Separate search endpoint — unnecessary; extending the existing list endpoint is simpler

## R2: Product Picker Data Source

**Decision**: Rewrite `ProductPickerPanel` to use the existing customer pricing endpoint (`GET /api/v1/customers/{id}/pricing`) instead of a non-existent `/api/v1/products` endpoint.

**Rationale**: The customer pricing response already contains all sales items with customer-specific pricing, grouped by product type/line. This is exactly what the product picker needs — no new endpoint required. The form already fetches this data on customer selection and caches it in `customerPricing` state.

**Alternatives considered**:
- Create a new `/api/v1/products` endpoint — would duplicate data already in pricing response and lack customer-specific prices
- Separate sales items endpoint — unnecessary indirection

## R3: Ship-Via Customer Defaults

**Decision**: Pass `default_ship_via` from the customer record to `ShipViaSelector` when a customer is selected. The customer list endpoint already returns this field.

**Rationale**: The `Customer` model already has `default_ship_via: CharField(100, null=True)`. The `GET /api/v1/customers` response includes it. The frontend just needs to read it on customer selection and pass it to `ShipViaSelector`.

**Alternatives considered**:
- Separate API call for customer defaults — unnecessary; data already in customer response

## R4: Order Edit Approach

**Decision**: Reuse `OrderForm` component with an `orderId` prop. When present, form loads existing order data via `GET /api/v1/orders/{id}` and submits via `PUT /api/v1/orders/{id}`. Customer field is displayed but disabled in edit mode.

**Rationale**: The form already handles all order fields. Edit mode needs: (1) fetch existing data on mount, (2) disable customer selector, (3) use PUT instead of POST. This avoids duplicating the complex form logic.

**Alternatives considered**:
- Separate EditOrderForm component — violates DRY; the form logic is identical except for the HTTP method and customer locking
- Inline editing in the list view — too complex for the number of fields; full form is more appropriate

## R5: Audit Log Model Design

**Decision**: Single `OrderAuditLog` model linked to the Order. Each row represents one save operation and stores a JSON `changes` field containing a structured diff of all modified fields (header and line items).

**Rationale**: One-entry-per-save (clarified in spec) is simpler to implement and query. JSON diff captures the full change context in one place. Matches the pattern used for inventory audit logs but adapted for the coarser granularity.

**Fields**: `id`, `order` (FK), `action` ("created" | "updated" | "deleted"), `changes` (JSONField — array of `{field, old_value, new_value}`), `entered_by`, `created_at`.

**Alternatives considered**:
- One row per changed field — higher volume, more complex queries, rejected per clarification
- Separate line item audit table — unnecessary complexity; line changes are included in the JSON diff

## R6: Order List Pagination

**Decision**: Server-side pagination with `offset`/`limit` query parameters, default page size 25. Filters: `date_from`, `date_to`, `customer_id`, `salesperson_email`, `search` (matches order_number or customer name).

**Rationale**: Standard REST pagination pattern. Server-side is necessary because the order count will grow over time. 25 per page matches the inventory list pattern.

**Alternatives considered**:
- Cursor-based pagination — unnecessary for this scale
- Client-side pagination — won't scale past a few hundred orders

## R7: Order Deletion

**Decision**: Soft delete is unnecessary at this scale. Hard delete via `DELETE /api/v1/orders/{id}` with cascade to line items. An audit log entry is created before deletion with a snapshot of the deleted order.

**Rationale**: Single-user, personal-project scale. Soft delete adds complexity (filtering deleted records everywhere) with minimal benefit. The audit log preserves a record of what was deleted and by whom.

**Alternatives considered**:
- Soft delete with `is_deleted` flag — adds filtering complexity to every query; overkill for this scale
