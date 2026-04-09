# Tasks: Order Management

**Input**: Design documents from `/specs/001-order-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-v1.md, frontend-design.md

**Tests**: Not explicitly requested in spec — test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Design reference**: `frontend-design.md` is the source of truth for all frontend UX decisions. Where it conflicts with earlier artifacts, the design doc takes priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `apps/api/app/`
- **Frontend**: `apps/web/src/`

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure for both apps

- [x] T001 Create backend project structure: `apps/api/` with `app/`, `app/models/`, `app/schemas/`, `app/routers/`, `app/services/`, `app/utils/`, `tests/`
- [x] T002 Initialize Python project with `apps/api/pyproject.toml` — dependencies: fastapi, uvicorn, tortoise-orm, aerich, asyncpg, python-multipart, structlog, pydantic
- [x] T003 [P] Create `apps/api/.env.example` with DATABASE_URL, ENVIRONMENT, LOG_LEVEL placeholders
- [x] T004 [P] Create `apps/api/Dockerfile` and `apps/api/docker-compose.yml` (app + PostgreSQL for local dev)
- [x] T005 [P] Create frontend project structure: `apps/web/` — initialize with Vite + React + TypeScript via `npm create vite@latest`
- [x] T006 [P] Configure frontend tooling in `apps/web/`: tailwind.config.ts (include Slate+Rose color palette from constitution as custom colors), tsconfig.json (strict: true), prettier.config.mjs, .env.example (VITE_API_URL)
- [x] T007 [P] Initialize shadcn/ui in `apps/web/` and install base components: Button, Input, Select, Table, Tooltip, Label, Dialog, Command (for combobox), Sheet (for side panel)
- [x] T008 [P] Create `apps/api/README.md` with setup and run instructions
- [x] T009 [P] Create `apps/web/README.md` with setup and run instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation

- [x] T010 Implement FastAPI app entry point with CORS middleware and structured logging in `apps/api/app/main.py`
- [x] T011 Implement settings/config from environment variables in `apps/api/app/config.py` — include TORTOISE_ORM config with `statement_cache_size=0` and `min_size=1` for Neon compatibility
- [x] T012 [P] Create Customer and Store Tortoise ORM models in `apps/api/app/models/customer.py` per data-model.md
- [x] T013 [P] Create ProductType, ProductLine, Variety, and SalesItem Tortoise ORM models in `apps/api/app/models/product.py` per data-model.md
- [x] T014 [P] Create CustomerPrice Tortoise ORM model in `apps/api/app/models/pricing.py` per data-model.md
- [x] T015 [P] Create Order and OrderLine Tortoise ORM models in `apps/api/app/models/order.py` per data-model.md — include order_number generation (ORD-YYYYMMDD-NNN format). Note: store_name is on Order (order-level), NOT on OrderLine
- [x] T016 Register all models and initialize Tortoise ORM + Aerich in `apps/api/app/main.py` — run initial migration with `aerich init-db`
- [x] T017 [P] Implement `/api/v1/health` endpoint in `apps/api/app/routers/health.py` returning `{"data": {"status": "healthy", "database": "connected"}}` per constitution requirement

### Frontend Foundation

- [x] T018 [P] Create API client service in `apps/web/src/services/api.ts` with base URL from env, response envelope parsing, and error handling
- [x] T019 [P] Create shared TypeScript types in `apps/web/src/types/index.ts` matching API response shapes from contracts/api-v1.md
- [x] T020 [P] Create reusable Tooltip wrapper component in `apps/web/src/components/common/Tooltip.tsx` using shadcn/ui Tooltip — used on all non-obvious fields per FR-014
- [x] T021 Create app shell layout in `apps/web/src/components/layout/AppShell.tsx` per frontend-design.md and constitution App Shell section — collapsible sidebar with icon rail (dark forest green `#1a2e1a`), "FB" monogram in white, nav items: Orders, Customers, Products, Pricing, Import, Settings. Icon-only rail as default collapsed state. Full-width cream (`#f4f1ec`) content area to the right
- [x] T022 [P] Create sidebar responsive behavior in `apps/web/src/components/layout/Sidebar.tsx` — desktop: icon rail (52px) expandable to full sidebar (~200px) with labels. Mobile (<768px): hidden behind hamburger menu in a top bar. Use Tailwind breakpoints
- [x] T023 [P] Create error boundary component in `apps/web/src/components/common/ErrorBoundary.tsx` — catch component errors, display user-friendly message, never expose stack traces per constitution
- [x] T024 Create App.tsx root layout in `apps/web/src/App.tsx` — wraps content in AppShell. Default route renders OrderForm page

**Checkpoint**: Backend serves /health, all ORM models created, frontend has app shell with icon rail sidebar and API client ready

---

## Phase 3: User Story 5 - Import Reference Data from CSV (Priority: P1) MVP

**Goal**: Load product catalog, customer list, and customer-specific pricing from CSV files so salespeople can select products and see pricing

**Independent Test**: Run CSV import endpoints, then query customers and products APIs to verify data is present and correct

### Implementation for User Story 5

- [x] T025 [US5] Implement CSV parsing utility in `apps/api/app/utils/csv_parser.py` — read CSV to list of dicts, handle encoding and delimiter detection
- [x] T026 [US5] Implement Varieties CSV import logic in `apps/api/app/services/import_service.py` — upsert ProductType, ProductLine, Variety hierarchy from CSV rows using raw SQL `INSERT ON CONFLICT UPDATE`
- [x] T027 [US5] Implement PriceData CSV import logic in `apps/api/app/services/import_service.py` — upsert Customer, SalesItem, and CustomerPrice records; extract retail_price from CSV; batch in chunks of 1000
- [x] T028 [US5] Implement Color by Variety CSV import logic in `apps/api/app/services/import_service.py` — update Variety.hex_color for matching variety names
- [x] T029 [US5] Create Pydantic response schemas for import results in `apps/api/app/schemas/import_data.py` (counts of created/updated records)
- [x] T030 [US5] Create import router with `POST /api/v1/import/varieties`, `POST /api/v1/import/pricing`, `POST /api/v1/import/colors` endpoints in `apps/api/app/routers/import_data.py` — accept multipart file upload, call import_service, return counts
- [x] T031 [US5] Register import router in `apps/api/app/main.py`
- [x] T032 [US5] Create CLI seed command as alternative to API import in `apps/api/app/seed.py` — accepts --varieties, --pricing, --colors flags with file paths, calls same import_service functions

**Checkpoint**: All three CSVs can be imported via API or CLI. Query the database to verify product hierarchy, customer pricing, and hex colors are present.

---

## Phase 4: User Story 1 - Create a New Order (Priority: P1) MVP

**Goal**: Salesperson selects customer, date, adds line items with auto-pricing, and submits order. Order is persisted with unique OrderID.

**Independent Test**: Create an order via API for an existing customer with multiple line items; verify order is stored and retrievable with correct pricing

### Backend for User Story 1

- [x] T033 [US1] Create Pydantic schemas for customers in `apps/api/app/schemas/customer.py` — CustomerResponse (with nested stores), CustomerListResponse per contracts/api-v1.md
- [x] T034 [P] [US1] Create Pydantic schemas for products in `apps/api/app/schemas/product.py` — VarietyResponse with nested sales_items, hex_color per contracts/api-v1.md
- [x] T035 [P] [US1] Create Pydantic schemas for pricing in `apps/api/app/schemas/pricing.py` — CustomerPricingResponse with is_custom flag per contracts/api-v1.md
- [x] T036 [US1] Create Pydantic schemas for orders in `apps/api/app/schemas/order.py` — OrderCreateRequest (with nested lines, store_name at order level NOT line level), OrderResponse, OrderLineResponse per contracts/api-v1.md
- [x] T037 [US1] Implement pricing service in `apps/api/app/services/pricing_service.py` — get_customer_pricing(customer_id) returns all sales items with customer price or retail fallback
- [x] T038 [US1] Implement order service in `apps/api/app/services/order_service.py` — create_order() that generates order_number (ORD-YYYYMMDD-NNN), validates required fields (customer, date, ≥1 line), validates stems > 0, looks up list_price_per_stem, calculates effective_price_per_stem, persists Order + OrderLines in a transaction
- [x] T039 [US1] Implement duplicate detection in `apps/api/app/services/order_service.py` — check_duplicate() compares customer + date + line items against existing orders; return warning if match found and force_duplicate is false
- [x] T040 [US1] Create customers router with `GET /api/v1/customers` and `GET /api/v1/customers/{id}` (includes nested stores) in `apps/api/app/routers/customers.py` per contracts/api-v1.md
- [x] T041 [P] [US1] Create products router with `GET /api/v1/products` (filterable by type, search, show) in `apps/api/app/routers/products.py` per contracts/api-v1.md — include hex_color in response
- [x] T042 [P] [US1] Create pricing router with `GET /api/v1/customers/{customer_id}/pricing` in `apps/api/app/routers/pricing.py` per contracts/api-v1.md
- [x] T043 [US1] Create orders router with `POST /api/v1/orders` and `GET /api/v1/orders/{id}` in `apps/api/app/routers/orders.py` per contracts/api-v1.md — handle 201, 409 (duplicate warning), 422 (validation)
- [x] T044 [US1] Register customers, products, pricing, and orders routers in `apps/api/app/main.py`
- [x] T045 [US1] Create endpoint `GET /api/v1/varieties/{variety_id}/colors` in `apps/api/app/routers/products.py` — returns known colors for a variety. Also `POST /api/v1/varieties/{variety_id}/colors` to add a new color (persists to DB, returns the new entry) per FR-017

### Frontend for User Story 1

- [x] T046 [US1] Create CustomerSelector component in `apps/web/src/components/order/CustomerSelector.tsx` per frontend-design.md — searchable dropdown (use shadcn Command/combobox pattern), fetches from GET /customers, shows customer name + ID badge on selection, on select triggers pricing load and populates Store dropdown
- [x] T047 [US1] Create StoreSelector component in `apps/web/src/components/order/StoreSelector.tsx` — dropdown filtered to stores belonging to selected customer. Disabled until customer is selected. Order-level field per frontend-design.md
- [x] T048 [US1] Create ProductPickerPanel component in `apps/web/src/components/order/ProductPickerPanel.tsx` per frontend-design.md — side panel (shadcn Sheet) that pushes from the left (~220px), products grouped by type (collapsible), hex color swatches next to variety names, customer-specific prices displayed, search bar at top matching on name + type + product line, clicking a product adds a line item. X button to dismiss. Mobile: full-screen overlay
- [x] T049 [US1] Create ColorVarietyCombobox component in `apps/web/src/components/order/ColorVarietyCombobox.tsx` per frontend-design.md section 5 — searchable combobox (shadcn Command) populated with known colors for the selected variety from `GET /varieties/{id}/colors`. Includes "Add new" option at bottom that calls `POST /varieties/{id}/colors` to persist, then selects the new value. Freeform text also accepted per spec
- [x] T050 [US1] Create LineItemTable component in `apps/web/src/components/order/LineItemTable.tsx` per frontend-design.md section 3 — white card with slate blue (`#1e3a5f`) header row. Columns: expand chevron (20px), Sales Item (flex:3), Color/Variety using ColorVarietyCombobox (flex:2), Stems (65px), Price/Stem (80px, auto-populated, manually overridable with list price preserved), Effective (80px, rose-colored if different from base), Box Reference (55px, color-coded letter badges), Delete × (24px). Inline add row at bottom with searchable dropdown matching on name + type + product line. Add/remove rows, validate stems > 0
- [x] T051 [US1] Create expanded sub-row for LineItemTable progressive disclosure per frontend-design.md — chevron toggles sub-row with `#faf8f6` background. Groups: Fees (Item Fee %, Item Fee $), Packing Details (Box Qty, Bunches/Box, Stems/Bunch), Special toggle (reveals Sleeve + UPC when Yes), Notes. All fields have tooltips
- [x] T052 [US1] Create BoxReferenceBadge component in `apps/web/src/components/order/BoxReferenceBadge.tsx` per frontend-design.md section 4 — renders color-coded letter badges. Colors cycle through predefined set: blue (`#dbeafe`), pink (`#fce7f3`), green (`#e8f0e8`), amber (`#fef3c7`), purple (`#ede9fe`). Lines sharing a letter share the same badge color
- [x] T053 [US1] Create BoxGroupingsLegend component in `apps/web/src/components/order/BoxGroupingsLegend.tsx` per frontend-design.md — renders below line item table, summarizes which products share each box (e.g., "A: Tulips + Callas"). Only visible when any line has a box reference
- [x] T054 [US1] Create OrderContextRow component in `apps/web/src/components/order/OrderContextRow.tsx` per frontend-design.md section 2 — horizontal row with Customer (flex:2), Store/Location (flex:1), Date (flex:1, defaults to today), Ship Via (flex:1, freeform). Responsive: 2×2 grid on tablet, stacked on mobile
- [x] T055 [US1] Create OrderFeesCard component in `apps/web/src/components/order/OrderFeesCard.tsx` per frontend-design.md section 6 — white card with 2×2 grid: Box Charge ($), Holiday Charge (%), Special Charge ($), Freight Charge ($), plus Freight Charge Included toggle (rose when on). All fields have tooltips
- [x] T056 [US1] Create OrderDetailsCard component in `apps/web/src/components/order/OrderDetailsCard.tsx` per frontend-design.md section 6 — white card with PO Number, Salesperson Email, Order Notes (multi-line textarea)
- [x] T057 [US1] Create OrderForm page component in `apps/web/src/components/order/OrderForm.tsx` per frontend-design.md — composes: header row ("New Order" title + "Browse Products" outlined button + "Submit Order" rose button), OrderContextRow, LineItemTable with expanded sub-rows, BoxGroupingsLegend, OrderFeesCard + OrderDetailsCard side by side. Handles submit via POST /orders, shows success toast with OrderID, auto-clears form on success, disables submit during request
- [x] T058 [US1] Implement effective price live preview in LineItemTable — compute `(price * (1 + fee%)) + fee$` client-side as fees are entered, display in Effective column with rose color when different from base price
- [x] T059 [US1] Handle duplicate order warning in OrderForm per frontend-design.md section 7 — if 409 response, show shadcn Dialog explaining the match with "Submit Anyway" and "Cancel" buttons. "Submit Anyway" resubmits with force_duplicate=true
- [x] T060 [US1] Implement inline validation in OrderForm — required fields (customer, date, ≥1 line item), stems > 0. Show inline error messages on offending fields per frontend-design.md section 7. Form stays populated on validation error
- [x] T061 [US1] Implement responsive behavior per frontend-design.md Responsive section — desktop: max-width ~1200px centered content. Tablet: order context row wraps to 2×2. Mobile: hamburger menu, stacked fields, order cards stack vertically, line item table horizontal-scrolls or collapses columns to essentials

**Checkpoint**: End-to-end order creation works — salesperson opens app in icon rail shell, selects customer (Store populates), sees pricing, browses or searches products, adds line items with color/variety combobox, sees box reference badges, expands rows for fees/packing/special, fills order details, submits, gets OrderID confirmation, form clears. Works on desktop and mobile.

---

## Phase 5: User Story 2 - Custom Packing Instructions (Priority: P2)

**Goal**: Salesperson can specify Box Reference letters, Box Quantity, Bunches Per Box, and Stems Per Bunch on line items

**Independent Test**: Create an order with packing details on multiple lines sharing Box Reference letters; verify packing fields are stored correctly and box grouping badges display correctly

### Implementation for User Story 2

- [x] T062 [US2] Verify packing fields are fully functional end-to-end — Box Reference editable on main row (populates badge), packing detail fields (Box Qty, Bunches/Box, Stems/Bunch) in expanded sub-row, BoxGroupingsLegend updates dynamically, all fields included in OrderCreateRequest and stored in OrderLine. Fix any gaps from Phase 4 implementation
- [x] T063 [US2] Add tooltip to Box Reference field per frontend-design.md Tooltips section: "Assign letters to group line items into the same box. Lines sharing a letter are packed together."

**Checkpoint**: Orders with custom packing references can be created and retrieved with all packing fields intact. Box reference badges are color-coded and legend displays correct groupings.

---

## Phase 6: User Story 3 - Apply Fees to an Order (Priority: P2)

**Goal**: Salesperson can apply order-level fees (Box Charge, Holiday Charge, Special Charge, Freight Charge) and line-level fees (Item Fee %, Item Fee $) with correct calculation

**Independent Test**: Create an order with both order-level and line-level fees; verify stored effective_price_per_stem matches formula: (base * (1 + fee%)) + fee$

### Implementation for User Story 3

- [x] T064 [US3] Verify fee fields are fully functional end-to-end — order-level fees in OrderFeesCard, line-level fees in expanded sub-row, effective price live preview in Effective column (rose when different from base), all fees included in OrderCreateRequest and stored correctly. Fix any gaps from Phase 4 implementation
- [x] T065 [US3] Verify tooltips on all fee fields per frontend-design.md Tooltips section — Item Fee %: "Percentage applied to base price before flat fee is added", Item Fee $: "Flat dollar amount added after percentage fee", Effective: "Calculated as (Price × (1 + Fee%)) + Fee$", Freight Charge Included: "When on, freight is already included in pricing — no additional charge applied"

**Checkpoint**: Orders with fees can be created. Effective price calculation matches expected formula. Tooltips explain fee behavior.

---

## Phase 7: User Story 4 - Special Retail Orders (Priority: P3)

**Goal**: Salesperson can mark line items as Special and enter Sleeve and UPC details for retail-ready orders

**Independent Test**: Create an order with a special line item including sleeve and UPC; verify these fields are stored. Create a non-special line and verify sleeve/UPC are null.

### Implementation for User Story 4

- [x] T066 [US4] Verify special order fields are fully functional end-to-end — Special toggle in expanded sub-row conditionally reveals Sleeve and UPC fields, all fields included in OrderCreateRequest and stored in OrderLine. Fix any gaps from Phase 4 implementation

**Checkpoint**: Special retail orders with sleeve and UPC can be created and retrieved.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T067 [P] Add structured JSON logging with structlog throughout `apps/api/app/` — ensure all log entries include timestamp, severity, app name, request context per constitution
- [x] T068 [P] Review and verify tooltips on ALL form fields per FR-014 and frontend-design.md Tooltips section — audit every field in OrderContextRow, LineItemTable, expanded sub-rows, OrderFeesCard, OrderDetailsCard
- [x] T069 [P] Create `apps/api/docker-compose.prod.yml` for production deployment per constitution
- [x] T070 Validate all API responses use consistent envelope `{"data": ...}` / `{"error": "..."}` across all routers in `apps/api/app/routers/`
- [x] T071 Run quickstart.md validation — follow all steps in `specs/001-order-management/quickstart.md` and verify setup works end-to-end
- [x] T072 Responsive QA pass — verify all breakpoints per frontend-design.md Responsive section: desktop (>1024px, icon rail + max-width content), tablet (768-1024px, 2×2 context row), mobile (<768px, hamburger, stacked fields, product picker as overlay)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US5 - CSV Import (Phase 3)**: Depends on Foundational — BLOCKS US1 (need reference data to create orders)
- **US1 - Create Order (Phase 4)**: Depends on US5 (needs customers and pricing loaded)
- **US2 - Packing (Phase 5)**: Depends on US1 (validates/extends the order form)
- **US3 - Fees (Phase 6)**: Depends on US1 (validates/extends the order form)
- **US4 - Special Orders (Phase 7)**: Depends on US1 (validates/extends the order form)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US5 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories — MUST complete before US1
- **US1 (P1)**: Can start after US5 — Core order creation with full frontend
- **US2 (P2)**: Can start after US1 — Validates packing flow works end-to-end
- **US3 (P2)**: Can start after US1 — Validates fee flow works end-to-end. Can run in parallel with US2.
- **US4 (P3)**: Can start after US1 — Validates special order flow. Can run in parallel with US2/US3.

### Within Each User Story

- Models before services
- Services before endpoints/routers
- Backend before frontend (frontend consumes API)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005, T006, T007, T008, T009 — all setup tasks can run in parallel
- T012, T013, T014, T015 — all ORM model creation can run in parallel
- T017, T018, T019, T020, T022, T023 — foundational utilities and frontend components can run in parallel
- T034, T035 — product and pricing schemas can run in parallel
- T041, T042 — products and pricing routers can run in parallel
- T046, T047, T048, T049, T052, T053 — independent frontend components can run in parallel (no cross-dependencies)
- US2, US3, US4 — can all run in parallel after US1 is complete

---

## Implementation Strategy

### MVP First (US5 + US1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories, includes app shell)
3. Complete Phase 3: US5 - CSV Import (seed reference data)
4. Complete Phase 4: US1 - Create Order (full frontend per design doc)
5. **STOP and VALIDATE**: Create an order end-to-end with real data on desktop and mobile
6. Deploy/demo if ready — this is the MVP

### Incremental Delivery

1. Setup + Foundational → App shell with icon rail visible, API serves /health
2. US5 (CSV Import) → Reference data loaded → Prerequisite met
3. US1 (Create Order) → Full order entry with product picker, color combobox, box badges, fees, progressive disclosure → **MVP!**
4. US2 (Packing) → Validate packing end-to-end → Deploy
5. US3 (Fees) → Validate fee calculations end-to-end → Deploy
6. US4 (Special Orders) → Validate special order flow → Deploy
7. Polish → Production-ready with full responsive QA

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Phase 4 (US1) is deliberately large — it builds the complete order form with all UI components from the design doc. This front-loads the work so US2/US3/US4 become validation passes rather than large builds
- The progressive disclosure sub-row (T051) includes ALL optional field groups (fees, packing, special, notes) from day one. US2/US3/US4 validate these work end-to-end rather than adding them incrementally
- store_name is an ORDER-LEVEL field (on OrderContextRow), not per-line — per data-model.md update
- Color/Variety combobox (T049) includes "Add new" persistence per FR-017
- Box Reference badges (T052) and legend (T053) are visible on the main row per frontend-design.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
