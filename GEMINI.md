## Project Overview
FullBloom is a custom CRM for Flower Farms, built with Oregon Flowers in mind. It tracks growing schedules, inventory, estimates, orders, and fullfilment of orders (allocation).

## Core Rule: Spec-First Development
**Never write implementation code without a corresponding spec.**

Before writing any code for a feature, confirm that a spec exists in `specs/` with status `approved` or `in-progress`. If no spec exists, stop and say so. Do not infer what to build from conversation context alone.

## Working with Specs

### Before coding
1. Read the relevant spec in `specs/`. Check the status field.
2. Only proceed if status is `approved` or `in-progress`.
3. If status is `draft` or `idea`, ask whether to promote it before proceeding.
4. Identify the acceptance criteria — those are your done conditions.

### Creating a new spec
When asked to create a spec:
1. Copy `specs/_template.md` as the starting point.
2. Name the file: `specs/<app-or-domain>-<short-slug>.md` (e.g., `specs/budget-weekly-summary.md`).
3. Set status to `draft`.
4. Fill in what is known; leave open questions explicit.
5. Do NOT start implementation until the spec is promoted to `approved`.

### Updating spec status
When implementation begins, update the spec's status field from `approved` → `in-progress`. When all acceptance criteria are met, update to `implemented`. Always keep the spec in sync with reality — it is the source of truth.

### Scope discipline
Do not implement anything not described in the spec. If a good idea surfaces during implementation, add it to the spec's **Open Questions** or create a new spec for it. Do not silently expand scope.

## Code Style Defaults (until per-app standards exist)
- Prefer TypeScript over JavaScript.
- Prefer simple, readable code over clever abstractions.
- No dependencies without justification — note the reason in a comment or commit message.
- Each app in `apps/<app-name>/` should have its own README explaining how to run it.

## File and Directory Conventions
- Specs live in `specs/` as markdown files.
- App code lives in `apps/<app-name>/`.
- Shared docs live in `docs/`.
- Design specs from brainstorming go under the relevant feature directory: `specs/<feature-dir>/` (e.g., `specs/016-digest-overhaul/nyt-digest-layout-design.md`). Never use a generic `docs/superpowers/` path.
- This file (`CLAUDE.md`) is the authoritative instruction set for AI behavior in this repo.

## What to Do When Unsure
If requirements are ambiguous, ask before building. A wrong implementation is more expensive than a clarifying question. Reference the spec's **Open Questions** section as the right place to surface uncertainty.

## Active Technologies
- Python 3.11+ (backend), TypeScript 5.x (frontend) + FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui (frontend) (001-order-management)
- PostgreSQL via Neon (serverless, free tier) (001-order-management)
- Python 3.11+ (backend), TypeScript 5.x (frontend) + FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui, react-router-dom (frontend) (003-product-management)
- PostgreSQL (local dev), Neon (production) (003-product-management)
- Python 3.11+ (backend), TypeScript 5.x (frontend) + FastAPI, Tortoise ORM, Supabase Auth (backend); React, Vite, Tailwind CSS, shadcn/ui, @supabase/supabase-js (frontend) (008-users-rbac)
- PostgreSQL (local dev), Neon (production), Supabase (auth provider) (008-users-rbac)

## Recent Changes
- 001-order-management: Added Python 3.11+ (backend), TypeScript 5.x (frontend) + FastAPI, Tortoise ORM, Aerich (backend); React, Vite, Tailwind CSS, shadcn/ui (frontend)

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
