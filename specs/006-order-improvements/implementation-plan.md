# Order Management Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken order submission form, add an order list view with expandable rows, enable order editing/deletion, add audit logging, and build test coverage.

**Architecture:** Extends the existing order management stack. Backend adds search, list, update, delete endpoints and an OrderAuditLog model. Frontend fixes CustomerSelector, ShipViaSelector, and ProductPickerPanel, adds an OrdersPage with expandable rows, and extends OrderForm for edit mode.

**Tech Stack:** Python 3.11+/FastAPI/Tortoise ORM (backend), TypeScript/React/Tailwind/shadcn (frontend), pytest (tests)

---

### Task 1: Backend — Add customer search support

**Files:**
- Modify: `apps/api/app/routers/customers.py:50-59`
- Create: `apps/api/tests/test_customers.py`

- [ ] **Step 1: Write failing tests for customer search**

Create `apps/api/tests/test_customers.py`:

```python
"""Tests for customer search endpoint."""
import pytest
from httpx import AsyncClient

BASE = "/api/v1"

pytestmark = pytest.mark.anyio


@pytest.fixture
async def customers(async_client):
    """Create test customers."""
    custs = []
    for name, number in [("Oregon Flowers", "CUST-001"), ("Happy Flower Market", "CUST-002"), ("Sunshine Blooms", "CUST-003")]:
        from app.models.customer import Customer
        c = await Customer.create(customer_number=number, name=name, is_active=True)
        custs.append(c)
    return custs


async def test_search_by_name(async_client, customers):
    resp = await async_client.get(f"{BASE}/customers?search=oregon")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Oregon Flowers"


async def test_search_by_number(async_client, customers):
    resp = await async_client.get(f"{BASE}/customers?search=CUST-002")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Happy Flower Market"


async def test_search_case_insensitive(async_client, customers):
    resp = await async_client.get(f"{BASE}/customers?search=SUNSHINE")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1


async def test_search_no_results(async_client, customers):
    resp = await async_client.get(f"{BASE}/customers?search=nonexistent")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 0


async def test_search_returns_all_without_param(async_client, customers):
    resp = await async_client.get(f"{BASE}/customers")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && python -m pytest tests/test_customers.py -v`
Expected: FAIL — search param not implemented

- [ ] **Step 3: Implement customer search**

In `apps/api/app/routers/customers.py`, modify the `list_customers` endpoint:

```python
from tortoise.expressions import Q

@router.get("/customers")
async def list_customers(active: bool | None = True, search: str | None = None) -> dict:
    """List all customers, optionally filtered by active status and search term."""
    qs = Customer.all()
    if active is not None:
        qs = qs.filter(is_active=active)
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(customer_number__icontains=search))
    customers = await qs.order_by("name")
    return {"data": [await _build_customer_list_response(c) for c in customers]}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && python -m pytest tests/test_customers.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/routers/customers.py apps/api/tests/test_customers.py
git commit -m "feat: add customer search support to list endpoint"
```

---

### Task 2: Backend — OrderAuditLog model and migration

**Files:**
- Modify: `apps/api/app/models/order.py`
- New migration via aerich

- [ ] **Step 1: Add OrderAuditLog model**

Append to `apps/api/app/models/order.py`:

```python
class OrderAuditLog(Model):
    """Audit trail for order changes. One entry per save operation."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    order = fields.ForeignKeyField(
        "models.Order", related_name="audit_logs", on_delete=fields.CASCADE
    )
    action = fields.CharField(max_length=10)  # "created", "updated", "deleted"
    changes = fields.JSONField(default=list)  # [{field, old_value, new_value}]
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "order_audit_logs"

    def __str__(self) -> str:
        return f"OrderAuditLog({self.order_id}, {self.action})"
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd apps/api
python -m aerich migrate --name add_order_audit_log
python -m aerich upgrade
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/models/order.py apps/api/migrations/
git commit -m "feat: add OrderAuditLog model and migration"
```

---

### Task 3: Backend — Order list, update, delete endpoints

**Files:**
- Modify: `apps/api/app/routers/orders.py`
- Modify: `apps/api/app/schemas/order.py`
- Modify: `apps/api/app/services/order_service.py`
- Create: `apps/api/tests/test_orders.py`

- [ ] **Step 1: Add new schemas**

Add to `apps/api/app/schemas/order.py`:

```python
class OrderLineUpdateRequest(BaseModel):
    id: str | None = None  # null for new lines
    sales_item_id: str
    assorted: bool = False
    color_variety: str | None = None
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    notes: str | None = None
    box_quantity: int | None = None
    bunches_per_box: int | None = None
    stems_per_bunch: int | None = None
    box_reference: str | None = None
    is_special: bool = False
    sleeve: str | None = None
    upc: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than zero")
        return v


class OrderUpdateRequest(BaseModel):
    order_date: str | None = None
    ship_via: str | None = None
    order_label: str | None = None
    freight_charge_included: bool | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    order_notes: str | None = None
    po_number: str | None = None
    salesperson_email: str | None = None
    lines: list[OrderLineUpdateRequest] | None = None


class OrderListItemResponse(BaseModel):
    id: str
    order_number: str
    customer_id: str
    customer_name: str
    order_date: str
    ship_via: str | None
    lines_count: int
    total_stems: int
    salesperson_email: str | None
    created_at: str


class OrderListResponse(BaseModel):
    items: list[OrderListItemResponse]
    total: int
    offset: int
    limit: int


class OrderAuditLogResponse(BaseModel):
    id: str
    action: str
    changes: list
    entered_by: str | None
    created_at: str
```

- [ ] **Step 2: Add update and delete service functions**

Add to `apps/api/app/services/order_service.py`:

```python
from app.models.order import Order, OrderLine, OrderAuditLog


async def update_order(order_id: str, data, entered_by: str | None = None) -> Order:
    """Update an existing order and create audit log entry."""
    order = await Order.get_or_none(id=order_id).prefetch_related(
        "lines", "lines__sales_item", "customer"
    )
    if not order:
        raise ValueError(f"Order {order_id} not found")

    changes = []

    # Track header field changes
    header_fields = [
        "order_date", "ship_via", "order_label", "freight_charge_included",
        "box_charge", "holiday_charge_pct", "special_charge", "freight_charge",
        "order_notes", "po_number", "salesperson_email",
    ]
    for field in header_fields:
        new_val = getattr(data, field, None)
        if new_val is not None:
            old_val = getattr(order, field)
            if str(old_val) != str(new_val):
                changes.append({"field": field, "old_value": str(old_val) if old_val is not None else None, "new_value": str(new_val)})
                setattr(order, field, new_val)

    await order.save()

    # Handle line items if provided
    if data.lines is not None:
        existing_lines = {str(line.id): line for line in order.lines}
        submitted_ids = {line.id for line in data.lines if line.id}

        # Delete removed lines
        for line_id, line in existing_lines.items():
            if line_id not in submitted_ids:
                sales_item = await line.sales_item
                changes.append({
                    "field": "line_removed",
                    "old_value": {"sales_item": str(sales_item), "stems": line.stems},
                    "new_value": None,
                })
                await line.delete()

        # Update or create lines
        from app.models.product import SalesItem
        from app.models.customer import CustomerPrice
        line_number = 0
        for line_data in data.lines:
            line_number += 1
            if line_data.id and line_data.id in existing_lines:
                # Update existing line
                existing = existing_lines[line_data.id]
                line_changes = {}
                for f in ["stems", "price_per_stem", "item_fee_pct", "item_fee_dollar",
                           "color_variety", "assorted", "notes", "box_quantity",
                           "bunches_per_box", "stems_per_bunch", "box_reference",
                           "is_special", "sleeve", "upc"]:
                    new_v = getattr(line_data, f)
                    old_v = getattr(existing, f)
                    if str(new_v) != str(old_v):
                        line_changes[f] = {"old": str(old_v) if old_v is not None else None, "new": str(new_v) if new_v is not None else None}
                        setattr(existing, f, new_v)

                # Recalculate effective price
                fee_pct = Decimal(str(line_data.item_fee_pct)) if line_data.item_fee_pct else Decimal("0")
                fee_dollar = Decimal(str(line_data.item_fee_dollar)) if line_data.item_fee_dollar else Decimal("0")
                price = Decimal(str(line_data.price_per_stem))
                existing.effective_price_per_stem = (price * (1 + fee_pct)) + fee_dollar
                existing.line_number = line_number
                await existing.save()

                if line_changes:
                    changes.append({
                        "field": "line_modified",
                        "old_value": {k: v["old"] for k, v in line_changes.items()},
                        "new_value": {k: v["new"] for k, v in line_changes.items()},
                        "line_id": str(existing.id),
                    })
            else:
                # Create new line
                sales_item = await SalesItem.get(id=line_data.sales_item_id)

                # Determine list price
                customer_price = await CustomerPrice.get_or_none(
                    customer_id=order.customer_id,
                    sales_item_id=line_data.sales_item_id,
                )
                list_price = float(customer_price.price) if customer_price else float(sales_item.retail_price)

                fee_pct = Decimal(str(line_data.item_fee_pct)) if line_data.item_fee_pct else Decimal("0")
                fee_dollar = Decimal(str(line_data.item_fee_dollar)) if line_data.item_fee_dollar else Decimal("0")
                price = Decimal(str(line_data.price_per_stem))
                effective_price = (price * (1 + fee_pct)) + fee_dollar

                new_line = await OrderLine.create(
                    order=order,
                    sales_item=sales_item,
                    assorted=line_data.assorted,
                    color_variety=line_data.color_variety,
                    stems=line_data.stems,
                    list_price_per_stem=list_price,
                    price_per_stem=float(line_data.price_per_stem),
                    item_fee_pct=line_data.item_fee_pct,
                    item_fee_dollar=line_data.item_fee_dollar,
                    effective_price_per_stem=float(effective_price),
                    notes=line_data.notes,
                    box_quantity=line_data.box_quantity,
                    bunches_per_box=line_data.bunches_per_box,
                    stems_per_bunch=line_data.stems_per_bunch,
                    box_reference=line_data.box_reference,
                    is_special=line_data.is_special,
                    sleeve=line_data.sleeve,
                    upc=line_data.upc,
                    line_number=line_number,
                )
                changes.append({
                    "field": "line_added",
                    "old_value": None,
                    "new_value": {"sales_item": str(sales_item), "stems": line_data.stems},
                })

    # Create audit log if there were changes
    if changes:
        await OrderAuditLog.create(
            order=order,
            action="updated",
            changes=changes,
            entered_by=entered_by or data.salesperson_email,
        )

    return await Order.get(id=order_id).prefetch_related("lines", "lines__sales_item", "customer")


async def delete_order(order_id: str, entered_by: str | None = None) -> str:
    """Delete an order and create a final audit entry."""
    order = await Order.get_or_none(id=order_id).prefetch_related("lines", "customer")
    if not order:
        raise ValueError(f"Order {order_id} not found")

    order_number = order.order_number
    customer = await order.customer

    # Create audit log before deletion
    await OrderAuditLog.create(
        order=order,
        action="deleted",
        changes=[{
            "field": "order_snapshot",
            "old_value": {
                "order_number": order_number,
                "customer": str(customer.name),
                "lines_count": len(order.lines),
            },
            "new_value": None,
        }],
        entered_by=entered_by,
    )

    await order.delete()
    return order_number
```

Also add audit log creation to the existing `create_order` function — after the order is created (around line 134), add:

```python
await OrderAuditLog.create(
    order=order,
    action="created",
    changes=[],
    entered_by=data.salesperson_email,
)
```

- [ ] **Step 3: Add list, update, delete, and audit log endpoints**

Add to `apps/api/app/routers/orders.py`:

```python
from datetime import date
from tortoise.expressions import Q

@router.get("/orders")
async def list_orders(
    offset: int = 0,
    limit: int = Query(default=25, le=100),
    date_from: date | None = None,
    date_to: date | None = None,
    customer_id: str | None = None,
    salesperson_email: str | None = None,
    search: str | None = None,
) -> dict:
    """List orders with optional filters and pagination."""
    qs = Order.all().prefetch_related("customer", "lines")

    if date_from:
        qs = qs.filter(order_date__gte=date_from)
    if date_to:
        qs = qs.filter(order_date__lte=date_to)
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
    if salesperson_email:
        qs = qs.filter(salesperson_email__icontains=salesperson_email)
    if search:
        qs = qs.filter(
            Q(order_number__icontains=search) | Q(customer__name__icontains=search)
        )

    total = await qs.count()
    orders = await qs.order_by("-order_date", "-created_at").offset(offset).limit(limit)

    items = []
    for o in orders:
        customer = await o.customer
        lines = await o.lines.all()
        items.append(OrderListItemResponse(
            id=str(o.id),
            order_number=o.order_number,
            customer_id=str(o.customer_id),
            customer_name=customer.name,
            order_date=str(o.order_date),
            ship_via=o.ship_via,
            lines_count=len(lines),
            total_stems=sum(l.stems for l in lines),
            salesperson_email=o.salesperson_email,
            created_at=o.created_at.isoformat(),
        ))

    return {"data": OrderListResponse(items=items, total=total, offset=offset, limit=limit)}


@router.put("/orders/{order_id}")
async def update_order_endpoint(order_id: str, data: OrderUpdateRequest) -> dict:
    """Update an existing order."""
    try:
        order = await update_order(order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 422, detail=str(e))

    # Return full order detail (same as GET)
    return await get_order(order_id)


@router.delete("/orders/{order_id}")
async def delete_order_endpoint(order_id: str) -> dict:
    """Delete an order."""
    try:
        order_number = await delete_order(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"data": {"deleted": True, "order_number": order_number}}


@router.get("/orders/{order_id}/audit-log")
async def get_order_audit_log(order_id: str) -> dict:
    """Get audit trail for an order."""
    order = await Order.get_or_none(id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    entries = await OrderAuditLog.filter(order=order).order_by("-created_at").limit(50)
    return {
        "data": [
            OrderAuditLogResponse(
                id=str(e.id),
                action=e.action,
                changes=e.changes,
                entered_by=e.entered_by,
                created_at=e.created_at.isoformat(),
            )
            for e in entries
        ]
    }
```

- [ ] **Step 4: Write comprehensive order tests**

Create `apps/api/tests/test_orders.py` with tests covering:
- Order creation (happy path, duplicate detection, missing customer, invalid lines)
- Order listing (pagination, date range filter, customer filter, search)
- Order update (header fields, add/remove/modify lines, audit log creation)
- Order deletion (success, 404, audit log)
- Audit log retrieval
- Completed sheet blocking (409)

- [ ] **Step 5: Run all tests**

```bash
cd apps/api && python -m pytest tests/test_orders.py tests/test_customers.py -v
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routers/orders.py apps/api/app/schemas/order.py apps/api/app/services/order_service.py apps/api/tests/test_orders.py
git commit -m "feat: add order list, update, delete endpoints with audit logging"
```

---

### Task 4: Frontend — Fix CustomerSelector search

**Files:**
- Modify: `apps/web/src/components/order/CustomerSelector.tsx`

- [ ] **Step 1: Fix the fetch to pass search param correctly**

The CustomerSelector already sends `?search=` to the backend. With Task 1's backend fix, search now works. However, verify the fetch URL construction is correct in `fetchCustomers` (line 26-39). It should be:

```typescript
const fetchCustomers = async (term?: string) => {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    const data = await api.get<Customer[]>(`/api/v1/customers?${params.toString()}`);
    setCustomers(data);
  } catch {
    setCustomers([]);
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: Test manually — type in search, verify filtered results**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order/CustomerSelector.tsx
git commit -m "fix: wire customer search to backend filter endpoint"
```

---

### Task 5: Frontend — Fix ShipViaSelector customer defaults

**Files:**
- Modify: `apps/web/src/components/order/ShipViaSelector.tsx`
- Modify: `apps/web/src/components/order/OrderForm.tsx`

- [ ] **Step 1: Add customerDefault prop to ShipViaSelector**

Update `ShipViaSelector` props interface and component:

```typescript
interface ShipViaSelectorProps {
  value: string;
  onChange: (value: string) => void;
  customerDefault?: string | null;
}
```

Replace the mount-time useEffect (lines 34-38) to respond to customerDefault changes:

```typescript
useEffect(() => {
  if (customerDefault) {
    onChange(customerDefault);
    // Add to options if not already present
    setOptions((prev) =>
      prev.includes(customerDefault) ? prev : [...prev, customerDefault]
    );
  } else if (!value) {
    onChange(DEFAULT_SHIP_VIA);
  }
}, [customerDefault]);
```

- [ ] **Step 2: Pass customer default from OrderForm**

In `OrderForm.tsx`, update `handleCustomerChange` to pass the customer's default_ship_via to ShipViaSelector. In the JSX where ShipViaSelector is rendered (in OrderContextRow), pass:

```tsx
<ShipViaSelector
  value={shipVia}
  onChange={setShipVia}
  customerDefault={customer?.default_ship_via}
/>
```

This requires threading the prop through `OrderContextRow`. Add `customerDefaultShipVia?: string | null` to OrderContextRow's props and pass it through.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order/ShipViaSelector.tsx apps/web/src/components/order/OrderForm.tsx apps/web/src/components/order/OrderContextRow.tsx
git commit -m "feat: auto-populate ship-via from customer default"
```

---

### Task 6: Frontend — Fix ProductPickerPanel to use customer pricing

**Files:**
- Modify: `apps/web/src/components/order/ProductPickerPanel.tsx`

- [ ] **Step 1: Rewrite to use customerPricing instead of /api/v1/products**

The component already receives `customerPricing: CustomerPricing[]` as a prop. Remove the fetch to `/api/v1/products` and instead derive the product list from customerPricing, grouped by product type/line. The customerPricing array contains `sales_item_id`, `sales_item_name`, `customer_price`, `retail_price`, etc.

Replace the useEffect fetch (lines 37-43) and the grouped useMemo to work from `customerPricing` prop instead of fetched varieties.

- [ ] **Step 2: Disable "Browse Products" button when no customer is selected**

In `OrderForm.tsx`, the button that opens ProductPickerPanel should be disabled when `customer` is null:

```tsx
<Button
  onClick={() => setProductPickerOpen(true)}
  disabled={!customer}
  title={!customer ? "Select a customer first" : undefined}
>
  Browse Products
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/order/ProductPickerPanel.tsx apps/web/src/components/order/OrderForm.tsx
git commit -m "fix: rewrite product picker to use customer pricing data"
```

---

### Task 7: Frontend — OrdersPage with expandable rows

**Files:**
- Create: `apps/web/src/pages/OrdersPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create OrdersPage component**

Build the orders list page with:
- Filter bar: search input, date range, customer dropdown, salesperson dropdown
- Data table with columns: chevron, order #, customer, date, ship via, lines, stems, actions
- Expandable rows showing line items (read-only)
- Pagination footer
- Edit button navigates to `/orders/{id}/edit`
- Delete button shows confirmation dialog
- "+ New Order" button navigates to `/orders/new`

Fetch from `GET /api/v1/orders` with query params for filters.

- [ ] **Step 2: Add routes**

In `App.tsx`, update routes:

```tsx
<Route path="/orders" element={<OrdersPage />} />
<Route path="/orders/new" element={<OrderForm />} />
<Route path="/orders/:orderId/edit" element={<OrderForm />} />
```

- [ ] **Step 3: Update sidebar**

In `Sidebar.tsx`, update the Orders nav item to have children:

```typescript
{
  label: "Orders",
  icon: ClipboardList,
  href: "/orders",
  children: [
    { label: "All Orders", icon: List, href: "/orders" },
    { label: "New Order", icon: PlusCircle, href: "/orders/new" },
  ],
},
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/OrdersPage.tsx apps/web/src/App.tsx apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add orders list page with expandable rows and filters"
```

---

### Task 8: Frontend — OrderForm edit mode

**Files:**
- Modify: `apps/web/src/components/order/OrderForm.tsx`
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Add edit mode support to OrderForm**

Key changes:
- Accept `orderId` from route params via `useParams()`
- When `orderId` is present, fetch order from `GET /api/v1/orders/{orderId}` on mount
- Populate all form fields from the response
- Disable CustomerSelector in edit mode (show customer name, not editable)
- Change submit to use `PUT /api/v1/orders/{orderId}` instead of `POST`
- Add dirty tracking and unsaved changes warning via `beforeunload` event
- Add audit log display section (expandable, fetches from `/api/v1/orders/{orderId}/audit-log`)

- [ ] **Step 2: Add OrderUpdateRequest and OrderAuditLogEntry types**

Add to `apps/web/src/types/index.ts`:

```typescript
export interface OrderLineUpdateRequest {
  id: string | null;
  sales_item_id: string;
  assorted: boolean;
  color_variety: string | null;
  stems: number;
  price_per_stem: number;
  item_fee_pct: number | null;
  item_fee_dollar: number | null;
  notes: string | null;
  box_quantity: number | null;
  bunches_per_box: number | null;
  stems_per_bunch: number | null;
  box_reference: string | null;
  is_special: boolean;
  sleeve: string | null;
  upc: string | null;
}

export interface OrderUpdateRequest {
  order_date?: string;
  ship_via?: string;
  order_label?: string;
  freight_charge_included?: boolean;
  box_charge?: number | null;
  holiday_charge_pct?: number | null;
  special_charge?: number | null;
  freight_charge?: number | null;
  order_notes?: string;
  po_number?: string;
  salesperson_email?: string;
  lines?: OrderLineUpdateRequest[];
}

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  ship_via: string | null;
  lines_count: number;
  total_stems: number;
  salesperson_email: string | null;
  created_at: string;
}

export interface OrderListResponse {
  items: OrderListItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface OrderAuditLogEntry {
  id: string;
  action: string;
  changes: Array<{field: string; old_value: unknown; new_value: unknown; line_id?: string}>;
  entered_by: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Create OrderAuditLog display component**

Create `apps/web/src/components/order/OrderAuditLog.tsx` — collapsible section showing audit entries chronologically. Reuse the visual pattern from the inventory `CountAuditLog` component.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/order/OrderForm.tsx apps/web/src/components/order/OrderAuditLog.tsx apps/web/src/types/index.ts
git commit -m "feat: add order edit mode with audit log display"
```

---

### Task 9: Fix TypeScript type mismatches

**Files:**
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Fix OrderDetailResponse**

Remove `store_name` from OrderDetailResponse (line 371) — the backend returns `order_label` not `store_name`. Add `order_label: string | null` if missing.

- [ ] **Step 2: Remove ProductListResponse**

Remove the `ProductListResponse` type if it exists — it's unused now that ProductPickerPanel uses customerPricing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/index.ts
git commit -m "fix: correct TypeScript type definitions for order responses"
```
