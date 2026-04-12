# Standing Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standing orders — recurring order templates with multi-day cadence, status management (active/paused/cancelled), order generation with preview, and full audit trail.

**Architecture:** New model file `standing_order.py` with StandingOrder, StandingOrderLine, StandingOrderAuditLog. New router, service, and schemas following the exact patterns from order management. Add nullable `standing_order_id` FK to existing Order model. Frontend: dedicated StandingOrdersPage with expandable rows, StandingOrderForm reusing order component patterns, GenerateOrdersDialog. Cadence stored as `frequency_weeks` (1/2/4) + `days_of_week` (JSON array of ints 0-6).

**Tech Stack:** Python 3.11+/FastAPI/Tortoise ORM (backend), TypeScript/React/Tailwind/shadcn (frontend), pytest (tests)

---

### Task 1: StandingOrder models + migration

**Files:**
- Create: `apps/api/app/models/standing_order.py`
- Modify: `apps/api/app/models/order.py` — add standing_order_id FK
- Modify: `apps/api/tests/conftest.py` — register new model module
- Migration via aerich

- [ ] **Step 1: Create StandingOrder, StandingOrderLine, StandingOrderAuditLog models**

Create `apps/api/app/models/standing_order.py`:

```python
"""StandingOrder, StandingOrderLine, and StandingOrderAuditLog models."""

import uuid

from tortoise import fields
from tortoise.models import Model


class StandingOrder(Model):
    """A recurring order template for a customer."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="standing_orders", on_delete=fields.CASCADE
    )
    status = fields.CharField(max_length=10, default="active")  # active, paused, cancelled
    frequency_weeks = fields.IntField()  # 1, 2, or 4
    days_of_week = fields.JSONField(default=list)  # [0,1,2,...6] Mon=0, Sun=6
    reference_date = fields.DateField()
    ship_via = fields.CharField(max_length=100, null=True)
    salesperson_email = fields.CharField(max_length=255, null=True)
    box_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    holiday_charge_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    special_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    freight_charge = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    freight_charge_included = fields.BooleanField(default=False)
    notes = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "standing_orders"

    def __str__(self) -> str:
        return f"StandingOrder({self.id}, {self.status})"


class StandingOrderLine(Model):
    """A single sales item within a standing order template."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    standing_order = fields.ForeignKeyField(
        "models.StandingOrder", related_name="lines", on_delete=fields.CASCADE
    )
    sales_item = fields.ForeignKeyField(
        "models.SalesItem", related_name="standing_order_lines", on_delete=fields.CASCADE
    )
    stems = fields.IntField()
    price_per_stem = fields.DecimalField(max_digits=10, decimal_places=2)
    item_fee_pct = fields.DecimalField(max_digits=5, decimal_places=4, null=True)
    item_fee_dollar = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    color_variety = fields.CharField(max_length=100, null=True)
    notes = fields.TextField(null=True)
    line_number = fields.IntField()

    class Meta:
        table = "standing_order_lines"
        unique_together = (("standing_order", "line_number"),)

    def __str__(self) -> str:
        return f"StandingOrderLine({self.standing_order_id}, #{self.line_number})"


class StandingOrderAuditLog(Model):
    """Audit trail for standing order changes with required reasons."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    standing_order = fields.ForeignKeyField(
        "models.StandingOrder", related_name="audit_logs", on_delete=fields.CASCADE
    )
    action = fields.CharField(max_length=10)  # created, updated, paused, resumed, cancelled
    reason = fields.TextField(null=True)
    changes = fields.JSONField(default=list)
    entered_by = fields.CharField(max_length=100, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "standing_order_audit_logs"

    def __str__(self) -> str:
        return f"StandingOrderAuditLog({self.standing_order_id}, {self.action})"
```

- [ ] **Step 2: Add standing_order_id FK to Order model**

In `apps/api/app/models/order.py`, add after the `order_label` field (line 29):

```python
    standing_order = fields.ForeignKeyField(
        "models.StandingOrder", related_name="generated_orders",
        on_delete=fields.SET_NULL, null=True
    )
```

- [ ] **Step 3: Register model module in test conftest**

In `apps/api/tests/conftest.py`, add `"app.models.standing_order"` to the models list in TORTOISE_TEST_CONFIG (after `"app.models.order"` on line 26).

- [ ] **Step 4: Register model module in app config**

In `apps/api/app/config.py`, add `"app.models.standing_order"` to the TORTOISE_ORM models list.

- [ ] **Step 5: Generate and apply migration**

```bash
cd apps/api
python -m aerich migrate --name add_standing_orders
python -m aerich upgrade
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/models/standing_order.py apps/api/app/models/order.py apps/api/tests/conftest.py apps/api/app/config.py apps/api/migrations/
git commit -m "feat: add StandingOrder models and Order.standing_order_id FK"
```

---

### Task 2: Standing order schemas

**Files:**
- Create: `apps/api/app/schemas/standing_order.py`

- [ ] **Step 1: Create all request/response schemas**

Create `apps/api/app/schemas/standing_order.py`:

```python
"""Pydantic schemas for standing order endpoints."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class StandingOrderLineCreateRequest(BaseModel):
    sales_item_id: UUID
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    color_variety: str | None = None
    notes: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class StandingOrderCreateRequest(BaseModel):
    customer_id: UUID
    frequency_weeks: int
    days_of_week: list[int]
    reference_date: date
    ship_via: str | None = None
    salesperson_email: EmailStr | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    freight_charge_included: bool = False
    notes: str | None = None
    lines: list[StandingOrderLineCreateRequest]

    @field_validator("frequency_weeks")
    @classmethod
    def frequency_must_be_valid(cls, v: int) -> int:
        if v not in (1, 2, 4):
            raise ValueError("frequency_weeks must be 1, 2, or 4")
        return v

    @field_validator("days_of_week")
    @classmethod
    def days_must_be_valid(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("at least one day of week is required")
        if not all(0 <= d <= 6 for d in v):
            raise ValueError("days_of_week must be integers 0-6 (Mon-Sun)")
        return sorted(set(v))

    @field_validator("lines")
    @classmethod
    def lines_must_not_be_empty(cls, v: list) -> list:
        if len(v) < 1:
            raise ValueError("standing order must have at least 1 line item")
        return v


class StandingOrderLineUpdateRequest(BaseModel):
    id: UUID | None = None
    sales_item_id: UUID
    stems: int
    price_per_stem: float
    item_fee_pct: float | None = None
    item_fee_dollar: float | None = None
    color_variety: str | None = None
    notes: str | None = None

    @field_validator("stems")
    @classmethod
    def stems_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stems must be greater than 0")
        return v


class StandingOrderUpdateRequest(BaseModel):
    frequency_weeks: int | None = None
    days_of_week: list[int] | None = None
    reference_date: date | None = None
    ship_via: str | None = None
    salesperson_email: EmailStr | None = None
    box_charge: float | None = None
    holiday_charge_pct: float | None = None
    special_charge: float | None = None
    freight_charge: float | None = None
    freight_charge_included: bool | None = None
    notes: str | None = None
    reason: str  # required for updates
    apply_to_future_orders: bool = False
    lines: list[StandingOrderLineUpdateRequest] | None = None

    @field_validator("frequency_weeks")
    @classmethod
    def frequency_must_be_valid(cls, v: int | None) -> int | None:
        if v is not None and v not in (1, 2, 4):
            raise ValueError("frequency_weeks must be 1, 2, or 4")
        return v

    @field_validator("days_of_week")
    @classmethod
    def days_must_be_valid(cls, v: list[int] | None) -> list[int] | None:
        if v is not None:
            if not v:
                raise ValueError("at least one day of week is required")
            if not all(0 <= d <= 6 for d in v):
                raise ValueError("days_of_week must be integers 0-6")
            return sorted(set(v))
        return v


class StatusChangeRequest(BaseModel):
    reason: str | None = None


class GeneratePreviewRequest(BaseModel):
    date_from: date
    date_to: date


class GenerateRequest(BaseModel):
    date_from: date
    date_to: date
    skip_already_generated: bool = True


# --- Response schemas ---

class StandingOrderLineResponse(BaseModel):
    id: str
    line_number: int
    sales_item_id: str
    sales_item_name: str
    stems: int
    price_per_stem: str
    item_fee_pct: str | None
    item_fee_dollar: str | None
    color_variety: str | None
    notes: str | None


class StandingOrderCreateResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: str
    frequency_weeks: int
    days_of_week: list[int]
    reference_date: str
    lines_count: int
    created_at: str


class StandingOrderDetailResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: str
    frequency_weeks: int
    days_of_week: list[int]
    days_of_week_names: list[str]
    reference_date: str
    cadence_description: str
    ship_via: str | None
    salesperson_email: str | None
    box_charge: str | None
    holiday_charge_pct: str | None
    special_charge: str | None
    freight_charge: str | None
    freight_charge_included: bool
    notes: str | None
    created_at: str
    updated_at: str
    lines: list[StandingOrderLineResponse]


class StandingOrderListItemResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    status: str
    frequency_weeks: int
    days_of_week: list[int]
    cadence_description: str
    lines_count: int
    total_stems: int
    salesperson_email: str | None
    updated_at: str


class GeneratePreviewMatch(BaseModel):
    standing_order_id: str
    customer_name: str
    cadence_description: str
    generate_date: str
    lines_count: int
    total_stems: int
    already_generated: bool


class GeneratePreviewResponse(BaseModel):
    date_from: str
    date_to: str
    matches: list[GeneratePreviewMatch]


class GenerateResponse(BaseModel):
    orders_created: int
    orders_skipped: int
    order_ids: list[str]


class StandingOrderAuditLogResponse(BaseModel):
    id: str
    action: str
    reason: str | None
    changes: list
    entered_by: str | None
    created_at: str
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/schemas/standing_order.py
git commit -m "feat: add standing order schemas"
```

---

### Task 3: Standing order service layer

**Files:**
- Create: `apps/api/app/services/standing_order_service.py`

- [ ] **Step 1: Create the service with all business logic**

Create `apps/api/app/services/standing_order_service.py` with these functions:

1. `build_cadence_description(frequency_weeks, days_of_week)` — returns human-readable string like "Every week on Mon, Tue, Thu"
2. `matches_cadence(standing_order, target_date)` — checks if a date matches the standing order's cadence (correct day of week + correct week cycle based on reference_date)
3. `create_standing_order(data)` — validates customer, creates standing order + lines in transaction, creates audit log
4. `update_standing_order(so_id, data, entered_by)` — updates header/lines with field-level diff tracking, creates audit log with reason, optionally applies changes to future generated orders
5. `pause_standing_order(so_id, reason, entered_by)` — validates status is active, changes to paused
6. `resume_standing_order(so_id, entered_by)` — validates status is paused, changes to active
7. `cancel_standing_order(so_id, reason, entered_by)` — validates not already cancelled, changes to cancelled
8. `generate_preview(date_from, date_to)` — finds all active standing orders, checks cadence match for each date, checks for existing generated orders
9. `generate_orders(date_from, date_to, skip_already_generated)` — creates regular Order + OrderLine records from standing order templates, sets standing_order_id FK

The cadence matching algorithm:
```python
def matches_cadence(so, target_date: date) -> bool:
    if target_date.weekday() not in so.days_of_week:
        return False
    if so.frequency_weeks == 1:
        return True
    weeks_diff = (target_date - so.reference_date).days // 7
    return weeks_diff % so.frequency_weeks == 0
```

The order generation copies all fields from the standing order template to create a regular Order, including all line items with pricing. The generated order's `standing_order_id` FK is set.

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/services/standing_order_service.py
git commit -m "feat: add standing order service layer"
```

---

### Task 4: Standing order router + register in main

**Files:**
- Create: `apps/api/app/routers/standing_orders.py`
- Modify: `apps/api/app/main.py` — register router

- [ ] **Step 1: Create router with all endpoints**

Endpoints to implement:
- `POST /standing-orders` — create
- `GET /standing-orders` — list with filters (status, customer_id, salesperson_email, search)
- `GET /standing-orders/{id}` — detail with lines
- `PUT /standing-orders/{id}` — update (requires active status)
- `POST /standing-orders/{id}/pause` — pause (requires active)
- `POST /standing-orders/{id}/resume` — resume (requires paused)
- `POST /standing-orders/{id}/cancel` — cancel (requires active or paused)
- `POST /standing-orders/generate-preview` — preview generation matches
- `POST /standing-orders/generate` — execute generation
- `GET /standing-orders/{id}/audit-log` — audit trail

Follow the exact patterns from `orders.py`: UUID path params, `{"data": ...}` envelope, HTTPException for errors (404/409/422).

- [ ] **Step 2: Register router in main.py**

Add import and `app.include_router(standing_orders_router)` after the orders_router line.

- [ ] **Step 3: Add standing_order_id to orders list response**

Modify `apps/api/app/routers/orders.py` to include `standing_order_id` in the list response and add a `from_standing_order` filter parameter.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routers/standing_orders.py apps/api/app/main.py apps/api/app/routers/orders.py
git commit -m "feat: add standing order endpoints"
```

---

### Task 5: Backend tests

**Files:**
- Create: `apps/api/tests/test_standing_orders.py`

- [ ] **Step 1: Write comprehensive tests**

Test coverage:
- Create standing order (happy path, invalid customer, empty lines, invalid frequency, invalid days)
- List standing orders (all statuses, filter by status, filter by customer, filter by salesperson, search)
- Get standing order detail
- Update standing order (header fields, add/remove/modify lines, audit log with reason, 409 when not active)
- Pause (happy path, already paused → 409, cancelled → 409, audit log)
- Resume (happy path, already active → 409, cancelled → 409, audit log)
- Cancel (happy path, already cancelled → 409, audit log)
- Generate preview (matching cadence, multi-day, 2-week/4-week cycles, duplicate detection)
- Generate orders (creates orders linked to standing order, skips duplicates, excludes paused/cancelled)
- Audit log retrieval

- [ ] **Step 2: Run tests**

```bash
cd apps/api && python -m pytest tests/test_standing_orders.py -v
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_standing_orders.py
git commit -m "test: add comprehensive standing order tests"
```

---

### Task 6: Frontend types

**Files:**
- Create: `apps/web/src/types/standing-order.ts`

- [ ] **Step 1: Create TypeScript types**

Types to define: StandingOrderListItem, StandingOrderDetail, StandingOrderLine, StandingOrderCreateRequest, StandingOrderUpdateRequest, StandingOrderLineRequest, GeneratePreviewMatch, GeneratePreviewResponse, GenerateResponse, StandingOrderAuditLogEntry, StatusChangeRequest.

All matching the API contract schemas.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/types/standing-order.ts
git commit -m "feat: add standing order TypeScript types"
```

---

### Task 7: StandingOrdersPage with expandable rows

**Files:**
- Create: `apps/web/src/pages/StandingOrdersPage.tsx`
- Modify: `apps/web/src/App.tsx` — add routes
- Modify: `apps/web/src/components/layout/Sidebar.tsx` — add nav item

- [ ] **Step 1: Create the list page**

Matching the mockup design:
- Header: "Standing Orders" title + "Generate Orders" (green) + "+ New Standing Order" (rose)
- Filters: search input, salesperson email dropdown (populated from unique values), status tabs (Active/Paused/Cancelled/All — Active default)
- Table: chevron (expand), Customer, Cadence, Status badge, Lines (blue pill), Total Stems (green pill), Last Modified, Actions
- Expandable rows: show line items with sales item name, color/variety, stems, price, line total, and summary row
- Actions: Edit/Pause/Cancel for active, Resume/Cancel for paused, none for cancelled
- Cancelled rows visually muted

- [ ] **Step 2: Add routes**

In `App.tsx`:
```tsx
<Route path="/standing-orders" element={<StandingOrdersPage />} />
<Route path="/standing-orders/new" element={<StandingOrderForm />} />
<Route path="/standing-orders/:standingOrderId/edit" element={<StandingOrderForm />} />
```

- [ ] **Step 3: Add sidebar nav item**

Add standing orders as children under the existing Orders nav item:
```typescript
{
  label: "Orders",
  icon: ClipboardList,
  href: "/orders",
  children: [
    { label: "All Orders", icon: List, href: "/orders" },
    { label: "New Order", icon: PlusCircle, href: "/orders/new" },
    { label: "Standing Orders", icon: RefreshCw, href: "/standing-orders" },
  ],
},
```
Import `RefreshCw` from lucide-react.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/StandingOrdersPage.tsx apps/web/src/App.tsx apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add standing orders list page with expandable rows"
```

---

### Task 8: StandingOrderForm (create + edit)

**Files:**
- Create: `apps/web/src/components/standing-orders/StandingOrderForm.tsx`
- Create: `apps/web/src/components/standing-orders/CadencePicker.tsx`
- Create: `apps/web/src/components/standing-orders/StandingOrderAuditLog.tsx`

- [ ] **Step 1: Create CadencePicker component**

The cadence section with day toggle chips matching the mockup:
- "Every [1/2/4] week(s) on [day chips] starting from [date]"
- Day chips are toggle buttons (Sun-Sat), slate blue when selected
- Live summary line: "→ Every week on Mon, Tue, Thu · starting Apr 14, 2026"

- [ ] **Step 2: Create StandingOrderForm**

Matching the OrderForm layout:
- Header bar: back arrow, title ("New Standing Order" / "Edit Standing Order"), status badge (edit only), action buttons (Pause/Cancel for active, Resume for paused, Browse Sales Items, Save)
- Customer section: CustomerSelector (locked in edit), Ship Via, Salesperson Email — reuse OrderContextRow patterns
- Cadence section: CadencePicker component
- Line items: reuse LineItemTable pattern with editable stems/price/color
- Fees + Details: reuse OrderFeesCard + notes card pattern
- Audit trail: StandingOrderAuditLog (edit mode only)
- Reason dialog: on save in edit mode, prompt for reason before submitting
- Apply to future orders: checkbox in reason dialog when editing

Uses `useParams()` for `standingOrderId` to detect edit mode. Fetches from `GET /standing-orders/{id}` on mount in edit mode. POST for create, PUT for update.

- [ ] **Step 3: Create StandingOrderAuditLog**

Collapsible section fetching from `GET /standing-orders/{id}/audit-log`. Color-coded actions (created=green, updated=blue, paused=amber, resumed=green, cancelled=rose). Shows reason in italics.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/standing-orders/
git commit -m "feat: add standing order form with cadence picker and audit log"
```

---

### Task 9: GenerateOrdersDialog

**Files:**
- Create: `apps/web/src/components/standing-orders/GenerateOrdersDialog.tsx`

- [ ] **Step 1: Create the dialog component**

Matching the mockup:
- Date range picker (From/To) with human-readable summary
- Preview table with checkboxes: customer, date, lines count, stems, "Already generated" badge
- Select-all checkbox in header
- Summary bar: "N selected of M matches · X total stems"
- Footer: note about standing order badge, Cancel button, green "Generate N Orders" button
- Calls `POST /standing-orders/generate-preview` on date change
- Calls `POST /standing-orders/generate` on confirm with selected matches
- On success, shows count and offers to navigate to orders list

- [ ] **Step 2: Wire into StandingOrdersPage**

The "Generate Orders" button in the page header opens this dialog.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/standing-orders/GenerateOrdersDialog.tsx apps/web/src/pages/StandingOrdersPage.tsx
git commit -m "feat: add generate orders dialog with preview"
```

---

### Task 10: Orders list standing order badge + filter

**Files:**
- Modify: `apps/web/src/pages/OrdersPage.tsx`
- Modify: `apps/web/src/types/index.ts`

- [ ] **Step 1: Add standing_order_id to OrderListItem type**

Add `standing_order_id: string | null` to the OrderListItem type.

- [ ] **Step 2: Add badge and filter to OrdersPage**

- Show a small "Standing" badge on orders where `standing_order_id` is not null
- Add a filter toggle: "From Standing Order" checkbox that adds `from_standing_order=true` to the API query

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/OrdersPage.tsx apps/web/src/types/index.ts
git commit -m "feat: add standing order badge and filter to orders list"
```
