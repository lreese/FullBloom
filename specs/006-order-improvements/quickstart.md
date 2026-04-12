# Quickstart: Order Management Improvements

## Prerequisites

- Python 3.11+ with virtualenv
- Node.js 18+
- PostgreSQL running locally
- Existing FullBloom dev environment set up (see `apps/api/README.md` and `apps/web/README.md`)

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate

# Run migrations (after OrderAuditLog model is added)
aerich migrate --name add_order_audit_log
aerich upgrade

# Run tests
python -m pytest tests/test_orders.py tests/test_customers.py -v

# Start dev server
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd apps/web
npm install
npm run dev
```

## Verification

1. **Customer search**: Navigate to New Order, type in customer search — should filter results
2. **Ship-via default**: Select a customer with `default_ship_via` set — Ship Via should auto-populate
3. **Product picker**: Select a customer, click "Browse Products" — should show customer's sales items with pricing
4. **Order list**: Navigate to Orders in sidebar — should show paginated order list
5. **Order editing**: Click an order in the list — should open editable form with existing data
6. **Order deletion**: Click delete on an order — should show confirmation, then remove
7. **Audit log**: Edit an order, then check audit log section — should show the change

## Key Files

| Area | File | What Changes |
|------|------|--------------|
| Customer search | `apps/api/app/routers/customers.py` | Add `search` query param |
| Order list/edit/delete | `apps/api/app/routers/orders.py` | Add list, update, delete endpoints |
| Order audit model | `apps/api/app/models/order.py` | Add OrderAuditLog model |
| Order service | `apps/api/app/services/order_service.py` | Add update, delete, audit diff logic |
| Order list page | `apps/web/src/pages/OrdersPage.tsx` | New page component |
| Order form (edit mode) | `apps/web/src/components/order/OrderForm.tsx` | Add edit mode support |
| Customer selector | `apps/web/src/components/order/CustomerSelector.tsx` | Fix search to use filtered results |
| Ship-via selector | `apps/web/src/components/order/ShipViaSelector.tsx` | Accept customer default |
| Product picker | `apps/web/src/components/order/ProductPickerPanel.tsx` | Rewrite to use customer pricing |
| Tests | `apps/api/tests/test_orders.py`, `test_customers.py` | New test files |
