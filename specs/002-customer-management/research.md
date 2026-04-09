# Research: Customer Management

## R1: Client-side vs server-side filtering

**Decision**: Client-side filtering and search after initial full load.

**Rationale**: ~180 customers is a trivially small dataset. Loading all records upfront and filtering in the browser eliminates round-trips for every keystroke/filter change. The existing customer list endpoint already returns all active customers. Column filter dropdowns need the full dataset to compute distinct values anyway.

**Alternatives considered**:
- Server-side filtering with query params: unnecessary complexity for <200 rows. Would require building filter query logic on the backend and debouncing on the frontend.
- Virtual scrolling: unnecessary at this data volume.

## R2: Dropdown values for Salesperson, Terms, Ship Via

**Decision**: Derive dropdown options from the existing data in the database. The API returns distinct values for each field, and the frontend uses those as dropdown options. No hardcoded lookup tables.

**Rationale**: The CSV data shows these are semi-structured (e.g., Salesperson uses initials like JR, TM, MM; Terms has values like "30 days", "Pay Per P/S"). Deriving from data means new values added by editing a customer automatically appear in dropdowns for future edits. Avoids maintaining a separate reference table.

**Alternatives considered**:
- Separate lookup/reference tables: adds schema complexity for little benefit. These aren't truly constrained enums — they're soft conventions.
- Hardcoded frontend constants: brittle, requires code changes to add a new salesperson.

## R3: Slide-out drawer implementation

**Decision**: Use shadcn/ui's Sheet component (already in the project) for the slide-out drawer. It opens from the right, supports responsive sizing, and becomes a full-screen overlay on mobile via CSS.

**Rationale**: Sheet is already installed and used conceptually in the codebase. No new dependency. The component handles focus trapping, escape-to-close, and backdrop click dismissal.

**Alternatives considered**:
- Custom drawer: unnecessary when Sheet does exactly this.
- Dialog/modal: doesn't show the table behind it, losing context.

## R4: Excel-style column filter component

**Decision**: Build a custom `CustomerColumnFilter` component using shadcn/ui's Popover + checkboxes. Each filterable column header gets a small filter icon that opens a popover with checkboxes for each distinct value.

**Rationale**: No off-the-shelf shadcn/ui component does Excel-style column filtering. Building it from Popover + Checkbox is straightforward. The component receives the column's distinct values and selected values, and emits filter changes.

**Alternatives considered**:
- TanStack Table with built-in filter UI: adds a heavyweight dependency for a single table. The filtering logic itself is simple enough to implement directly.
- react-table: same concern — too heavy for this use case.

## R5: Next-available customer number

**Decision**: Backend endpoint `GET /api/v1/customers/next-number` returns `max(customer_number) + 10` (rounding up to next ten). The frontend pre-fills this on the Add Customer form.

**Rationale**: The existing numbering scheme uses multiples of 10 with some exceptions (e.g., 90, 120, 130). Using max + 10 rounded to the next ten maintains the pattern. The user can override to any unused number.

**Alternatives considered**:
- max + 1: breaks the existing spacing pattern.
- Random: confusing for users who think of customers by number.
- Frontend-only calculation: requires loading all customers just to compute a number; backend is cleaner.

## R6: Database migration strategy for new fields

**Decision**: Single Aerich migration adding 7 nullable fields to the `customers` table: `salesperson`, `contact_name`, `default_ship_via`, `phone`, `location`, `payment_terms`, `email`, `notes`. All nullable since existing rows won't have this data until the customer info CSV is imported.

**Rationale**: Making fields nullable avoids breaking existing data. The import service will be extended to populate these fields from the Customer Info CSV. Fields follow the constitution's DB naming conventions.

**Alternatives considered**:
- Non-nullable with defaults: adds artificial empty-string data. Nullable is more honest about missing information.
- Separate table for extended info: over-normalized for a 1:1 relationship. Flat is simpler.
