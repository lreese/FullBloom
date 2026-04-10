# Feature Specification: Product Management

**Feature Branch**: `003-product-management`  
**Created**: 2026-04-09  
**Status**: in-progress  
**Input**: Product management page with same UX patterns as customer management — list/search/filter, drawer edit/add, archive/restore, bulk update. Manage varieties, product lines, and colors. Sidebar dropdown under Products.

## Clarifications

### Session 2026-04-09

- Q: Should archive use the existing `show` field or a separate `is_active`? → A: Add `is_active` for archive/restore, keep `show` as a separate "visible in order forms" flag
- Q: How should bulk update values be specified? → A: Inline bulk toolbar with field picker → value picker → Apply button
- Q: Should colors use hard delete or soft-delete? → A: Soft-delete (colors have data quality issues with duplicates that need future cleanup work)
- Q: How should the sidebar dropdown work in collapsed icon-only mode? → A: Flyout popover appears next to the icon showing sub-items
- Q: Should sales items be manageable, and where? → A: Manage sales items inline in the variety drawer — add/edit/delete SKUs as a section below variety fields
- Q: What happens to customer prices when a sales item is deleted? → A: Soft-delete with warning — show count of customer prices, let user confirm. Customer prices preserved (hidden with inactive sales item).

## User Scenarios & Testing

### User Story 1 - Browse and Search Varieties (Priority: P1)

A user navigates to the Products section in the sidebar and sees a table of all varieties (the primary "product" entity). The table shows columns like name, product line, type, color, flowering type, show status, and weekly sales category. The user can search across text fields and apply Excel-style per-column filters (same pattern as customer management). A "Clear Filters" button resets all filters. Columns are toggleable and reorderable.

**Why this priority**: Visibility into the product catalog is the foundation for all other product management tasks.

**Independent Test**: Navigate to Products → Varieties, see the full list, use search and column filters to narrow results, toggle column visibility.

**Acceptance Scenarios**:

1. **Given** varieties exist in the system, **When** the user navigates to the Varieties page, **Then** they see a table of all active varieties sorted alphabetically by name.
2. **Given** the variety list is displayed, **When** the user types in the search field, **Then** the list filters to varieties matching the search term across text fields (name, color, product line, type, flowering type).
3. **Given** a filterable column header, **When** the user clicks the filter icon, **Then** a dropdown appears listing distinct values with checkboxes.
4. **Given** multiple column filters are active, **When** the user clicks "Clear Filters", **Then** all filters and search are reset.
5. **Given** the variety list is displayed, **When** the user opens the Columns popover, **Then** they can toggle visibility and drag-to-reorder columns.

---

### User Story 2 - Edit Variety Details (Priority: P1)

A user clicks on a variety row to open a slide-out drawer from the right containing an edit form. The form allows editing variety fields: name, product line, color, hex color, flowering type, can replace, show status, weekly sales category, item group ID, and item group description. Product line is a dropdown. Below the variety fields, a "Sales Items" section lists associated SKUs (name, stems per order, retail price) with the ability to add, edit, and delete sales items inline. Changes are saved when the user confirms.

**Why this priority**: Keeping product data accurate is essential for orders and pricing.

**Independent Test**: Click a variety, change its fields, save, confirm the changes persist.

**Acceptance Scenarios**:

1. **Given** the variety list is displayed, **When** the user clicks a variety row, **Then** a slide-out drawer opens with the variety's current details in an edit form.
2. **Given** the edit form is open, **When** the user changes any field and saves, **Then** the updated values appear in the table.
3. **Given** the edit form is open, **When** the user clicks cancel, **Then** changes are discarded.
4. **Given** the user clears the name field, **When** they attempt to save, **Then** a validation error is shown.
5. **Given** the edit form is open, **When** the user scrolls to the Sales Items section, **Then** they see a list of associated SKUs with name, stems per order, and retail price.
6. **Given** the Sales Items section is visible, **When** the user clicks "Add Sales Item", **Then** an inline row appears for entering name, stems per order, and retail price.
7. **Given** a sales item exists, **When** the user edits its fields and saves, **Then** the sales item is updated.
8. **Given** a sales item exists, **When** the user clicks delete on it and confirms, **Then** the sales item is removed.

---

### User Story 3 - Add a New Variety (Priority: P2)

A user clicks "Add Variety" to open the drawer in add mode. They fill in variety details including selecting a product line from a dropdown. After saving, the new variety appears in the list.

**Why this priority**: Adding new varieties happens when new flower types become available each season.

**Independent Test**: Click Add Variety, fill in details, save, confirm it appears in the list.

**Acceptance Scenarios**:

1. **Given** the user is on the Varieties page, **When** they click "Add Variety", **Then** a slide-out drawer opens with an empty form.
2. **Given** the add form is open, **When** the user fills in at least the required fields (name, product line) and saves, **Then** the new variety appears in the list.
3. **Given** the add form is open, **When** the user enters a variety name that already exists within the same product line, **Then** a validation error is shown.

---

### User Story 4 - Bulk Update Varieties (Priority: P2)

A user can select multiple varieties using checkboxes in the table, then apply a bulk action using an inline toolbar that appears above the table. The toolbar has two dropdowns: a "Field" picker (show, weekly sales category, product line, color, flowering type) and a "Value" picker (populated with valid values for the selected field), plus an "Apply" button.

**Why this priority**: Seasonal changes often require updating many varieties at once (e.g., hiding off-season varieties, recategorizing a group).

**Independent Test**: Select 5 varieties via checkboxes, choose "Set Show = No" from a bulk action menu, confirm all 5 are updated.

**Acceptance Scenarios**:

1. **Given** the variety list is displayed, **When** the user clicks a checkbox on a row, **Then** the row is selected and a bulk action toolbar appears.
2. **Given** multiple rows are selected, **When** the user clicks "Select All", **Then** all visible (filtered) rows are selected.
3. **Given** rows are selected, **When** the user chooses a bulk action (e.g., "Set Show = No") and confirms, **Then** all selected varieties are updated.
4. **Given** rows are selected, **When** the user clicks "Clear Selection", **Then** all selections are removed and the bulk toolbar disappears.
5. **Given** a bulk update completes, **When** the table refreshes, **Then** updated values are reflected in all affected rows.

---

### User Story 5 - Archive and Restore Varieties (Priority: P2)

A user can archive (soft-delete) a variety, removing it from the active list. Archived varieties are viewable via an Active/Archived toggle and can be restored.

**Why this priority**: Varieties go out of season or are discontinued but may return — soft-delete preserves the data.

**Independent Test**: Archive a variety, confirm it disappears from the active list, switch to archived view, restore it.

**Acceptance Scenarios**:

1. **Given** a variety is displayed, **When** the user clicks archive in the drawer, **Then** a confirmation prompt appears.
2. **Given** the user confirms, **When** the action completes, **Then** the variety is removed from the active list.
3. **Given** the user toggles to archived view, **When** the list loads, **Then** archived varieties are visible.
4. **Given** an archived variety is displayed, **When** the user clicks restore, **Then** the variety reappears in the active list.
5. **Given** a variety has associated sales items, **When** the user archives it, **Then** the archive succeeds (sales items are preserved).

---

### User Story 6 - Manage Product Lines (Priority: P3)

A user navigates to Products → Product Lines via the sidebar dropdown. They see a table of all product lines grouped by product type. They can add, edit, and archive product lines using the same drawer pattern.

**Why this priority**: Product lines organize varieties and change infrequently, but need to be manageable when new flower categories are introduced.

**Independent Test**: Navigate to Product Lines, see the list, add a new product line, edit an existing one.

**Acceptance Scenarios**:

1. **Given** the user navigates to Product Lines, **When** the page loads, **Then** they see a table of all product lines with columns: name, product type, and variety count.
2. **Given** the product line list is displayed, **When** the user clicks a row, **Then** a drawer opens for editing the product line name and product type.
3. **Given** the user clicks "Add Product Line", **When** they fill in name and select a product type, **Then** the new product line appears in the list.
4. **Given** a product line has no varieties, **When** the user archives it, **Then** the archive succeeds.
5. **Given** a product line has varieties, **When** the user attempts to archive it, **Then** a warning shows that associated varieties will also be hidden.

---

### User Story 7 - Manage Colors (Priority: P3)

A user navigates to Products → Colors via the sidebar dropdown. They see a table of all variety colors with the color name and hex code. They can add, edit, and archive (soft-delete) color entries. Colors are used as reference data when assigning colors to varieties.

**Why this priority**: Color management is supporting data that changes infrequently but must be accurate for variety display.

**Independent Test**: Navigate to Colors, see the list, add a new color, edit an existing one's hex code.

**Acceptance Scenarios**:

1. **Given** the user navigates to Colors, **When** the page loads, **Then** they see a table of colors with columns: variety name, color name, and a color swatch (hex preview).
2. **Given** the color list is displayed, **When** the user clicks a row, **Then** a drawer opens for editing the color name and hex code.
3. **Given** the user clicks "Add Color", **When** they select a variety and enter a color name and hex code, **Then** the new color appears in the list.

---

### User Story 8 - Manage Product Types (Priority: P3)

A user navigates to Products → Product Types via the sidebar dropdown. They see a simple table of all product types (e.g., Tulips, Lilies, Unknown) with the name and a count of product lines in each. They can add, edit, and archive product types using the same drawer pattern.

**Why this priority**: Product types are the top-level category and change very rarely, but need to be manageable when new flower categories are introduced.

**Independent Test**: Navigate to Product Types, see the list, add a new product type, edit an existing one.

**Acceptance Scenarios**:

1. **Given** the user navigates to Product Types, **When** the page loads, **Then** they see a table of all product types with columns: name and product line count.
2. **Given** the product type list is displayed, **When** the user clicks a row, **Then** a drawer opens for editing the product type name.
3. **Given** the user clicks "Add Product Type", **When** they enter a name and save, **Then** the new product type appears in the list.
4. **Given** a product type has no product lines, **When** the user archives it, **Then** the archive succeeds.
5. **Given** a product type has product lines, **When** the user attempts to archive it, **Then** a warning shows that associated product lines and their varieties will also be hidden.

---

### User Story 9 - Sidebar Navigation with Dropdown (Priority: P1)

The Products item in the sidebar expands to show sub-items: Varieties, Product Lines, Colors, and Product Types. Clicking Products itself navigates to Varieties (the default). The dropdown is collapsible.

**Why this priority**: Navigation structure is required for all other stories to be accessible.

**Independent Test**: Click Products in sidebar, see dropdown with Varieties/Product Lines/Colors, navigate between them.

**Acceptance Scenarios**:

1. **Given** the sidebar is visible, **When** the user clicks Products, **Then** a dropdown expands showing Varieties, Product Lines, Colors, and Product Types.
2. **Given** the dropdown is expanded, **When** the user clicks Varieties, **Then** they navigate to the Varieties page.
3. **Given** the dropdown is expanded, **When** the user clicks Product Lines, **Then** they navigate to the Product Lines page.
4. **Given** the dropdown is expanded, **When** the user clicks Colors, **Then** they navigate to the Colors page.
5. **Given** the dropdown is expanded, **When** the user clicks Product Types, **Then** they navigate to the Product Types page.
6. **Given** the sidebar is collapsed to icon-only mode, **When** the user clicks the Products icon, **Then** a flyout popover appears next to the icon showing all sub-items.

---

### Edge Cases

- What happens when a variety name is duplicated across different product lines? Allowed — uniqueness is per product line, not global.
- What happens when bulk update is applied to 0 selected rows? The bulk action button is disabled when nothing is selected.
- What happens when a product type has no product lines? It still appears in the product type list but shows 0 product lines.
- What happens when the user bulk archives varieties that have sales items with customer prices? Archive succeeds — pricing data is preserved, varieties are just hidden.
- What happens when a soft-deleted sales item is restored? It reappears in the drawer and its customer prices become active again.

## Requirements

### Functional Requirements

**Varieties (primary view)**
- **FR-001**: System MUST display all active varieties in a searchable, filterable table.
- **FR-002**: Filterable columns MUST have Excel-style filter dropdowns showing distinct values with checkboxes.
- **FR-003**: System MUST allow editing variety details via a slide-out drawer. Product line is a dropdown select.
- **FR-004**: System MUST validate that variety name is not empty and is unique within its product line.
- **FR-005**: System MUST allow creating new varieties with all fields; name and product line are required.
- **FR-006**: System MUST support soft-delete (archive) of varieties using an `is_active` flag (separate from the `show` flag, which controls order form visibility).
- **FR-007**: System MUST allow viewing archived varieties separately and restoring them.
- **FR-008**: System MUST support bulk selection via row checkboxes with a "Select All" option.
- **FR-009**: System MUST support bulk update of selected varieties for fields: show status, weekly sales category, product line, color, and flowering type.
- **FR-010**: A "Clear Filters" button MUST reset all column filters and the search field.
- **FR-011**: Columns MUST be toggleable and drag-to-reorderable, with preferences persisted locally.
- **FR-012**: Search MUST match across all text fields regardless of column visibility.

**Product Lines**
- **FR-013**: System MUST display all product lines in a table with name, product type, and variety count.
- **FR-014**: System MUST allow adding, editing, and archiving product lines via a drawer.
- **FR-015**: Archiving a product line with varieties MUST warn the user that associated varieties will also be hidden.

**Colors**
- **FR-016**: System MUST display variety colors in a table with variety name, color name, and hex color swatch.
- **FR-017**: System MUST allow adding, editing, and archiving (soft-delete) color entries via a drawer.

**Sales Items (inline in variety drawer)**
- **FR-020**: The variety edit drawer MUST show a "Sales Items" section listing associated SKUs (name, stems per order, retail price).
- **FR-021**: System MUST allow adding new sales items to a variety from within the drawer.
- **FR-022**: System MUST allow editing sales item fields (name, stems per order, retail price) inline.
- **FR-023**: System MUST soft-delete sales items. If the sales item has customer prices, a warning MUST show the count and require confirmation. Customer prices are preserved (hidden with the inactive sales item).
- **FR-024**: System MUST validate that sales item name is not empty and stems per order is a positive integer.
- **FR-025**: System MUST allow viewing and restoring soft-deleted sales items within the variety drawer.

**Product Types**
- **FR-026**: System MUST display all product types in a table with name and product line count.
- **FR-027**: System MUST allow adding, editing, and archiving product types via a drawer.
- **FR-028**: Archiving a product type with product lines MUST warn the user that associated product lines and their varieties will also be hidden.
- **FR-029**: Product type name MUST be unique.

**Navigation**
- **FR-018**: The Products sidebar item MUST expand to show sub-navigation: Varieties, Product Lines, Colors, and Product Types.
- **FR-019**: The sidebar dropdown MUST work in both expanded and collapsed sidebar modes, using a flyout popover when collapsed.

### Key Entities

- **ProductType**: Top-level category (e.g., Tulips, Cut Flowers). Attributes: name. Exists in data model.
- **ProductLine**: Category within a type (e.g., Standard Tulips, Novelty Tulips). Attributes: name, product type. Exists in data model.
- **Variety**: The primary product entity. Attributes: name, product line, color, hex color, flowering type, can replace, show (order form visibility), is_active (archive flag, new field), weekly sales category, item group ID, item group description. Exists in data model — needs `is_active` field added.
- **SalesItem**: Purchasable SKU tied to a variety. Attributes: name, stems per order, retail price, is_active (soft-delete, new field). Managed inline within the variety drawer (add/edit/soft-delete/restore). Customer prices referencing a soft-deleted sales item are preserved but hidden.
- **VarietyColor**: Color lookup for a variety. Attributes: variety, color name, is_active (soft-delete, new field). Exists in data model — needs `is_active` field added.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can find any variety by name within 5 seconds using search.
- **SC-002**: Users can edit and save a variety's details in under 15 seconds.
- **SC-003**: Users can bulk update 20+ varieties in under 30 seconds.
- **SC-004**: Archived varieties are recoverable — no data is permanently lost.
- **SC-005**: The Varieties page loads the full catalog in under 2 seconds.
- **SC-006**: Users can navigate between Varieties, Product Lines, Colors, and Product Types within 1 click from the sidebar.

## Assumptions

- This follows the same UX patterns established in 002-customer-management: slide-out drawer, Excel-style column filters, column visibility/reorder, Active/Archived toggle, client-side filtering.
- The Variety model gets a new `is_active` field for archive/restore. The existing `show` field is preserved as a separate flag controlling order form visibility.
- SalesItem management (add/edit/delete SKUs) is in scope, managed inline within the variety drawer.
- VarietyColor gets a new `is_active` field for soft-delete. Color data has known duplication issues from free-text entry — cleanup is deferred to a separate task.
- Product types are a small, stable set (~3 currently: Tulips, Lilies, Unknown) but get their own management page under Products for CRUD and archive.
- The existing data (~300 varieties, ~50 product lines, ~10 product types) is small enough for client-side filtering.
- Bulk update applies to the currently filtered/visible set when "Select All" is used, not the entire database.
