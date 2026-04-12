# Feature Specification: Standing Orders

**Feature Branch**: `007-standing-orders`  
**Created**: 2026-04-12  
**Status**: implemented  
**Input**: Recurring orders for specific customers on a regular cadence. Salespeople can create, edit, pause, resume, and cancel standing orders. All changes tracked with audit trail. Standing orders have their own list view and generate regular orders for specific dates.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Standing Order (Priority: P1)

A salesperson creates a standing order for a customer who regularly orders the same products. They select the customer, define the cadence (e.g., every week on Tuesday, every 2 weeks on Monday), add sales items with quantities and pricing, and save. The standing order is created with an "active" status.

**Why this priority**: The core capability — without creating standing orders, nothing else works.

**Independent Test**: Can be fully tested by creating a standing order, verifying it appears in the standing orders list with correct details.

**Acceptance Scenarios**:

1. **Given** a salesperson is on the standing orders page, **When** they click "New Standing Order", **Then** a form opens for creating a standing order.
2. **Given** the form is open, **When** the salesperson selects a customer, **Then** the customer's sales items and pricing are available for adding line items.
3. **Given** the salesperson has selected a customer and cadence, **When** they add sales items with quantities and save, **Then** the standing order is created with status "active".
4. **Given** a standing order is created, **When** the salesperson views the standing orders list, **Then** the new order appears with customer name, cadence, line item count, and status.

---

### User Story 2 - Standing Orders List View (Priority: P2)

A salesperson navigates to a "Standing Orders" section (separate from the regular Orders tab) and sees all standing orders. The list shows customer name, cadence, status (active/paused/cancelled), line item count, and last modified date. They can filter by status, customer, and search by customer name.

**Why this priority**: Salespeople need a dedicated view to manage standing orders separately from one-time orders.

**Independent Test**: Can be fully tested by navigating to the standing orders list and verifying orders display correctly with working filters.

**Acceptance Scenarios**:

1. **Given** a salesperson navigates to the Standing Orders page, **When** the page loads, **Then** they see a list of all standing orders sorted by customer name.
2. **Given** standing orders exist with different statuses, **When** the salesperson filters by "active", **Then** only active standing orders are shown.
3. **Given** the salesperson types a customer name in the search box, **When** they search, **Then** matching standing orders are displayed.
4. **Given** a standing order has been cancelled, **When** the salesperson filters by "cancelled", **Then** cancelled orders are visible but visually distinguished.
5. **Given** the list is displayed, **When** the salesperson views a row, **Then** they can see: customer name, cadence description, status badge, number of line items, and last modified date.
6. **Given** the list is displayed, **When** the default filter is applied, **Then** only active standing orders are shown.

---

### User Story 3 - Generate Orders from Standing Orders (Priority: P3)

From the Standing Orders page, a salesperson clicks "Generate Orders" to create regular orders from active standing orders for a specific date or date range. The system shows a preview of which standing orders match the selected dates (based on their cadence), and the salesperson confirms to generate. Generated orders appear in the regular Orders list, linked back to their standing order.

**Why this priority**: This is the core value proposition of standing orders — turning recurring templates into actual orders without re-entering them manually.

**Independent Test**: Can be fully tested by creating a standing order with a weekly cadence, generating orders for a matching date, and verifying regular orders are created and linked.

**Acceptance Scenarios**:

1. **Given** a salesperson is on the Standing Orders page, **When** they click "Generate Orders", **Then** a dialog opens with a date picker (defaulting to the next upcoming business day).
2. **Given** the dialog is open, **When** the salesperson selects a date or date range, **Then** the system shows a preview listing which active standing orders match the cadence for those dates.
3. **Given** the preview shows matching standing orders, **When** the salesperson confirms, **Then** regular orders are created for each matching standing order with all line items, pricing, and ship-via copied from the template.
4. **Given** orders are generated, **When** the salesperson views the regular Orders list, **Then** the generated orders appear with a visual indicator showing they came from a standing order.
5. **Given** a standing order's cadence is "every 1 week on Tuesday", **When** the salesperson generates for a Monday, **Then** that standing order does NOT appear in the preview (cadence doesn't match).
6. **Given** a standing order is paused, **When** the salesperson generates orders, **Then** the paused standing order is excluded from generation.
7. **Given** orders have already been generated for a specific date from a standing order, **When** the salesperson tries to generate again for the same date, **Then** the system warns about duplicates and allows the salesperson to skip or override.

---

### User Story 4 - Edit a Standing Order (Priority: P4)

A salesperson opens an existing standing order to make changes. They can modify the cadence, add or remove sales items, change quantities or pricing, and update notes. When they save, a reason for the change is captured and an audit trail entry is created. The system offers to apply changes to future orders already generated from this standing order.

**Why this priority**: Customers frequently change their standing orders — adjusting quantities seasonally, adding/removing items, or changing delivery schedules.

**Independent Test**: Can be fully tested by opening an existing standing order, modifying fields, saving with a reason, and verifying changes persist and audit trail is recorded.

**Acceptance Scenarios**:

1. **Given** a salesperson clicks a standing order in the list, **When** the order loads, **Then** all fields are populated in an editable form.
2. **Given** the salesperson modifies line items, **When** they save, **Then** a dialog prompts for a reason for the change.
3. **Given** the salesperson provides a reason and confirms, **When** the save completes, **Then** changes are persisted and an audit entry is created with the reason, who changed it, and what changed.
4. **Given** future orders have already been generated from this standing order, **When** the salesperson saves changes, **Then** the system asks whether to apply changes to those future orders as well.
5. **Given** the salesperson chooses to apply to future orders, **When** confirmed, **Then** all unshipped future orders from this standing order are updated to match the new template.
6. **Given** a standing order is paused or cancelled, **When** the salesperson opens it, **Then** the form is read-only (must resume before editing).

---

### User Story 5 - Pause and Resume (Priority: P5)

A salesperson can pause an active standing order (e.g., customer is on vacation, seasonal slowdown). The order retains all its data but is marked as paused and excluded from order generation. Later, the salesperson can resume it, returning it to active status. Both actions are recorded in the audit trail.

**Why this priority**: Pausing is less destructive than cancelling — it preserves the order for reactivation without re-entering everything.

**Independent Test**: Can be fully tested by pausing an active order, verifying status changes and it's excluded from generation, then resuming and verifying it returns to active.

**Acceptance Scenarios**:

1. **Given** an active standing order, **When** the salesperson clicks "Pause", **Then** a dialog asks for a reason.
2. **Given** the salesperson provides a reason, **When** they confirm, **Then** the status changes to "paused" and an audit entry is created.
3. **Given** a paused standing order, **When** the salesperson clicks "Resume", **Then** the status changes back to "active" and an audit entry is created.
4. **Given** a cancelled standing order, **When** the salesperson views it, **Then** there is no option to resume (cancelled is final).

---

### User Story 6 - Cancel (Soft Delete) (Priority: P6)

A salesperson can cancel a standing order that is no longer needed. Cancellation is a soft delete — the order remains visible in the list (filtered by status) but cannot be edited, resumed, or used for order generation. The audit trail records the cancellation with a reason.

**Why this priority**: Cancellation provides a clean way to retire standing orders while preserving history.

**Independent Test**: Can be fully tested by cancelling a standing order, verifying it shows as cancelled in the list, and confirming it cannot be edited or resumed.

**Acceptance Scenarios**:

1. **Given** an active or paused standing order, **When** the salesperson clicks "Cancel Order", **Then** a dialog asks for a reason.
2. **Given** the salesperson provides a reason and confirms, **When** the cancellation completes, **Then** the status changes to "cancelled" and an audit entry is created.
3. **Given** a cancelled standing order, **When** the salesperson views it in the list, **Then** it is visually distinguished (e.g., muted/strikethrough) and cannot be edited, resumed, or used for generation.

---

### User Story 7 - Audit Trail (Priority: P7)

Every change to a standing order — creation, edits, pause, resume, cancellation — is recorded with who made the change, when, what changed, and why (the reason provided by the salesperson). The audit trail is viewable from the standing order detail view.

**Why this priority**: The audit trail answers "when and why did this change?" — critical for accountability.

**Independent Test**: Can be fully tested by making several changes to a standing order and verifying the audit log shows all entries with correct details.

**Acceptance Scenarios**:

1. **Given** a standing order has been modified multiple times, **When** the salesperson views the audit trail, **Then** they see a chronological list of all changes.
2. **Given** an audit entry exists, **When** the salesperson views it, **Then** they can see: timestamp, who made the change, action type (created/edited/paused/resumed/cancelled), reason, and a summary of what changed.

---

### User Story 8 - Test Coverage (Priority: P8)

All standing order endpoints have comprehensive backend test coverage.

**Why this priority**: Required by constitution but doesn't deliver direct user value.

**Independent Test**: Can be verified by running the test suite.

**Acceptance Scenarios**:

1. **Given** the test suite runs, **When** standing order tests execute, **Then** they cover: CRUD operations, status transitions, order generation, cadence matching, audit logging, filtering, soft delete, and validation.

---

### Edge Cases

- What happens when a salesperson tries to edit a paused standing order? They must resume it first — the edit form is read-only for non-active orders.
- What happens when a customer is deactivated? Existing standing orders retain the customer reference but should auto-pause with an audit note.
- Can a standing order have zero line items? No — at least one line item is required.
- Can the cadence be changed on a paused order? No — resume first, then edit.
- What happens if a salesperson tries to cancel an already-cancelled order? The cancel button is not shown for cancelled orders.
- What happens when generating orders for a date that already has generated orders from the same standing order? The system warns about duplicates and lets the salesperson skip or override.
- What happens when a standing order has a 2- or 4-week cadence? The system tracks which weeks are active based on a reference start date set when the standing order is created.

## Clarifications

### Session 2026-04-12

- Q: What cadence options should be supported? → A: Every 1, 2, or 4 weeks on one or more days of the week (multi-select toggle chips). Monthly dropped. "Every day" = all 7 days selected.
- Q: Cadence UI? → A: Day chip toggle buttons — compact, visual. Section has a "CADENCE" header. Live summary line below.
- Q: Can cadence include multiple days? → A: Yes. A standing order generates one order per matching day per cycle.

## Requirements *(mandatory)*

### Functional Requirements

**Standing Order CRUD:**

- **FR-001**: The system MUST allow creating a standing order with: customer, salesperson, cadence (frequency and days of week), line items (sales items with quantities and pricing), ship-via, order-level fees, and optional notes.
- **FR-002**: A standing order MUST have exactly one status at any time: "active", "paused", or "cancelled".
- **FR-003**: New standing orders MUST be created with status "active".
- **FR-004**: The system MUST support editing all fields of an active standing order. Non-active orders MUST be read-only.
- **FR-005**: The system MUST support soft-deleting (cancelling) a standing order. Cancelled orders remain visible but cannot be edited, resumed, or used for generation.

**Standing Orders List:**

- **FR-006**: The system MUST provide a dedicated list view for standing orders, separate from the regular orders list.
- **FR-007**: The standing orders list MUST be filterable by status (active, paused, cancelled, or all).
- **FR-007a**: The standing orders list MUST be filterable by salesperson.
- **FR-008**: The standing orders list MUST be searchable by customer name.
- **FR-009**: Each row MUST display: customer name, cadence description, status badge, line item count, and last modified date.
- **FR-010**: The default filter MUST show active orders only.

**Order Generation:**

- **FR-011**: The system MUST allow generating regular orders from active standing orders for a specific date or date range.
- **FR-012**: The system MUST match standing orders to dates based on their cadence (frequency + days of week). Only standing orders whose cadence matches the selected date(s) are included.
- **FR-013**: Before generating, the system MUST show a preview of which standing orders will generate orders, including customer name and line item count.
- **FR-014**: Generated regular orders MUST be linked back to their source standing order so the relationship is visible in the orders list.
- **FR-015**: The regular orders list MUST allow filtering to show only orders generated from standing orders, and each such order MUST display a visual indicator of its standing order origin.
- **FR-016**: The system MUST detect and warn when orders have already been generated from a standing order for the same date, allowing skip or override.
- **FR-017**: Paused and cancelled standing orders MUST be excluded from order generation.

**Applying Changes to Future Orders:**

- **FR-018**: When a standing order is edited, the system MUST offer the option to apply changes to all future unshipped orders already generated from that standing order.
- **FR-019**: The salesperson MUST be able to choose whether to apply changes to future orders or only to the standing order template going forward.

**Status Transitions:**

- **FR-020**: The system MUST support pausing an active standing order with a required reason.
- **FR-021**: The system MUST support resuming a paused standing order (returns to active).
- **FR-022**: The system MUST support cancelling an active or paused standing order with a required reason. Cancellation is permanent — no resume from cancelled.

**Audit Trail:**

- **FR-023**: The system MUST create an audit entry on every standing order change: creation, edit, pause, resume, and cancellation.
- **FR-024**: Each audit entry MUST capture: who made the change, when, what action was taken, a reason (required for edits, pause, and cancellation), and a structured summary of what changed.
- **FR-025**: The audit trail MUST be viewable from the standing order detail/edit view.

**Test Coverage:**

- **FR-026**: All standing order endpoints MUST have backend test coverage including happy path, status transitions, order generation, cadence matching, validation, and audit logging.

### Key Entities

- **StandingOrder**: A recurring order template for a customer. Contains customer reference, cadence (frequency + days of week + reference start date), status (active/paused/cancelled), ship-via, order-level fees, notes, and line items.
- **StandingOrderLine**: A single sales item within a standing order — specifies the sales item, quantity (stems), and pricing.
- **StandingOrderAuditLog**: A record of a change made to a standing order — captures action type, reason, structured changes, who, and when.
- **Order.standing_order_id**: Link from a generated regular order back to its source standing order (nullable — null for manually created orders).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Salespeople can create a standing order in under 2 minutes.
- **SC-002**: Salespeople can find any standing order within 10 seconds using the list view's search and filters.
- **SC-003**: Order generation preview loads in under 2 seconds for any date range.
- **SC-004**: All status transitions (pause, resume, cancel) complete in under 3 seconds.
- **SC-005**: Every standing order change is captured in the audit trail with zero missed entries.
- **SC-006**: The audit trail clearly answers "who changed what, when, and why" for 100% of entries.
- **SC-007**: Generated orders are correctly linked to their standing order 100% of the time.
- **SC-008**: All standing order endpoints have backend test coverage with tests passing on every build.

## Assumptions

- The cadence field captures frequency (every 1, 2, or 4 weeks) and days of week (Sunday through Saturday — multiple days can be selected) as structured data. For 2- and 4-week cadences, a reference start date determines which weeks are active.
- Standing order line items use the same sales items and customer pricing as regular orders.
- The "reason" field for changes is a short freeform text (not a dropdown of predefined reasons).
- The standing orders list is a separate section in the sidebar, not a tab within the regular orders page.
- Ship-via and order-level fees (box charge, holiday %, etc.) can be set on standing orders just like regular orders, since they repeat with each fulfillment.
- No auth/RBAC yet — all salespeople can see and edit all standing orders. Access control will come with the users/RBAC feature.
- "Unshipped" orders for the purpose of FR-018 means orders whose order_date is in the future. Past orders are not modified when a standing order changes.
- Order generation is manual (salesperson-initiated), not automatic on a schedule. Auto-generation can be added later when background workers are in place.
