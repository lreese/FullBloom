# Frontend Design: Customer Management

**Branch**: `002-customer-management` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Overview

A customer management page within the existing FullBloom web app. Displays all customers in a filterable, searchable table with Excel-style column filters. Users can add, edit (via slide-out drawer), archive (soft-delete), and restore customers. All decisions follow the constitution: shadcn/ui components, Tailwind CSS, Slate + Rose palette, existing app shell.

## Component Structure

```
apps/web/src/
├── components/customer/
│   ├── CustomerTable.tsx           # Table with toolbar, filters, search, column controls
│   ├── CustomerColumnFilter.tsx    # Popover with checkboxes per filterable column
│   ├── CustomerDrawer.tsx          # Sheet-based form (edit + add modes)
│   └── CustomerArchiveDialog.tsx   # Confirmation dialog before archiving
├── pages/
│   └── CustomersPage.tsx           # Page component, wired into sidebar router
├── services/
│   └── api.ts                      # Extend with customer endpoints
└── types/
    └── index.ts                    # Extend Customer type with new fields
```

## Table Design

### Toolbar

Single horizontal row containing (left to right):
- **Page title**: "Customers" — slate blue, bold
- **Search input**: Placeholder "Search all fields...", magnifying glass icon. Matches across all text fields (name, contact, location, email, phone, notes) regardless of column visibility. Client-side, instant as-you-type.
- **Active/Archived toggle**: Segmented control. Active is the default. Switching views resets filters and search.
- **Clear Filters**: Text button, muted gray. Resets all column filters and search field.
- **Columns**: Button that opens a popover for toggling column visibility and drag-to-reorder.
- **Add Customer**: Rose pink button, right-aligned. Opens the drawer in add mode.

On mobile, the toolbar wraps naturally across rows.

### Columns

**Default visible (6)**: Customer Number, Name, Salesperson, Ship Via, Location, Terms.

**Hidden by default (4)**: Contact, Phone, Email, Notes. Togglable via the Columns popover.

**User customization**: Column visibility and order are stored in `localStorage` so preferences persist across reloads. Users can drag to reorder and toggle visibility. No backend storage needed for a single-user system.

### Column Filters

**Filterable columns (6)**: Name, Salesperson, Ship Via, Terms, Location, Active status. Each has a small triangle icon in the header.

**Non-filterable columns (4)**: Customer Number, Contact, Phone, Email, Notes — no filter icon.

**Filter icon states**: Muted gray when inactive, rose pink when a filter is active.

**Filter popover**: Clicking the filter icon opens a `Popover` (shadcn/ui) with checkboxes for each distinct value in that column. Select/deselect to filter. "Select All" / "Clear" shortcuts at the top.

**Filter logic**: AND across columns, OR within a column. Filters + search combine with AND. "Clear Filters" resets everything.

### Table Rows

- Hover highlights the row (subtle warm gray)
- Click anywhere on a row opens the edit drawer
- Footer shows count: "172 active customers" or "8 archived customers"

## Drawer Design

### Pattern

shadcn/ui `Sheet` component, opens from the right. ~520px wide on desktop (table partially visible behind). Full-screen overlay on mobile.

### Header

- **Title**: "Edit Customer" (edit mode) or "New Customer" (add mode)
- **Subtitle**: "#260 · Baisch & Skinner" in edit mode; no subtitle in add mode
- **Archive button**: Rose outline style, positioned in the header (edit mode only). Replaced with "Restore" button when viewing an archived customer.
- **Close X**: Far right

### Form Layout — Two-Column Sections

**Identity section**:
| Left | Right |
|------|-------|
| Customer Number (read-only in edit, editable + pre-filled in add) | Salesperson (dropdown) |
| Name * (full width, spans both columns) | |

**Contact section**:
| Left | Right |
|------|-------|
| Contact Name (text) | Phone (text) |
| Email (full width) | |

**Shipping & Billing section**:
| Left | Right |
|------|-------|
| Ship Via (dropdown) | Terms (dropdown) |
| Location (full width) | |

**Notes section**:
- Full-width textarea, resizable vertically

On mobile, all sections collapse to single-column layout.

### Dropdown Fields

Salesperson, Ship Via, and Terms are `Select` components populated from `GET /api/v1/customers/dropdown-options`. Values derived from existing data — no hardcoded lists. The dropdown options endpoint is refetched after any customer create/update, so if a user enters a new value via direct DB or import, it appears automatically.

### Footer

Sticky at the bottom of the drawer. Right-aligned buttons:
- **Cancel**: White with gray border
- **Save Changes** (edit) / **Create Customer** (add): Rose pink filled

### Validation

- **Name**: Required. Inline error if empty on save attempt.
- **Customer Number** (add mode only): Required, must be unique. Pre-filled with `GET /api/v1/customers/next-number` (max + 10, rounded to next ten). User can override. 422 from API surfaces as inline error.

### Archived Customer View

When viewing an archived customer in the drawer:
- All form fields are **read-only** (no editing archived customers)
- "Restore" button replaces "Archive" in the header
- No Save/Cancel footer — just Close

## Archive & Restore Flow

### Archive

1. User clicks "Archive" in drawer header
2. `CustomerArchiveDialog` appears: "Archive {name}? They will be hidden from the active list but can be restored later."
3. On confirm → `POST /customers/{id}/archive`
4. Drawer closes, customer removed from active list, count updates

### Restore

1. User switches to Archived view via toggle
2. Clicks an archived customer row → drawer opens (read-only mode)
3. Clicks "Restore" in drawer header
4. `POST /customers/{id}/restore` → customer moves to active list
5. Drawer closes, count updates

### View Switching

Active/Archived segmented toggle in toolbar. Switching views:
- Resets all filters and search
- Fetches the appropriate list (`?active=true` or `?active=false`)

## State Management

No global store. Local React state in `CustomersPage`:

- `customers: Customer[]` — full list from API
- `searchTerm: string`
- `columnFilters: Record<string, string[]>` — selected values per filterable column
- `visibleColumns: string[]` — ordered list of visible column keys
- `activeView: 'active' | 'archived'`
- `drawerState: { open: boolean; mode: 'edit' | 'add'; customer?: Customer }`

**Mutations** (create, update, archive, restore): Refetch the full list from the API after each mutation. No optimistic updates — unnecessary at ~180 records.

**Column preferences**: Persisted in `localStorage` under key `fullbloom:customer-columns`.

## Data Flow

```
Page mount
  → GET /customers?active=true  → customers[]
  → GET /customers/dropdown-options  → dropdownOptions

User types in search / toggles column filter
  → Client-side filter on customers[]  → filteredCustomers[]

User clicks row
  → Open drawer with customer data (already loaded)

User saves edit
  → PATCH /customers/{id}  → refetch list

User creates customer
  → GET /customers/next-number  → pre-fill form
  → POST /customers  → refetch list

User archives
  → POST /customers/{id}/archive  → refetch list

User toggles Active/Archived
  → GET /customers?active={value}  → replace customers[]
```
