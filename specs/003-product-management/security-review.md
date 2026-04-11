# Security Review: 003-Product-Management

**Reviewer:** Claude (automated)
**Date:** 2026-04-09
**Branch:** `003-product-management` (commits `df7ebb8..36e3a9f`)
**Scope:** 38 files changed, ~5,000 lines added across backend (FastAPI/Tortoise) and frontend (React/TypeScript)

---

## Summary

The 003-product-management feature is **generally well-implemented from a security perspective**. It uses Tortoise ORM (no raw SQL), Pydantic schemas with field-level validation, UUID-typed path parameters, and React's default output escaping. No critical vulnerabilities were found. There are two medium-severity issues related to the bulk update endpoint's type safety and missing validation on the `retail_price` field, plus several low/informational items.

---

## Findings by Severity

### Critical

None.

### High

None.

### Medium

#### M-1: Bulk Update Endpoint Accepts Arbitrary Value Types Without Field-Specific Validation

- **Location:** `apps/api/app/schemas/product.py:99-102`, `apps/api/app/services/product_service.py:49-61`
- **Description:** The `BulkUpdateRequest` schema accepts `value: str | bool | None` with no field-specific validation. While the `field` parameter is allowlisted against `BULK_UPDATABLE_FIELDS` (good), the `value` is passed directly to `Variety.filter(id__in=ids).update(**{field: value})`. For example, `product_line_id` expects a UUID but receives an unvalidated string. If a malformed string is passed, the database will reject it (Tortoise/PostgreSQL will error on an invalid UUID FK), but the error message propagated back may leak internal schema details (table names, column types) depending on FastAPI's exception handling.
- **Impact:** Potential information disclosure via database error messages. No data corruption risk since PostgreSQL enforces FK constraints, but the error path is uncontrolled.
- **Recommendation:** Add field-specific value validation in `bulk_update_varieties()`. For `product_line_id`, parse as UUID; for `show`, coerce to bool; for string fields, validate max_length. Wrap the DB call in a try/except to return a clean 422 instead of a 500 with a database traceback.

#### M-2: `retail_price` Field Has No Validation on Sales Item Create/Update

- **Location:** `apps/api/app/schemas/sales_item.py:20` (create), `apps/api/app/schemas/sales_item.py:33` (update)
- **Description:** The `retail_price` field is typed as `str` in both `SalesItemCreateRequest` and `SalesItemUpdateRequest` with no validation whatsoever -- no max_length, no regex pattern, no numeric check. The underlying model field is `DecimalField(max_digits=10, decimal_places=2)`, so Tortoise will reject non-numeric values at the DB layer, but the resulting error is uncontrolled.
- **Impact:** A malicious or malformed input like `"not-a-number"` or an extremely long string will produce an unhandled database error that may leak internal details. Additionally, the frontend `SalesItemList.tsx` (line 113) allows default `"0.00"` but does no numeric validation on the price field.
- **Recommendation:** Either change `retail_price` to `Decimal` type in the Pydantic schema, or add a `field_validator` that parses it as a decimal value and enforces the `max_digits=10, decimal_places=2` constraint. Add `max_length` at minimum.

### Low

#### L-1: `hex_color` Field Accepts Any 7-Character String

- **Location:** `apps/api/app/schemas/product.py:63` (create), `apps/api/app/schemas/product.py:84` (update)
- **Description:** The `hex_color` field has `max_length=7` but no regex pattern validation to enforce `#[0-9a-fA-F]{6}` format. Non-hex values like `"AAAAAAA"` (missing `#`) or `"#ZZZZZZ"` would be stored.
- **Impact:** Low. No security vulnerability per se, but invalid hex colors will produce broken UI rendering (the color swatch in `ColorTable.tsx:153` uses `style={{ backgroundColor: hexColor }}`). This is a data integrity issue more than a security issue.
- **Recommendation:** Add a `field_validator` for `hex_color` that enforces the `#[0-9a-fA-F]{6}` pattern.

#### L-2: Column Preferences Stored in localStorage Without Sanitization on Read

- **Location:** `apps/web/src/components/product/VarietyTable.tsx:70-88`
- **Description:** The `loadColumnPrefs()` function reads from `localStorage`, parses JSON, and uses the values to control which columns render. If an attacker could write to localStorage (e.g., via a separate XSS on the same origin), they could inject arbitrary column keys. However, the rendering uses a `COLUMN_MAP` lookup (`COLUMN_MAP[key]`) that filters out unknown keys (line 222: `.filter(Boolean)`), so unknown keys are safely discarded.
- **Impact:** Minimal. The `COLUMN_MAP` lookup acts as an effective allowlist. No XSS vector since column keys are used as object keys, not rendered as HTML.
- **Recommendation:** No immediate action needed. The current design is safe. If desired, add explicit validation of stored keys against `DEFAULT_ORDER` during load.

#### L-3: Bulk Update Does Not Verify Variety Ownership or Validate IDs Exist

- **Location:** `apps/api/app/services/product_service.py:60`
- **Description:** The bulk update call `Variety.filter(id__in=ids).update(...)` silently succeeds even if some or all IDs don't exist -- the `updated_count` will just be less than `len(ids)`. There is no auth system yet, so there's no IDOR risk currently, but if multi-tenant or role-based access is added later, this pattern would need to validate ownership.
- **Impact:** Low. No current auth means no access control bypass. The silent partial-update behavior could be confusing to users but isn't a security issue today.
- **Recommendation:** Document this as a known limitation. When auth is added, ensure the bulk update filters by tenant/user scope.

### Informational

#### I-1: No Authentication or Authorization

- **Location:** All routers (`products.py`, `colors.py`, `product_lines.py`, `sales_items.py`)
- **Description:** No auth middleware, no JWT/session validation, no role-based access control. All endpoints are publicly accessible.
- **Impact:** Expected at this stage of development (internal tool, local dev), but must be addressed before any production deployment.
- **Recommendation:** Track as a cross-cutting concern. When auth is added, ensure archive/restore and bulk update operations require appropriate permissions.

#### I-2: CORS Configuration Is Appropriately Scoped

- **Location:** `apps/api/app/config.py:15-22`, `apps/api/app/main.py:65-71`
- **Description:** CORS defaults to `http://localhost:5173,http://localhost:5174` and is configurable via environment variable. `allow_credentials=True` is set with `allow_methods=["*"]` and `allow_headers=["*"]`. This is fine for local dev but should be tightened for production (specific origins, specific methods).
- **Impact:** No current risk; this is appropriate for the dev stage.
- **Recommendation:** Before production deployment, restrict `allow_methods` to `["GET", "POST", "PATCH", "DELETE", "OPTIONS"]` and `allow_headers` to specific values.

#### I-3: `is_active` on VarietyUpdateRequest Could Allow Direct Activation/Deactivation Bypass

- **Location:** `apps/api/app/schemas/product.py:79-89`
- **Description:** The `VarietyUpdateRequest` schema does not include `is_active` as an updatable field, which is correct -- archive/restore is handled via dedicated endpoints. This is good design. The same pattern is followed for all entity update schemas.
- **Impact:** None. This is a positive observation.
- **Recommendation:** None needed.

#### I-4: Database Credentials in Default Config

- **Location:** `apps/api/app/config.py:6-9`
- **Description:** The default `DATABASE_URL` contains `fullbloom:fullbloom@localhost:5432/fullbloom`. This is standard for local development and overridden by environment variables in deployment.
- **Impact:** No risk as long as production uses environment variable overrides.
- **Recommendation:** No change needed. Consider adding a `.env.example` file if one doesn't exist.

#### I-5: New Routers Properly Registered

- **Location:** `apps/api/app/main.py:11-19, 76-79`
- **Description:** All four new routers (`colors_router`, `product_lines_router`, `products_router`, `sales_items_router`) are properly imported and registered via `app.include_router()`.
- **Impact:** None. This is correct.

---

## Positive Security Observations

1. **No raw SQL anywhere.** All database access goes through Tortoise ORM's query builder, eliminating SQL injection risk.

2. **UUID-typed path parameters.** All path params (`variety_id`, `color_id`, `product_line_id`, `sales_item_id`) are typed as `UUID` in the FastAPI signature, so invalid UUIDs are rejected at the framework level with a clean 422 before reaching application code.

3. **Pydantic schemas with `max_length` constraints.** All string fields in create/update schemas have `max_length` limits matching the database column sizes. Empty-string validators (`name_not_empty`) are consistently applied.

4. **`exclude_unset=True` on PATCH operations.** All update endpoints use `data.model_dump(exclude_unset=True)`, preventing null-overwrites of fields the client didn't intend to change.

5. **`is_active` excluded from update schemas.** Archive/restore is only possible through dedicated endpoints, preventing mass-assignment of the `is_active` field.

6. **Bulk update field allowlist.** The `BULK_UPDATABLE_FIELDS` set in `product_service.py` acts as an explicit allowlist, preventing arbitrary field modification via the bulk endpoint.

7. **No `dangerouslySetInnerHTML` in frontend.** All React components use standard JSX text content rendering, which auto-escapes HTML. The color swatch uses `style={{ backgroundColor }}` which is safe (React sanitizes style values).

8. **Color picker input is safe.** The native `<input type="color">` element at `VarietyDrawer.tsx:246-251` only produces valid hex color values from browser UI interaction. The text input beside it flows through normal React state -- no injection vector.

9. **No sensitive data in localStorage.** Only UI preferences (column order/visibility) are stored in localStorage (`fullbloom:variety-columns`).

10. **Uniqueness checks before create/update.** All entity creation endpoints check for duplicate names within scope before inserting, and update endpoints re-check uniqueness when name changes.

11. **Archive warnings for related data.** The sales item archive endpoint returns `customer_prices_count` and the product line archive returns `variety_count`, allowing the frontend to warn users about downstream impacts.
