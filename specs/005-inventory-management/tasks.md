# Tasks: Inventory Management

**Input**: Design documents from `/specs/005-inventory-management/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-v1.md, frontend-design.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and model/migration setup

- [ ] T001 Add `in_harvest` (BooleanField, default=True) and `stems_per_bunch` (IntField, default=10) fields to Variety model in `apps/api/app/models/product.py`
- [ ] T002 Create inventory models file with DailyCount, CustomerCount, Estimate, CountSheetTemplate, PullDaySchedule, SheetCompletion, and CountAuditLog models in `apps/api/app/models/inventory.py`
- [ ] T003 Register inventory models in TORTOISE_ORM config in `apps/api/app/config.py`
- [ ] T004 Generate Aerich migration for all new models and Variety extensions via `aerich migrate`
- [ ] T005 Create inventory Pydantic schemas (request/response) in `apps/api/app/schemas/inventory.py`
- [ ] T006 [P] Create inventory TypeScript type definitions in `apps/web/src/types/inventory.ts`
- [ ] T007 [P] Create seed script to insert default PullDaySchedule (Mon/Wed/Fri) in `apps/api/app/seed.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend services and routing infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create inventory service with 10-stem equivalent calculation, sanity check logic, and copy helpers in `apps/api/app/services/inventory_service.py`
- [ ] T009 [P] Create counts router with GET /counts, PUT /counts, GET /counts/recent/{variety_id} endpoints in `apps/api/app/routers/counts.py`
- [ ] T010 [P] Create customer-counts router with GET /customer-counts, PUT /customer-counts endpoints in `apps/api/app/routers/customer_counts.py`
- [ ] T011 [P] Create estimates router with GET /estimates, PUT /estimates endpoints in `apps/api/app/routers/estimates.py`
- [ ] T012 [P] Create availability router with GET /availability endpoint in `apps/api/app/routers/availability.py`
- [ ] T013 [P] Create harvest-status router with GET /varieties/harvest-status, PATCH /varieties/harvest-status/bulk endpoints in `apps/api/app/routers/harvest_status.py`
- [ ] T014 [P] Create sheet completion router with POST /sheets/complete, POST /sheets/uncomplete endpoints in `apps/api/app/routers/sheet_completion.py`
- [ ] T015 [P] Create count-sheet-templates router with GET/PUT /count-sheet-templates/{product_type_id} endpoints in `apps/api/app/routers/sheet_templates.py`
- [ ] T016 [P] Create pull-day-schedules router with GET/PUT /pull-day-schedules endpoints in `apps/api/app/routers/pull_days.py`
- [ ] T017 [P] Create comparison router with GET /counts/comparison endpoint in `apps/api/app/routers/comparison.py`
- [ ] T018 [P] Create print router with GET /print/count-sheet endpoint returning print-optimized HTML in `apps/api/app/routers/print_sheets.py`
- [ ] T019 Register all new routers in `apps/api/app/main.py`
- [ ] T020 [P] Create SearchFilterBar component (search, product line chips, status filter) in `apps/web/src/components/inventory/SearchFilterBar.tsx`
- [ ] T021 [P] Create SheetCompletionBar component (progress indicator + Complete Sheet button) in `apps/web/src/components/inventory/SheetCompletionBar.tsx`
- [ ] T022 Add Inventory sidebar group with routes (Counts, Estimates, Availability, Harvest Status) in `apps/web/src/components/layout/` sidebar config and update `apps/web/src/App.tsx` with new routes

**Checkpoint**: Foundation ready — all API endpoints exist and shared frontend components are available

---

## Phase 3: User Story 6 - Toggle Variety Harvest Status (Priority: P2, but foundational for all forms) 🎯 Build First

**Goal**: Let field leads toggle varieties as in-harvest or dormant so only relevant varieties appear on count/estimate forms

**Independent Test**: Mark varieties as dormant, confirm they disappear from count/estimate forms. Toggle back, confirm they reappear.

- [ ] T023 [US6] Create HarvestToggleList component with toggle switches and bulk actions per product line in `apps/web/src/components/inventory/HarvestToggleList.tsx`
- [ ] T024 [US6] Create HarvestStatusPage with product type selector and HarvestToggleList in `apps/web/src/pages/HarvestStatusPage.tsx`

**Checkpoint**: Harvest status toggle is functional. Variety filtering is available for all subsequent forms.

---

## Phase 4: User Story 1 - Enter Remaining Counts (Priority: P1) 🎯 MVP

**Goal**: Field leads enter remaining counts (10-stem equivalents) per variety after priority customer bunches are pulled

**Independent Test**: Navigate to Counts, select today and Lilies, enter counts for varieties using set/add/remove, mark varieties done, save, refresh, confirm persistence.

- [ ] T025 [P] [US1] Create CountForm component with stacked rows, +/−/edit interactions, done checkboxes, and audit log expansion in `apps/web/src/components/inventory/CountForm.tsx`
- [ ] T026 [P] [US1] Create SanityWarning component for inline amber warning badges in `apps/web/src/components/inventory/SanityWarning.tsx`
- [ ] T027 [P] [US1] Create CountAuditLog component showing recent set/add/remove activity per variety in `apps/web/src/components/inventory/CountAuditLog.tsx`
- [ ] T028 [US1] Create CountsPage with date picker, product type selector, Remaining/Customer tabs, toolbar (search/filter/copy/print), floating save, and SheetCompletionBar in `apps/web/src/pages/CountsPage.tsx`

**Checkpoint**: Remaining counts are fully functional and testable independently. Field leads can enter, add to, subtract from, and save counts.

---

## Phase 5: User Story 2 - Enter Customer-Specific Priority Counts (Priority: P1)

**Goal**: Field leads enter customer-specific bunch counts with auto-calculated 10-stem equivalent summaries

**Independent Test**: Open Customer tab, select a customer chip, enter bunch counts for varieties, confirm 10-stem equivalent totals auto-calculate, save and verify persistence.

- [ ] T029 [P] [US2] Create CustomerCountSelector component with customer chips (status badges), selected customer header, and summary totals in `apps/web/src/components/inventory/CustomerCountSelector.tsx`
- [ ] T030 [US2] Integrate CustomerCountSelector into CountsPage Customer tab, reusing CountForm for the variety list input in `apps/web/src/pages/CountsPage.tsx`

**Checkpoint**: Customer-specific counts are functional. Both tabs on the Counts page work independently.

---

## Phase 6: User Story 3 - Enter Weekly Estimates by Pull Day (Priority: P1)

**Goal**: Field leads enter weekly estimates broken down by pull day (Mon/Wed/Fri) in 10-stem equivalents

**Independent Test**: Navigate to Estimates, select current week and Lilies, enter estimates for Mon/Wed/Fri, save, toggle to Last Week's Actual, confirm data displays.

- [ ] T031 [P] [US3] Create EstimateForm component with pull-day columns, large inputs, and week toggle (This Week editable / Last Week read-only) in `apps/web/src/components/inventory/EstimateForm.tsx`
- [ ] T032 [US3] Create EstimatesPage with week picker, product type selector, toolbar (search/filter/copy/print), floating save, and SheetCompletionBar in `apps/web/src/pages/EstimatesPage.tsx`

**Checkpoint**: Weekly estimates are fully functional. All three P1 data entry stories are complete.

---

## Phase 7: User Story 13 - Count and Estimate Completion Notifications (Priority: P1)

**Goal**: When a sheet is marked "Done", the status is visible to sales on the availability view as a data source indicator

**Independent Test**: Complete a count sheet as a field lead. Navigate to Availability view and confirm the product type shows "Actual counts — updated [time] by [user]" instead of "Estimates only."

- [ ] T033 [US13] Wire SheetCompletionBar's "Complete Sheet" button to POST /sheets/complete endpoint, enforce all-varieties-done precondition, show error if incomplete in `apps/web/src/components/inventory/SheetCompletionBar.tsx`

**Checkpoint**: Completion flow works end-to-end. Sales can see when counts are in.

---

## Phase 8: User Story 5 - Sales Availability View (Priority: P2)

**Goal**: Read-only view for sales showing current availability across all product types with data source indicators

**Independent Test**: Enter counts for today, navigate to Availability, confirm counts display with "Actual counts" status. Check a product type without counts shows "Estimates only."

- [ ] T034 [P] [US5] Create AvailabilityCard component with collapsible product type section, green/amber status banner, and variety list in `apps/web/src/components/inventory/AvailabilityCard.tsx`
- [ ] T035 [US5] Create AvailabilityPage with date picker showing all product types using AvailabilityCard, link to Comparison page in `apps/web/src/pages/AvailabilityPage.tsx`

**Checkpoint**: Sales has a functional read-only availability view with clear data source indicators.

---

## Phase 9: User Story 4 - View Estimate vs. Actual Comparison (Priority: P2)

**Goal**: Sales and leadership see weekly estimate vs. actual comparison with variance highlighting

**Independent Test**: Enter estimates and counts for a week, navigate to Comparison, confirm side-by-side display with variance highlighting and summary totals.

- [ ] T036 [P] [US4] Create ComparisonGrid component with estimate/actual side-by-side cells, variance highlighting (green over/rose under), and summary row in `apps/web/src/components/inventory/ComparisonGrid.tsx`
- [ ] T037 [US4] Create ComparisonPage with week picker, product type selector, and ComparisonGrid in `apps/web/src/pages/ComparisonPage.tsx`

**Checkpoint**: Comparison view is functional for sales/leadership review.

---

## Phase 10: User Story 9 - Bulk Entry Shortcuts (Priority: P2)

**Goal**: Copy last count and copy from estimate shortcuts to speed up data entry

**Independent Test**: Enter counts for Monday. On Tuesday, tap "Copy last count" and confirm Monday's values pre-fill. Edit and save.

- [ ] T038 [P] [US9] Create CopyButtons component with "Copy last count", "Copy from estimate", "Copy last week's estimate" buttons with disabled states in `apps/web/src/components/inventory/CopyButtons.tsx`
- [ ] T039 [US9] Integrate CopyButtons into CountsPage and EstimatesPage toolbars, wire to inventory service copy logic in `apps/web/src/pages/CountsPage.tsx` and `apps/web/src/pages/EstimatesPage.tsx`

**Checkpoint**: Bulk copy shortcuts are functional on both Counts and Estimates pages.

---

## Phase 11: User Story 12 - Sanity Check Warnings (Priority: P2)

**Goal**: Non-blocking warnings when entered values are significantly outside recent history

**Independent Test**: Enter counts of 50 for a variety over several days. Enter 5000 on the next day. Confirm warning appears. Dismiss and save normally.

- [ ] T040 [US12] Integrate SanityWarning into CountForm and EstimateForm — fetch last 5 counts on form load via GET /counts/recent/{variety_id}, trigger warning on >5x or <0.2x average in `apps/web/src/components/inventory/CountForm.tsx` and `apps/web/src/components/inventory/EstimateForm.tsx`

**Checkpoint**: Sanity check warnings are functional and non-blocking.

---

## Phase 12: User Story 11 - Print Blank Count and Estimate Sheets (Priority: P2)

**Goal**: Printable blank sheets for field use during paper-to-digital transition

**Independent Test**: Tap print icon, select Lilies and Customer Count, confirm print-optimized blank sheet renders with correct varieties and columns.

- [ ] T041 [P] [US11] Create PrintSheet component that opens a new tab with print-optimized HTML layout (CSS @media print) in `apps/web/src/components/inventory/PrintSheet.tsx`
- [ ] T042 [US11] Integrate print icon into CountsPage and EstimatesPage toolbars, wire to GET /print/count-sheet endpoint in `apps/web/src/pages/CountsPage.tsx` and `apps/web/src/pages/EstimatesPage.tsx`

**Checkpoint**: Blank print sheets are functional for all three sheet types.

---

## Phase 13: User Story 7 - Configure Customer Count Sheet Columns (Priority: P3)

**Goal**: Admins/leads configure which customer-bunch columns appear on the customer count sheet

**Independent Test**: Add a new customer-bunch column, confirm it appears in the customer count entry grid.

- [ ] T043 [P] [US7] Create TemplateConfigDrawer component with drag-to-reorder list, add column (customer dropdown + bunch size + sleeve type), remove with confirmation in `apps/web/src/components/inventory/TemplateConfigDrawer.tsx`
- [ ] T044 [US7] Integrate TemplateConfigDrawer into CountsPage Customer tab via gear icon in `apps/web/src/pages/CountsPage.tsx`

**Checkpoint**: Count sheet template configuration is self-service.

---

## Phase 14: User Story 8 - Configure Pull Days per Week (Priority: P3)

**Goal**: Admins/leads configure pull days per week for estimates

**Independent Test**: Change pull days for a future week, confirm estimate form shows updated columns.

- [ ] T045 [P] [US8] Create PullDayConfigPopover component with Mon-Sat checkboxes and "This week only" vs "Update default" toggle in `apps/web/src/components/inventory/PullDayConfigPopover.tsx`
- [ ] T046 [US8] Integrate PullDayConfigPopover into EstimatesPage via gear icon in `apps/web/src/pages/EstimatesPage.tsx`

**Checkpoint**: Pull day configuration is self-service.

---

## Phase 15: User Story 10 - Last Week's Numbers on Estimate Form (Priority: P3)

**Goal**: Show last week's actual counts as read-only reference when entering estimates

**Independent Test**: Enter counts for a week, open estimate form for the following week, toggle to "Last Week's Actual" tab and confirm data displays.

- [ ] T047 [US10] Wire EstimateForm's week toggle to fetch and display last week's actuals from GET /estimates response `last_week_actuals` field in `apps/web/src/components/inventory/EstimateForm.tsx`

**Checkpoint**: Last week's reference data is accessible from the estimate form.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T048 [P] Add auto-save draft to localStorage on input change for CountsPage and EstimatesPage for crash recovery
- [ ] T049 [P] Add structured logging with structlog for all inventory routers in `apps/api/app/routers/`
- [ ] T050 Update quickstart.md verification steps and test all curl commands in `specs/005-inventory-management/quickstart.md`
- [ ] T051 Update spec status from Draft to in-progress in `specs/005-inventory-management/spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (models must exist for routers)
- **US6 Harvest Status (Phase 3)**: Depends on Phase 2 — foundational for all forms
- **US1, US2, US3 (Phases 4-6)**: Depend on Phase 3 (harvest filtering)
  - US1 can start independently after Phase 3
  - US2 depends on US1 (shares CountsPage, reuses CountForm)
  - US3 is independent of US1/US2
- **US13 (Phase 7)**: Depends on US1/US2/US3 (needs completion bars to exist)
- **US5 (Phase 8)**: Depends on US13 (needs completion status for data source indicators)
- **US4, US9, US12, US11 (Phases 9-12)**: Depend on US1/US3 (need count/estimate forms to exist)
  - These four can run in parallel with each other
- **US7, US8, US10 (Phases 13-15)**: Depend on US2/US3 respectively
  - These three can run in parallel with each other
- **Polish (Phase 16)**: Depends on all desired stories being complete

### User Story Dependencies

- **US6** (Harvest Status): Foundational — no story dependencies
- **US1** (Remaining Counts): Depends on US6
- **US2** (Customer Counts): Depends on US1 (shares CountsPage)
- **US3** (Estimates): Depends on US6, independent of US1/US2
- **US13** (Notifications): Depends on US1, US2, US3
- **US5** (Availability): Depends on US13
- **US4** (Comparison): Depends on US3
- **US9** (Copy Shortcuts): Depends on US1, US3
- **US12** (Sanity Checks): Depends on US1
- **US11** (Print): Depends on US1, US3
- **US7** (Template Config): Depends on US2
- **US8** (Pull Day Config): Depends on US3
- **US10** (Last Week Reference): Depends on US3

### Parallel Opportunities

```
Phase 2: T009-T018 can all run in parallel (separate router files)
Phase 2: T020-T021 can run in parallel (separate components)
Phase 4+5: US1 tasks T025-T027 can run in parallel (separate components)
Phase 6: US3 independent of US1/US2 — can run in parallel with Phase 5
Phases 9-12: US4, US9, US12, US11 can all run in parallel
Phases 13-15: US7, US8, US10 can all run in parallel
```

---

## Parallel Example: Foundation (Phase 2)

```
# All routers can be written in parallel (separate files):
T009: counts.py
T010: customer_counts.py
T011: estimates.py
T012: availability.py
T013: harvest_status.py
T014: sheet_completion.py
T015: sheet_templates.py
T016: pull_days.py
T017: comparison.py
T018: print_sheets.py

# All shared components in parallel:
T020: SearchFilterBar.tsx
T021: SheetCompletionBar.tsx
```

---

## Implementation Strategy

### MVP First (User Stories 6 + 1)

1. Complete Phase 1: Setup (models, migrations)
2. Complete Phase 2: Foundational (routers, shared components)
3. Complete Phase 3: US6 Harvest Status
4. Complete Phase 4: US1 Remaining Counts
5. **STOP and VALIDATE**: Test remaining counts independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US6 (Harvest Status) → Variety filtering works
3. US1 (Remaining Counts) → MVP field data entry ✓
4. US2 (Customer Counts) → Priority customer workflow ✓
5. US3 (Estimates) → Weekly planning workflow ✓
6. US13 (Notifications) → Field→Sales handoff ✓
7. US5 (Availability) → Sales visibility ✓
8. US4, US9, US12, US11 → Enhancement batch (parallel)
9. US7, US8, US10 → Configuration batch (parallel)
10. Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The CountAuditLog model (from frontend-design.md) replaces simple entered_by tracking with full set/add/remove history
- All counts/estimates are in 10-stem equivalents; customer counts entered in column's bunch size with auto-conversion
