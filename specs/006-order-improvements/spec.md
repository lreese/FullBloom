# Feature Specification: Order Management Improvements

**Feature Branch**: `006-order-improvements`  
**Created**: 2026-04-12  
**Status**: implemented  
**Input**: Fix broken order submission form (customer search, product errors, ship-via defaults), add test coverage, add filterable order list view with inline editing, add audit logging on all order edits.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Order Submission Form (Priority: P1)

A salesperson opens the order form to enter a new order. They type a customer name into the customer search box and see a filtered list of matching customers. After selecting a customer, the Ship Via field auto-populates with that customer's default ship-via preference. They open the product picker to browse available products by product type and product line, select items to add as line items, and submit the order without errors.

**Why this priority**: The order form is the core workflow and is currently broken in multiple places — customer search returns unfiltered results, the product picker fails because its API endpoint doesn't exist, and ship-via ignores customer defaults. Nothing else matters if salespeople can't submit orders reliably.

**Independent Test**: Can be fully tested by creating a new order end-to-end — searching for a customer, verifying ship-via default populates, adding products via the picker, and submitting successfully.

**Acceptance Scenarios**:

1. **Given** a salesperson is on the order form, **When** they type "Oregon" into the customer search, **Then** only customers whose name or customer number contains "Oregon" appear in the dropdown.
2. **Given** a salesperson selects a customer who has `default_ship_via = "FedEx"`, **When** the customer is selected, **Then** the Ship Via field auto-populates with "FedEx".
3. **Given** a salesperson selects a customer who has no default_ship_via set, **When** the customer is selected, **Then** the Ship Via field shows "Pick Up - Tues" as the system default.
4. **Given** no customer is selected, **When** a salesperson clicks "Browse Products", **Then** the button is disabled or shows a prompt to select a customer first.
5. **Given** a customer is selected, **When** a salesperson clicks "Browse Products", **Then** the product picker panel opens showing sales items available to that customer with their customer-specific pricing, grouped by product type and product line.
6. **Given** the product picker is open, **When** the salesperson selects a sales item, **Then** it is added as a line item with the customer's price pre-populated.
7. **Given** a salesperson has added line items and filled required fields, **When** they submit the order, **Then** the order is created successfully with a unique order number.

---

### User Story 2 - Order List View (Priority: P2)

A salesperson navigates to an "Orders" page from the sidebar and sees a list of all orders, showing order number, customer name, order date, ship via, line item count, and total stems. They can filter by date range, customer, and salesperson. They can search by order number or customer name. The list is sorted by most recent first.

**Why this priority**: Salespeople currently have no way to view or find existing orders. This is the foundation for editing and auditing — you can't edit what you can't see.

**Independent Test**: Can be fully tested by navigating to the orders page and verifying orders display correctly with working filters.

**Acceptance Scenarios**:

1. **Given** a salesperson navigates to the Orders page, **When** the page loads, **Then** they see a paginated list of orders sorted by order date descending.
2. **Given** orders exist for multiple dates, **When** the salesperson selects a date range filter, **Then** only orders within that range are shown.
3. **Given** orders exist for multiple customers, **When** the salesperson selects a customer filter, **Then** only that customer's orders are shown.
4. **Given** the salesperson types an order number in the search box, **When** they search, **Then** matching orders are displayed.
5. **Given** the order list is displayed, **When** the salesperson views a row, **Then** they can see: order number, customer name, order date, ship via, number of line items, and total stems.

---

### User Story 3 - Order Editing (Priority: P3)

From the order list view, a salesperson clicks on an order to open it in an editable form. They can modify any field except the customer (which is locked after creation) — dates, ship via, line items (add, remove, edit quantities/prices), fees, and notes. When they save, changes are persisted and an audit trail is created automatically.

**Why this priority**: Editing is essential for day-to-day corrections but depends on the list view (Story 2) for navigation.

**Independent Test**: Can be fully tested by opening an existing order, modifying fields, saving, and verifying changes persist.

**Acceptance Scenarios**:

1. **Given** a salesperson clicks an order in the list view, **When** the order loads, **Then** all fields are populated with the order's current values in an editable form.
2. **Given** a salesperson is editing an order, **When** they change the stems on a line item and save, **Then** the updated stems value is persisted.
3. **Given** a salesperson is editing an order, **When** they add a new line item and save, **Then** the new line item appears in the order.
4. **Given** a salesperson is editing an order, **When** they remove a line item and save, **Then** the line item is deleted from the order.
5. **Given** a salesperson is editing an order, **When** they modify order-level fees and save, **Then** the updated fees are persisted and effective prices recalculated.
6. **Given** a salesperson has unsaved changes and attempts to navigate away, **When** the navigation is triggered, **Then** a confirmation dialog warns about unsaved changes.

---

### User Story 4 - Order Deletion (Priority: P4)

From the order list view or the order edit view, a salesperson can delete an order. The system asks for confirmation before deleting. Deletion removes the order and all its line items. An audit log entry records who deleted the order and when.

**Why this priority**: Salespeople need to clean up erroneous orders (e.g., wrong customer selected, duplicate created by mistake). Depends on the list view (Story 2) for navigation.

**Independent Test**: Can be fully tested by creating an order, deleting it from the list view, and confirming it no longer appears.

**Acceptance Scenarios**:

1. **Given** a salesperson is viewing the order list, **When** they click delete on an order, **Then** a confirmation dialog appears asking them to confirm the deletion.
2. **Given** the confirmation dialog is shown, **When** the salesperson confirms, **Then** the order and all its line items are permanently deleted.
3. **Given** the confirmation dialog is shown, **When** the salesperson cancels, **Then** the order remains unchanged.
4. **Given** a salesperson deletes an order, **When** the deletion completes, **Then** an audit log entry is created with the action "deleted", the order number, who deleted it, and when.

---

### User Story 5 - Audit Logging (Priority: P5)

Every time an order is created, edited, or deleted, the system records an audit trail capturing who made the change, when, and what changed. Audit entries are viewable from the order detail view.

**Why this priority**: Audit logging is a cross-cutting concern that adds traceability but doesn't block core workflows.

**Independent Test**: Can be fully tested by editing an order, then viewing the audit log to verify the change was recorded with correct details.

**Acceptance Scenarios**:

1. **Given** a salesperson creates a new order, **When** the order is saved, **Then** an audit entry is created with action "created", the salesperson's identifier, and a timestamp.
2. **Given** a salesperson edits an order, **When** they save changes, **Then** an audit entry is created for each changed field, capturing the old value, new value, who changed it, and when.
3. **Given** a salesperson is viewing an order, **When** they expand the audit log section, **Then** they see a chronological list of all changes made to that order.
4. **Given** a line item is added or removed, **When** the order is saved, **Then** the audit log records the line-level change with the affected line item details.

---

### User Story 6 - Test Coverage (Priority: P6)

All order management endpoints have comprehensive backend test coverage, including order creation, editing, listing, duplicate detection, customer search, and audit logging.

**Why this priority**: Tests ensure the fixes and new features work correctly and prevent regressions, but they don't deliver direct user value.

**Independent Test**: Can be verified by running the test suite and confirming all order-related tests pass.

**Acceptance Scenarios**:

1. **Given** the test suite runs, **When** order creation tests execute, **Then** they cover: happy path, duplicate detection, missing customer, invalid line items, and fee calculations.
2. **Given** the test suite runs, **When** order editing tests execute, **Then** they cover: field updates, line item add/remove, audit log creation, and concurrent edit handling.
3. **Given** the test suite runs, **When** order list tests execute, **Then** they cover: pagination, date range filtering, customer filtering, and search.
4. **Given** the test suite runs, **When** customer search tests execute, **Then** they cover: partial name match, customer number match, empty results, and case insensitivity.

---

### Edge Cases

- What happens when a salesperson edits an order while another salesperson is also editing it? The last save wins; no real-time collaboration needed at this scale.
- What happens when a customer is deactivated after an order references them? Existing orders retain the customer reference; the customer just won't appear in search for new orders.
- What happens when a sales item is deactivated after it's on an order? Existing line items retain the reference; the item won't appear in the product picker for new orders.
- What happens when the order list has thousands of orders? Paginate server-side with a reasonable page size (25-50 orders per page).

## Clarifications

### Session 2026-04-12

- Q: Should the customer on an existing order be changeable? → A: Customer is locked after creation — salesperson must create a new order if customer was wrong.
- Q: Should every individual field change get its own audit entry, or one entry per save? → A: One audit entry per save with a structured summary of all changes.
- Q: Order list layout? → A: Table view with expandable rows (chevron to show line items inline, read-only). Edit navigates to full OrderForm.
- Q: Edit form approach? → A: Reuse existing OrderForm with orderId prop — disabled customer selector, PUT instead of POST, fetch existing data on mount.

## Requirements *(mandatory)*

### Functional Requirements

**Order Form Fixes:**

- **FR-001**: The customer search endpoint MUST support a `search` query parameter that filters customers by name or customer number (case-insensitive partial match).
- **FR-002**: When a customer is selected in the order form, the Ship Via field MUST auto-populate with the customer's `default_ship_via` value if one is set; otherwise fall back to the system default ("Pick Up - Tues").
- **FR-003**: The product picker MUST require a customer to be selected before it can be opened. If no customer is selected, the "Browse Products" button MUST be disabled with a prompt to select a customer first.
- **FR-004**: The product picker MUST display sales items available to the selected customer with their customer-specific pricing, grouped by product type and product line. When a sales item is selected, it MUST be added as a line item with the customer's price pre-populated.

**Order List View:**

- **FR-005**: The system MUST provide a paginated list view of all orders, sorted by order date descending by default.
- **FR-006**: The order list MUST be filterable by date range, customer, and salesperson email.
- **FR-007**: The order list MUST be searchable by order number and customer name.
- **FR-008**: Each order row MUST display: order number, customer name, order date, ship via, line item count, and total stems. Rows MUST be expandable via a chevron to show line items inline (read-only) with product name, color/variety, stems, list price, actual price, effective price, and box reference. Overridden prices MUST be visually distinguished.

**Order Editing:**

- **FR-009**: The system MUST support updating existing orders via a PUT endpoint, accepting the same fields as order creation except customer (which is locked after creation).
- **FR-010**: The order edit form MUST reuse the same form component as order creation, pre-populated with existing order data.
- **FR-011**: The system MUST support adding, removing, and modifying individual line items on an existing order.
- **FR-012**: The system MUST recalculate effective prices when fees or prices are modified during editing.
- **FR-013**: The system MUST warn users about unsaved changes before navigating away from the edit form.

**Order Deletion:**

- **FR-013a**: The system MUST support deleting an order via a DELETE endpoint, which removes the order and all its line items.
- **FR-013b**: The frontend MUST show a confirmation dialog before deleting an order.

**Audit Logging:**

- **FR-014**: The system MUST create an audit log entry when an order is created, capturing the creator and timestamp.
- **FR-015**: The system MUST create one audit log entry per save operation when an order is edited, containing a structured summary of all fields changed (old values, new values), who made the change, and when.
- **FR-016**: Line-item-level changes (add, remove, modify) MUST be included in the same per-save audit entry as header-level changes.
- **FR-017**: Audit log entries MUST be viewable from the order detail/edit view.

**Test Coverage:**

- **FR-018**: All order-related API endpoints MUST have backend test coverage including happy path and error cases.
- **FR-019**: Customer search endpoint MUST have tests covering partial match, case insensitivity, and empty results.

### Key Entities

- **Order**: A customer's request for flowers on a specific date. Contains header-level info (customer, date, ship via, fees, notes) and one or more line items.
- **OrderLine**: A single product line within an order — specifies the sales item, quantity (stems), pricing, packing details, and optional special order info.
- **OrderAuditLog**: A record of a change made to an order — captures the action type, field changed, old/new values, who made the change, and when.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Salespeople can search for and select a customer in under 5 seconds (filtered results appear within 300ms of typing).
- **SC-002**: The product picker loads and displays available products without errors on every attempt.
- **SC-003**: Ship-via correctly reflects the selected customer's default for 100% of customers that have a default set.
- **SC-004**: Salespeople can find any existing order within 15 seconds using the list view's search and filters.
- **SC-005**: All order modifications are captured in the audit log with zero missed changes.
- **SC-006**: All order-related API endpoints have backend test coverage with tests passing on every build.

## Assumptions

- Single-user editing is sufficient — no real-time collaboration or optimistic locking needed at this scale.
- The existing order creation flow (fee calculation, duplicate detection, order number generation) is correct and should be preserved.
- The `default_ship_via` field already exists on the Customer model and may already have data populated for some customers.
- Audit logging uses the same pattern established in inventory management (per-model audit log table with action, old/new values, entered_by, timestamp).
- The order list view is accessible to all users (no role-based access control until Clerk auth is added).
- The existing `OrderForm` component can be extended for editing rather than building a separate edit form.
- Frontend tests are not required per the constitution (recommended but not mandatory).
