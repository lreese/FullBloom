# Security Review: 004-price-management

**Date:** 2026-04-09
**Reviewer:** Claude (automated)
**Scope:** All new backend and frontend code on the `004-price-management` branch (39 files, ~6000 LOC)
**Framework:** OWASP Top 10 + domain-specific pricing concerns

---

## CRITICAL

### C1. CSV Import: No file size limit (DoS)
**Files:** `routers/pricing.py:284-355`, `routers/price_lists.py:362-425`
**Category:** OWASP A05 (Security Misconfiguration)

Both CSV import endpoints call `await file.read()` with no size limit. An attacker can upload a multi-GB file to exhaust server memory and crash the process.

**Fix:** Add a size check before reading:
```python
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
content = await file.read(MAX_UPLOAD_BYTES + 1)
if len(content) > MAX_UPLOAD_BYTES:
    raise HTTPException(status_code=413, detail="File too large")
```

### C2. CSV Import: No row count limit (DoS / resource exhaustion)
**Files:** `routers/pricing.py:299-348`, `routers/price_lists.py:376-423`
**Category:** OWASP A05

The CSV reader iterates every row without limit. A file with millions of rows will issue millions of individual DB queries (one `SalesItem.filter()` + one `CustomerPrice.filter()` per row), holding the event loop for an extended period and potentially exhausting DB connections.

**Fix:** Cap rows (e.g., 10,000) and return an error if exceeded, or process in batches.

### C3. Archive price list: No transaction wrapping (data integrity)
**File:** `services/pricing_service.py:329-379` (`archive_price_list`)
**Category:** OWASP A08 (Software and Data Integrity Failures)

The archive flow performs N customer updates + M override inserts + 1 price list update as individual queries with no transaction. A crash mid-operation leaves the system in an inconsistent state: some customers converted, others not, price list still active.

**Fix:** Wrap the entire operation in `async with in_transaction():` from Tortoise ORM.

---

## HIGH

### H1. Inline edit endpoint accepts raw `dict` body (mass assignment)
**Files:** `routers/price_lists.py:149-207` (`update_price_list_item`), `routers/price_lists.py:258-295` (`update_retail_price`)
**Category:** OWASP A01 (Broken Access Control) / A08

Both endpoints accept `body: dict` instead of a Pydantic schema. This bypasses all automatic validation. While the code manually extracts `price`, accepting an untyped dict is a bad pattern -- any future field additions could be silently accepted and persisted.

`update_retail_price` also accepts `sales_item_id` from the body (not the URL path), meaning a caller could manipulate which item gets its retail price changed in a way that's harder to audit.

**Fix:** Create `PriceListItemUpdateRequest` and `RetailPriceUpdateRequest` Pydantic schemas. Move `sales_item_id` to the URL path.

### H2. CSV Import: No negative price validation
**Files:** `routers/pricing.py:310-312`, `routers/price_lists.py:387-389`
**Category:** Domain-specific (Price Manipulation)

CSV import parses prices with `Decimal(price_str.replace("$", "").replace(",", ""))` but never checks for negative values. The schema validators elsewhere reject negatives, but the CSV import path bypasses those schemas entirely, allowing negative prices to be imported.

**Fix:** Add `if price < 0: not_found_count += 1; continue` after the Decimal parse.

### H3. Zero prices allowed everywhere
**Files:** All price validators in `schemas/pricing.py`, `schemas/sales_item.py`
**Category:** Domain-specific (Price Manipulation)

Every price validator checks `if d < 0` but allows `d == 0`. A zero-price item means the customer gets the product for free. This is likely unintentional for a wholesale flower business.

**Fix:** Either reject zero (`if d <= 0`) or add a warning/confirmation flow for zero-price entries. At minimum, document that zero is intentionally allowed.

### H4. Bulk endpoint: No upper bound on `sales_item_ids` list size
**Files:** `schemas/pricing.py:158-183` (`BulkCustomerPriceRequest`), `schemas/pricing.py:190-206` (`BulkPriceListItemRequest`)
**Category:** OWASP A05 (DoS)

The `sales_item_ids` list has no `max_length` constraint. A request with 100,000 UUIDs will generate 100,000+ sequential DB queries. Combined with audit logging, this could monopolize the DB connection pool.

**Fix:** Add `sales_item_ids: list[UUID] = Field(max_length=500)` or similar.

### H5. Content-Disposition header injection in CSV export
**File:** `routers/pricing.py:276-281`
**Category:** OWASP A03 (Injection)

The customer name is inserted into the `Content-Disposition` header with only space-to-underscore replacement: `f"attachment; filename={customer_name}_pricing.csv"`. A customer name containing quotes, semicolons, newlines, or non-ASCII characters could inject malicious header values.

**Fix:** Sanitize the filename more thoroughly -- strip all non-alphanumeric/underscore characters, or use a fixed filename with the customer ID instead:
```python
filename = f"customer_{customer_id}_pricing.csv"
```

---

## MEDIUM

### M1. PriceChangeLog has no `changed_by` field (audit completeness)
**File:** `models/pricing.py:63-80`
**Category:** OWASP A09 (Security Logging and Monitoring Failures)

The audit log records what changed but not who changed it. Since there's no auth yet, this is a design-for-the-future concern, but the schema should have the field now (nullable) so it doesn't require a migration later.

### M2. No authentication or authorization on any endpoint
**Files:** All routers
**Category:** OWASP A01 (Broken Access Control), A07 (Identification and Authentication Failures)

Every endpoint is publicly accessible. Pricing data (customer-specific pricing, cost prices) is business-sensitive. This is presumably pre-launch/internal, but worth noting since `cost_price` was added in this branch.

### M3. Bulk operations: no validation that sales_item_ids actually exist
**Files:** `routers/pricing.py:155-185` (set_price), `routers/price_lists.py:220-254` (bulk update)
**Category:** Data Integrity

The bulk `set_price` action in `bulk_customer_prices` iterates over `sales_item_ids` and creates `CustomerPrice` records without verifying the sales item exists. If a UUID doesn't correspond to a real `SalesItem`, a `CustomerPrice` is created referencing a non-existent item. The FK constraint at the DB level may catch this, but uncaught `IntegrityError` would crash the request mid-batch, leaving a partial update.

**Fix:** Pre-validate all IDs exist, or wrap in a transaction and handle IntegrityError.

### M4. CSV Import: `content.decode("utf-8")` with no error handling
**Files:** `routers/pricing.py:292`, `routers/price_lists.py:369`
**Category:** OWASP A05

If the uploaded file is not UTF-8 (e.g., Excel-exported CSV in Windows-1252 or UTF-16 BOM), `decode("utf-8")` raises `UnicodeDecodeError`, which surfaces as an unhandled 500 error.

**Fix:** Use `errors="replace"` or catch the exception and return a 422.

### M5. `reset_to_list` action creates overrides instead of removing them
**File:** `routers/pricing.py:205-244`
**Category:** Logic / Domain Integrity

The `reset_to_list` action copies the price list price into a customer override record, rather than deleting the override so the customer falls through to the price list price. This means future price list changes won't propagate to "reset" customers. This is arguably a data integrity issue, not strictly security, but it creates unexpected pricing behavior.

### M6. No rate limiting on import endpoints
**Files:** `routers/pricing.py:284`, `routers/price_lists.py:362`
**Category:** OWASP A05

Import endpoints do heavy DB work per request. Without rate limiting, an automated client could flood the server with import requests.

---

## LOW

### L1. Frontend inline editing: no client-side price validation
**Files:** `CustomerPriceGrid.tsx:91-98`, `PriceListMatrix.tsx:98-130`, `ItemPriceGrid.tsx:53-59`
**Category:** Defense in depth

All inline-edit inputs accept freeform text and submit directly to the API. While the backend validates, adding a client-side numeric check improves UX and provides defense in depth against submitting garbage strings (e.g., `"><script>alert(1)</script>`). The backend correctly treats these as strings and parses them as Decimal, so XSS is not possible here, but malformed inputs create unnecessary 422 errors.

### L2. Frontend `handleExport` uses `window.open` with constructed URL
**File:** `CustomerPricesPage.tsx:134-141`
**Category:** OWASP A03 (Injection)

The export URL is constructed using `selectedCustomerId`, which is a UUID selected from a dropdown (not user-typed). Risk is minimal since UUIDs are validated by FastAPI. No issue in practice.

### L3. `impact_preview` doesn't validate negative new_price
**File:** `routers/price_lists.py:303-320`
**Category:** Domain-specific

The `new_price` query parameter is parsed as Decimal without checking for negatives. While preview is read-only and doesn't persist data, it's inconsistent with the validation on write endpoints.

### L4. Migration runs data transforms in the same transaction as DDL
**File:** `migrations/models/6_20260411073759_add_price_management.py`
**Category:** Data Integrity

The migration converts `price_type` string values to `price_list` FK references and then drops the `price_type` column, all in one SQL string. If the data transform fails (e.g., unexpected characters), the column is still dropped in some DB engines. Since `RUN_IN_TRANSACTION = True`, this is mitigated for PostgreSQL, which supports transactional DDL. Low risk.

### L5. `BulkCustomerPriceRequest.action` validated as string enum manually
**File:** `schemas/pricing.py:163-167`
**Category:** Code quality

Using a `field_validator` for a fixed set of values when a `Literal` or `Enum` type would provide the same validation with better documentation and type safety.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 3 | CSV DoS (no size/row limits), archive atomicity |
| High | 5 | Mass assignment via untyped dict, negative price bypass in CSV, zero-price policy, bulk DoS, header injection |
| Medium | 6 | Missing audit identity, no auth, bulk ID validation, encoding errors, reset_to_list semantics, no rate limiting |
| Low | 5 | Client-side validation, preview negative check, migration safety, enum typing |

### Top 3 priorities to fix before any production use:
1. **Add file size and row limits to CSV imports** (C1, C2)
2. **Wrap `archive_price_list` in a DB transaction** (C3)
3. **Replace `body: dict` with Pydantic schemas on inline-edit endpoints** (H1)
