# Research: Price Management

## R1: PriceList model vs implicit price categories

**Decision**: Create an explicit `PriceList` model with `PriceListItem` join table. Replace the implicit CSV-column approach and the free-text `Customer.price_type` with a proper FK relationship.

**Rationale**: The current system has price lists as implicit columns in a CSV (Retail, Wholesale High, Wholesale Low, Local Plus). There's no table representing a price list — they're just conventions. Moving to explicit models enables: CRUD on price lists, customer assignment via FK, archiving with data migration, and the matrix UI. Retail is NOT a PriceList entity — it's the SalesItem's `retail_price` field displayed as the first column.

**Alternatives considered**:
- Keep implicit price lists: blocks all CRUD functionality and matrix editing.
- Store price lists as JSON on sales items: violates relational normalization, makes queries hard.

## R2: Price list matrix component

**Decision**: Build a custom `PriceListMatrix` component — not a DataTable. The matrix has fixed "Sales Item" and "Retail" columns on the left, then one column per active price list. Cells are inline-editable.

**Rationale**: DataTable is designed for homogeneous column definitions known at build time. The price list matrix has dynamic columns (one per PriceList record), inline cell editing (click → input → blur-save), and the Retail column edits the SalesItem directly while other columns edit PriceListItem rows. This is fundamentally different from a standard table.

**Alternatives considered**:
- Adapt DataTable with dynamic columns: possible but the inline editing pattern doesn't fit DataTable's row-click-opens-drawer model.
- Use a spreadsheet library (react-datasheet, ag-grid): adds a heavy dependency. The matrix is simple enough to build from scratch.

## R3: Customer price_type → price_list_id migration

**Decision**: Add `price_list_id` FK to Customer model. Seed PriceList records from distinct `price_type` values. Backfill FK by name matching. Drop `price_type` column. Use aerich for the structural migration, add data manipulation SQL to the generated file.

**Rationale**: The current free-text `price_type` has values: "Retail", "Wholesale High", "Wholesale Low", "Local Plus", "Not Managed". These become PriceList records. "Retail" and "Not Managed" customers get `price_list_id = NULL` (they use retail by default).

**Alternatives considered**:
- Keep price_type alongside FK: redundant data that can drift.
- Map "Retail" to a PriceList record: creates confusion since Retail isn't a stored price list but a view of SalesItem.retail_price.

## R4: Effective price resolution

**Decision**: The effective price for a customer-sales item combination is resolved as:
1. If a CustomerPrice override exists → use it
2. Else if the customer has a price_list_id and a PriceListItem exists → use the PriceListItem price
3. Else → use the SalesItem's retail_price

This resolution happens server-side for the customer pricing grid endpoint, returning the effective price, its source ("override", "price_list", "retail"), and all constituent values.

**Rationale**: Server-side resolution keeps the frontend simple — it just renders what the API returns. The source indicator enables the analytics (highlighting overrides, showing where pricing comes from).

**Alternatives considered**:
- Client-side resolution: requires loading all price list items + customer prices + retail prices and computing in the browser. Possible at this scale but pushes business logic to the frontend.

## R5: Price list archive with customer price preservation

**Decision**: When a price list is archived, for each customer assigned to it:
1. For each PriceListItem in the archived list, create a CustomerPrice override (if one doesn't already exist) with the PriceListItem's price.
2. Set the customer's `price_list_id` to NULL (defaults to retail).
3. The customer's effective prices don't change — they're now explicit overrides.

**Rationale**: This preserves every customer's pricing exactly as it was. The conversion is reversible in concept (overrides can be manually removed to fall back to retail). The API performs this in a transaction.

**Alternatives considered**:
- Just unassign customers and lose their list prices: data loss.
- Block archiving if customers are assigned: too restrictive.

## R6: Sales item creation with price list population

**Decision**: When creating a sales item, the drawer shows a "Price Lists" section with all active price lists pre-selected (checkboxes). The user can:
- Set a single price for all selected lists (default mode)
- Toggle to edit each list's price individually
Selected lists get a PriceListItem at the chosen price(s). Unselected lists get no PriceListItem.

**Rationale**: Most new sales items need prices on all lists. Pre-selecting all with a single-price option is the fastest workflow. Individual editing is available for items that need different prices per list.

**Alternatives considered**:
- Auto-populate all at retail: no user control over initial list prices.
- Don't populate until explicitly set in the matrix: creates incomplete data that's hard to spot.
