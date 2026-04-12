# Research: Standing Orders

## R1: Cadence Matching Algorithm

**Decision**: Store cadence as two fields: `frequency_weeks` (int: 1, 2, or 4) and `day_of_week` (int: 0=Monday through 6=Sunday), plus a `reference_date` (date) for multi-week cycles.

**Rationale**: To determine if a standing order matches a target date: (1) check if the target date's weekday matches `day_of_week`, (2) compute the number of weeks between `reference_date` and the target date, (3) check if that number is divisible by `frequency_weeks`. Simple arithmetic, no external libraries needed.

**Alternatives considered**:
- Cron expressions — overkill for 3 frequency options
- iCal RRULE — unnecessary dependency for simple weekly cadences
- Freeform text cadence — not computable for matching

## R2: Order Generation Approach

**Decision**: Manual generation triggered by salesperson from the Standing Orders page. Salesperson selects a date or date range, system finds matching active standing orders, shows preview, salesperson confirms.

**Rationale**: No background worker infrastructure exists yet (Celery/Redis not deployed). Manual generation gives full salesperson control and avoids surprise orders. Auto-generation can be layered on later.

**Alternatives considered**:
- Celery beat auto-generation — requires infrastructure not yet deployed
- Hybrid auto-generate with review queue — adds complexity for questionable value at current scale

## R3: Standing Order ↔ Order Linkage

**Decision**: Add a nullable `standing_order_id` FK on the existing Order model. When an order is generated from a standing order, this FK is set. Manually created orders have it as null.

**Rationale**: Simple FK relationship. The Order model already exists; adding one nullable column is minimal. Enables filtering and badge display in the orders list without schema complexity.

**Alternatives considered**:
- Separate join table — unnecessary for a simple 1:many relationship
- Tag/label system — over-engineered for a single boolean-like distinction

## R4: Applying Changes to Future Orders

**Decision**: When a standing order is edited and the salesperson chooses "apply to future orders," the system queries for orders with `standing_order_id = this_standing_order AND order_date > today AND is_deleted = false`, then updates their line items to match the standing order template. This is a bulk operation within the edit save flow.

**Rationale**: Future orders are identified by `order_date > today`. Past orders are never modified — they represent what was actually fulfilled. The update replaces all line items on the generated order with the current standing order template (delete existing lines, create new ones from template).

**Alternatives considered**:
- Per-field diff propagation — too complex; replacing all lines is simpler and matches the mental model ("make future orders look like the current template")
- Mark future orders as "needs review" instead of auto-updating — adds workflow complexity without clear benefit at this scale

## R5: Duplicate Detection on Generation

**Decision**: Before generating, check if an order already exists with the same `standing_order_id` and `order_date`. If found, include it in the preview as "already generated" and let the salesperson skip or override (which deletes the existing and creates a fresh one).

**Rationale**: Prevents accidental double-generation. The check is a simple query. Override is useful when the standing order was modified after initial generation.

**Alternatives considered**:
- Block generation entirely if duplicate exists — too rigid; salesperson may want to regenerate after template changes
- Silently skip duplicates — hides information from the salesperson

## R6: Soft Delete Implementation

**Decision**: Use a `status` field with value "cancelled" rather than a separate `is_deleted` flag. The status field already captures the three states (active/paused/cancelled), so cancelled IS the soft delete. No separate boolean needed.

**Rationale**: Avoids the dual-state problem where `is_deleted=true` and `status="active"` could conflict. Status is the single source of truth for the standing order's lifecycle. Queries filter by `status != "cancelled"` for active views or include all statuses for the full list.

**Alternatives considered**:
- Separate `is_deleted` boolean like Order model — creates potential state conflicts with the status field
- Hard delete — loses history and audit trail

## R7: Audit Log with Reasons

**Decision**: `StandingOrderAuditLog` model with `action` (created/updated/paused/resumed/cancelled), `reason` (required text for edit/pause/cancel, optional for create/resume), `changes` (JSON diff), `entered_by`, `created_at`. One entry per action.

**Rationale**: The "reason" field is the key differentiator from the Order audit log — standing order changes require business justification. Same per-action granularity as inventory audit logs.

**Alternatives considered**:
- Reuse OrderAuditLog with a polymorphic FK — coupling standing orders to the order audit system creates unnecessary dependency
- Reason as a separate field on the standing order itself — loses history; only shows the last reason
