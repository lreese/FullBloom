# Feature Specification: Customer Management

**Feature Branch**: `002-customer-management`  
**Created**: 2026-04-08  
**Status**: in-progress  
**Input**: Customer management page: list all customers with search/filter, inline edit customer details, add new customers, soft-delete customers (recoverable).

## Clarifications

### Session 2026-04-08

- Q: What edit UX pattern for customer details? → A: Slide-out drawer from the right (full-screen overlay on mobile)
- Q: Should Salesperson, Terms, and Ship Via be dropdowns or free text? → A: Dropdowns for Salesperson, Terms, and Ship Via; free text for all other fields
- Q: Which columns get Excel-style filter dropdowns? → A: Only columns with constrained/repeated values: Name, Salesperson, Ship Via, Terms, Location, Active status
- Q: Should search match only name or multiple fields? → A: Search matches all text fields (name, contact, location, email, phone, notes)
- Q: How is customer number assigned when adding a new customer? → A: System suggests next available number, user can override

## User Scenarios & Testing

### User Story 1 - Browse and Search Customers (Priority: P1)

A user navigates to the Customers tab in the sidebar and sees a table of all active customers with columns: Customer Number, Name, Salesperson, Contact, Ship Via, Phone, Location, Terms, Email, and Notes. They can search by name and apply Excel-style per-column filters (dropdown on each column header showing the distinct values in that column) to narrow the list. A "Clear Filters" button resets all active filters and search in one click.

**Why this priority**: Users need visibility into their customer base before they can manage it. This is the foundation all other stories build on.

**Independent Test**: Can be fully tested by navigating to the Customers page, seeing the full customer list, using search and column filters to narrow results, and clearing all filters.

**Acceptance Scenarios**:

1. **Given** customers exist in the system, **When** the user navigates to the Customers page, **Then** they see a table of all active customers sorted alphabetically by name.
2. **Given** the customer list is displayed, **When** the user types in the search field, **Then** the list filters to customers matching the search term across all text fields (name, contact, location, email, phone, notes).
3. **Given** a filterable column header (Name, Salesperson, Ship Via, Terms, Location, Active), **When** the user clicks the filter icon, **Then** a dropdown appears listing the distinct values for that column with checkboxes to select/deselect values.
4. **Given** the user selects one or more values in a column filter, **When** they confirm, **Then** the table shows only rows matching the selected values across all active filters.
5. **Given** multiple column filters are active, **When** the user clicks "Clear Filters", **Then** all column filters and the search field are reset and the full list is restored.
6. **Given** a column filter is active, **When** the column header visually indicates the filter is applied (e.g., highlighted icon), **Then** the user can see at a glance which columns are filtered.
7. **Given** no customers match the combined search and filters, **When** the list is empty, **Then** a "No customers found" message is displayed with the Clear Filters button visible.

---

### User Story 2 - Edit Customer Details (Priority: P1)

A user clicks on a customer row to open a slide-out drawer from the right containing an edit form. On desktop the drawer partially overlays the table; on mobile it opens as a full-screen overlay. The form allows editing any customer field: name, salesperson, contact, ship via, phone, location, terms, email, and notes. Salesperson, Ship Via, and Terms are dropdown selects; all other fields are free text. Changes are saved when the user confirms, and the list updates immediately. Customer number is displayed but read-only.

**Why this priority**: Keeping customer data accurate is a core daily task — tied with browsing as the most essential capability.

**Independent Test**: Can be tested by selecting a customer, changing their details, saving, and confirming the changes persist on refresh.

**Acceptance Scenarios**:

1. **Given** the customer list is displayed, **When** the user clicks a customer row, **Then** a slide-out drawer opens from the right with the customer's current details in an edit form.
2. **Given** the edit form is open, **When** the user changes any field and saves, **Then** the updated values appear in the customer list.
3. **Given** the edit form is open, **When** the user clicks cancel, **Then** changes are discarded and the form closes.
4. **Given** the user clears a required field (name), **When** they attempt to save, **Then** a validation error is shown and the save is blocked.
5. **Given** the edit form is open, **When** the user views the customer number field, **Then** it is displayed but not editable.

---

### User Story 3 - Add a New Customer (Priority: P2)

A user clicks an "Add Customer" button to open a form (same slide-out drawer pattern) where they can enter all customer details: customer number, name, salesperson, contact, ship via, phone, location, terms, email, and notes. The customer number field is pre-filled with the next available number but the user can override it. Salesperson, Ship Via, and Terms are dropdown selects. After saving, the new customer appears in the list.

**Why this priority**: Adding customers is essential but happens less frequently than browsing or editing.

**Independent Test**: Can be tested by clicking Add Customer, filling in details, saving, and confirming the customer appears in the list.

**Acceptance Scenarios**:

1. **Given** the user is on the Customers page, **When** they click "Add Customer", **Then** a slide-out drawer opens with a form pre-filled with the next available customer number.
2. **Given** the add form is open, **When** the user fills in at least the required fields (customer number, name) and saves, **Then** the new customer appears in the list.
3. **Given** the add form is open, **When** the user changes the pre-filled customer number to a valid unique number, **Then** the system accepts the override.
4. **Given** the add form is open, **When** the user enters a customer number that already exists, **Then** a validation error is shown.
5. **Given** the add form is open, **When** the user cancels, **Then** the form closes with no changes.

---

### User Story 4 - Soft-Delete a Customer (Priority: P2)

A user can archive (soft-delete) a customer, removing them from the default active list but keeping the data recoverable. The user can also view archived customers and restore them.

**Why this priority**: Deletion plumbing is needed early, but the recoverable approach means it's lower risk than a hard delete.

**Independent Test**: Can be tested by archiving a customer, confirming they disappear from the active list, switching to an "archived" view, and restoring them.

**Acceptance Scenarios**:

1. **Given** a customer is displayed in the list, **When** the user clicks archive, **Then** a confirmation prompt appears.
2. **Given** the user confirms the archive, **When** the action completes, **Then** the customer is removed from the active list.
3. **Given** the user toggles to view archived customers, **When** the archived list loads, **Then** previously archived customers are visible.
4. **Given** an archived customer is displayed, **When** the user clicks restore, **Then** the customer reappears in the active list.
5. **Given** a customer has existing orders, **When** the user archives them, **Then** the archive succeeds (orders are preserved, customer is just hidden from active views).

---

### Edge Cases

- What happens when a user tries to archive the last remaining active customer? Allow it — no minimum customer count.
- What happens when two users edit the same customer simultaneously? Last write wins — acceptable for a single-user system.
- How does search interact with the archived view? Search applies to whichever view is active — active or archived.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display all active customers in a searchable table.
- **FR-002**: Filterable columns (Name, Salesperson, Ship Via, Terms, Location, Active) MUST have an Excel-style filter dropdown showing distinct values with checkboxes. Non-filterable columns (Customer Number, Contact, Phone, Email, Notes) do not get filter dropdowns.
- **FR-012**: Multiple column filters MUST combine (AND logic) to narrow the displayed rows.
- **FR-013**: A "Clear Filters" button MUST reset all column filters and the search field in one action.
- **FR-014**: Columns with an active filter MUST show a visual indicator on the header.
- **FR-003**: System MUST allow editing of all customer fields except customer number via a slide-out drawer. Salesperson, Ship Via, and Terms MUST be dropdown selects; all other editable fields are free text.
- **FR-004**: System MUST validate that customer name is not empty on save.
- **FR-005**: System MUST allow creating a new customer with all customer fields; customer number and name are required. The customer number field MUST be pre-filled with the next available number but allow user override.
- **FR-006**: System MUST validate customer number uniqueness when adding a new customer.
- **FR-016**: Search MUST match across all text fields: name, contact, location, email, phone, and notes.
- **FR-007**: System MUST support soft-delete by setting the customer to inactive (archiving).
- **FR-008**: System MUST prompt for confirmation before archiving a customer.
- **FR-009**: System MUST allow viewing archived (inactive) customers separately.
- **FR-010**: System MUST allow restoring an archived customer to active status.
- **FR-015**: Customer number MUST be read-only after creation.

### Key Entities

- **Customer**: A buyer in the system. Key attributes: customer number (integer, unique), name, salesperson, contact name, default ship via method, phone, location (city/state), payment terms, email, active status, and notes. The current data model needs to be extended — it currently only has customer number, name, price type, and active status.
- **Store**: A ship-to location belonging to a customer. Visible in customer detail but not editable in this feature.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can find any customer by name within 5 seconds using search.
- **SC-002**: Users can edit and save a customer's details in under 15 seconds.
- **SC-003**: Users can add a new customer in under 30 seconds.
- **SC-004**: Archived customers are recoverable — no data is permanently lost through the archive action.
- **SC-005**: The Customers page loads the full customer list in under 2 seconds.

### Data Import

Two CSV import endpoints support initial data loading:
- `POST /api/v1/import/customer-info` — populates customer fields (salesperson, contact, ship via, phone, location, terms, email, notes, active status) from the Customer Info CSV. Matches by customer number, upserts.
- `POST /api/v1/import/price-categories` — sets price_type from the Customer Price Category CSV. Matches by customer name (case-insensitive).

These are operational endpoints for data seeding, not user-facing features.

## Assumptions

- This is a single-user system (Oregon Flowers staff), so concurrent editing conflicts are not a concern.
- The existing `is_active` field is sufficient for soft-delete. The Customer model needs new fields: salesperson, contact, ship_via, phone, location, terms, email, and notes.
- The `price_type` field is retained on the model (used by pricing) but is not a column in the customer management table since it doesn't appear in the customer info data.
- Store management (add/edit/delete stores) is out of scope for this feature.
- The Customers page uses the same app shell (sidebar, layout) as the Orders page.
- Price type values are a known set (e.g., Retail, Wholesale) but are entered as free text for now.
