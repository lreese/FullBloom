# Frontend Design: Product Management

**Branch**: `003-product-management` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Overview

Product management adds three sub-pages (Varieties, Product Lines, Colors) under a sidebar dropdown. Varieties is the primary view with a filterable table, bulk update toolbar, slide-out drawer with inline sales item management, and archive/restore. Product Lines and Colors are simpler CRUD pages using the same patterns. All UX follows the customer management conventions: shadcn/ui components, Tailwind CSS, Slate + Rose palette.

## Component Structure

```
apps/web/src/
├── components/
│   ├── product/
│   │   ├── VarietyTable.tsx           # Table with toolbar, filters, bulk select, checkboxes
│   │   ├── VarietyDrawer.tsx          # Drawer: variety edit/add with sales items section
│   │   ├── VarietyBulkToolbar.tsx     # Bulk action bar (replaces main toolbar when active)
│   │   ├── SalesItemList.tsx          # Inline sales item table within drawer
│   │   ├── ProductLineTable.tsx       # Product lines table
│   │   ├── ProductLineDrawer.tsx      # Product line edit/add drawer
│   │   ├── ColorTable.tsx             # Colors table with swatches
│   │   ├── ColorDrawer.tsx            # Color edit/add drawer
│   │   └── ProductArchiveDialog.tsx   # Shared archive confirmation (parameterized)
│   ├── common/
│   │   └── ColumnFilter.tsx           # Extracted from CustomerColumnFilter → reusable
│   └── layout/
│       └── Sidebar.tsx                # Modified: expandable dropdown for Products
├── pages/
│   ├── VarietiesPage.tsx              # Primary products view
│   ├── ProductLinesPage.tsx           # Product lines CRUD
│   └── ColorsPage.tsx                 # Colors CRUD
├── services/
│   └── api.ts                         # Extend with product endpoints
└── types/
    └── index.ts                       # Variety, ProductLine, VarietyColor, SalesItem types
```

## Sidebar Navigation

### Expanded Mode

The `navItems` array supports an optional `children` property. Products is the only item with children. Clicking "Products" toggles the dropdown open/closed with a chevron indicator. Sub-items appear indented below with small Lucide icons:
- Leaf icon → Varieties
- Folder icon → Product Lines
- Palette icon → Colors

Clicking a sub-item navigates to it. The Products parent stays highlighted when any sub-item is active. Other nav items (Orders, Customers, etc.) remain flat — no change to their behavior.

### Collapsed Mode (Icon Rail)

Clicking the Products icon opens a flyout Popover (shadcn/ui) anchored to the icon, showing the three sub-items as a small vertical menu. Clicking one navigates and closes the flyout. Other nav items work as before (direct click navigates).

### Routes

- `/products` → redirects to `/products/varieties`
- `/products/varieties` — Varieties page
- `/products/product-lines` — Product Lines page
- `/products/colors` — Colors page

## Varieties Table

### Toolbar

Same single-row pattern as customer management (left to right):
- **Page title**: "Varieties"
- **Search input**: Matches across name, color, product line, type, flowering type
- **Active/Archived toggle**: Segmented control
- **Clear Filters**: Resets all filters and search
- **Columns**: Drag-to-reorder + toggle visibility popover
- **+ Add Variety**: Rose pink button, right-aligned

### Columns

**Default visible (7)**: Name, Product Line, Type, Color, Show, Flowering Type, Weekly Sales Category.

**Hidden by default (4)**: Hex Color, Can Replace, Item Group ID, Item Group Description.

**Column prefs**: Stored in `localStorage` under `fullbloom:variety-columns`.

### Column Filters

**Filterable (7)**: Name, Product Line, Type, Color, Show, Flowering Type, Weekly Sales Category. Uses the shared `ColumnFilter` component (extracted from customer management's `CustomerColumnFilter`).

**Non-filterable (4)**: Hex Color, Can Replace, Item Group ID, Item Group Description.

**Filter logic**: Same as customer management — AND across columns, OR within a column.

### Checkboxes & Bulk Selection

Every row has a checkbox in the first column. The header checkbox toggles select all/none for the current filtered view. Clicking the checkbox toggles selection only — clicking elsewhere on the row opens the edit drawer.

**Selected rows**: Highlighted with light rose background (`#fce7f3`).

### Bulk Update Toolbar

When 1+ rows are selected, the main toolbar is **replaced** (not stacked) with a rose-tinted bulk action bar:

- **Selection count**: "5 selected" with a checkmark icon
- **Divider**
- **"Set"** label → **Field dropdown** (Show, Weekly Sales Category, Product Line, Color, Flowering Type) → **"to"** label → **Value dropdown** (populated dynamically: booleans show Yes/No, others show distinct values from dropdown-options endpoint) → **Apply** button (rose pink)
- **Clear Selection** button (right-aligned, muted gray)

Clicking Apply sends `PATCH /varieties/bulk` with `{ ids, field, value }` and refetches the list. Selection clears after successful apply.

### Footer

Shows count: "287 active varieties" or "5 of 287 selected" when rows are checked.

## Variety Drawer

### Pattern

shadcn/ui Sheet from the right, ~520px desktop, full-screen mobile.

### Header

- **Title**: "Edit Variety" (edit mode) or "New Variety" (add mode)
- **Subtitle**: "Product Line · Variety Name" in edit mode; none in add mode
- **Close X**: Far right

### Form Layout — Two-Column Sections

**Identity section**:
| Left | Right |
|------|-------|
| Name * (text) | Product Line (dropdown) |
| Color (text) | Hex Color (text input + native `<input type="color">` picker, synced bidirectionally) |

The hex color field has a text input for precise hex entry alongside a native color picker swatch. Changing either updates the other.

**Classification section**:
| Left | Right |
|------|-------|
| Flowering Type (dropdown) | Weekly Sales Category (dropdown) |
| Show in Orders (checkbox) | Can Replace (checkbox) |

On mobile, all sections collapse to single-column layout.

### Dropdown Fields

Product Line, Flowering Type, and Weekly Sales Category are `Select` components populated from `GET /api/v1/varieties/dropdown-options`. The Product Line dropdown shows values grouped by product type (e.g., "Tulips > Standard Tulips").

### Sales Items Section

A mini table within the drawer, below the variety form fields. Separated by a section header "Sales Items" with a "+ Add" link button on the right.

**Table columns**: Name, Stems, Retail $, Actions (edit pencil + archive trash icons).

**Existing rows**: Displayed as read-only text. Clicking the edit icon makes that row's fields editable inline (inputs replace text) with per-row Save/Cancel.

**Adding**: Clicking "+ Add" inserts a blank row at the bottom with rose-bordered inputs (name, stems, price) and Save/Cancel buttons. Save calls `POST /varieties/{id}/sales-items`.

**Archiving**: Clicking the trash icon on a sales item checks for customer prices via the `customer_prices_count` field. If > 0, shows a warning: "This sales item has N customer prices. Archive it?" On confirm, calls `POST /sales-items/{id}/archive`.

**Archived items**: A toggle link "Show archived (N)" below the table reveals soft-deleted sales items in a muted style with a Restore button on each.

**Customer price hint**: Small muted text below each sales item showing customer price count (e.g., "42 customer prices").

**Independence**: Variety fields save via the drawer's Save button. Sales items save per-item. These are independent operations.

### Footer

- **Bottom-left**: Archive button (rose outline) in edit mode. Restore button (green outline) for archived varieties.
- **Bottom-right**: Cancel (white outline) + Save Changes/Create Variety (rose pink filled).

### Archived Variety View

Same as customer management: all fields read-only, Restore button replaces Archive, no Save/Cancel footer.

## Product Lines Page

### Table

Same toolbar pattern: "Product Lines" title, search, Active/Archived toggle, Columns, "+ Add Product Line".

**Columns**: Name, Product Type, Variety Count, Active status. All filterable except Variety Count.

No checkboxes, no bulk update (unnecessary for ~50 rows).

### Drawer

Simple two-field form:
- Name * (text)
- Product Type (dropdown of existing product types)
- Read-only info: "Varieties in this line: N"

**Archive warning**: If the product line has varieties, the archive dialog shows: "This product line has N varieties. Archiving it will hide them from the active varieties list."

**Footer**: Archive bottom-left, Cancel + Save bottom-right.

## Colors Page

### Table

Same toolbar pattern: "Colors" title, search, Active/Archived toggle, "+ Add Color".

**Columns**: Variety Name, Color Name, color swatch (small circle rendered with the variety's hex_color).

No checkboxes, no bulk update.

### Drawer

Simple form:
- Variety (dropdown, searchable — uses the varieties list)
- Color Name (text)
- Note: "Hex colors are managed on the variety, not here."

**Soft-delete** via Archive/Restore, same pattern.

## Shared Components

### ColumnFilter (common)

Extracted from `CustomerColumnFilter` → `components/common/ColumnFilter.tsx`. Same props interface: `values`, `selected`, `onChange`. Used by both `CustomerTable` and `VarietyTable`. The old `CustomerColumnFilter` file is deleted; `CustomerTable` imports from `common/ColumnFilter`.

### ProductArchiveDialog

Same pattern as `CustomerArchiveDialog` but parameterized:
- `entityName`: "Albatros" / "Standard Tulips" / etc.
- `entityType`: "variety" / "product line" / "color" / "sales item"
- `warningText`: Optional additional warning (e.g., "This product line has 24 varieties...")
- `onConfirm` / `onCancel` callbacks

## State Management

Each page uses local React state (same pattern as `CustomersPage`):

**VarietiesPage**:
- `varieties: Variety[]`
- `dropdownOptions: VarietyDropdownOptions`
- `searchTerm`, `columnFilters`, `columnPrefs`
- `activeView: 'active' | 'archived'`
- `selectedIds: Set<string>` — for bulk selection
- `drawerState: { open, mode, variety? }`

**ProductLinesPage**: Same pattern minus bulk selection.

**ColorsPage**: Same pattern minus bulk selection and column controls.

**Mutations**: Refetch list after each mutation. No optimistic updates.

## Data Flow

```
VarietiesPage mount
  → GET /varieties?active=true  → varieties[]
  → GET /varieties/dropdown-options  → dropdownOptions

User types in search / toggles column filter
  → Client-side filter on varieties[]  → filteredVarieties[]

User clicks row (not checkbox)
  → GET /varieties/{id}  → open drawer with sales items

User clicks checkbox
  → Toggle id in selectedIds  → show/hide bulk toolbar

User applies bulk update
  → PATCH /varieties/bulk  → refetch list, clear selection

User saves variety edit
  → PATCH /varieties/{id}  → refetch list

User adds/edits/archives sales item (within drawer)
  → POST/PATCH/POST(archive) sales-items  → refetch variety detail

User toggles Active/Archived
  → GET /varieties?active={value}  → replace varieties[]
```
