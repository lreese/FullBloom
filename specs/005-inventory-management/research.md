# Research: Inventory Management

## Decision: Data Model for Counts and Estimates

**Decision**: Separate tables for daily counts (remaining), customer counts, and estimates. Each is a distinct activity with different schemas.

**Rationale**: The three data types have fundamentally different structures. Daily counts are a simple variety→value mapping. Customer counts have a customer+bunch_size+sleeve_type dimension. Estimates have a pull-day dimension. Trying to unify them into a single polymorphic table would add complexity without benefit.

**Alternatives considered**:
- Single `inventory_entry` table with `type` discriminator — rejected because the columns differ significantly (customer counts need customer FK, bunch_size, sleeve_type; estimates need pull_day)
- Separate count sheets as first-class entities with line items — rejected as over-normalized for the data entry patterns (field leads enter one variety at a time, not sheets)

## Decision: Variety Extensions (in_harvest, stems_per_bunch)

**Decision**: Add `in_harvest` (boolean, default true) and `stems_per_bunch` (integer, default 10) fields directly to the Variety model.

**Rationale**: Both fields are intrinsic to the variety and affect inventory behavior. `in_harvest` is toggled by field leads to control which varieties appear on forms. `stems_per_bunch` drives the 10-stem equivalent conversion. Adding them to Variety avoids a join table and keeps queries simple.

**Alternatives considered**:
- Separate `harvest_status` table with timestamps — over-engineered for a simple toggle
- `stems_per_bunch` on ProductLine instead of Variety — too coarse, some varieties within a product line may have different bunch sizes

## Decision: Count Sheet Template Storage

**Decision**: Store count sheet column configurations as a JSON array on a `CountSheetTemplate` model, one row per product type.

**Rationale**: The column layout is an ordered list of customer+bunch_size+sleeve_type tuples that changes infrequently. A JSON column is simpler than a normalized many-to-many with an ordering column. The data is read as a whole unit (render the grid), never queried by individual column.

**Alternatives considered**:
- Normalized table with `position` column — adds complexity for insert/reorder operations with no querying benefit
- Hardcoded configuration — rejected because column layouts change as customer relationships evolve

## Decision: Pull Day Schedule Storage

**Decision**: Store pull day schedules as a JSON array of day numbers on a `PullDaySchedule` model with a `week_start` date field. A single row with `week_start=NULL` serves as the default.

**Rationale**: Pull days rarely change (Mon/Wed/Fri is the default). Per-week overrides are edge cases. A simple model with a JSON array of day numbers (0=Mon, 2=Wed, 4=Fri) is sufficient.

**Alternatives considered**:
- Calendar-based system with recurring patterns — over-engineered for the use case
- Config file — rejected because leads need to adjust per-week without developer involvement

## Decision: Completion Tracking (Done Flags)

**Decision**: Per-variety done via a `is_done` boolean on each count/estimate row. Per-sheet done via a `CountSheetCompletion` model that tracks date+product_type+count_type completion status.

**Rationale**: Per-variety done maps to the spreadsheet workflow (leads check off each variety as they count it). Per-sheet done is the business trigger for notifications to sales. Separating them allows the sheet-level done to enforce "all varieties marked" as a precondition.

**Alternatives considered**:
- Only sheet-level done — misses the per-variety tracking that leads use during counting
- Derive sheet-level from all-varieties-done — doesn't allow explicit "I'm done" confirmation from the lead

## Decision: Notification Mechanism

**Decision**: In-app status indicators on sales-facing views (availability view shows "Counts updated 10 min ago by [user]" per product type). No external notifications (email/Slack) for v1.

**Rationale**: The sales team checks FullBloom throughout the day. A clear "estimates only" vs "actual counts available" indicator per product type is the minimum viable notification. External push notifications add infrastructure complexity (webhooks, queues) that isn't justified for a single-user/small-team deployment.

**Alternatives considered**:
- WebSocket push for real-time updates — adds complexity, polling or page refresh is sufficient for v1
- Email/Slack notifications — deferred to post-v1 when user base grows

## Decision: Sanity Check Implementation

**Decision**: Compare entered value against the average of the last 5 counts for the same variety. Warn if the new value is >5x or <0.2x the average. Client-side calculation using cached recent history fetched when the form loads.

**Rationale**: Simple ratio-based comparison catches obvious fat-finger errors (5000 vs 50) without complex statistical models. Client-side avoids a round-trip per keystroke. The 5x/0.2x threshold is generous enough to avoid false positives during legitimate production swings.

**Alternatives considered**:
- Server-side validation on save — adds latency to the save operation
- Standard deviation-based — over-engineered for the use case, and small sample sizes make stddev unreliable
