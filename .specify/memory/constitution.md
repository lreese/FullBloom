<!--
Sync Impact Report
==================
Version change: N/A → 1.0.0
Type: MINOR (initial ratification — all principles new)

Added sections:
  - Core Principles (I–V)
  - Technology Defaults (Frontend, Backend, Infrastructure, Auth, API, Secrets, Error Handling, Docs, Scale)
  - Coding Standards
  - Development Workflow
  - Governance

Removed sections: None (initial version)

Modified principles: None (initial version)

Templates requiring updates:
  ✅ plan-template.md — Constitution Check section references constitution generically; no update needed
  ✅ spec-template.md — No constitution-specific references; no update needed
  ✅ tasks-template.md — No constitution-specific references; no update needed
  ✅ No command files found in .specify/templates/commands/

Follow-up TODOs: None
-->

# FullBloom Constitution

## Core Principles

### I. Spec-First (NON-NEGOTIABLE)

No implementation code MUST be written without a corresponding spec in `specs/` with status
`approved` or `in-progress`. Claude Code MUST refuse to build features when no approved spec
exists and MUST ask whether to promote a draft before proceeding. Specs are the contract — code
serves specs, not the other way around. The acceptance criteria in a spec are the sole definition
of "done." This principle cannot be suspended, waived, or inferred around from conversation
context alone.

### II. Simplicity Over Cleverness

Code MUST use the minimum complexity required to satisfy the spec's acceptance criteria. YAGNI
applies: do not build for hypothetical future requirements. Prefer three clear lines over a
premature abstraction. Clever patterns, unnecessary layers, and over-engineered solutions MUST be
rejected. If complexity is genuinely required, it MUST be justified in the spec or plan before
implementation.

### III. Multi-Agent Architecture (NON-NEGOTIABLE)

FullBloom will add AI features in the future. When it does, it is a multi-agent system. Apps and
services MUST be designed to support agent orchestration — not just human interaction. AI model
calls MUST be abstracted behind a configurable interface; no model name or provider MUST be
hardcoded in application logic. The active model MUST be swappable via environment variable
without code changes. This applies to all apps that use AI, including `apps/fullbloom-agent/`.
Vendor lock-in to any single AI provider is explicitly prohibited.

### IV. App Isolation

Each app lives in `apps/<app-name>/` and MUST be self-contained: independently runnable,
independently documented, and independently deployable. Apps MUST NOT share code via implicit
imports across app boundaries.

If shared logic is needed across apps, it requires its own spec and lives in a dedicated
`packages/` directory imported explicitly via workspace protocol (e.g., `"@fullbloom/db": "*"`).
The Prisma client, schema, and generated types MUST live in `packages/db/` and be imported
this way — never duplicated across apps. Any additional shared packages (utilities, validators,
shared types) follow the same rule.

An app's README MUST explain how to install and run it with no assumed context.

### V. Deep Observability (NON-NEGOTIABLE)

Every FullBloom app MUST be observable across three layers — system, user, and AI — from day one.
Observability is not optional and MUST NOT be added as an afterthought.

**System**: All apps MUST instrument backend traces, latency, and error rates using OpenTelemetry
(OTEL). OTEL is the standard — vendor-neutral and exportable to any backend. Every service MUST
expose a `/health` endpoint.

**User behavior**: Frontend analytics via PostHog is recommended but not required for initial
deployment. When implemented, PostHog Cloud is the default provider. Self-hosting is optional
and should be evaluated based on cost and data volume.

**AI**: Every AI model call across all agents and apps MUST be traced via Langfuse. Traces MUST
capture: model used, prompt, response, tool calls, token usage, latency, and agent decision path.
Langfuse Cloud (free tier) is the default provider. Self-hosting on Render is an option if
usage exceeds the free tier or data residency requirements arise.

## Technology Defaults

### Frontend

TypeScript is the default language. React is the default UI framework; use Vite as the build tool
and Vitest for frontend tests. Tailwind CSS is the standard styling approach. shadcn/ui is the
standard component library — components are copied into the project (not a package dependency)
and styled with Tailwind. Do not install alternative component libraries (MUI, Chakra, Mantine,
Ant Design) — shadcn/ui is the only approved component system for FullBloom frontends.

### Color Palette

FullBloom uses a **Slate + Rose** palette with deep forest green accents. All apps MUST use
these colors consistently:

- **Sidebar background**: `#1a2e1a` (deep forest green)
- **Sidebar hover/active**: `#2d4a2d` (medium forest green)
- **Headings & structural text**: `#1e3a5f` (slate blue)
- **Primary action** (buttons, links, active states): `#c27890` (rose pink)
- **Secondary accent**: `#5c3d50` (deep plum)
- **Status/info badges**: `#dbeafe` background / `#1e3a5f` text (blue), `#fce7f3` / `#831843`
  (pink), `#e8f0e8` / `#2d4a2d` (green)
- **Content background**: `#f4f1ec` (warm cream)
- **Card/input background**: `#ffffff` (white)
- **Borders**: `#e0ddd8` (warm gray)
- **Muted text**: `#94a3b8` (cool gray)
- **Body text**: `#334155` (dark slate)
- **Brand wordmark**: white (never rose — rose is reserved for actions)

### App Shell

All FullBloom frontend apps MUST use a consistent app shell layout:

- **Collapsible sidebar navigation** on the left. Desktop: expands to show icon + label, collapses
  to an icon-only rail (always visible, one-click navigation). Mobile: sidebar fully hidden behind
  a hamburger menu in a top bar. The icon rail is the default collapsed state on desktop.
- **Full-width content area** to the right of the sidebar. Content flows vertically in a single
  column with a `max-width` container to prevent over-stretching on wide monitors.
- **No secondary sidebars or split panels** for primary content. Auxiliary panels (e.g., product
  picker) slide out from the left, pushing the content area narrower, and can be dismissed.
- On mobile, auxiliary panels open as full-screen overlays.

### Backend

Python is the default language. FastAPI is the default web framework; use pytest for backend
tests. PostgreSQL is the default database; use Tortoise ORM and Aerich for migrations.

### Dependencies

Dependencies MUST be justified — note the reason in a comment or commit message. No dependency
should be added "just in case." Each app MUST have its own README; shared packages require a spec
before being created.

### Infrastructure

Mac Mini is the local development environment and LLM host. Production deployment uses a single
**DigitalOcean Droplet** (2GB RAM preferred, vertically scalable as needed) running docker-compose: **Caddy** (serves frontend static
files + reverse-proxies the API, automatic HTTPS via Let's Encrypt), **FastAPI** (API server),
**Celery** (worker + beat combined), **Redis** (broker), and **Neon** (serverless PostgreSQL,
free tier, external). The frontend is built during deployment and served as static files by
Caddy — no separate frontend hosting service. Every backend app MUST include a `Dockerfile` and
`docker-compose.yml` for local development (app + PostgreSQL), plus a `docker-compose.prod.yml`
for production. A `deploy.sh` script MUST exist for one-command deployment from the local
machine. A `setup-droplet.sh` script MUST exist for repeatable droplet provisioning. The local
LLM (Ollama on Mac Mini) is used for development; production uses `AI_PROVIDER=claude` via the
Anthropic API. No cloud-vendor-specific SDKs MUST be embedded in application code —
infrastructure concerns belong in deployment config, not app logic.

### Authentication

Clerk is the standard auth provider for all apps with user accounts. Use the Clerk React SDK for
the frontend and validate Clerk-issued JWTs on the FastAPI backend. No custom auth code MUST be
written — login, signup, password reset, and session management are fully delegated to Clerk. All
protected API routes MUST verify the Clerk JWT on every request. User identity in the database
MUST reference the Clerk user ID as the foreign key.

### API Conventions

All backend APIs MUST follow REST conventions. URLs MUST use plural nouns and be versioned from
day one (`/api/v1/`). Nested resources for relationships (`/api/v1/users/{id}/tasks`). HTTP verbs:
`GET` read, `POST` create, `PATCH` update, `DELETE` remove. All responses MUST use a consistent
envelope: `{ "data": ... }` for success, `{ "error": "message" }` for failures. Status codes:
`200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden,
`404` Not Found, `422` Validation Error, `500` Server Error.

### Secrets

Secrets MUST never be committed to git. Every app MUST include a `.env.example` listing all
required environment variables with placeholder values. Local secrets live in `.env` (already
gitignored). Production secrets are passed as environment variables to Docker at runtime on the
host machine. No secret MUST be hardcoded in source code.

### Error Handling

Backend errors MUST be logged as structured JSON using Python's `structlog` library. Every log
entry MUST include: timestamp, severity, app name, error message, and request context where
applicable. Logs MUST be written to stdout so Docker captures them. Frontend errors MUST be caught
at the component boundary and display a user-friendly inline message — never a raw stack trace.
`500` errors MUST be logged server-side; the client receives only `{ "error": "Something went
wrong" }`. A self-healing agent (`apps/fullbloom-agent/`) is planned to consume structured logs
across all FullBloom apps, diagnose errors via the Claude API, and propose or apply fixes. That
agent requires its own spec before implementation.

### Documentation

Markdown is used for all documentation and specs; files MUST be Obsidian-compatible (standard
markdown + YAML frontmatter, no MDX or custom syntax).

### Scale

Performance and scale targets are personal-project scale by default: single user, local or
lightweight cloud deployment, no SLA requirements unless a spec explicitly defines them.

## Coding Standards

### Code Style & Consistency

**Formatting is non-negotiable and fully automated** — no manual style debates.

- **TypeScript/JavaScript**: Prettier is the formatter. Configuration lives in `prettier.config.*`
  at the app root. All files MUST be formatted on save via IDE integration. No code may be
  committed that has not been Prettier-formatted.
- **Python**: Ruff is the formatter and linter (replaces Black + Flake8). Configuration lives in
  `pyproject.toml`. All files MUST be formatted on save via IDE integration. PEP 8 is the
  baseline; Ruff enforces it automatically.

**Indentation**: 2 spaces for TypeScript/JavaScript/JSON. 4 spaces for Python. No tabs anywhere.

**Naming conventions**:
- TypeScript: `camelCase` for variables and functions, `PascalCase` for components, classes, and
  types/interfaces, `SCREAMING_SNAKE_CASE` for module-level constants.
- Python: `snake_case` for variables, functions, and modules; `PascalCase` for classes;
  `SCREAMING_SNAKE_CASE` for module-level constants. No abbreviations unless universally understood
  (`id`, `url`, `api` are fine; `usr`, `cfg`, `mgr` are not).
- Database columns: `snake_case`. Suffix `_id` is reserved for foreign keys (UUID references to
  another table's primary key). Human-assigned business identifiers use `_number` (e.g.,
  `customer_number`, `order_number`). Boolean columns use `is_` or `has_` prefix. Timestamps use
  `_at` suffix (`created_at`, `updated_at`). Free-text fields that could be ambiguous get a
  descriptive qualifier (`contact_name` not `contact`, `payment_terms` not `terms`,
  `default_ship_via` not `ship_via` when the value is a default that can be overridden per order).

**No magic literals**: Repeated string or numeric literals MUST be extracted into named constants.
A string used once inline is fine; the same string in two places is a constant waiting to happen.

**Imports**:
- TypeScript: external packages first, then internal absolute paths (`@/`), then relative paths.
  No unused imports; enforce with ESLint.
- Python: stdlib first, then third-party, then local app imports (`from app.*`). Use `isort` or
  Ruff's import sorter. No wildcard imports (`from module import *`).

**TypeScript strictness**: All apps MUST run with `"strict": true` in `tsconfig.json`. Implicit
`any` is forbidden. Type every function parameter and return value; inference is fine for local
variables where the type is obvious from context.

## Development Workflow

The spec lifecycle is: `idea → draft → approved → in-progress → implemented` (with `abandoned`
as an exit at any stage). The only gate that matters is `draft → approved` — that is the explicit
decision to build. Claude Code MUST update spec status to `in-progress` before writing code, and
to `implemented` when all acceptance criteria are checked off.

`CLAUDE.md` is the runtime guidance file for Claude Code and MUST stay in sync with this
constitution. If a conflict exists between `CLAUDE.md` and this constitution, this constitution
takes precedence and `CLAUDE.md` MUST be updated.

Specs are tracked in `specs/README.md`. When a spec is created, a row MUST be added to that index.

Commit messages MUST follow Conventional Commits format: `type: short description`. Types:
`feat` (new feature), `fix` (bug fix), `docs` (documentation), `chore` (maintenance),
`refactor` (code change with no behavior change), `test` (tests). Subject line MUST be lowercase,
imperative mood, under 72 characters. Example: `feat: add weekly budget summary endpoint`.

Branch strategy: `master` is always deployable. Feature work MUST use short-lived feature branches
named `<NNN>-<slug>` where NNN is the zero-padded spec number (e.g., `002-customer-management`).
Bug fixes use `fix/<slug>`. Merge to master when the spec's acceptance criteria are met. Delete
branches after merging.

## Governance

This constitution supersedes all other practices in the FullBloom repository. Amendments require:
updating this file with a version bump, updating `CLAUDE.md` if runtime behavior changes, and
noting the change in a commit message.

Versioning follows semantic rules:

- MAJOR: backward-incompatible removal or redefinition of a principle
- MINOR: new principle or section added
- PATCH: clarifications, wording, non-semantic refinements

As a solo project, no formal review process is required — but amendments MUST be intentional and
reflected here before taking effect in practice.

**Version**: 1.2.1 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-09
