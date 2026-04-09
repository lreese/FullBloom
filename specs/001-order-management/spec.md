# Feature Specification: Order Management

**Feature Branch**: `001-order-management`
**Created**: 2026-04-07
**Status**: Implemented
**Input**: User description: "Core order entry and storage system for Oregon Flowers, replacing Google Sheets + Apps Script"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a New Order (Priority: P1)

A salesperson receives a phone call or email from a customer wanting to place an order. The salesperson opens FullBloom, selects the customer and order date. The system loads that customer's pricing. The salesperson adds line items — choosing products from the catalog, with stems auto-priced from the customer's price list. They fill in order-level details (Ship Via, PO number, notes, fees) and submit the order. The order is persisted and assigned a unique OrderID.

**Why this priority**: This is the core workflow that replaces the Google Sheets "Add Order" tab. Without order creation, nothing else in the system has value.

**Independent Test**: A salesperson can create an order with multiple line items for an existing customer and confirm it was saved by retrieving it.

**Acceptance Scenarios**:

1. **Given** a salesperson selects customer "R & B Flowers" on date 2026-04-07, **When** they add 3 line items (Tulips Standard x10 - Dynasty, Callas LARGE x10, Blueberries x5) and submit, **Then** an order is created with a unique OrderID, all line items are stored with correct prices from R & B Flowers' price list, and the order is retrievable.
2. **Given** a salesperson is building an order, **When** they select a Sales Item, **Then** the Price per Stem is auto-populated from the customer's pricing. The salesperson MAY override the price manually; the original list price is preserved alongside the override.
3. **Given** a salesperson submits an order, **When** required fields are missing (no customer, no date, no line items), **Then** the system rejects the submission with a clear error message.
4. **Given** a salesperson submits a valid order, **When** the order is saved successfully, **Then** the system displays a success confirmation with the assigned OrderID and auto-clears the form for the next order.

---

### User Story 2 - Specify Custom Packing Instructions (Priority: P2)

A customer requests specific packing: certain flowers in specific boxes, with defined bunch sizes. The salesperson uses the Box Reference letter system to group line items into boxes, and optionally specifies Box Quantity, Bunches Per Box, and Stems Per Bunch for each line.

**Why this priority**: Custom packing is a common request and a key differentiator of the business. Without it, salespeople would need to communicate packing instructions outside the system, defeating the purpose of the tool.

**Independent Test**: A salesperson can create an order with custom packing references and verify the box groupings are stored correctly.

**Acceptance Scenarios**:

1. **Given** a salesperson is adding line items, **When** they assign Box Reference "A" to two different line items and "B" to a third, **Then** the stored order reflects that the first two items share a box and the third is in a separate box.
2. **Given** a line item has 3 boxes, **When** the salesperson enters Box Reference "A, B, C" for that line and another line references "C", **Then** the system stores the grouping so that the second line merges into box C of the first.
3. **Given** a salesperson specifies Stems Per Bunch = 5, Bunches Per Box = 4, Box Quantity = 2 on a line, **Then** these packing details are stored alongside the line item.

---

### User Story 3 - Apply Fees to an Order (Priority: P2)

A salesperson needs to apply various charges to an order: order-level fees (Box Charge, Holiday Charge, Special Charge, Freight Charge) and line-level fees (Item Fee %, Item Fee $). The system calculates the effective price per line item accounting for stacked fees.

**Why this priority**: Fee handling is part of every order and directly affects invoicing accuracy. Getting this wrong means incorrect pricing.

**Independent Test**: A salesperson can create an order with both order-level and line-level fees and verify the stored values and calculated totals are correct.

**Acceptance Scenarios**:

1. **Given** a line item with base Price per Stem = $1.50, Item Fee % = 10%, Item Fee $ = $0.05, **When** the order is submitted, **Then** the effective price per stem is stored as ($1.50 * 1.10) + $0.05 = $1.70.
2. **Given** an order with Box Charge = $2.00, Holiday Charge = 15%, Special Charge = $5.00, Freight Charge = $10.00, **When** the order is submitted, **Then** all four order-level fees are stored and associated with the order.
3. **Given** Freight Charge Included = Yes on the order, **When** the order is submitted, **Then** the Freight Charge field is stored as included (no additional charge applied).

---

### User Story 4 - Special Retail Orders with Sleeve and UPC (Priority: P3)

Some customers require retail-ready packing with sleeves and UPC codes. The salesperson marks a line item as "Special" and fills in sleeve and UPC details.

**Why this priority**: Special orders are a subset of total orders but represent higher-value retail customers. Can be added after core ordering works.

**Independent Test**: A salesperson can create an order with a special line item including sleeve and UPC and verify these details are stored.

**Acceptance Scenarios**:

1. **Given** a salesperson marks a line item as Special = Yes, **When** they enter sleeve = "Spring Bouquet" and UPC = "012345678901", **Then** these values are stored on the line item.
2. **Given** a line item is not marked as Special, **When** the order is submitted, **Then** sleeve and UPC fields are empty/null and no validation errors occur.

---

### User Story 5 - Import Reference Data from CSV (Priority: P1)

Before the system is usable, the product catalog (varieties, product lines, types), customer list, and customer-specific pricing must be loaded from the existing Google Sheets CSVs. This is a one-time (or periodic) seed operation, not ongoing sync.

**Why this priority**: Without reference data, salespeople cannot select products or see pricing. This is a prerequisite for US1.

**Independent Test**: An administrator can run the import, and the system reflects the correct product catalog, customer list, and per-customer pricing.

**Acceptance Scenarios**:

1. **Given** the Varieties CSV is imported, **When** a user queries the product catalog, **Then** the full hierarchy (Type → Product Line → Variety) is present, including Color, Flowering type, Can Replace, Show flag, Weekly Sales Category, and Item Group ID.
2. **Given** the PriceData CSV is imported, **When** a salesperson selects customer "R & B Flowers" and product "Tulips Standard x10", **Then** the system returns R & B Flowers' specific price (not the Retail default).
3. **Given** the Color by Variety CSV is imported, **When** varieties are displayed in the UI, **Then** each variety shows its associated hex color.

---

### Edge Cases

- What happens when a customer has no custom price for a product? Fall back to Retail Price.
- What happens when a salesperson enters a Color/Variety that does not exist in the catalog? Allow freeform entry (the field is informational, not a strict foreign key — customers describe colors loosely).
- What happens when Box Reference letters are inconsistent across line items (e.g., a reference to "C" but no line defines box C)? Store as-is; packing validation is a future feature.
- What happens when stems = 0 or negative? Reject with validation error.
- What happens when a potential duplicate is submitted (same customer + date + items)? Warn the salesperson but allow override. OrderID generation MUST still guarantee uniqueness regardless.
- Order editing/modification after submission is out of scope for this spec — planned as "Change Order" feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow creation of orders with one or more line items.
- **FR-002**: System MUST auto-populate Price per Stem from the customer's pricing when a Sales Item is selected. If no customer-specific price exists, MUST fall back to Retail Price. Salesperson MAY override the price on any line item; the system MUST store both the original list price and the override price.
- **FR-003**: System MUST generate a unique OrderID for each order and a unique RowID for each line item.
- **FR-004**: System MUST store order-level fields: Customer ID, Customer Name, Date, Ship Via, Price Type, Freight Charge Included, Box Charge, Holiday Charge (%), Special Charge ($), Freight Charge ($), Order Notes, PO Number, Salesperson Email.
- **FR-005**: System MUST store line-item fields: Sales Item, Assorted (Y/N), Color/Variety (freeform), Stems, Price per Stem, Item Fee %, Item Fee $, Store Name, Notes, Box Quantity, Bunches Per Box, Stems Per Bunch, Box Reference, Special (Y/N), Sleeve, UPC.
- **FR-006**: System MUST support importing product catalog from the Varieties CSV, preserving the Type → Product Line → Variety hierarchy. Re-imports MUST upsert: update existing records and insert new ones without deleting unmatched records.
- **FR-007**: System MUST support importing customer-specific pricing from the PriceData CSV, linking each price entry to a customer and Sales Item. Re-imports MUST upsert: update existing records and insert new ones without deleting unmatched records.
- **FR-008**: System MUST support importing variety display colors from the Color by Variety CSV.
- **FR-009**: System MUST validate that every order has a customer, date, and at least one line item before accepting it.
- **FR-010**: System MUST validate that stems quantity is a positive integer on every line item.
- **FR-013**: Line-level fee calculation MUST apply Item Fee % first (multiply base price), then add Item Fee $ on top. The fee formula MUST be explained via a tooltip on the fee fields.
- **FR-014**: The UI MUST provide tooltips on all fields where the purpose or behavior is not immediately obvious to a salesperson.
- **FR-015**: After successful order submission, the system MUST display a confirmation with the assigned OrderID and auto-clear the form for the next order entry.
- **FR-016**: System MUST warn the salesperson when submitting an order that matches an existing order on customer + date + identical line items, but MUST allow the salesperson to override and submit anyway.
- **FR-011**: System MUST store the Assorted flag per line item, indicating the customer accepts assorted colors rather than a specific variety.
- **FR-012**: System MUST persist the "Show" flag from the product catalog so the UI can filter which varieties are visible to salespeople during order entry.
- **FR-017**: The Color/Variety combobox MUST support adding new color/variety values on the fly. When a salesperson selects "Add new" and enters a value, the system MUST persist it to the database so it appears in future lookups for that variety.

### Key Entities

- **Customer**: Represents a flower shop or wholesaler. Has an ID, name, Price Type (Retail, etc.), and zero or more Store locations.
- **Store**: A specific branch or delivery location belonging to a Customer.
- **Product Catalog (Variety)**: Represents a specific flower variety within the hierarchy Type → Product Line → Variety. Carries attributes: Color, Flowering type, Can Replace, Show, Weekly Sales Category, Item Group ID, display hex color.
- **Sales Item**: A purchasable unit combining a Variety and a stems-per-order count (e.g., "Dahlia x5"). Links to pricing.
- **Customer Price**: A per-customer, per-Sales-Item price entry. Falls back to Retail Price when no customer-specific price exists.
- **Order**: A single order placed by a customer on a specific date. Contains order-level metadata and one or more Order Lines.
- **Order Line**: A single line item within an order — one product, quantity, price (with original list price preserved if overridden), optional packing and fee details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A salesperson can create a complete order (customer, date, 5+ line items with pricing, fees, and packing instructions) in under 3 minutes — comparable to or faster than the current Google Sheets workflow.
- **SC-002**: 100% of orders created through the system are retrievable with all fields intact (no data loss on submission).
- **SC-003**: Customer-specific pricing loads within 1 second of customer selection, even for customers with 200+ priced items.
- **SC-004**: CSV import processes the full product catalog (~56KB), pricing matrix (~968KB), and color mapping (~16KB) without errors or data truncation.
- **SC-005**: The system prevents submission of invalid orders (missing customer, missing date, zero line items, non-positive stems) 100% of the time.

## Clarifications

### Session 2026-04-07

- Q: Can salespeople override the auto-populated Price per Stem? → A: Yes, overridable — original list price preserved alongside the override.
- Q: How should re-importing CSVs handle existing data? → A: Upsert — update existing records, insert new ones, leave unmatched as-is. (Internal price management UI is planned as a future feature.)
- Q: Fee stacking order for line-level fees? → A: Percentage first (multiply base price), then flat fee added on top. Add tooltips to explain this. Tooltips SHOULD be used throughout the UI wherever field purpose is not immediately obvious.
- Q: What happens after order submission? → A: Success confirmation with OrderID displayed, form auto-clears for next order.
- Q: How to handle potential duplicate orders? → A: Warn if same customer + date + items exist, but allow override. Order editing is planned as a future feature ("Change Order" spec).

## Assumptions

- The existing Google Sheets data (Varieties, PriceData, Color by Variety CSVs) is the authoritative source for initial seed data. Format will not change for the import.
- Customer IDs from the existing system will be preserved (not regenerated) to maintain continuity.
- Ship Via will be a freeform text field initially; migrating to a managed route list is a future enhancement.
- Salesperson identity comes from their email address. Authentication/authorization (Clerk) is out of scope for this spec — the salesperson email is a stored field, not a logged-in user identity.
- Order modification (editing/canceling after submission) is explicitly out of scope — that is a separate spec ("Change Order").
- Inventory visibility (showing available stems during order entry) is out of scope for this spec.
- Reporting views (Today's Orders, Customer's Orders, All Orders) are out of scope for this spec.
- The frontend order entry form will be modeled after the existing Google Sheets "Add Order" tab layout — product list with prices on the left, order-level fields on the right — to minimize retraining.
- Price Type determines which price list loads for a customer; the current known types are "Retail" and potentially others (wholesale, etc.). The system MUST support multiple price types even if only Retail is used initially.
