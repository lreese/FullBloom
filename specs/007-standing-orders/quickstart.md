# Quickstart: Standing Orders

## Prerequisites

- Python 3.11+ with virtualenv
- Node.js 18+
- PostgreSQL running locally
- Existing FullBloom dev environment set up

## Backend Setup

```bash
cd apps/api
source .venv/bin/activate

# Run migrations (after models are added)
aerich migrate --name add_standing_orders
aerich upgrade

# Run tests
python -m pytest tests/test_standing_orders.py -v

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

1. **Create**: Navigate to Standing Orders in sidebar, click "New Standing Order", select customer, set cadence, add lines, save
2. **List**: Verify standing order appears in list with correct status badge and cadence
3. **Edit**: Click standing order, modify lines, save with reason — verify audit trail
4. **Pause/Resume**: Pause a standing order, verify it shows as paused, resume it
5. **Cancel**: Cancel a standing order, verify it shows as cancelled and is read-only
6. **Generate**: Click "Generate Orders", select a date, verify preview shows matching standing orders, confirm and check orders list
7. **Linkage**: In regular Orders list, verify generated orders show standing order badge
8. **Audit**: Open a standing order, expand audit log, verify all changes recorded with reasons

## Key Files

| Area | File | What It Does |
|------|------|-------------|
| Models | `apps/api/app/models/standing_order.py` | StandingOrder, StandingOrderLine, StandingOrderAuditLog |
| Router | `apps/api/app/routers/standing_orders.py` | All standing order endpoints |
| Service | `apps/api/app/services/standing_order_service.py` | Business logic, cadence matching, order generation |
| Schemas | `apps/api/app/schemas/standing_order.py` | Request/response schemas |
| Order model | `apps/api/app/models/order.py` | Modified — standing_order_id FK |
| Tests | `apps/api/tests/test_standing_orders.py` | Comprehensive test coverage |
| List page | `apps/web/src/pages/StandingOrdersPage.tsx` | List view with filters |
| Form | `apps/web/src/components/standing-orders/StandingOrderForm.tsx` | Create/edit form |
| Generate dialog | `apps/web/src/components/standing-orders/GenerateOrdersDialog.tsx` | Date picker + preview + confirm |
| Audit log | `apps/web/src/components/standing-orders/StandingOrderAuditLog.tsx` | Audit trail display |
| Types | `apps/web/src/types/standing-order.ts` | TypeScript types |
