# Frontend Design: Inventory Management

**Branch**: `005-inventory-management`
**Date**: 2026-04-11
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Design Priorities

1. **Accuracy** — clear feedback, confirmation previews, sanity warnings
2. **Speed** — large touch targets, minimal taps, bulk shortcuts
3. **Mobile-first** — optimized for tablets and large phones; field leads work in the field

## Navigation

New "Inventory" group in the collapsible sidebar:

```
Inventory
├── Counts          → /inventory/counts
├── Estimates       → /inventory/estimates
├── Availability    → /inventory/availability
└── Harvest Status  → /inventory/harvest-status
```

Configuration (count sheet templates, pull day schedules) is accessible via gear icons within the Counts and Estimates pages — not separate sidebar entries.

---

## Counts Page (`/inventory/counts`)

### Layout

- **Top bar**: Date picker (defaults to today) + Product type selector (e.g., "Lilies")
- **Tabs**: "Standard" | "Specials" — both share the same date/product type context
- **Toolbar**: Search bar, product line filter chips, status filter (All / Blank only / Filled only), Copy buttons, Print icon
- **Sheet completion bar**: Progress indicator (e.g., "12/38 varieties done") with "Complete Sheet" button enabled only when all varieties are marked done
- **Floating save button**: Anchored to bottom of screen
- **Auto-save draft**: Local draft saved so nothing is lost if browser closes

### Standard Tab (Story 1)

Stacked rows, one per variety, grouped by product line with section headers showing subtotals.

**Row states**:

- **Empty**: Plain input field, no +/− buttons. User types a number to set the initial count.
- **Has value**: +/− buttons flank the count value. Tapping the number allows direct edit/replace.
- **Add expanded**: Tapping "+" opens an inline input below the row with "Add: [input] → new total: **X**" and a Save button. Green accent.
- **Subtract expanded**: Tapping "−" opens same inline input with "Remove: [input] → new total: **X**" and Save. Rose accent.
- **Sanity warning**: Amber highlight on row when value is >5x or <0.2x the average of the last 5 counts. Warning badge: "~10x avg — confirm?" Non-blocking, dismissible.

Each row has a checkbox for per-variety "Done" marking.

**Audit trail**: Every set/add/remove action is logged with timestamp, amount, action type (set/add/remove), and eventually user ID when auth is added. Recent activity for a variety viewable by tapping the variety name or an info icon.

### Specials Tab (Story 2)

Column-first approach optimized for the actual workflow (field leads work customer by customer).

**Customer selector**: Horizontal chip bar at top showing all configured customer-bunch columns (abbreviated: "HFM TJ 5s", "SWY 3s", etc.). Chips show status via color:
- Empty (no data) — default/muted
- Active (has data, not complete) — rose accent
- Complete (done) — green accent
- Overflow: "+14 more" chip expands to show all

**Selected customer header**: Bar below chips showing full customer name, bunch size, sleeve type, and running total for this customer.

**Variety list**: Once a customer is selected, the form is a simple vertical list identical to remaining counts — variety name + bunch count input, grouped by product line. Same search/filter/status controls apply.

**Summary totals**: Auto-calculated 10-stem equivalent totals per tier (Total all 5-stem, Total all 3-stem, etc.) shown at the bottom or in a collapsible summary section. Conversion formula: `(bunches × stems per bunch) / 10`, rounded to nearest integer.

**Configuration**: Gear icon opens a drawer for managing customer-bunch columns:
- Drag-to-reorder list
- Add column: customer dropdown + bunch size (number) + sleeve type (Plastic/Paper)
- Remove column: delete icon with confirmation warning that historical data is preserved

---

## Estimates Page (`/inventory/estimates`)

### Layout

- **Top bar**: Week picker (defaults to current week's Monday) + Product type selector
- **Toggle**: "This Week's Estimate" (editable) | "Last Week's Actual" (read-only reference)
- **Toolbar**: Search bar, product line filter chips, status filter, Copy buttons ("Copy last week's estimate"), Print icon
- **Same save/completion pattern** as Counts

### Estimate Form (Story 3)

Three columns for pull days (Mon/Wed/Fri by default), large inputs taking full advantage of tablet width. Varieties grouped by product line with section headers.

**Toggle between weeks**: Default view shows this week's editable estimate inputs. Tapping "Last Week's Actual" tab shows the same variety list with last week's counts as read-only values — leads can flip back and forth to reference without sacrificing input size.

**Pull day configuration**: Gear icon opens a popover with:
- Checkboxes for Mon–Sat
- "This week only" toggle vs. "Update default" for handling holiday weeks

---

## Availability Page (`/inventory/availability`) — Story 5

Read-only view for sales team. No edit capabilities.

### Layout

- **Top bar**: Date picker (defaults to today)
- **All product types shown at once** — no product type selector needed, sales wants the full picture
- Each product type is a **collapsible section** with a status banner:
  - **Green**: "Actual counts — updated 10:32am by Tyler" (counts completed)
  - **Amber**: "Estimates only — counts not yet submitted" (no counts for this date)
  - **Per product type**: each has its own status, so sales knows exactly which counts are in
- Within each section: variety list with remaining count (or estimate if no count), grouped by product line

This status banner is the notification mechanism (Story 13) — no separate notification system needed for v1.

---

## Comparison Page (`/inventory/comparison`) — Story 4

For sales and leadership. Desktop-oriented.

### Layout

- **Top bar**: Week picker + Product type selector
- **Table**: Varieties as rows, pull days as columns. Each cell shows estimate and actual side by side.
- **Variance highlighting**: Green = produced more than estimated, Rose = produced less
- **Summary row**: Total estimated vs. total actual, overall variance percentage
- Not optimized for tablet — this is a review/analysis view
- Accessible via link from the Availability page or direct URL — not a separate sidebar entry

---

## Harvest Status Page (`/inventory/harvest-status`) — Story 6

### Layout

- **Top bar**: Product type selector
- List of all active varieties grouped by product line
- Each row: variety name + toggle switch (in harvest / dormant)
- **Bulk actions**: "Set all to dormant" / "Set all to in harvest" per product line section header
- Changes save immediately on toggle (no separate save button needed)

---

## Print Sheets (Story 11)

- Printer icon in Counts and Estimates toolbar
- Opens a print-optimized HTML page in a new tab
- Clean layout: no app chrome, variety names with empty cells, correct groupings, column headers
- For customer counts: all configured customer-bunch columns, landscape orientation
- CSS `@media print` handles formatting — no PDF generation

---

## Sanity Checks (Story 12)

- **Data fetch**: When count form loads, fetch last 5 counts per variety in one API call
- **Threshold**: Warn if value >5x or <0.2x the recent average
- **Display**: Inline amber warning badge on the row ("~10x avg — confirm?")
- **Behavior**: Non-blocking — does not prevent saving
- **Minimum data**: No warning shown for varieties with fewer than 3 historical data points

---

## Bulk Entry Shortcuts (Story 9)

Available on the Estimates page only (removed from Counts page):

- **"Copy last week's estimate"**: Pre-fills from prior week's estimate. Only in-harvest varieties. Disabled with explanation if no previous estimate exists.
- Pre-fills only — nothing saves until user taps Save.

---

## Shared UX Patterns

### Search & Filtering

Available on all count/estimate entry forms:

1. **Search bar**: Type-ahead filtering by variety name, instant results
2. **Product line chips**: Tap to filter to one product line (Orientals, Asiatics, LAs, etc.)
3. **Status filter**: Toggle between All / Blank only / Filled only

### Save Behavior

- Floating "Save" button anchored to bottom of viewport
- Saves all entered/modified values in one batch PUT request
- Auto-save local draft on each input change (localStorage) for crash recovery
- Visual confirmation on successful save (brief toast/flash)

### Per-Variety Done + Sheet Complete

- Each variety row has a checkbox for marking "done"
- Sheet completion bar at top shows progress (done count / total)
- "Complete Sheet" button enabled only when all varieties are marked done
- Completing the sheet triggers the status update visible on the Availability page

### Color & Styling

All UI follows the FullBloom constitution palette:
- Sidebar: `#1a2e1a` (deep forest green)
- Primary action (buttons, active states): `#c27890` (rose pink)
- Content background: `#f4f1ec` (warm cream)
- Card/input background: `#ffffff` (white)
- Warnings: amber accent
- Success/completion: green accent (`#2d4a2d` / `#8fbc8f`)
- Body text: `#334155` (dark slate)

### Responsive Behavior

- **Tablet landscape**: Primary target. All forms designed to work without horizontal scrolling.
- **Tablet portrait**: Stacked rows still work. Estimate form may need slight input size reduction.
- **Desktop**: Same layout with more breathing room. Comparison view is desktop-preferred.
- **Phone**: Functional but not the primary target. Stacked row layout scales down naturally.

---

## Data Model Impact

One change surfaced during brainstorm that affects the data model:

**Count audit log**: The DailyCount entity needs a companion `CountAuditLog` table to track set/add/remove actions:

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `daily_count_id` | UUID FK | References daily_counts |
| `action` | VARCHAR(10) | "set", "add", "remove" |
| `amount` | INT | The value set/added/removed |
| `resulting_total` | INT | The count value after this action |
| `entered_by` | VARCHAR(100) | Free text until Clerk auth |
| `created_at` | TIMESTAMPTZ | |

This replaces the simple "entered_by + timestamp" on DailyCount with a full history. The DailyCount.count_value remains the current total (updated on each action).

---

## Pages & Components Summary

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| CountsPage | `/inventory/counts` | Remaining + Customer counts (tabbed) |
| EstimatesPage | `/inventory/estimates` | Weekly estimates by pull day |
| AvailabilityPage | `/inventory/availability` | Sales read-only view |
| ComparisonPage | `/inventory/comparison` | Estimate vs. actual (sales/leadership) |
| HarvestStatusPage | `/inventory/harvest-status` | Toggle in-harvest/dormant |

### Components (`components/inventory/`)

| Component | Used In | Purpose |
|-----------|---------|---------|
| CountForm | CountsPage (Standard tab) | Stacked variety rows with +/−/edit, done checkbox |
| CustomerCountSelector | CountsPage (Specials tab) | Customer chip bar + selected customer header |
| EstimateForm | EstimatesPage | Pull-day columns with week toggle |
| SheetCompletionBar | CountsPage, EstimatesPage | Progress indicator + Complete Sheet button |
| SanityWarning | CountForm, EstimateForm | Inline amber warning badge |
| CopyButtons | CountsPage, EstimatesPage | Copy last count / Copy from estimate toolbar |
| SearchFilterBar | All entry forms | Search + product line chips + status filter |
| CountAuditLog | CountForm (expandable) | Recent activity per variety |
| PrintSheet | CountsPage, EstimatesPage | Print-optimized blank sheet in new tab |
| AvailabilityCard | AvailabilityPage | Per-product-type collapsible section with status |
| ComparisonGrid | ComparisonPage | Estimate vs actual table with variance |
| HarvestToggleList | HarvestStatusPage | Variety list with toggle switches |
| TemplateConfigDrawer | CountsPage (Specials tab) | Manage customer-bunch column layout |
| PullDayConfigPopover | EstimatesPage | Configure pull days per week |
