# Research: Product Management

## R1: Soft-delete strategy — is_active vs show

**Decision**: Add `is_active` (boolean, default true) to Variety, SalesItem, and VarietyColor. Keep existing `show` field on Variety as a separate flag for order form visibility.

**Rationale**: `show` controls whether a variety appears in the order creation flow (seasonal toggling). `is_active` controls whether the record is visible in management views (archive/restore). These are independent concerns — a variety can be active (manageable) but hidden from orders (`show=false`), or archived entirely (`is_active=false`).

**Alternatives considered**:
- Using `show` for both purposes: conflates seasonal hiding with actual archiving. Users lose the ability to distinguish "off-season" from "discontinued."
- Adding a `status` enum: over-engineered for two independent boolean flags.

## R2: Bulk update approach

**Decision**: Single PATCH endpoint `PATCH /api/v1/varieties/bulk` accepting `{ ids: [...], field: "...", value: "..." }`. Frontend sends the selected IDs, field name, and new value. Backend validates the field is in the allowed set and applies the update.

**Rationale**: A generic field+value approach is simpler than separate endpoints per field. The allowed fields list (show, weekly_sales_category, product_line_id, color, flowering_type) is validated server-side.

**Alternatives considered**:
- Separate endpoints per bulk field: too many endpoints for the same pattern.
- Full object PATCH per row: sends unnecessary data for a single-field bulk change.

## R3: Sidebar dropdown implementation

**Decision**: Modify the Sidebar component to support a `children` array on nav items. Items with children render an expandable section (when sidebar is expanded) or a flyout Popover (when collapsed). Only Products gets children initially; other nav items remain flat.

**Rationale**: The sidebar already uses a `navItems` array with `label`, `icon`, `href`. Adding an optional `children` array is a minimal, backward-compatible change. Flyout uses the existing shadcn/ui Popover component.

**Alternatives considered**:
- Separate sidebar component for hierarchical nav: over-engineered for one dropdown.
- Nested routes without sidebar changes: users can't navigate to sub-pages without the sidebar showing them.

## R4: Reusable column filter component

**Decision**: Extract `CustomerColumnFilter` to `components/common/ColumnFilter` and use it in both CustomerTable and VarietyTable. Same props interface, just moved.

**Rationale**: Identical functionality needed in both tables. Moving it to common avoids duplication and makes it available for future tables (orders, pricing).

**Alternatives considered**:
- Keep separate copies: code duplication with no benefit.
- Install a table library (TanStack Table): heavyweight for our filtering needs.

## R5: Sales item inline management pattern

**Decision**: The variety drawer's "Sales Items" section uses an inline editable list pattern. Each sales item is a row with editable fields (name, stems per order, retail price). New items are added via an "Add Sales Item" button that inserts a blank row. Save/delete are per-item, not batched with the variety save.

**Rationale**: Per-item saves avoid the complexity of tracking dirty state across a nested form. The variety fields save independently from sales items. This matches how the user thinks about it — editing the variety vs managing its SKUs.

**Alternatives considered**:
- Batch save (variety + all sales items in one request): requires complex state tracking for adds/edits/deletes in a single transaction. Error handling becomes difficult.
- Separate page/drawer for sales items: breaks the "variety is the primary context" mental model.

## R6: ProductLine and VarietyColor soft-delete

**Decision**: Add `is_active` to both ProductLine and VarietyColor. ProductLine archive cascades visibility (archived product line's varieties are filtered from active views but not individually archived). VarietyColor uses standard soft-delete.

**Rationale**: ProductLine archive should hide associated varieties without changing their individual `is_active` flag — when the product line is restored, all its varieties reappear. This is a filter-based cascade, not a data mutation cascade.

**Alternatives considered**:
- Hard cascade (set is_active=false on all child varieties): destructive and hard to undo cleanly.
- Block archive if children exist: too restrictive for seasonal management.
