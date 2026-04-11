# Frontend Design: Price Management

**Branch**: `004-price-management` | **Date**: 2026-04-11
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Overview

Price management adds three sub-pages under a Pricing sidebar dropdown: Sales Items, Price Lists, and Customer Prices. Sales Items and Customer Prices use the shared DataTable/TableToolbar/useTableState components. The Price List Matrix is a custom grid component with inline cell editing. Analytics are integrated as badges and summary bars within the existing views, not a separate page.

## Component Structure

```
apps/web/src/
├── components/
│   ├── pricing/
│   │   ├── SalesItemTable.tsx         # DataTable with dynamic price list columns
│   │   ├── SalesItemDrawer.tsx        # Drawer with price list section (set-one/edit-each)
│   │   ├── PriceListMatrix.tsx        # Custom matrix grid with inline cell editing
│   │   ├── PriceListDialog.tsx        # Add/rename price list dialog
│   │   ├── CustomerPriceGrid.tsx      # Customer-centric DataTable with inline override
│   │   ├── ItemPriceGrid.tsx          # Item-centric DataTable (all customers for one item)
│   │   ├── PricingSummaryBar.tsx      # Analytics: total items, override count, %
│   │   └── PriceAnomalyBadge.tsx      # ⚠ badge for >20% variance
│   └── layout/
│       └── Sidebar.tsx               # Add Pricing dropdown
├── pages/
│   ├── SalesItemsPage.tsx
│   ├── PriceListsPage.tsx
│   └── CustomerPricesPage.tsx
├── services/
│   └── api.ts                         # Extend with pricing endpoints
└── types/
    └── index.ts                       # PriceList, PriceListItem, CustomerPrice types
```

## Sales Items Page

### Table

Uses shared `DataTable` + `TableToolbar` + `useTableState`.

**Static columns**: Name, Variety, Stems, Retail Price.

**Dynamic columns**: One column per active PriceList, loaded from `GET /api/v1/price-lists`. Each shows the PriceListItem price for that sales item. Dynamic columns are appended after the static columns and included in the column visibility/reorder system.

**All columns** filterable and sortable (using the shared DataTable infrastructure).

**Checkboxes** for bulk selection. Bulk toolbar replaces main toolbar when rows selected. Bulk-updatable fields: retail price, variety, stems per order.

**Toolbar**: Title "Sales Items", search input, Active/Archived toggle, Columns popover, "+ Add Sales Item", Export CSV, Import CSV.

**Column prefs**: Stored in `localStorage` under `fullbloom:sales-item-columns`.

### Drawer

Sheet from the right (~520px desktop, full-screen mobile). Two-column sections following the established pattern.

**Identity section**:
| Left | Right |
|------|-------|
| Name * (text) | Variety (dropdown) |
| Stems per Order * (number) | Retail Price * (currency input) |

**Price Lists section**:

In **edit mode**: Each active price list shown as a row with name and an editable price input. Changes save individually via `PATCH /price-list-items/{price_list_id}/{sales_item_id}`.

In **add mode**: All price lists shown with checkboxes (all pre-selected by default). Two sub-modes toggled by a switch:
- **"Same price for all"** (default): Single price input. All selected lists get this price.
- **"Edit individually"**: One price input per selected list.

**Info**: Read-only customer prices count ("42 customer prices reference this item").

**Footer**: Archive bottom-left (with customer price count warning), Cancel + Save/Create bottom-right.

## Price List Matrix Page

### Custom Component

`PriceListMatrix` — NOT a DataTable. Built for the matrix editing pattern.

### Toolbar

Title "Price Lists", search input (filters rows by sales item name/variety), "+ Add Price List" button, Export CSV, Import CSV.

### Grid Layout

Compact zebra stripe (alternating row backgrounds). No variety grouping — flat list.

**Columns**:
- Sales Item (left-aligned, bold)
- Variety (left-aligned, muted)
- Stems (center, narrow)
- Retail (center, rose-tinted header — edits `SalesItem.retail_price` directly)
- One column per active PriceList (center, header shows name + customer count badge in muted text)

### Inline Cell Editing

- Click any price cell → cell becomes an `<input>` with rose border
- Type new price → blur or Enter saves
- Tab moves to next cell in the row
- Escape cancels edit, reverts to original value
- Brief flash/highlight on successful save

### Impact Preview

When saving a price list cell (not retail), a small tooltip appears:
- "42 customers on this list"
- "5 have overrides (unaffected)"
- "37 will see price change"
- Save / Cancel buttons

Fetched from `GET /price-list-items/{price_list_id}/{sales_item_id}/impact?new_price=X`.

### Add Price List

`PriceListDialog` — small dialog with:
- Name input (required, unique)
- "Copy prices from" dropdown: Retail or any existing price list
- Create button

Creates the PriceList + pre-populates all PriceListItem rows from the selected source.

### Price List Header Actions

Clicking a price list column header name opens a small popover:
- Rename (inline edit)
- Archive (with warning: "N customers on this list. Their prices will be converted to custom overrides.")

### Bulk Select

Checkboxes on rows. Bulk action toolbar: "Set [price list dropdown] = $ [price input] for N selected items." Apply button. Uses `PATCH /price-list-items/bulk`.

### Spread Indicator

On the far right of each row, a small muted badge showing price range across lists when spread is significant (e.g., "$0.55–$0.75"). Helps spot items with inconsistent pricing.

## Customer Prices Page

Two views toggled at the top via a segmented control: "By Customer" (default) and "By Item".

### Customer View

**Customer selector**: Searchable dropdown at the top showing customer name + price list badge (e.g., blue "Wholesale High" pill). Selecting a customer loads their pricing grid.

**DataTable** with shared components. Columns:
- Sales Item (text, filterable, sortable)
- Variety (text, filterable, sortable)
- Stems (number, filterable, sortable)
- List Price (currency, filterable, sortable — read-only, from the customer's assigned price list)
- Customer Price (currency, filterable, sortable — inline editable)

**List Price**: Read-only. Sourced from the customer's `price_list_id` → PriceListItem. For customers with no price list (NULL), shows `SalesItem.retail_price`.

**Customer Price**: Inline editable.
- Empty rows show "click to set" in faded italic
- Clicking opens an input with rose border, blur/Enter saves (creates/updates CustomerPrice)
- Rows with overrides get a rose background (`#fce7f3`)
- Small ✕ button on override rows to remove the override
- Anomaly badge: when customer price is >20% different from list price, shows ⚠ with percentage (e.g., "⚠ -50%")

**Summary bar** (`PricingSummaryBar`): Below the customer selector — "120 items · 15 custom prices · 12.5% customized"

**"Only Overrides" toggle**: Checkbox in the toolbar area, filters to rows with customer prices only.

**Bulk select**: Checkboxes on rows. Bulk actions: "Set custom price for all selected" (price input), "Remove overrides for all selected".

**Export/Import**: CSV buttons in toolbar.

### Item View

**Sales item selector**: Searchable dropdown at the top.

**DataTable** with columns:
- Customer Name (text, filterable, sortable)
- Price List (text, filterable, sortable — the customer's assigned list name)
- List Price (currency, filterable, sortable)
- Customer Price (currency, filterable, sortable — inline editable, same pattern as customer view)

Great for answering "who pays what for Tulips Standard x10?" and spotting anomalies across customers.

### Effective Price Tooltip

Hovering any Customer Price cell shows a tooltip with:
- Price list name
- List price
- Override amount (if set)

## Sidebar Navigation

Pricing item in the sidebar expands with icons:
- Tag icon → Sales Items (`/pricing/sales-items`)
- LayoutGrid icon → Price Lists (`/pricing/price-lists`)
- UserDollar icon → Customer Prices (`/pricing/customer-prices`)

Same dropdown pattern as Products — expandable in expanded mode, flyout popover in collapsed mode. `/pricing` redirects to `/pricing/sales-items`.

## Analytics (integrated)

All analytics are embedded in existing views, not a separate page:

- **PricingSummaryBar**: Total items, override count, percentage customized. Shown on Customer Prices page below customer selector.
- **PriceAnomalyBadge**: ⚠ badge with percentage on Customer Price cells >20% from list price. Rose outline on white background.
- **Effective price tooltip**: Hover Customer Price cell → popover with price list name, list price, override.
- **Price spread indicator**: Small muted badge on Price List Matrix rows showing min–max range when prices vary significantly across lists.

## Backend-Only Features (no UI in v1)

### Price Change Log

`PriceChangeLog` table silently captures every price mutation:
- Retail price changes (from matrix or drawer)
- Price list item changes (from matrix)
- Customer override creates/updates/deletes

Fields: timestamp, change_type, action, sales_item_id, price_list_id, customer_id, old_price, new_price. Append-only, no UI.

### Cost/Margin

`cost_price` field on SalesItem (nullable DECIMAL). API responses include `cost_price` and computed `margin` when cost_price is set. No UI — ready for future margin dashboards.

## State Management

**SalesItemsPage**: Local state with `useTableState`. Dynamic columns loaded from `/api/v1/price-lists` on mount. Standard refetch-after-mutation pattern.

**PriceListsPage**: Local state for the matrix data (loaded from `/api/v1/price-lists/matrix`), editing cell state, search term. Not using `useTableState` since the matrix is a custom component.

**CustomerPricesPage**: Local state for selected customer/item, view toggle, pricing grid data. The DataTable uses `useTableState` for filtering/sorting. Customer data loaded from `/api/v1/customers/{id}/pricing`, item data from `/api/v1/sales-items/{id}/customer-pricing`.

## Data Flow

```
SalesItemsPage mount
  → GET /sales-items (with price_list_prices)  → items[]
  → GET /price-lists  → dynamic column definitions

PriceListsPage mount
  → GET /price-lists/matrix  → { price_lists[], items[] with prices map }

CustomerPricesPage (customer view)
  → GET /customers (for selector)
  → User selects customer
  → GET /customers/{id}/pricing  → { customer, items[], summary }

CustomerPricesPage (item view)
  → GET /sales-items (for selector, just names)
  → User selects item
  → GET /sales-items/{id}/customer-pricing  → { sales_item, customers[] }

Matrix cell edit
  → PATCH /price-list-items/{plId}/{siId}  → refetch matrix row
  → GET /price-list-items/{plId}/{siId}/impact (before save)

Customer price override
  → POST /customers/{id}/prices  → refetch customer pricing
  → DELETE /customers/{id}/prices/{siId}  → refetch customer pricing

Add Price List
  → POST /price-lists { name, copy_from }  → refetch matrix

Import/Export
  → GET .../export → CSV download
  → POST .../import → file upload → refetch data
```
