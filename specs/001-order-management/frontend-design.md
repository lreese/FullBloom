# Frontend Design: Order Management

**Date**: 2026-04-08
**Feature**: 001-order-management
**Status**: Approved

## Overview

The order entry UI replaces the Google Sheets "Add Order" tab. It is a single-page form inside
the FullBloom app shell (icon rail sidebar + full-width content area) using the Slate + Rose
color palette defined in the constitution.

## App Shell

Per constitution (v1.1.0):
- Dark forest green icon rail on the left (collapsible to labels on hover/click, hamburger on
  mobile)
- Navigation items: Orders, Customers, Products, Pricing, Import, Settings
- "FB" monogram in white at the top of the rail
- Full-width cream content area to the right

## Order Form Layout

The form flows vertically in the content area:

### 1. Header Row
- Page title: "New Order" (slate blue, left-aligned)
- Action buttons right-aligned: "Browse Products" (outlined), "Submit Order" (rose pink filled)

### 2. Order Context Row
Four fields in a horizontal row:
- **Customer** (flex: 2) — searchable dropdown, shows customer name + ID badge on selection.
  Selecting a customer loads their pricing into the product picker and line items.
- **Store / Location** (flex: 1) — dropdown filtered to stores belonging to the selected
  customer. Order-level field, not per-line.
- **Date** (flex: 1) — date picker, defaults to today.
- **Ship Via** (flex: 1) — freeform text field (future: managed route dropdown).

### 3. Line Item Table
White card with rounded corners. Slate blue header row.

**Visible columns (always shown):**

| Column | Width | Notes |
|--------|-------|-------|
| Expand chevron | 20px | ▶ collapsed, ▼ expanded |
| Sales Item | flex: 3 | Product name from catalog |
| Color / Variety | flex: 2 | Searchable combobox (see below) |
| Stems | 65px | Positive integer, right-aligned |
| Price/Stem | 80px | Auto-populated, manually overridable |
| Effective | 80px | Calculated price after fees, rose-colored if different from base |
| Box | 55px | Color-coded letter badges (see Box Reference below) |
| Delete | 24px | × button in rose |

**Expanded sub-row (progressive disclosure):**
Clicking the chevron expands a sub-row below the line with grouped fields:
- **Fees**: Item Fee %, Item Fee $
- **Packing Details**: Box Qty, Bunches/Box, Stems/Bunch
- **Special**: Toggle (Y/N). When Yes, reveals Sleeve and UPC fields.
- **Notes**: Freeform text for the line item.

Background of expanded rows is slightly warm (`#faf8f6`) to distinguish from collapsed rows.

**Adding line items — dual mode:**
1. **Inline**: Bottom row shows "+ Type to search or click Browse Products". Typing opens a
   searchable dropdown matching on product name + type + product line. Selecting a product adds
   a new row with price auto-populated from customer pricing (or retail fallback).
2. **Product Picker Panel**: "Browse Products" button opens a side panel from the left that
   pushes the form narrower. Panel shows products grouped by type (collapsible groups), with
   hex color swatches and customer-specific prices. Clicking a product adds it as a line item.
   Search bar at top. Panel stays open for multiple selections. X button to dismiss. On mobile,
   opens as full-screen overlay.

### 4. Box Reference System
- Box Reference is a **visible column on the main row** (not buried in expanded details).
- Displayed as color-coded letter badges: e.g., blue "A", pink "B".
- Lines sharing the same letter get the same badge color, making groupings scannable at a glance.
- A line with multiple boxes shows multiple badges: "A" "B".
- **Box groupings legend** appears below the table summarizing which products share each box
  (e.g., "A: Tulips + Callas", "B: Callas + Blueberries").
- Badge colors cycle through a predefined set: blue (`#dbeafe`), pink (`#fce7f3`), green
  (`#e8f0e8`), amber (`#fef3c7`), purple (`#ede9fe`), etc.

### 5. Color/Variety Combobox
- Searchable dropdown populated with known colors/varieties for the selected Sales Item's
  variety from the database.
- Typing filters the list.
- **"Add new" option** at the bottom of the dropdown. Selecting it creates the color/variety
  in the database and selects it on the line item. This allows salespeople to expand the
  color catalog on the fly without leaving the order form.
- Freeform text is still accepted — if the salesperson types a value that doesn't match any
  existing entry and doesn't use "Add new", it stores as-is (informational field).

### 6. Order-Level Cards
Two cards side by side below the line item table:

**Order Fees card:**
- 2×2 grid: Box Charge ($), Holiday Charge (%), Special Charge ($), Freight Charge ($)
- Freight Charge Included toggle (rose-colored when on)
- All fields have tooltips explaining their purpose

**Order Details card:**
- PO Number
- Salesperson Email
- Order Notes (multi-line textarea)

### 7. Submit Behavior
- "Submit Order" button disabled during submission (prevents double-click).
- On success: confirmation toast/banner with assigned OrderID (e.g., "ORD-20260408-001").
  Form auto-clears for the next order.
- On duplicate warning (409): modal dialog explaining the match, with "Submit Anyway" and
  "Cancel" buttons. "Submit Anyway" resubmits with `force_duplicate=true`.
- On validation error (422): inline error messages on the offending fields, form stays
  populated.

## Responsive Behavior

**Desktop (>1024px):**
- Icon rail visible. Content area with max-width container (~1200px centered).
- Product picker as push panel (~220px wide).

**Tablet (768–1024px):**
- Icon rail visible. Content stretches full width.
- Product picker as push panel.
- Order context row wraps to 2×2 grid.

**Mobile (<768px):**
- Icon rail hidden, hamburger menu in top bar.
- Content full width, no max-width constraint.
- Product picker as full-screen overlay.
- Order context row stacks vertically (one field per row).
- Line item table horizontal-scrolls if needed, or columns collapse to essentials
  (Sales Item, Stems, Price) with all other data in the expanded sub-row.
- Order-level cards stack vertically.

## Tooltips

Per FR-014, tooltips MUST appear on all non-obvious fields. Key tooltips:
- **Item Fee %**: "Percentage applied to base price before flat fee is added"
- **Item Fee $**: "Flat dollar amount added after percentage fee"
- **Effective**: "Calculated as (Price × (1 + Fee%)) + Fee$"
- **Box Reference**: "Assign letters to group line items into the same box. Lines sharing a
  letter are packed together."
- **Assorted**: "Customer accepts any available colors rather than a specific variety"
- **Freight Charge Included**: "When on, freight is already included in pricing — no additional
  charge applied"

## New Functional Requirement

**FR-017**: The Color/Variety combobox MUST support adding new color/variety values on the fly.
When a salesperson selects "Add new" and enters a value, the system MUST persist it to the
database so it appears in future lookups for that variety.
