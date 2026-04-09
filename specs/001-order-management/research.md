# Research: Order Management

**Date**: 2026-04-07
**Feature**: 001-order-management

## Tortoise ORM + Neon Serverless PostgreSQL

**Decision**: Use Tortoise ORM with asyncpg, configured for Neon compatibility.

**Rationale**: Tortoise ORM works with Neon out of the box, but requires two config tweaks for Neon's pgbouncer (transaction mode):
- Set `statement_cache_size=0` in connection credentials (asyncpg uses prepared statements by default, which break across pgbouncer transactions)
- Set `min_size=1` for connection pool (Neon cold-starts make idle connections wasteful)

**Alternatives considered**: SQLAlchemy (async) — heavier, more mature, but constitution specifies Tortoise ORM.

## CSV Bulk Import Strategy

**Decision**: Use raw SQL `INSERT ... ON CONFLICT DO UPDATE` for bulk upsert, batched in chunks of 1000-5000 rows.

**Rationale**: Tortoise ORM's `bulk_create()` does not support upsert (`ON CONFLICT DO UPDATE`). For ~50K pricing rows, the ORM layer adds unnecessary overhead. Raw SQL via `connections.get_connection("default").execute_query()` is the pragmatic path. Tortoise's `bulk_create(ignore_conflicts=True)` only handles insert-or-skip, not update-on-conflict, which we need for re-imports.

**Alternatives considered**:
- `bulk_create(ignore_conflicts=True)` — only skips conflicts, doesn't update existing records
- Staging table + merge — overengineered for this scale
- Row-by-row ORM upsert — too slow for 50K rows

## Aerich Migrations + Neon

**Decision**: Use Aerich with the same `statement_cache_size=0` fix. Keep migrations simple.

**Rationale**: Aerich works with Neon but is less mature than Alembic. Known to have occasional issues with complex schema changes (enum alterations, index renames). For this project's scale and complexity, it's sufficient. Fallback: raw SQL migrations for edge cases.

**Alternatives considered**: Alembic — requires SQLAlchemy, doesn't integrate with Tortoise ORM natively.

## OrderID Strategy

**Decision**: Dual-ID approach — UUID primary key (`id`) for internal use + human-readable `order_number` for display.

**Rationale**: Human-readable IDs like `ORD-20260407-001` are critical for a CRM where salespeople reference orders verbally ("pull up ORD-20260407-001"). UUIDs are better as primary keys for joins and API references (non-guessable, no sequence gaps). The `order_number` uses a date prefix + daily sequence, enforced with a `UNIQUE` constraint.

**Format**: `ORD-YYYYMMDD-NNN` (e.g., `ORD-20260407-001`). The daily counter resets each day. Sequence managed via a DB sequence or counter table.

**Alternatives considered**:
- UUID only — hostile to users in a CRM context
- Sequential integer only — lacks date context, less meaningful
- Prefixed ID as primary key — works but UUIDs are more robust for distributed/future scenarios

## RowID Strategy

**Decision**: UUID for line-item RowIDs.

**Rationale**: Line items don't need human-readable IDs — they're never referenced verbally. UUID provides uniqueness without coordination overhead.
