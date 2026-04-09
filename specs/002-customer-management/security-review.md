# Security Review: 002-customer-management

**Date**: 2026-04-09
**Reviewer**: Claude Security Review Agent
**Branch**: 002-customer-management

## Summary

The branch is reasonably well-structured for an early-stage internal CRM. The ORM and parameterized queries prevent SQL injection, Pydantic schemas enforce basic input typing, and the frontend avoids unsafe HTML rendering. The most significant issues are the wildcard CORS configuration (pre-existing, not introduced by this branch), missing server-side input length/format validation, and the potential for mass assignment via the update endpoint. No critical, immediately exploitable vulnerabilities were found in the new code.

## Findings

### Critical (exploit possible, fix before any deployment)

None.

### High (significant risk, fix before production)

**H1 - Wildcard CORS with credentials enabled**
- **Location**: `apps/api/app/main.py:62-68`
- **Description**: CORS is configured with `allow_origins=["*"]` and `allow_credentials=True`. Per the Fetch spec, browsers will not send credentials when the origin is `*`, so `allow_credentials=True` is currently inert. However, FastAPI/Starlette will reflect the requesting origin in the `Access-Control-Allow-Origin` header when credentials are enabled, effectively making this an "allow any origin with credentials" configuration. If authentication is ever added (cookies, tokens), any website could make credentialed cross-origin requests to the API.
- **Impact**: When auth is added, any malicious site could perform CSRF-style attacks against authenticated users.
- **Recommendation**: Restrict `allow_origins` to explicit origins (e.g., `["http://localhost:5173"]` for dev, the production domain for prod). Pull from an environment variable. This is pre-existing but worth fixing before adding auth.

**H2 - No file size limit on CSV upload endpoints**
- **Location**: `apps/api/app/routers/import_data.py:49-55` (and lines 23-46 for other import endpoints)
- **Description**: The `upload_customer_info` endpoint (and all import endpoints) call `await file.read()` on the uploaded file with no size check. An attacker or misconfigured client could upload a multi-gigabyte file, consuming all available memory and crashing the process.
- **Impact**: Denial of service.
- **Recommendation**: Add a size check before processing: read in chunks or check `Content-Length`, and reject files above a reasonable limit (e.g., 10 MB). FastAPI supports a `max_upload_size` pattern or you can check `len(content)` immediately after `file.read()`.

### Medium (should fix, but not immediately exploitable)

**M1 - Mass assignment on customer update: `is_active` and `price_type` not explicitly excluded**
- **Location**: `apps/api/app/schemas/customer.py:55-71` and `apps/api/app/routers/customers.py:120-148`
- **Description**: The `CustomerUpdateRequest` schema does not include `is_active`, `price_type`, `id`, or `customer_number`, so Pydantic will ignore those fields if sent. This is currently safe because `model_dump(exclude_unset=True)` only returns fields defined on the schema. However, the protection is implicit. If someone later adds `is_active` or `price_type` to the update schema (which are on the model), `update_from_dict` would allow setting them, bypassing the dedicated archive/restore endpoints.
- **Impact**: Low today, but architectural risk. A future developer could inadvertently expose sensitive fields.
- **Recommendation**: Add a comment documenting that the update schema intentionally excludes `is_active`, `price_type`, `customer_number`, and `id`. Alternatively, explicitly pass `exclude={"is_active", "price_type", "id", "customer_number"}` in the router when calling `update_from_dict`.

**M2 - No input length validation on string fields**
- **Location**: `apps/api/app/schemas/customer.py:35-71`
- **Description**: The `CustomerCreateRequest` and `CustomerUpdateRequest` schemas define string fields with no `max_length` constraints. The database model has `max_length` on `CharField` (e.g., `salesperson` is `max_length=10`, `name` is `max_length=255`), but Tortoise ORM does not enforce `max_length` at the Python level for PostgreSQL — it relies on the DB column type, which for `CharField` generates `VARCHAR(n)`. If the DB truncates or rejects, the user gets a raw database error.
- **Impact**: Unvalidated long strings could produce unhelpful 500 errors with DB details. The `salesperson` field is particularly tight at 10 characters.
- **Recommendation**: Add `max_length` validators to Pydantic fields to match the model constraints: `name: str = Field(max_length=255)`, `salesperson: str | None = Field(None, max_length=10)`, etc. This gives clean 422 errors instead of 500s.

**M3 - No email format validation**
- **Location**: `apps/api/app/schemas/customer.py:44` (create) and `apps/api/app/schemas/customer.py:63` (update)
- **Description**: The `email` field accepts any string. There is no format validation.
- **Impact**: Garbage data in the email field; if email is ever used for notifications or communication, invalid values will cause downstream failures.
- **Recommendation**: Use Pydantic's `EmailStr` type (from `pydantic[email]`) or add a regex validator for basic email format checking.

**M4 - No rate limiting on import endpoints**
- **Location**: `apps/api/app/routers/import_data.py` (all endpoints)
- **Description**: The CSV import endpoints perform heavy database operations (bulk upserts with hundreds/thousands of rows). There is no rate limiting, so repeated rapid calls could overload the database.
- **Impact**: Denial of service against the database.
- **Recommendation**: Add rate limiting middleware (e.g., `slowapi`) or at minimum a simple in-memory lock to prevent concurrent import operations.

**M5 - CSV import lacks row count limits**
- **Location**: `apps/api/app/services/import_service.py:446-537`
- **Description**: The `import_customer_info` function processes all rows from the CSV without any limit. Combined with no file size limit (H2), a CSV with millions of rows could consume excessive memory and database resources.
- **Impact**: Resource exhaustion.
- **Recommendation**: Add a maximum row count check (e.g., 50,000 rows) after parsing and before processing.

### Low (defense in depth, best practice improvements)

**L1 - UUID customer_id path parameter not validated**
- **Location**: `apps/api/app/routers/customers.py:62-88` (and lines 120, 151, 162)
- **Description**: The `customer_id` path parameter is typed as `str` but is used directly in `Customer.get_or_none(id=customer_id)`. If a non-UUID string is passed, the ORM will raise an exception that FastAPI converts to a 500 or a Tortoise-specific error.
- **Impact**: Information leakage through error messages; unclean error responses.
- **Recommendation**: Type the parameter as `uuid.UUID` in the function signature, or add a validator. FastAPI will then return a clean 422 for malformed UUIDs.

**L2 - No `Content-Type` validation on CSV upload**
- **Location**: `apps/api/app/routers/import_data.py:49-55`
- **Description**: The upload endpoint accepts any file type. It does not check that the uploaded file is actually a CSV (by content type or by attempting to validate the parsed output).
- **Impact**: Non-CSV files will be silently parsed (possibly producing zero rows) or produce confusing errors.
- **Recommendation**: Check `file.content_type` for `text/csv` or `text/plain`, or validate that the parsed result has at least one row with expected column headers.

**L3 - Default database credentials in config**
- **Location**: `apps/api/app/config.py:6-9`
- **Description**: The default `DATABASE_URL` includes credentials: `postgres://fullbloom:fullbloom@localhost:5432/fullbloom`. While this is a reasonable development default, it should never reach production.
- **Impact**: If deployed without setting the environment variable, the app connects with known credentials.
- **Recommendation**: In production, require `DATABASE_URL` to be set (raise on missing), or use a sentinel default that will fail loudly rather than connect to a guessable local instance.

**L4 - Error messages may leak implementation details**
- **Location**: `apps/api/app/routers/customers.py:96-99`
- **Description**: The duplicate customer number error message includes the customer number: `f"Customer number {data.customer_number} already exists"`. This is fine for an internal app, but FastAPI's default exception handler will also surface Pydantic validation errors with full field paths and ORM errors with query details if not caught.
- **Impact**: Minor information disclosure in error responses.
- **Recommendation**: Add a global exception handler that catches `tortoise.exceptions.*` and returns generic error messages in non-development environments.

**L5 - `customer_number` on create is user-controlled with no range validation**
- **Location**: `apps/api/app/schemas/customer.py:36`
- **Description**: The `customer_number` field is an unconstrained `int`. A user could submit `customer_number=0`, negative numbers, or extremely large integers.
- **Impact**: Data integrity issues; the `next-number` logic assumes positive incrementing values.
- **Recommendation**: Add `Field(gt=0)` or `Field(ge=1)` to constrain customer numbers to positive integers.

### Informational (observations, not vulnerabilities)

**I1 - No authentication or authorization**
- The application has no auth layer. All endpoints are publicly accessible. This is acknowledged in the project context (single-user app, auth not yet implemented). When auth is added, every endpoint will need access control checks.

**I2 - No CSRF protection**
- With no auth there's nothing to protect via CSRF. When auth is added, ensure SameSite cookies and/or CSRF tokens are used.

**I3 - Soft-delete pattern is sound**
- The archive/restore pattern uses a dedicated `is_active` flag rather than actual deletion, which is good for data preservation. The flag cannot be set via the general update endpoint.

**I4 - No DELETE endpoint exists**
- There is no hard-delete endpoint for customers, which is a safe default for a CRM.

**I5 - Frontend uses React's default escaping**
- All user data is rendered via JSX expressions (e.g., `{customer.name}`), which React auto-escapes. No `dangerouslySetInnerHTML` usage was found anywhere in the codebase.

## Positive Security Observations

- **Parameterized queries throughout**: All raw SQL in `import_service.py` uses positional parameters (`$1`, `$2`, etc.) rather than string interpolation. No SQL injection vectors.
- **Pydantic schema boundary**: Create and update endpoints use distinct Pydantic schemas that control which fields are accepted, preventing direct mass assignment of `id`, `is_active`, or `customer_number` on update.
- **Soft-delete only**: No hard-delete endpoints exist, reducing risk of accidental data loss.
- **No secrets in frontend code**: The frontend only stores column visibility preferences in localStorage. No tokens, credentials, or sensitive data in client-side storage.
- **XSS-safe rendering**: React's default JSX escaping is used consistently. No `dangerouslySetInnerHTML` or `eval` patterns found.
- **Structured logging**: The API uses `structlog` with JSON output, which avoids log injection attacks and provides clean audit trails.
- **Clean error handling on frontend**: The API client (`api.ts`) wraps errors into typed exceptions without exposing raw response bodies to the UI.
