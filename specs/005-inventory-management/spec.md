# Feature Specification: Inventory Management

**Feature Branch**: `005-inventory-management`  
**Created**: 2026-04-11  
**Status**: implemented  
**Input**: Inventory management for flower farms. Tracks weekly estimates (broken down by pull days within the week) and daily counts at the variety level — all measured in bunches. Counts and estimates are not done every day because some farms don't pull flowers daily. Oregon Flowers also does special customer-specific counts for prioritized customers, broken down by bunch configuration (customer + bunch size + sleeve type). Users are field employees and leads — distinct from sales and data management roles.

## Reference Notes

Key observations from Oregon Flowers' existing spreadsheets:

**Estimate sheets** (e.g., "Lily Estimate 2026 - 4.6.2026"):
- Organized by product line (Asiatics, Novelty LA's, Orientals, Callas, New Seasons) with variety as the row
- Columns are specific pull days within the week (Mon, Wed, Fri) — not a single weekly total
- Each cell is an estimate in 10-stem equivalents for that variety on that pull day
- All counts and estimates are in 10-stem equivalents as the standard unit across all product types
- Calla varieties have size built into the variety name (e.g., "Gold Medal (SMALL)", "Gold Medal (MED)" are distinct varieties) — no special size-grade handling needed
- Blank means "not expected to produce"; 0 means "counted, none expected"
- Covers multiple product types in one sheet (all Lilies together, Callas separate, etc.)

**Count sheets** (e.g., "Lily Counts 2026 - 4.15.2026"):
- Rows are varieties grouped by product line (Orientals section, then Asiatics, then LAs)
- Left side: remaining bunches (in 10-stem equivalents) after priority customer bunches are pulled, with a Totals column summing them
- Right side: customer-specific bunch configurations — columns are customer name + stems per bunch (5-stem, 3-stem, 2-stem, 1-stem) + sleeve type (Plastic or Paper). Values entered in bunches of that column's bunch size.
- Auto-calculated summary columns convert customer bunches to 10-stem equivalents: `(bunches × stems per bunch) / 10`. Columns: Total all 5-stem, Total all 3-stem, Total all 2-stem, Total all 1-stem (each in 10-stem equiv), and Totals of all bunched (remaining 10-stem equiv + customer 10-stem equiv)
- Example: Santander with 100 bunches in a 3-stem column → (100 × 3) / 10 = 30 ten-stem equivalents
- A "Done" column to mark completion per variety
- Product line section totals (TOTAL ASIATICS, TOTAL LA'S)
- These are for a single date and a single product type grouping (Lilies)

## Clarifications

### Session 2026-04-11

- Q: Is "product type" (e.g., Lilies) a higher-level grouping than "product line" (e.g., Asiatics, Orientals, LAs)? → A: Yes. Product Type is the higher grouping. Product Line is a subgroup within each Product Type. Users select product type first, then see varieties grouped by product line within forms.
- Q: What do the multiple unlabeled left-side columns on the count sheet represent? → A: Separate count entries by different people or field sections. The system only needs to store the total per variety — the sub-columns are a spreadsheet artifact, not a data model requirement.
- Q: Is "Done" per-variety, per-sheet, or both? → A: Both. Per-variety tracking so leads can mark individual varieties as counted, plus a sheet-level "Done" that requires all varieties to be marked first. The sheet-level Done is what triggers notifications to sales.
- Q: How should fractional 10-stem equivalents be handled? → A: Round to nearest integer. E.g., 213.9 → 214, 213.4 → 213.
- Q: How should the 20+ column customer count grid work on mobile? → A: Deferred to implementation brainstorm. Options to explore: (A) horizontal scroll with sticky variety column, (B) card-based view — one variety at a time, (C) desktop/laptop only for customer counts.

## User Scenarios & Testing

### User Story 1 - Enter Standard Counts (Priority: P1)

A field lead opens FullBloom on a tablet or phone in the field and navigates to Counts. They select a date (defaulting to today) and a product type (e.g., "Lilies"). They see a simple list of all varieties currently marked "in harvest" for that product type, grouped by product line (Orientals, Asiatics, LAs). For each variety, they enter the number of 10-stem equivalents remaining after priority customer bunches (Story 2) have been pulled. They tap "Save" when done and can mark the count as complete. If returning to a date that already has counts, existing values are pre-populated for editing. This count represents what's available for general allocation — non-priority customers, walk-in orders, and other sales channels. The priority customer bunches are counted separately in Story 2, which is typically done first.

**Why this priority**: Sales needs to know what's available beyond priority customer commitments. This remainder count is what they sell from for all non-priority orders.

**Independent Test**: Navigate to Counts, select today and "Lilies", enter remaining counts (in 10-stem equivalents) for several varieties, save, refresh, confirm counts persist and are attributed to the user.

**Acceptance Scenarios**:

1. **Given** the user navigates to Counts, **When** the page loads, **Then** they see a date picker (defaulting to today) and a product type selector.
2. **Given** a product type is selected, **When** the form loads, **Then** only varieties marked "in harvest" are listed, grouped by product line with product line headers.
3. **Given** the count form is displayed, **When** the user enters counts (in 10-stem equivalents) and saves, **Then** counts are persisted with the date, product type, variety, user, and timestamp.
4. **Given** a count already exists for this date and product type, **When** the user navigates to it, **Then** existing values are pre-populated and editable.
5. **Given** some rows are left blank, **When** the user saves, **Then** blank rows are treated as "not counted" (distinct from an explicit 0 meaning "none available").
6. **Given** the user finishes counting a variety, **When** they mark that variety as "Done", **Then** the per-variety completion is recorded.
7. **Given** all varieties in the sheet are marked "Done", **When** the user marks the sheet as complete, **Then** a sheet-level completion flag is recorded with user and timestamp, triggering notifications to sales.

---

### User Story 2 - Enter Specials (Priority: P1)

For priority customers, field leads count how many bunches of each customer-specific configuration can be made per variety. This is typically done first, before the remaining inventory is counted (Story 1). The user selects a date, a product type, and opens the "Specials" view. They see a grid: rows are varieties (grouped by product line), columns are customer-bunch configurations (e.g., "HFM Trader Joe 5-stem Paper", "Safeway 3-stem Plastic"). The user enters how many bunches of each configuration can be made per variety — entered in the column's bunch size (e.g., number of 3-stem bunches, number of 5-stem bunches). The system auto-calculates summary columns that convert each tier to 10-stem equivalents: `(bunches × stems per bunch) / 10`. Summary columns include: Total all 5-stem, Total all 3-stem, Total all 2-stem, Total all 1-stem (each in 10-stem equivalents), and Totals of all bunched (remaining 10-stem equiv from Story 1 + customer 10-stem equiv). Product line section totals are also shown.

**Why this priority**: Customer-specific counts are how the farm commits availability to its most important accounts. Priority customers get counted first, then what's left goes to general allocation (Story 1). The 10-stem equivalent conversion gives a common unit so remaining and customer-bunched inventory can be summed into a single availability total.

**Independent Test**: Open Specials for a date, enter bunch counts across multiple customer columns, confirm totals calculate correctly, save and verify persistence.

**Acceptance Scenarios**:

1. **Given** the user opens Specials for a date and product type, **When** the grid loads, **Then** only varieties marked "in harvest" are shown as rows (grouped by product line) and customer-bunch configurations are columns, ordered by bunch size descending.
2. **Given** the grid is displayed, **When** the user enters bunch counts, **Then** the system auto-calculates 10-stem equivalents per tier (Total all 5-stem, Total all 3-stem, etc.) using `(bunches × stems per bunch) / 10`, and a grand total (remaining + customer 10-stem equivalents).
3. **Given** customer columns have sleeve type attributes, **When** the grid renders, **Then** columns are visually grouped or labeled by sleeve type (Plastic, Paper).
4. **Given** product line groups exist, **When** the grid renders, **Then** each product line section shows a subtotal row (e.g., TOTAL ASIATICS).
5. **Given** a completed specials entry, **When** the user marks it "Done", **Then** the completion status is recorded.

---

### User Story 3 - Enter Weekly Estimates by Pull Day (Priority: P1)

At the start of each week, a field lead enters estimated bunch availability broken down by pull day. They select a week (identified by the week-of date) and see a form listing all varieties grouped by product line (Asiatics, Novelty LA's, Orientals, Callas, etc.). For each variety, columns represent the pull days for that week (typically Mon, Wed, Fri but configurable). The user enters estimated bunch counts per variety per pull day.

**Why this priority**: Estimates are the sales team's primary planning tool — they set customer expectations before actual counts come in. Having them broken down by pull day (not just a weekly lump sum) is critical for day-level order planning.

**Independent Test**: Navigate to Estimates, select the current week, enter per-day estimates for several varieties, save, confirm persistence and that the sales team can view the data.

**Acceptance Scenarios**:

1. **Given** the user navigates to Estimates, **When** they select a week, **Then** they see a form with varieties as rows and pull-day columns (e.g., Mon, Wed, Fri).
2. **Given** the form is loaded, **When** varieties are displayed, **Then** only varieties marked "in harvest" are shown, grouped by product line with section headers.
3. **Given** any product line, **When** the estimate form renders, **Then** each variety is a single row (varieties with sizes like Callas already have size in the variety name, e.g., "Gold Medal (SMALL)").
4. **Given** estimates are entered and saved, **When** the user returns to the same week, **Then** previously entered estimates are pre-populated.
5. **Given** an estimate already exists, **When** the user edits and re-saves, **Then** the updated value replaces the prior one.
6. **Given** some cells are left blank, **When** saved, **Then** blank means "not expected to produce" (distinct from 0 meaning "expected to produce zero").

---

### User Story 4 - View Estimate vs. Actual Comparison (Priority: P2)

A salesperson or manager navigates to a weekly comparison view to see how actual counts tracked against estimates. They select a week and product type and see a table: varieties as rows, pull days as columns, with each cell showing the estimated and actual bunch counts side by side. Significant variances are highlighted so leadership can quickly spot which varieties over- or under-produced relative to expectations. This helps sales calibrate how much to trust estimates when making commitments to customers, and helps leadership identify forecasting patterns (e.g., a lead who consistently underestimates, or a variety that's unpredictable).

**Why this priority**: Sales needs to know how reliable estimates are before committing to customers. Leadership needs visibility into forecast accuracy to improve planning and hold teams accountable.

**Independent Test**: Enter estimates for a week, enter counts for days within that week, navigate to the comparison view, confirm both data sets render alongside each other with variance highlighting.

**Acceptance Scenarios**:

1. **Given** a week has both estimates and counts, **When** the user views the comparison, **Then** estimated and actual bunch counts are displayed side by side per variety per pull day.
2. **Given** the comparison is displayed, **When** a variety's actual significantly differs from estimate, **Then** the variance is visually highlighted (e.g., color-coded over/under).
3. **Given** some days have estimates but no counts yet, **When** the comparison renders, **Then** those days show the estimate with an empty actual (not zero).
4. **Given** the comparison view, **When** the user scans the data, **Then** a summary row or indicator shows overall forecast accuracy for the week (e.g., total estimated vs. total actual per product type).

---

### User Story 5 - Sales Availability View (Priority: P2)

A salesperson navigates to an availability view to see what's currently available across product types. They select a date (defaulting to today) and see a read-only summary of the latest counts — bunches available per variety, grouped by product type and product line. They can also see the weekly estimate for context (what was expected vs. what was actually counted). This view is read-only; salespeople don't enter counts. Counts are from-scratch — each day's count is independent with no carry-over from previous days. Carry-over inventory will be added when the allocation feature is built.

**Why this priority**: Sales needs to know what's available to confirm orders and set customer expectations. Without this, they'd have to ask field leads directly or check the old spreadsheets.

**Independent Test**: Enter counts for today as a field lead, switch to the sales view, confirm the counts are visible and read-only.

**Acceptance Scenarios**:

1. **Given** the salesperson navigates to the availability view, **When** they select a date, **Then** they see a read-only summary of bunch counts per variety, grouped by product type and product line.
2. **Given** counts exist for the selected date, **When** the view loads, **Then** it shows the most recent count data with the timestamp and who entered it.
3. **Given** estimates exist for the selected week, **When** the view loads, **Then** the weekly estimate is shown alongside the actual count for comparison.
4. **Given** no counts exist for the selected date, **When** the view loads, **Then** it shows the estimate (if available) with a note that counts haven't been entered yet.
5. **Given** the availability view, **When** the salesperson interacts with it, **Then** all data is read-only — no editing capability.

---

### User Story 6 - Toggle Variety Harvest Status (Priority: P2)

A field lead navigates to a harvest status view where they can see all active varieties for a product type and toggle each one as "in harvest" or "dormant." Varieties marked "in harvest" appear on count and estimate forms; dormant varieties are hidden. This keeps forms clean — a lead counting Lilies in April doesn't scroll past 30 varieties that won't produce until July. The toggle is a simple on/off per variety, controlled by the lead based on what's actually producing in the field.

**Why this priority**: Without this, count and estimate forms show every active variety regardless of season, making data entry slower and noisier. This directly supports the mobile-first, paper-beating UX goal.

**Independent Test**: Mark several varieties as dormant, open a count form for that product type, confirm only in-harvest varieties appear. Toggle one back, confirm it reappears.

**Acceptance Scenarios**:

1. **Given** the user navigates to the harvest status view for a product type, **When** the page loads, **Then** they see all active varieties with their current harvest status (in harvest or dormant).
2. **Given** the harvest status list, **When** the user toggles a variety to "dormant", **Then** it no longer appears on count or estimate forms for that product type.
3. **Given** a dormant variety, **When** the user toggles it back to "in harvest", **Then** it reappears on count and estimate forms.
4. **Given** a variety was dormant and had no counts, **When** it is toggled to "in harvest" mid-week, **Then** it appears on future counts/estimates but no historical entries are created.
5. **Given** a variety has historical counts from a previous season, **When** it is toggled back to "in harvest", **Then** historical data is unaffected and the variety appears fresh on new forms.

---

### User Story 7 - Configure Customer Count Sheet Columns (Priority: P3)

An admin or lead configures which customer-bunch configurations appear as columns on the **Specials sheet** (the grid from User Story 2). They select a product type and see the current column layout. They can add a new column by selecting a customer, a bunch size (stems per bunch), and a sleeve type. They can reorder and remove columns. These configurations are per product type. This does not affect the general daily count form (User Story 1), which is always a simple variety-by-stem-count list.

**Why this priority**: The customer count sheet structure evolves as customer relationships and bunch requirements change. Self-service configuration replaces manual spreadsheet column management.

**Independent Test**: Add a new customer-bunch column to a product type's customer count template, verify it appears in the customer-specific count entry grid.

**Acceptance Scenarios**:

1. **Given** the user navigates to Count Sheet Configuration, **When** they select a product type, **Then** they see the current ordered list of customer-bunch columns.
2. **Given** the configuration view, **When** the user adds a column (customer + bunch size + sleeve type), **Then** it appears in future customer count grids for that product type.
3. **Given** an existing column is removed, **When** new count sheets are created, **Then** the column no longer appears, but historical data is preserved.
4. **Given** columns exist, **When** the user reorders them, **Then** the new order is reflected in the count entry form.

---

### User Story 8 - Configure Pull Days per Week (Priority: P3)

An admin or lead configures which days of the week are pull days for estimates. Different weeks may have different pull schedules (e.g., a holiday week might only have two pull days). The default is Mon/Wed/Fri but can be adjusted per week.

**Why this priority**: Pull day flexibility is needed but most weeks use the default schedule, so this is a lower-priority configuration feature.

**Independent Test**: Change pull days for a future week from Mon/Wed/Fri to Tue/Thu, confirm the estimate form shows the updated columns.

**Acceptance Scenarios**:

1. **Given** a default pull day schedule exists, **When** a new week is opened for estimates, **Then** the default days are used as columns.
2. **Given** the admin adjusts pull days for a specific week, **When** the estimate form for that week loads, **Then** only the configured days appear as columns.

---

### User Story 9 - Copy Last Week's Estimate (Priority: P2)

When entering weekly estimates, a field lead can tap "Copy last week's estimate" to pre-fill the current week's form with the prior week's estimate values. This eliminates re-typing similar numbers week to week. Values are pre-filled but fully editable before saving — nothing is committed until the user saves. This shortcut is only available on the Estimates page, not on Counts.

**Why this priority**: Estimates tend to be similar week to week. Pre-filling from last week saves time and reduces errors.

**Independent Test**: Enter estimates for one week. Open the next week, tap "Copy last week's estimate", confirm values pre-fill. Edit and save.

**Acceptance Scenarios**:

1. **Given** estimates exist for the previous week, **When** the user taps "Copy last week's estimate", **Then** the form is pre-filled with last week's values mapped to this week's pull days.
2. **Given** values are pre-filled via copy, **When** the user edits some values and saves, **Then** only the current form's values are stored (the source data is not affected).
3. **Given** no previous week's estimate exists, **When** the user looks for the copy option, **Then** the button is disabled with a brief explanation.
4. **Given** the previous estimate has varieties that are now dormant, **When** "Copy last week's estimate" is used, **Then** only in-harvest varieties are pre-filled (dormant ones are skipped).

---

### User Story 10 - Last Week's Numbers on Estimate Form (Priority: P3)

When entering weekly estimates, the form shows last week's actual counts alongside the empty estimate fields. For each variety, the lead sees what was actually pulled last week (per pull day) as a reference column next to where they enter this week's estimate. This is displayed inline — no separate view or navigation required. The reference data is read-only and unobtrusive (lighter text or a secondary column).

**Why this priority**: This is the single most useful reference when estimating, and showing it inline means the lead doesn't have to remember numbers or flip between screens. That said, it's a nice-to-have — leads have been estimating from memory and paper for years, so this is an improvement, not a blocker.

**Independent Test**: Enter counts for a week, open the estimate form for the following week, confirm last week's actuals appear as reference alongside the empty estimate fields.

**Acceptance Scenarios**:

1. **Given** counts exist for the previous week, **When** the estimate form loads, **Then** last week's actual counts per pull day are displayed as read-only reference alongside the estimate input fields.
2. **Given** no counts exist for the previous week, **When** the estimate form loads, **Then** the reference column is empty or hidden (no "0" values shown).
3. **Given** the reference data is displayed, **When** the user interacts with the form, **Then** only the estimate fields are editable — the reference data cannot be modified.

---

### User Story 11 - Print Blank Count and Estimate Sheets (Priority: P2)

A field lead prints a blank count or estimate sheet to take into the field. They select a product type and sheet type (general count, customer count, or estimate) and get a clean, print-optimized layout with variety names, grouping headers, and empty cells — matching what they'd carry on a clipboard. After the field walk, they come back and enter the numbers into FullBloom. For customer count sheets, the printed version includes all configured customer-bunch column headers. This bridges the paper-to-digital transition and lets leads who aren't comfortable with a tablet in the field continue their existing workflow while still centralizing data entry in the system.

**Why this priority**: Field staff have done this on paper for years. Forcing an immediate switch to tablet-in-the-field will meet resistance. Printable sheets let them keep the field walk on paper while getting the benefits of digital data entry and downstream visibility.

**Independent Test**: Navigate to the print function, select "Lilies" and "Specials", confirm a print-friendly blank sheet renders with correct varieties (in-harvest only), product line groupings, and customer-bunch column headers. Print it.

**Acceptance Scenarios**:

1. **Given** the user selects a product type and sheet type, **When** they tap "Print blank sheet", **Then** a print-optimized layout renders with variety names grouped by product line and empty cells for data entry.
2. **Given** a specials sheet is selected, **When** the blank sheet renders, **Then** all configured customer-bunch column headers are included with the correct ordering.
3. **Given** the print layout, **When** rendered, **Then** only in-harvest varieties for the selected product type are included.
4. **Given** an estimate sheet is selected, **When** the blank sheet renders, **Then** columns match the configured pull days for the selected week.
5. **Given** the print layout, **When** the user prints, **Then** the output is clean and readable on standard paper (no clipped columns, appropriate font size, landscape orientation for wide sheets).

---

### User Story 12 - Sanity Check Warnings (Priority: P2)

When entering counts or estimates, the system flags entries that look like likely errors. If a value is significantly higher or lower than recent history for that variety (e.g., 10x the average of the last 5 counts), a non-blocking warning appears inline next to the field — something like "This is much higher than recent counts. Confirm?" The user can dismiss the warning and keep the value; it does not prevent saving. The goal is catching fat-finger errors on a tablet (typing 5000 instead of 50), not enforcing business rules. Warnings are based on simple comparisons to recent data, not complex statistical models.

**Why this priority**: Bad data flowing to sales causes real problems — over-promising to customers or missing allocation opportunities. A gentle nudge catches the most obvious errors without slowing down experienced leads.

**Independent Test**: Enter counts of 50 for a variety over several days. Enter 5000 on the next day. Confirm a warning appears. Dismiss it and confirm the value saves normally.

**Acceptance Scenarios**:

1. **Given** a variety has recent count history, **When** the user enters a value significantly outside the recent range, **Then** a non-blocking warning appears inline next to the field.
2. **Given** a warning is displayed, **When** the user dismisses it or saves anyway, **Then** the value is saved without modification.
3. **Given** a variety has no count history (first time being counted), **When** the user enters any value, **Then** no warning is shown.
4. **Given** a value within the normal range, **When** the user enters it, **Then** no warning is shown.

---

### User Story 13 - Count and Estimate Completion Notifications (Priority: P1)

When a field lead marks a count or estimate sheet as "Done", the system notifies relevant users that new data is available. This is critical for the handoff between field and sales — when actual counts are completed, sales can switch from allocating based on estimates to allocating based on real counts. Notifications indicate what was completed (product type, count type, date), who completed it, and when. The notification mechanism should be visible within FullBloom (e.g., an indicator on the sales availability view, an activity feed, or a banner) rather than requiring external tools like email or Slack for v1.

**Why this priority**: The transition from estimate-based allocation to actual-count-based allocation is a daily workflow inflection point. If sales doesn't know counts are in, they keep working off stale estimates. This is the trigger that tells sales "real numbers are ready."

**Independent Test**: As a field lead, complete a count and mark it "Done." As a salesperson, confirm a notification or indicator appears showing that counts are now available for that product type.

**Acceptance Scenarios**:

1. **Given** a field lead marks a count sheet as "Done", **When** a salesperson views the availability or sales view, **Then** they see an indicator that counts were completed (product type, time, who).
2. **Given** a field lead marks an estimate as "Done", **When** a salesperson views availability, **Then** they see an indicator that estimates are available for the upcoming week.
3. **Given** counts have not been completed for today, **When** a salesperson views availability, **Then** it's clear that the data shown is based on estimates, not actual counts.
4. **Given** counts were completed earlier today, **When** a salesperson views availability, **Then** it's clear that actual count data is available and when it was last updated.
5. **Given** multiple product types, **When** some have completed counts and others don't, **Then** the notification/indicator is per product type so sales knows exactly which counts are in.

---

### Edge Cases

- What happens when a variety is added or archived mid-week? New varieties appear on future counts/estimates; archived varieties stop appearing but historical data is preserved.
- What happens when a variety is toggled to dormant mid-week? It disappears from future count/estimate forms but any already-entered data for the current week is preserved.
- What if two field employees enter counts for the same date and product type? Last-save-wins with the most recent save timestamp and user recorded. No real-time collaboration for v1.
- What if a variety has zero bunches? User can explicitly enter 0 or leave blank. Blank = "not counted/not expected"; 0 = "counted, none available."
- What if a product type has no active varieties? Empty state message directing user to product management.
- How are Calla sizes handled? Sizes are part of the variety name in the product catalog (e.g., "Gold Medal (SMALL)" is its own variety). No special handling needed — they're just varieties like any other.
- What happens to customer count columns when a customer is archived? The column is hidden from new count sheets but historical data is preserved.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow field employees/leads to enter remaining counts per variety (in 10-stem equivalents) for a given date and product type.
- **FR-002**: System MUST allow field employees/leads to enter weekly estimates per variety per pull day (in 10-stem equivalents) for a given week.
- **FR-003**: System MUST support customer-specific count sheets with configurable columns representing customer + bunch size + sleeve type combinations.
- **FR-004**: System MUST auto-calculate 10-stem equivalent totals on customer count sheets: per-tier totals using `(bunches × stems per bunch) / 10` rounded to nearest integer, product line section totals, and grand total (remaining 10-stem equiv + customer 10-stem equiv).
- **FR-005**: System MUST group varieties by product line within count and estimate forms, with section headers and section totals.
- **FR-006**: System MUST distinguish between "not counted" (blank/null) and "zero available" (explicit 0).
- **FR-007**: System MUST track which user entered or last modified each count/estimate entry and when.
- **FR-008**: System MUST allow admins/leads to configure customer-bunch column layouts per product type for customer count sheets.
- **FR-009**: System MUST allow admins/leads to configure pull days per week for estimates, defaulting to Mon/Wed/Fri.
- **FR-010**: System MUST preserve historical count and estimate data when varieties are archived or count sheet columns are removed.
- **FR-011**: System MUST support both per-variety and per-sheet "Done" flags. Leads mark individual varieties as counted; the sheet-level "Done" (date + product type) requires all varieties to be marked first. The sheet-level Done triggers notifications to sales.
- **FR-012**: System MUST treat all varieties as simple rows in count and estimate forms. Varieties with sizes (e.g., Callas) have the size built into the variety name — no special size-grade handling is needed.
- **FR-013**: System MUST display count and estimate entry forms in a mobile-first layout optimized for tablets and large phones. The current workflow is paper-based (field staff fill in a paper sheet then transcribe it) — the digital experience must be at least as fast and simple as writing on paper. Minimal taps, large touch targets, no unnecessary navigation.
- **FR-014**: System MUST support navigating to past dates for count entry and review, not limited to the current day.
- **FR-015**: Estimates and counts are both entered at the variety level (one row per variety). No special size-grade logic exists — sizes are part of the variety name in the product catalog.
- **FR-025**: The standard bunch size (stems per bunch for 10-stem equivalent conversion) MUST be configurable per variety or product line. This value is used as the base unit for counts and estimates and drives the 10-stem equivalent calculations on customer count sheets. This attribute should live on the variety record in the product catalog, defaulting to 10 for all existing varieties.
- **FR-016**: System MUST support an "in harvest" / "dormant" toggle per variety, controllable by field leads. Only varieties marked "in harvest" appear on count and estimate forms. Dormant varieties are hidden but not archived — their historical data is preserved and they can be toggled back at any time.
- **FR-017**: System MUST provide a harvest status management view where leads can see all active varieties for a product type and toggle their harvest status.
- **FR-018**: System MUST provide a "Copy last week's estimate" function on the Estimates page that pre-fills the current week's form with the prior week's estimate values, filtering to in-harvest varieties only.
- **FR-020**: System MUST display last week's actual counts as read-only reference data inline on the estimate entry form.
- **FR-021**: System MUST provide print-optimized blank sheets for general counts, customer counts, and estimates, filtered to in-harvest varieties with correct grouping and column headers.
- **FR-022**: System MUST display non-blocking inline warnings when a count or estimate value is significantly outside the recent range for that variety. Warnings do not prevent saving.
- **FR-023**: System MUST notify relevant users (sales, leadership) when a count or estimate sheet is marked "Done", indicating the product type, count type, completion time, and who completed it.
- **FR-024**: System MUST clearly indicate on sales-facing views whether displayed data is based on estimates or actual counts, and when the data was last updated, per product type.

### Key Entities

- **Daily Count**: A remaining count for a single variety on a specific date (in 10-stem equivalents, after priority customer allocation). Key attributes: variety, date, product type, count (10-stem equiv), entered by, timestamp.
- **Customer Count**: A bunch count for a specific variety, customer, and bunch configuration on a specific date. Key attributes: variety, date, customer, bunch size, sleeve type, bunch count, entered by, timestamp.
- **Estimate**: A per-pull-day estimate for a variety within a week (in 10-stem equivalents). Key attributes: variety, week-of date, pull day (day of week or specific date), product line, estimate (10-stem equiv), entered by, timestamp.
- **Count Sheet Template**: Defines customer-bunch columns for a product type's customer count sheet. Key attributes: product type, ordered list of columns (customer, bunch size, sleeve type).
- **Pull Day Schedule**: Defines which days of the week are pull days. Key attributes: week-of date (or default), list of days.
- **Count/Estimate Completion**: Tracks "Done" status per session. Key attributes: date or week, product type, count type, completed flag, completed by, timestamp.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Field employees can complete a full daily count for a product type (30+ varieties) in under 5 minutes on a mobile device.
- **SC-002**: Customer count sheet totals match manual spreadsheet calculations within the first week of use (100% accuracy on auto-calculated fields).
- **SC-003**: Weekly estimates entered by field leads are viewable by sales staff within 1 minute of being saved.
- **SC-004**: 100% of count and estimate entries are attributable to a specific user and timestamp.
- **SC-005**: Count sheet column configuration changes take effect immediately without requiring technical support.
- **SC-006**: Data entry replaces the existing Google Sheets workflow within 30 days of deployment, as measured by field team adoption.

## Assumptions

- Varieties, product lines, and product lines already exist in the system via Product Management (003). Counts and estimates reference existing variety records.
- Customers already exist in the system via Customer Management (002). Customer count columns reference existing customer records.
- The "product line" grouping (Orientals, Asiatics, LAs) and product line grouping map to existing attributes on variety records (product line or type fields).
- Calla sizes are part of the variety name (e.g., "Gold Medal (SMALL)" is a distinct variety in the product catalog). No special size-grade modeling is needed.
- For v1, all authenticated users can access count and estimate entry. Role-based access (restricting to field employees/leads) will be layered on when auth roles are implemented.
- Count sheets are per-farm. Multi-farm support is out of scope for v1.
- Real-time multi-user collaboration on the same count/estimate sheet is not required. Conflict resolution is last-save-wins.
- The customer count sheet column layout is relatively stable — changes happen weekly or less frequently, not during active counting.
- Pull day schedules default to Mon/Wed/Fri and rarely change. Per-week overrides are an edge case, not the norm.
- Internet connectivity in the field may be intermittent. The v1 system requires connectivity to save, but forms should be usable with slow connections (no heavy JS, minimal round-trips). Offline support is out of scope for v1.
