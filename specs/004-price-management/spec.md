# Feature Specification: Price Management

**Feature Branch**: `004-price-management`  
**Created**: 2026-04-11  
**Status**: implemented  
**Input**: Price management with sales items, price lists, customer prices, and pricing analytics for salespeople.

## Clarifications

### Session 2026-04-11

- Q: How should Customer.price_type connect to the PriceList entity? → A: Replace free-text price_type with price_list_id FK. Migrate existing data by name matching.
- Q: When a new price list is created, should PriceListItem rows be pre-populated? → A: Yes, pre-populate all rows. The user selects which existing price list (or Retail) to copy prices from. Every price list has a row for every active sales item.
- Q: When a new sales item is created, how are price list rows created? → A: User selects which price lists to populate (all pre-selected by default). They can set one price for all selected lists, or edit each list's price individually. Selected lists get a PriceListItem at the chosen price(s).
- Q: Should Customer Prices support an item-centric view (all customers for one item)? → A: Yes, both views as a toggle — customer-centric (default) and item-centric.
- Q: Should the 20% anomaly threshold be configurable? → A: Fixed at 20% for now. Configurable threshold deferred to a future admin settings section.

## User Scenarios & Testing

### User Story 1 - Browse and Manage Sales Items (Priority: P1)

A salesperson navigates to Pricing → Sales Items and sees a table of all purchasable SKUs. Each row shows the sales item name, variety, stems per order, retail price, and a column for each active price list (e.g., Wholesale High, Wholesale Low, Local Plus) showing that list's price. They can search, filter, sort, add new sales items, edit existing ones (including all price list prices), and archive/restore. Same UX patterns as product management (DataTable, drawer, column filters, sorting).

**Why this priority**: Sales items are the foundation of all pricing — they must be manageable before price lists or customer prices can reference them.

**Independent Test**: Navigate to Sales Items, see the full list, add a new sales item, edit an existing one, archive and restore.

**Acceptance Scenarios**:

1. **Given** sales items exist, **When** the user navigates to Sales Items, **Then** they see a table with columns: name, variety name, stems per order, retail price, one column per price list (e.g., Wholesale High, Wholesale Low, Local Plus), and active status.
2. **Given** the sales items list is displayed, **When** the user clicks a row, **Then** a drawer opens for editing name, variety (dropdown), stems per order, retail price, and the price for each price list.
3. **Given** the user clicks "Add Sales Item", **When** they fill in name, variety, stems per order, and retail price, **Then** a price lists section appears with all lists pre-selected. The user can set one price for all lists or toggle to edit each list's price individually. The new sales item is created with PriceListItem rows for the selected lists at the chosen prices.
4. **Given** a sales item has customer prices, **When** the user views the drawer, **Then** they see a count of customer prices referencing this item.
5. **Given** a sales item has customer prices, **When** the user archives it, **Then** a warning shows the customer price count and asks for confirmation.

---

### User Story 2 - View and Manage Price Lists (Priority: P1)

A salesperson navigates to Pricing → Price Lists and sees a matrix-style view: rows are sales items, columns are price lists (Retail, Wholesale High, Wholesale Low, Local Plus). Each cell shows the price for that sales item on that list. The salesperson can edit prices inline, add new price lists, and rename existing ones.

**Why this priority**: Price lists define the base pricing tier for each customer — they're the backbone of the pricing model.

**Independent Test**: Navigate to Price Lists, see the matrix, edit a price cell, add a new price list.

**Acceptance Scenarios**:

1. **Given** the user navigates to Price Lists, **When** the page loads, **Then** they see a matrix with sales items as rows and price lists as columns, plus a "Retail" column showing the base retail price.
2. **Given** the matrix is displayed, **When** the user clicks a price cell, **Then** it becomes editable inline and they can type a new price.
3. **Given** the user changes a price and presses Enter or clicks away, **When** the save completes, **Then** the cell shows the updated price.
4. **Given** the user clicks "Add Price List", **When** they enter a name and select a source price list to copy from (or Retail), **Then** a new column appears in the matrix with all prices pre-populated from the selected source.
5. **Given** a price list has customers assigned to it, **When** the user views the price list header, **Then** they see the count of customers on that list.
6. **Given** the matrix is displayed, **When** the user searches, **Then** the rows filter to matching sales items.
7. **Given** a price in a list differs from retail, **When** the cell is displayed, **Then** it shows the price.
8. **Given** the user changes a price list price, **When** they save, **Then** a preview shows: customers on this list, customers with overrides (unaffected), and customers whose effective price will change. The user confirms or cancels.

---

### User Story 3 - View and Manage Customer Prices (Priority: P1)

A salesperson navigates to Pricing → Customer Prices. The page has two views, toggled at the top:

**Customer view (default)**: Select a customer from a searchable dropdown to see their complete pricing. For each sales item: the price list price (based on their assigned price list), the customer-specific override (if any), and the effective price. They can add, edit, and remove customer-specific overrides.

**Item view**: Select a sales item from a searchable dropdown to see what every customer pays for it. Each row shows: customer name, price list name, price list price, customer override (if any), and effective price. This view is ideal for spotting pricing anomalies across customers.

**Why this priority**: Customer-specific pricing is the most common daily task for salespeople — adjusting prices for individual accounts.

**Independent Test**: Select a customer, see their pricing grid, add a custom price override, edit it, remove it.

**Acceptance Scenarios**:

1. **Given** the user navigates to Customer Prices, **When** the page loads, **Then** they see a customer selector at the top.
2. **Given** a customer is selected, **When** the pricing grid loads, **Then** each row shows: sales item name, variety, stems, price list price, customer override (if any), and effective price.
3. **Given** a row has no customer override, **When** the effective price column is displayed, **Then** it shows the price list price in normal text.
4. **Given** a row has a customer override, **When** the effective price column is displayed, **Then** it is visually highlighted (e.g., bold or colored) to indicate custom pricing.
5. **Given** the user clicks "Set Custom Price" on a row, **When** they enter a price, **Then** a customer-specific override is created and the effective price updates.
6. **Given** a customer override exists, **When** the user clicks "Remove Override", **Then** the override is deleted and the effective price reverts to the price list price.
7. **Given** the user edits an existing override, **When** they change the price and save, **Then** the effective price updates immediately.
8. **Given** the pricing grid is displayed, **When** the user searches, **Then** rows filter to matching sales items.

---

### User Story 4 - Pricing Analytics Dashboard (Priority: P2)

A salesperson sees pricing insights on the Customer Prices page and the Price Lists page that help them manage prices intelligently. These are not a separate page but integrated hints and badges within the existing views.

**Why this priority**: Analytics help salespeople catch pricing anomalies and make informed decisions, but the core CRUD must work first.

**Independent Test**: Select a customer with custom pricing, see which items have overrides highlighted, see anomaly flags.

**Acceptance Scenarios**:

1. **Given** a customer is selected in Customer Prices, **When** the grid loads, **Then** a summary bar shows: total sales items, number with custom overrides, and percentage customized.
2. **Given** a customer's override price differs significantly from their price list (more than 20% variance), **When** the row is displayed, **Then** it shows a warning badge indicating unusual pricing.
3. **Given** the Price Lists matrix is displayed, **When** a sales item's prices vary significantly across lists, **Then** the row shows a "spread" indicator (e.g., min-max range).
4. **Given** a salesperson views a customer's pricing, **When** they hover over the effective price, **Then** a tooltip shows: price list name, price list price, override amount, and delta from retail.
5. **Given** the user views the Customer Prices page, **When** they toggle a "Show Only Overrides" filter, **Then** only rows with customer-specific pricing are displayed.
6. **Given** a variety has multiple sales items, **When** the user views the Price Lists matrix, **Then** the variety name groups related sales items visually.

---

### User Story 5 - Sidebar Navigation (Priority: P1)

The Pricing item in the sidebar expands to show sub-items: Sales Items, Price Lists, and Customer Prices. Same dropdown pattern as Products (expandable in expanded mode, flyout in collapsed mode).

**Why this priority**: Navigation is required for all other stories.

**Independent Test**: Click Pricing in sidebar, see dropdown, navigate between sub-pages.

**Acceptance Scenarios**:

1. **Given** the sidebar is visible, **When** the user clicks Pricing, **Then** a dropdown expands showing Sales Items, Price Lists, and Customer Prices.
2. **Given** the sidebar is collapsed, **When** the user clicks the Pricing icon, **Then** a flyout popover shows the sub-items.

---

### Edge Cases

- What happens when a customer has no price list assigned (price_type is empty or "Not Managed")? They see retail prices as their base, with any customer overrides applied on top.
- What happens when a price list is archived? Customers assigned to it have their price list prices converted to customer-specific overrides (preserving their current pricing), then their price_type is set to Retail. A warning shows the affected customer count and explains the conversion before confirming.
- What happens when a sales item is archived? Its customer prices are preserved but hidden. It disappears from the price list matrix. Restoring it brings everything back.
- What happens when a customer override is set to the same value as their price list price? Allow it — the override is explicit and won't change if the price list changes later.
- What happens when the retail price of a sales item changes? The Retail column in the price list matrix is a live editable view of the sales item's `retail_price` — editing it there updates the sales item directly. Retail is not a PriceList entity; it's always sourced from the sales item. Other price lists (Wholesale High, etc.) store their own absolute values and do not change when retail changes.

## Requirements

### Functional Requirements

**Sales Items**
- **FR-001**: System MUST display all sales items in a searchable, filterable, sortable table showing retail price and one column per active price list.
- **FR-002**: System MUST allow CRUD + archive/restore of sales items via a slide-out drawer.
- **FR-003**: Sales item name MUST be unique. Stems per order MUST be a positive integer. Retail price MUST be a valid positive number.
- **FR-004**: Archiving a sales item with customer prices MUST warn with the count and require confirmation.
- **FR-023**: System MUST support bulk selection of sales items with checkboxes and a bulk update toolbar (same pattern as variety bulk update). Bulk-updatable fields: retail price, variety, stems per order.

**Price Lists**
- **FR-005**: System MUST display price lists in a matrix view with sales items as rows and price lists as columns.
- **FR-006**: System MUST allow inline editing of prices in the matrix (click cell → edit → save).
- **FR-007**: System MUST allow creating new price lists by name.
- **FR-008**: System MUST allow renaming and archiving price lists.
- **FR-009**: Each price list column header MUST show the count of customers assigned to it.
- **FR-010**: Price list prices are stored as absolute values, independent of retail price.
- **FR-011**: The matrix MUST be searchable/filterable by sales item name and variety.
- **FR-024**: System MUST support bulk selection of rows in the price list matrix with a bulk action to set a price across all selected sales items for a chosen price list (e.g., "Set Wholesale High = $0.50 for all selected").

**Customer Prices**
- **FR-012**: System MUST allow selecting a customer to view their complete pricing grid.
- **FR-013**: The pricing grid MUST show: sales item, variety, stems, price list price, customer override (if any), and effective price.
- **FR-014**: System MUST allow adding, editing, and removing customer-specific price overrides.
- **FR-015**: Rows with customer overrides MUST be visually distinct from rows using price list defaults.
- **FR-016**: System MUST support a "Show Only Overrides" filter toggle.
- **FR-025**: System MUST support bulk selection of rows in the customer pricing grid with bulk actions: set custom price for all selected, remove overrides for all selected, or set all selected to a specific price list's price.
- **FR-026**: Customer Prices page MUST support an item-centric view: select a sales item to see all customers' prices for it, with columns for customer name, price list, list price, override, and effective price.

**Analytics**
- **FR-017**: Customer Prices page MUST show a summary bar with total items, override count, and percentage customized.
- **FR-018**: Rows with customer prices that differ more than 20% from the price list price MUST show a warning badge.
- **FR-019**: Price list matrix MUST show price spread indicators for sales items with significant variance across lists.
- **FR-020**: Effective price tooltip MUST show price list name, list price, and override amount (if any).
- **FR-027**: Before saving a price list price change, a preview MUST show: how many customers are on this list, how many have overrides (won't be affected), and the net impact (customers whose effective price will change).

**Export/Import**
- **FR-028**: System MUST allow exporting a customer's pricing grid to CSV (sales item, variety, stems, price list price, override, effective price).
- **FR-029**: System MUST allow exporting the price list matrix to CSV (sales item rows × price list columns).
- **FR-030**: System MUST allow importing price list prices from CSV (sales item name + price per column) to bulk-update a price list.
- **FR-031**: System MUST allow importing customer price overrides from CSV (sales item name + price) for a selected customer.

**Navigation**
- **FR-021**: The Pricing sidebar item MUST expand to show sub-navigation: Sales Items, Price Lists, Customer Prices.
- **FR-022**: The sidebar dropdown MUST work in both expanded and collapsed modes.

### Key Entities

- **SalesItem**: Purchasable SKU. Attributes: name (unique), variety (FK), stems per order, retail price, is_active. Already exists in data model.
- **PriceList**: Named pricing tier. Attributes: name (unique), is_active. New entity — currently price lists are implicit columns in a CSV. Needs to be a real table.
- **PriceListItem**: Per-sales-item price within a price list. Attributes: price list (FK), sales item (FK), price. New entity — this is the matrix cell data.
- **CustomerPrice**: Per-customer price override for a sales item. Attributes: customer (FK), sales item (FK), price. Already exists in data model.
- **Customer.price_list_id**: The customer's assigned price list (FK to PriceList). Replaces the current free-text `price_type` field. Migration backfills FK by matching existing price_type values to PriceList names.
- **PriceChangeLog**: Append-only audit trail for all price changes. Attributes: timestamp, change type (price_list_item, customer_override, retail_price), entity IDs (sales item, price list, customer as applicable), old price, new price, action (created, updated, deleted). Captures who changed what and when. No UI in v1 — data capture only for future reporting.
- **SalesItem.cost_price**: Per-stem cost (what Oregon Flowers pays the grower). Nullable, DECIMAL(10,2). Backend model and API only in v1 — no UI. Enables future margin calculations (margin = effective_price - cost_price). API responses will include `cost_price` and `margin` fields when cost_price is set.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Salespeople can view a customer's complete pricing (all sales items with effective prices) in under 3 seconds.
- **SC-002**: Salespeople can set or modify a customer price override in under 10 seconds.
- **SC-003**: Salespeople can identify all customers with unusual pricing (>20% variance from list) in under 5 seconds.
- **SC-004**: The price list matrix loads with all sales items and price lists in under 2 seconds.
- **SC-005**: Salespeople can update a price list price for a sales item in under 5 seconds (inline edit).
- **SC-006**: 100% of customer price overrides are visually distinguishable from price list defaults.

## Assumptions

- This follows the same UX patterns as product management: shared DataTable, TableToolbar, useTableState, slide-out drawers, archive/restore.
- The existing `CustomerPrice` model is sufficient for overrides — no schema changes needed there.
- The existing `SalesItem` model is sufficient — it already has `is_active` from the product management feature.
- Price lists need a new `PriceList` model and a `PriceListItem` join table to replace the implicit CSV-column approach.
- The `Customer.price_type` free-text field is replaced by `price_list_id` FK to PriceList. Existing data migrated by name matching. The customer management drawer's "Price Type" dropdown updates to reference PriceList records.
- The Price Lists matrix view is a different UI pattern from the standard DataTable — it needs a custom matrix/grid component.
- Data volume: ~120 sales items × ~5 price lists = ~600 price list items. ~164 customers × ~60 avg sales items = ~10,000 customer prices. Client-side rendering is fine at this scale.
- Bulk operations on customer prices (e.g., "set all prices for customer X to their price list defaults") are out of scope for v1 but may be added later.
