# Customer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a customer management page with searchable/filterable table, slide-out drawer for add/edit, and archive/restore functionality.

**Architecture:** Backend extends existing Customer model with 7 new fields and adds CRUD + archive/restore endpoints. Frontend adds a new page with client-side filtering, column controls, and a Sheet-based drawer form. React Router added for page navigation.

**Tech Stack:** Python 3.11+ / FastAPI / Tortoise ORM (backend), TypeScript / React / Vite / Tailwind / shadcn/ui (frontend), PostgreSQL via Neon

---

## Work Streams

Tasks are organized into 3 independent streams that can run concurrently:

- **Stream A (Tasks 1-4):** Backend — model, migration, schemas, endpoints
- **Stream B (Tasks 5-8):** Frontend — routing, types, API client, page shell
- **Stream C (Tasks 9-13):** Frontend components — table, filters, drawer, archive

Stream C depends on Stream B completing Tasks 5-7 first (routing, types, API client). Streams A and B are fully independent.

---

### Task 1: Extend Customer Model with New Fields

**Files:**
- Modify: `apps/api/app/models/customer.py`

- [ ] **Step 1: Add 7 new fields to Customer model**

```python
"""Customer and Store models."""

import uuid

from tortoise import fields
from tortoise.models import Model


class Customer(Model):
    """A customer (buyer) in the system."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer_number = fields.IntField(unique=True)
    name = fields.CharField(max_length=255)
    price_type = fields.CharField(max_length=50, default="Retail")
    is_active = fields.BooleanField(default=True)
    salesperson = fields.CharField(max_length=10, null=True)
    contact_name = fields.CharField(max_length=255, null=True)
    default_ship_via = fields.CharField(max_length=100, null=True)
    phone = fields.CharField(max_length=50, null=True)
    location = fields.CharField(max_length=255, null=True)
    payment_terms = fields.CharField(max_length=50, null=True)
    email = fields.CharField(max_length=255, null=True)
    notes = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "customers"

    def __str__(self) -> str:
        return self.name


class Store(Model):
    """A store / ship-to location belonging to a customer."""

    id = fields.UUIDField(pk=True, default=uuid.uuid4)
    customer = fields.ForeignKeyField(
        "models.Customer", related_name="stores", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=255)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "stores"
        unique_together = (("customer", "name"),)

    def __str__(self) -> str:
        return self.name
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/models/customer.py
git commit -m "feat: add 7 new fields to Customer model (salesperson, contact, ship_via, phone, location, terms, email, notes)"
```

---

### Task 2: Create Database Migration

**Files:**
- Create: `apps/api/migrations/models/2_20260408_add_customer_fields.py`

- [ ] **Step 1: Create the migration file**

```python
from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "salesperson" VARCHAR(10);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_name" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_ship_via" VARCHAR(100);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "location" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(50);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "salesperson";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "contact_name";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "default_ship_via";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "location";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "payment_terms";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "email";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "notes";
    """
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/migrations/models/2_20260408_add_customer_fields.py
git commit -m "feat: add migration for new customer fields"
```

---

### Task 3: Add Customer Schemas and Service

**Files:**
- Modify: `apps/api/app/schemas/customer.py`
- Create: `apps/api/app/services/customer_service.py`

- [ ] **Step 1: Rewrite customer schemas with full field set**

Replace `apps/api/app/schemas/customer.py` entirely:

```python
"""Pydantic schemas for customer endpoints."""

from pydantic import BaseModel, ConfigDict, field_validator


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class CustomerListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_number: int
    name: str
    salesperson: str | None
    contact_name: str | None
    default_ship_via: str | None
    phone: str | None
    location: str | None
    payment_terms: str | None
    email: str | None
    notes: str | None
    price_type: str
    is_active: bool


class CustomerResponse(CustomerListResponse):
    stores: list[StoreResponse]


class CustomerCreateRequest(BaseModel):
    customer_number: int
    name: str
    salesperson: str | None = None
    contact_name: str | None = None
    default_ship_via: str | None = None
    phone: str | None = None
    location: str | None = None
    payment_terms: str | None = None
    email: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class CustomerUpdateRequest(BaseModel):
    name: str | None = None
    salesperson: str | None = None
    contact_name: str | None = None
    default_ship_via: str | None = None
    phone: str | None = None
    location: str | None = None
    payment_terms: str | None = None
    email: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip() if v is not None else None


class DropdownOptionsResponse(BaseModel):
    salesperson: list[str]
    default_ship_via: list[str]
    payment_terms: list[str]


class NextNumberResponse(BaseModel):
    next_number: int
```

- [ ] **Step 2: Create customer service**

Create `apps/api/app/services/customer_service.py`:

```python
"""Customer service — next-number generation and dropdown options."""

import math

from tortoise.functions import Max

from app.models.customer import Customer


async def get_next_customer_number() -> int:
    """Return the next suggested customer number.

    Uses max(customer_number) + 10, rounded up to the next ten.
    """
    result = await Customer.annotate(max_num=Max("customer_number")).first().values("max_num")
    max_num = result["max_num"] if result and result["max_num"] else 0
    return int(math.ceil((max_num + 10) / 10) * 10)


async def get_dropdown_options() -> dict[str, list[str]]:
    """Return distinct values for dropdown fields from existing data."""
    customers = await Customer.all().values(
        "salesperson", "default_ship_via", "payment_terms"
    )

    salesperson = sorted({c["salesperson"] for c in customers if c["salesperson"]})
    default_ship_via = sorted({c["default_ship_via"] for c in customers if c["default_ship_via"]})
    payment_terms = sorted({c["payment_terms"] for c in customers if c["payment_terms"]})

    return {
        "salesperson": salesperson,
        "default_ship_via": default_ship_via,
        "payment_terms": payment_terms,
    }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/schemas/customer.py apps/api/app/services/customer_service.py
git commit -m "feat: add customer schemas (create, update, list, detail) and service (next-number, dropdown options)"
```

---

### Task 4: Rewrite Customer Router with Full CRUD

**Files:**
- Modify: `apps/api/app/routers/customers.py`

- [ ] **Step 1: Rewrite the customers router with all endpoints**

Replace `apps/api/app/routers/customers.py` entirely:

```python
"""Customer endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerListResponse,
    CustomerResponse,
    CustomerUpdateRequest,
    DropdownOptionsResponse,
    NextNumberResponse,
)
from app.services.customer_service import get_dropdown_options, get_next_customer_number

router = APIRouter(prefix="/api/v1", tags=["customers"])


@router.get("/customers")
async def list_customers(active: bool | None = True) -> dict:
    """List customers filtered by active status."""
    qs = Customer.all()
    if active is not None:
        qs = qs.filter(is_active=active)
    customers = await qs.order_by("name")
    return {
        "data": [
            CustomerListResponse(
                id=str(c.id),
                customer_number=c.customer_number,
                name=c.name,
                salesperson=c.salesperson,
                contact_name=c.contact_name,
                default_ship_via=c.default_ship_via,
                phone=c.phone,
                location=c.location,
                payment_terms=c.payment_terms,
                email=c.email,
                notes=c.notes,
                price_type=c.price_type,
                is_active=c.is_active,
            )
            for c in customers
        ]
    }


@router.get("/customers/next-number")
async def next_customer_number() -> dict:
    """Get the next suggested customer number."""
    next_num = await get_next_customer_number()
    return {"data": NextNumberResponse(next_number=next_num)}


@router.get("/customers/dropdown-options")
async def dropdown_options() -> dict:
    """Get distinct values for dropdown fields."""
    options = await get_dropdown_options()
    return {"data": DropdownOptionsResponse(**options)}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str) -> dict:
    """Get a single customer with nested stores."""
    customer = await Customer.get_or_none(id=customer_id).prefetch_related("stores")
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "data": CustomerResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
            stores=[
                {"id": str(s.id), "name": s.name}
                for s in customer.stores  # type: ignore[attr-defined]
            ],
        )
    }


@router.post("/customers", status_code=201)
async def create_customer(data: CustomerCreateRequest) -> dict:
    """Create a new customer."""
    existing = await Customer.filter(customer_number=data.customer_number).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail=f"Customer number {data.customer_number} already exists",
        )
    customer = await Customer.create(**data.model_dump())
    return {
        "data": CustomerListResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
        )
    }


@router.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, data: CustomerUpdateRequest) -> dict:
    """Update a customer's fields. Only include fields to change."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields to update")

    await customer.update_from_dict(update_data).save()
    return {
        "data": CustomerListResponse(
            id=str(customer.id),
            customer_number=customer.customer_number,
            name=customer.name,
            salesperson=customer.salesperson,
            contact_name=customer.contact_name,
            default_ship_via=customer.default_ship_via,
            phone=customer.phone,
            location=customer.location,
            payment_terms=customer.payment_terms,
            email=customer.email,
            notes=customer.notes,
            price_type=customer.price_type,
            is_active=customer.is_active,
        )
    }


@router.post("/customers/{customer_id}/archive")
async def archive_customer(customer_id: str) -> dict:
    """Soft-delete (archive) a customer."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = False
    await customer.save()
    return {"data": {"id": str(customer.id), "is_active": False}}


@router.post("/customers/{customer_id}/restore")
async def restore_customer(customer_id: str) -> dict:
    """Restore an archived customer."""
    customer = await Customer.get_or_none(id=customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.is_active = True
    await customer.save()
    return {"data": {"id": str(customer.id), "is_active": True}}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/app/routers/customers.py
git commit -m "feat: rewrite customer router with full CRUD, archive/restore, next-number, and dropdown-options endpoints"
```

---

### Task 5: Add React Router and Page Routing

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/pages/CustomersPage.tsx`

- [ ] **Step 1: Install react-router-dom**

```bash
cd apps/web && npm install react-router-dom
```

Justification: Client-side routing is required to navigate between Orders, Customers, and future pages. react-router-dom is the standard React routing library.

- [ ] **Step 2: Create a placeholder CustomersPage**

Create `apps/web/src/pages/CustomersPage.tsx`:

```tsx
export function CustomersPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-[#1e3a5f]">Customers</h1>
      <p className="text-sm text-[#94a3b8] mt-2">Customer management page — coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx with router**

Replace `apps/web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OrderForm } from "@/components/order/OrderForm";
import { CustomersPage } from "@/pages/CustomersPage";
import "@/index.css";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/orders" element={<OrderForm />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="*" element={<Navigate to="/orders" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 4: Update Sidebar to use router links**

In `apps/web/src/components/layout/Sidebar.tsx`, replace the `<a>` tags with `useNavigate` from react-router-dom. Change the `activePath` state to use `useLocation().pathname`. Replace the `<a>` element with a `<button>` or `<div>` that calls `navigate(href)`:

```tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Users,
  Flower2,
  DollarSign,
  Upload,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Orders", icon: ClipboardList, href: "/orders" },
  { label: "Customers", icon: Users, href: "/customers" },
  { label: "Products", icon: Flower2, href: "/products" },
  { label: "Pricing", icon: DollarSign, href: "/pricing" },
  { label: "Import", icon: Upload, href: "/import" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

interface SidebarProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.pathname;

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-12 px-3 bg-sidebar">
        <span className="text-white font-bold text-lg tracking-tight">FullBloom</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* ── Mobile backdrop ────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex flex-col h-full bg-sidebar transition-all duration-200",
          "hidden md:flex",
          expanded ? "w-[200px]" : "w-[52px]",
          mobileOpen && "!flex w-[200px]"
        )}
      >
        <div className="flex items-center justify-between h-14 px-3">
          <span className="text-white font-bold text-xl tracking-tight select-none">
            {expanded || mobileOpen ? "FullBloom" : "FB"}
          </span>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-white p-1"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2 mt-2">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = activePath === href;
            return (
              <button
                key={href}
                onClick={() => {
                  navigate(href);
                  setMobileOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-sidebar-hover hover:text-white transition-colors w-full text-left",
                  active && "bg-sidebar-hover text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {(expanded || mobileOpen) && (
                  <span className="whitespace-nowrap">{label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex px-2 py-3">
          <button
            onClick={() => onExpandedChange(!expanded)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors px-2 py-1 rounded-md w-full"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                <span className="text-xs whitespace-nowrap">Collapse</span>
              </>
            ) : (
              <PanelLeftOpen className="h-5 w-5 shrink-0" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/App.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/pages/CustomersPage.tsx
git commit -m "feat: add react-router-dom, page routing, and sidebar navigation"
```

---

### Task 6: Extend Frontend Types and API Client

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/services/api.ts`

- [ ] **Step 1: Add customer types to index.ts**

Add these types after the existing `Customer` interface in `apps/web/src/types/index.ts`. Also update the existing `Customer` interface with the new fields:

```typescript
export interface Customer {
  id: string;
  customer_number: number;
  name: string;
  salesperson: string | null;
  contact_name: string | null;
  default_ship_via: string | null;
  phone: string | null;
  location: string | null;
  payment_terms: string | null;
  email: string | null;
  notes: string | null;
  price_type: string;
  is_active: boolean;
  stores?: Store[];
}

export interface CustomerCreateRequest {
  customer_number: number;
  name: string;
  salesperson?: string | null;
  contact_name?: string | null;
  default_ship_via?: string | null;
  phone?: string | null;
  location?: string | null;
  payment_terms?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface CustomerUpdateRequest {
  name?: string;
  salesperson?: string | null;
  contact_name?: string | null;
  default_ship_via?: string | null;
  phone?: string | null;
  location?: string | null;
  payment_terms?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface DropdownOptions {
  salesperson: string[];
  default_ship_via: string[];
  payment_terms: string[];
}
```

- [ ] **Step 2: Add PATCH method and customer API functions to api.ts**

Add a `patch` method to the api object in `apps/web/src/services/api.ts`:

```typescript
export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export const api = { get, post, patch };
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/services/api.ts
git commit -m "feat: extend frontend types with customer fields and add PATCH to API client"
```

---

### Task 7: Install shadcn/ui Popover and Checkbox Components

**Files:**
- Create: `apps/web/src/components/ui/popover.tsx`
- Create: `apps/web/src/components/ui/checkbox.tsx`

- [ ] **Step 1: Install Popover and Checkbox via shadcn CLI**

```bash
cd apps/web && npx shadcn@latest add popover checkbox
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui/popover.tsx apps/web/src/components/ui/checkbox.tsx
git commit -m "chore: add shadcn/ui Popover and Checkbox components"
```

---

### Task 8: Build CustomerColumnFilter Component

**Files:**
- Create: `apps/web/src/components/customer/CustomerColumnFilter.tsx`

- [ ] **Step 1: Create the Excel-style column filter component**

Create `apps/web/src/components/customer/CustomerColumnFilter.tsx`:

```tsx
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerColumnFilterProps {
  values: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function CustomerColumnFilter({
  values,
  selected,
  onChange,
}: CustomerColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const isActive = selected.length > 0 && selected.length < values.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "ml-1 inline-flex items-center text-[10px]",
            isActive ? "text-[#c27890]" : "text-[#94a3b8] hover:text-[#334155]"
          )}
          aria-label="Filter column"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            className="text-xs text-[#c27890] hover:underline"
            onClick={() => onChange([...values])}
          >
            Select All
          </button>
          <button
            className="text-xs text-[#94a3b8] hover:underline"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {values.map((value) => (
            <label
              key={value}
              className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-[#f4f1ec] cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, value]);
                  } else {
                    onChange(selected.filter((v) => v !== value));
                  }
                }}
              />
              <span className="truncate text-[#334155]">{value || "—"}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-[#e0ddd8]">
          <Button
            size="sm"
            className="w-full bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
            onClick={() => setOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/customer/CustomerColumnFilter.tsx
git commit -m "feat: add CustomerColumnFilter component (Excel-style filter popover)"
```

---

### Task 9: Build CustomerDrawer Component

**Files:**
- Create: `apps/web/src/components/customer/CustomerDrawer.tsx`

- [ ] **Step 1: Create the slide-out drawer form**

Create `apps/web/src/components/customer/CustomerDrawer.tsx`:

```tsx
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer, CustomerCreateRequest, CustomerUpdateRequest, DropdownOptions } from "@/types";

interface CustomerDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "add";
  customer: Customer | null;
  dropdownOptions: DropdownOptions;
  nextNumber: number | null;
  onSave: (data: CustomerCreateRequest | CustomerUpdateRequest) => Promise<void>;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export function CustomerDrawer({
  open,
  onClose,
  mode,
  customer,
  dropdownOptions,
  nextNumber,
  onSave,
  onArchive,
  onRestore,
}: CustomerDrawerProps) {
  const [form, setForm] = useState({
    customer_number: 0,
    name: "",
    salesperson: "",
    contact_name: "",
    default_ship_via: "",
    phone: "",
    location: "",
    payment_terms: "",
    email: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isArchived = customer ? !customer.is_active : false;
  const isReadOnly = mode === "edit" && isArchived;

  useEffect(() => {
    if (mode === "edit" && customer) {
      setForm({
        customer_number: customer.customer_number,
        name: customer.name,
        salesperson: customer.salesperson ?? "",
        contact_name: customer.contact_name ?? "",
        default_ship_via: customer.default_ship_via ?? "",
        phone: customer.phone ?? "",
        location: customer.location ?? "",
        payment_terms: customer.payment_terms ?? "",
        email: customer.email ?? "",
        notes: customer.notes ?? "",
      });
    } else if (mode === "add") {
      setForm({
        customer_number: nextNumber ?? 0,
        name: "",
        salesperson: "",
        contact_name: "",
        default_ship_via: "",
        phone: "",
        location: "",
        payment_terms: "",
        email: "",
        notes: "",
      });
    }
    setError(null);
  }, [mode, customer, nextNumber, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (mode === "add") {
        const data: CustomerCreateRequest = {
          customer_number: form.customer_number,
          name: form.name.trim(),
          salesperson: form.salesperson || null,
          contact_name: form.contact_name || null,
          default_ship_via: form.default_ship_via || null,
          phone: form.phone || null,
          location: form.location || null,
          payment_terms: form.payment_terms || null,
          email: form.email || null,
          notes: form.notes || null,
        };
        await onSave(data);
      } else {
        const data: CustomerUpdateRequest = {
          name: form.name.trim(),
          salesperson: form.salesperson || null,
          contact_name: form.contact_name || null,
          default_ship_via: form.default_ship_via || null,
          phone: form.phone || null,
          location: form.location || null,
          payment_terms: form.payment_terms || null,
          email: form.email || null,
          notes: form.notes || null,
        };
        await onSave(data);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const renderSelect = (
    field: string,
    label: string,
    options: string[],
    value: string
  ) => (
    <div>
      <Label className="text-xs font-semibold text-[#1e3a5f]">{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => setField(field, v)}
        disabled={isReadOnly}
      >
        <SelectTrigger className="mt-1 h-8 text-sm">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">None</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-[#e0ddd8]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-[#1e3a5f]">
                {mode === "add" ? "New Customer" : "Edit Customer"}
              </SheetTitle>
              {mode === "edit" && customer && (
                <SheetDescription className="text-xs mt-0.5">
                  #{customer.customer_number} &middot; {customer.name}
                </SheetDescription>
              )}
            </div>
            {mode === "edit" && customer && !isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-[#c27890] border-[#fce7f3] hover:bg-[#fce7f3] text-xs"
                onClick={() => onArchive(customer.id)}
              >
                Archive
              </Button>
            )}
            {mode === "edit" && customer && isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="text-[#2d4a2d] border-[#e8f0e8] hover:bg-[#e8f0e8] text-xs"
                onClick={() => onRestore(customer.id)}
              >
                Restore
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Identity */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Identity
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">
                  Customer Number
                </Label>
                {mode === "edit" ? (
                  <div className="mt-1 px-3 py-1.5 bg-[#f4f1ec] border border-[#e0ddd8] rounded-md text-sm text-[#94a3b8]">
                    {form.customer_number}
                  </div>
                ) : (
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={form.customer_number}
                    onChange={(e) =>
                      setField("customer_number", e.target.value)
                    }
                  />
                )}
              </div>
              {renderSelect(
                "salesperson",
                "Salesperson",
                dropdownOptions.salesperson,
                form.salesperson
              )}
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Name *
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                disabled={isReadOnly}
              />
              {error && error.toLowerCase().includes("name") && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">
                  Contact Name
                </Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.contact_name}
                  onChange={(e) => setField("contact_name", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1e3a5f]">
                  Phone
                </Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Email
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Shipping & Billing */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Shipping &amp; Billing
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderSelect(
                "default_ship_via",
                "Ship Via",
                dropdownOptions.default_ship_via,
                form.default_ship_via
              )}
              {renderSelect(
                "payment_terms",
                "Terms",
                dropdownOptions.payment_terms,
                form.payment_terms
              )}
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-[#1e3a5f]">
                Location
              </Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Notes
            </div>
            <Textarea
              className="text-sm resize-y min-h-[60px]"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {/* General error */}
          {error && !error.toLowerCase().includes("name") && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        {!isReadOnly && (
          <div className="flex gap-2 px-5 py-3 border-t border-[#e0ddd8] bg-[#faf8f5] justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : mode === "add"
                  ? "Create Customer"
                  : "Save Changes"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/customer/CustomerDrawer.tsx
git commit -m "feat: add CustomerDrawer component (Sheet-based edit/add form with two-column sections)"
```

---

### Task 10: Build CustomerArchiveDialog Component

**Files:**
- Create: `apps/web/src/components/customer/CustomerArchiveDialog.tsx`

- [ ] **Step 1: Create the archive confirmation dialog**

Create `apps/web/src/components/customer/CustomerArchiveDialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CustomerArchiveDialogProps {
  open: boolean;
  customerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CustomerArchiveDialog({
  open,
  customerName,
  onConfirm,
  onCancel,
}: CustomerArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1e3a5f]">
            Archive {customerName}?
          </DialogTitle>
          <DialogDescription className="text-sm text-[#334155]">
            They will be hidden from the active list but can be restored later.
            Existing orders will not be affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#c27890] hover:bg-[#a8607a] text-white"
            onClick={onConfirm}
          >
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/customer/CustomerArchiveDialog.tsx
git commit -m "feat: add CustomerArchiveDialog confirmation component"
```

---

### Task 11: Build CustomerTable Component

**Files:**
- Create: `apps/web/src/components/customer/CustomerTable.tsx`

- [ ] **Step 1: Create the customer table with toolbar, filters, and column controls**

Create `apps/web/src/components/customer/CustomerTable.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerColumnFilter } from "./CustomerColumnFilter";
import { Search, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

interface ColumnDef {
  key: string;
  label: string;
  filterable: boolean;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "customer_number", label: "#", filterable: false, defaultVisible: true },
  { key: "name", label: "Name", filterable: true, defaultVisible: true },
  { key: "salesperson", label: "Salesperson", filterable: true, defaultVisible: true },
  { key: "default_ship_via", label: "Ship Via", filterable: true, defaultVisible: true },
  { key: "location", label: "Location", filterable: true, defaultVisible: true },
  { key: "payment_terms", label: "Terms", filterable: true, defaultVisible: true },
  { key: "contact_name", label: "Contact", filterable: false, defaultVisible: false },
  { key: "phone", label: "Phone", filterable: false, defaultVisible: false },
  { key: "email", label: "Email", filterable: false, defaultVisible: false },
  { key: "notes", label: "Notes", filterable: false, defaultVisible: false },
];

const STORAGE_KEY = "fullbloom:customer-columns";

function loadColumnPrefs(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
}

function saveColumnPrefs(cols: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}

const SEARCHABLE_FIELDS = [
  "name",
  "contact_name",
  "location",
  "email",
  "phone",
  "notes",
] as const;

interface CustomerTableProps {
  customers: Customer[];
  activeView: "active" | "archived";
  onViewChange: (view: "active" | "archived") => void;
  onRowClick: (customer: Customer) => void;
  onAddClick: () => void;
}

export function CustomerTable({
  customers,
  activeView,
  onViewChange,
  onRowClick,
  onAddClick,
}: CustomerTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    loadColumnPrefs
  );

  const hasActiveFilters =
    searchTerm.length > 0 ||
    Object.values(columnFilters).some((v) => v.length > 0);

  const clearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
  };

  const handleViewChange = (view: "active" | "archived") => {
    clearAllFilters();
    onViewChange(view);
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      saveColumnPrefs(next);
      return next;
    });
  };

  // Compute distinct values for filterable columns
  const distinctValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of ALL_COLUMNS) {
      if (!col.filterable) continue;
      const values = new Set<string>();
      for (const c of customers) {
        const val = c[col.key as keyof Customer];
        if (val != null && val !== "") values.add(String(val));
      }
      result[col.key] = Array.from(values).sort();
    }
    return result;
  }, [customers]);

  // Apply search + column filters
  const filtered = useMemo(() => {
    let result = customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c) =>
        SEARCHABLE_FIELDS.some((field) => {
          const val = c[field as keyof Customer];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    for (const [key, selected] of Object.entries(columnFilters)) {
      if (selected.length === 0) continue;
      result = result.filter((c) => {
        const val = c[key as keyof Customer];
        return val != null && selected.includes(String(val));
      });
    }

    return result;
  }, [customers, searchTerm, columnFilters]);

  const activeColumns = ALL_COLUMNS.filter((c) =>
    visibleColumns.includes(c.key)
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <h1 className="text-lg font-bold text-[#1e3a5f] whitespace-nowrap">
          Customers
        </h1>

        <div className="flex-1 min-w-[180px] max-w-[320px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <Input
            placeholder="Search all fields..."
            className="pl-8 h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Active/Archived toggle */}
        <div className="flex gap-px bg-[#e0ddd8] rounded-md overflow-hidden">
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              activeView === "active"
                ? "bg-[#c27890] text-white"
                : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
            )}
            onClick={() => handleViewChange("active")}
          >
            Active
          </button>
          <button
            className={cn(
              "px-3 py-1 text-xs transition-colors",
              activeView === "archived"
                ? "bg-[#c27890] text-white"
                : "bg-white text-[#334155] hover:bg-[#f4f1ec]"
            )}
            onClick={() => handleViewChange("archived")}
          >
            Archived
          </button>
        </div>

        {hasActiveFilters && (
          <button
            className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1"
            onClick={clearAllFilters}
          >
            Clear Filters
          </button>
        )}

        {/* Column toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-[#94a3b8] hover:text-[#334155] border border-[#e0ddd8] rounded px-2 py-1 flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 px-1 py-0.5 text-sm rounded hover:bg-[#f4f1ec] cursor-pointer"
                >
                  <Checkbox
                    checked={visibleColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <span className="text-[#334155]">{col.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          className="bg-[#c27890] hover:bg-[#a8607a] text-white text-xs ml-auto"
          onClick={onAddClick}
        >
          + Add Customer
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e0ddd8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#e0ddd8] bg-[#faf8f5]">
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-xs font-semibold text-[#1e3a5f] whitespace-nowrap"
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {col.filterable && distinctValues[col.key] && (
                        <CustomerColumnFilter
                          values={distinctValues[col.key]}
                          selected={columnFilters[col.key] ?? []}
                          onChange={(selected) =>
                            setColumnFilters((prev) => ({
                              ...prev,
                              [col.key]: selected,
                            }))
                          }
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeColumns.length}
                    className="px-3 py-8 text-center text-[#94a3b8]"
                  >
                    No customers found.
                    {hasActiveFilters && (
                      <button
                        className="ml-2 text-[#c27890] hover:underline"
                        onClick={clearAllFilters}
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-[#f0ede8] hover:bg-[#faf8f5] cursor-pointer transition-colors"
                    onClick={() => onRowClick(customer)}
                  >
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2 text-[#334155]",
                          col.key === "name" && "font-medium",
                          col.key === "notes" && "max-w-[200px] truncate"
                        )}
                      >
                        {(customer[col.key as keyof Customer] as string) ??
                          "—"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-[#94a3b8] bg-[#faf8f5] border-t border-[#e0ddd8]">
          {filtered.length} {activeView} customer{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/customer/CustomerTable.tsx
git commit -m "feat: add CustomerTable component with toolbar, search, column filters, and visibility toggle"
```

---

### Task 12: Wire Up CustomersPage

**Files:**
- Modify: `apps/web/src/pages/CustomersPage.tsx`

- [ ] **Step 1: Replace the placeholder with the full page**

Replace `apps/web/src/pages/CustomersPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import { CustomerTable } from "@/components/customer/CustomerTable";
import { CustomerDrawer } from "@/components/customer/CustomerDrawer";
import { CustomerArchiveDialog } from "@/components/customer/CustomerArchiveDialog";
import type {
  Customer,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  DropdownOptions,
} from "@/types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>({
    salesperson: [],
    default_ship_via: [],
    payment_terms: [],
  });
  const [activeView, setActiveView] = useState<"active" | "archived">("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"edit" | "add">("edit");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    const data = await api.get<Customer[]>(
      `/api/v1/customers?active=${activeView === "active"}`
    );
    setCustomers(data);
  }, [activeView]);

  const fetchDropdownOptions = useCallback(async () => {
    const data = await api.get<DropdownOptions>(
      "/api/v1/customers/dropdown-options"
    );
    setDropdownOptions(data);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const handleAddClick = async () => {
    const data = await api.get<{ next_number: number }>(
      "/api/v1/customers/next-number"
    );
    setNextNumber(data.next_number);
    setSelectedCustomer(null);
    setDrawerMode("add");
    setDrawerOpen(true);
  };

  const handleSave = async (
    data: CustomerCreateRequest | CustomerUpdateRequest
  ) => {
    if (drawerMode === "add") {
      await api.post("/api/v1/customers", data);
    } else if (selectedCustomer) {
      await api.patch(
        `/api/v1/customers/${selectedCustomer.id}`,
        data
      );
    }
    await fetchCustomers();
    await fetchDropdownOptions();
  };

  const handleArchiveRequest = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (customer) setArchiveTarget(customer);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await api.post(`/api/v1/customers/${archiveTarget.id}/archive`, {});
    setArchiveTarget(null);
    setDrawerOpen(false);
    await fetchCustomers();
  };

  const handleRestore = async (id: string) => {
    await api.post(`/api/v1/customers/${id}/restore`, {});
    setDrawerOpen(false);
    await fetchCustomers();
  };

  return (
    <>
      <CustomerTable
        customers={customers}
        activeView={activeView}
        onViewChange={setActiveView}
        onRowClick={handleRowClick}
        onAddClick={handleAddClick}
      />

      <CustomerDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        customer={selectedCustomer}
        dropdownOptions={dropdownOptions}
        nextNumber={nextNumber}
        onSave={handleSave}
        onArchive={handleArchiveRequest}
        onRestore={handleRestore}
      />

      <CustomerArchiveDialog
        open={archiveTarget !== null}
        customerName={archiveTarget?.name ?? ""}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/CustomersPage.tsx
git commit -m "feat: wire up CustomersPage with table, drawer, and archive dialog"
```

---

### Task 13: Update Spec Status

**Files:**
- Modify: `specs/002-customer-management/spec.md`

- [ ] **Step 1: Update spec status from Draft to in-progress**

Change line 5 of `specs/002-customer-management/spec.md` from:

```
**Status**: Draft
```

to:

```
**Status**: in-progress
```

- [ ] **Step 2: Commit**

```bash
git add specs/002-customer-management/spec.md
git commit -m "docs: update 002-customer-management spec status to in-progress"
```

---

## Execution Summary

| Stream | Tasks | Can Start | Depends On |
|--------|-------|-----------|------------|
| A: Backend | 1, 2, 3, 4 | Immediately | Nothing |
| B: Frontend Setup | 5, 6, 7 | Immediately | Nothing |
| C: Frontend Components | 8, 9, 10, 11, 12 | After Tasks 5-7 | Stream B |
| Final | 13 | After all tasks | Everything |

**Parallel execution plan:**
- Agent 1: Tasks 1-4 (backend)
- Agent 2: Tasks 5-7 (frontend setup), then Tasks 8-12 (frontend components)
- After both complete: Task 13 (spec status update)
