# Security Review: 007-standing-orders

**Date:** 2026-04-12
**Scope:** New standing orders feature on branch 007-standing-orders.
**Auth posture:** No authentication. Supabase Auth planned.

## CRITICAL

None.

## HIGH

**~~H1 — Generate endpoint ignores UI checkbox selection~~** — CLOSED

Added `standing_order_ids: list[UUID] | None` to `GenerateRequest` schema. Service filters by these IDs when provided.

**~~H2 — `entered_by` always NULL for pause/resume/cancel~~** — CLOSED

Service now falls back to `so.salesperson_email` when `entered_by` is not provided.

**~~H3 — `sales_item_id` not validated on line update~~** — CLOSED

Added pre-validation: checks all sales_item_ids exist before mutating. Returns 422 instead of 500.

## MEDIUM

**~~M1 — No date-range bounds on generate endpoints~~** — CLOSED

Added `model_validator`: `date_from <= date_to` and max 90 days on both preview and generate schemas.

**~~M2 — No CORS wildcard guard in production~~** — CLOSED

Added startup assertion: `RuntimeError` if `CORS_ORIGINS` contains `*` outside development.

**~~M3 — `status` field no DB enum constraint~~** — CLOSED

Added `Literal["active", "paused", "cancelled"]` type to all response schemas. Service logic enforces transitions.

**~~M4 — `notes` and `color_variety` unbounded~~** — CLOSED

Added `color_variety` max 100 chars and `notes` max 2000 chars validators to all line schemas.

**M5 — No rate limiting** — DEFERRED

Pre-existing. Will address with `slowapi` when adding multi-user support.

## LOW

**~~L1 — Empty string passes `reason` validation~~** — CLOSED

Added `reason_not_blank` validator. Also created `StatusChangeWithReasonRequest` for pause/cancel (reason required), separate from resume (reason optional).

**L2 — No XSS risk** — CLEARED. React text nodes used throughout.

**L3 — `generate_order_number` TOCTOU race** — DEFERRED

Low risk at single-user scale. Will address with a DB sequence when adding multi-user.

**L4 — Hardcoded dev credentials as DATABASE_URL fallback** — NOTED

Dev-only default kept for local development convenience. TODO comment added. Production deployment must set `DATABASE_URL` explicitly.
