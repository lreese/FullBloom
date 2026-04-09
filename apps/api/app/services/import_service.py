"""Import services for varieties, pricing, and color CSV data."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation

from tortoise import Tortoise

from app.schemas.import_data import (
    ImportColorsResult,
    ImportPricingResult,
    ImportVarietiesResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_bool(value: str | None) -> bool:
    """Convert Yes/No strings to bool."""
    if not value:
        return False
    return value.strip().lower() == "yes"


def _parse_decimal(value: str | None) -> Decimal | None:
    """Strip $ and commas, return Decimal or None."""
    if not value:
        return None
    cleaned = value.replace("$", "").replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_int(value: str | None) -> int | None:
    """Parse an integer, return None on failure."""
    if not value:
        return None
    try:
        return int(value.strip())
    except (ValueError, TypeError):
        return None


def _chunks(lst: list, n: int):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


# ---------------------------------------------------------------------------
# import_varieties
# ---------------------------------------------------------------------------

async def import_varieties(rows: list[dict]) -> ImportVarietiesResult:
    """Import variety rows from the Varieties CSV."""
    conn = Tortoise.get_connection("default")

    # Collect unique types, lines, and varieties
    types_seen: dict[str, str] = {}        # name -> uuid
    lines_seen: dict[tuple, str] = {}      # (type_name, line_name) -> uuid
    variety_rows: list[dict] = []

    for row in rows:
        variety_name = (row.get("Variety/Item") or "").strip()
        if not variety_name or variety_name == "Always on":
            continue

        type_name = (row.get("Type") or "").strip()
        line_name = (row.get("Product Line") or "").strip()

        if not type_name or not line_name:
            continue

        if type_name not in types_seen:
            types_seen[type_name] = str(uuid.uuid4())

        line_key = (type_name, line_name)
        if line_key not in lines_seen:
            lines_seen[line_key] = str(uuid.uuid4())

        variety_rows.append({
            "id": str(uuid.uuid4()),
            "type_name": type_name,
            "line_name": line_name,
            "name": variety_name,
            "color": (row.get("Color") or "").strip() or None,
            "flowering_type": (row.get("Flowering") or "").strip() or None,
            "can_replace": _parse_bool(row.get("Can Replace")),
            "show": _parse_bool(row.get("Show?")),
            "weekly_sales_category": (row.get("Weekly Sales Category") or "").strip() or None,
            "item_group_id": _parse_int(row.get("Item Group ID")),
            "item_group_description": (row.get("Item Group ID Description") or "").strip() or None,
        })

    # Deduplicate varieties by (type, line, name) — keep last occurrence
    seen_varieties: dict[tuple, int] = {}
    for i, v in enumerate(variety_rows):
        key = (v["type_name"], v["line_name"], v["name"])
        seen_varieties[key] = i
    variety_rows = [variety_rows[i] for i in sorted(seen_varieties.values())]

    result = ImportVarietiesResult()

    # --- Upsert product types ---
    for chunk in _chunks(list(types_seen.items()), 500):
        values_parts = []
        params: list = []
        for i, (name, uid) in enumerate(chunk):
            offset = i * 2
            values_parts.append(f"(${offset + 1}, ${offset + 2})")
            params.extend([uid, name])
        sql = (
            f"INSERT INTO product_types (id, name) VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.types_created += 1
            else:
                result.types_updated += 1

    # Fetch type id map
    _, type_rows = await conn.execute_query(
        "SELECT id, name FROM product_types", []
    )
    type_id_map = {r["name"]: str(r["id"]) for r in type_rows}

    # --- Upsert product lines ---
    for chunk in _chunks(list(lines_seen.items()), 500):
        values_parts = []
        params = []
        for i, ((type_name, line_name), uid) in enumerate(chunk):
            offset = i * 3
            values_parts.append(f"(${offset + 1}, ${offset + 2}, ${offset + 3})")
            params.extend([uid, type_id_map[type_name], line_name])
        sql = (
            f"INSERT INTO product_lines (id, product_type_id, name) VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (product_type_id, name) DO UPDATE SET name = EXCLUDED.name "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.lines_created += 1
            else:
                result.lines_updated += 1

    # Fetch line id map
    _, line_rows = await conn.execute_query(
        "SELECT pl.id, pl.name, pt.name AS type_name "
        "FROM product_lines pl JOIN product_types pt ON pl.product_type_id = pt.id",
        [],
    )
    line_id_map = {(r["type_name"], r["name"]): str(r["id"]) for r in line_rows}

    # --- Upsert varieties ---
    for chunk in _chunks(variety_rows, 500):
        values_parts = []
        params = []
        for i, v in enumerate(chunk):
            offset = i * 11
            values_parts.append(
                f"(${offset+1}, ${offset+2}, ${offset+3}, ${offset+4}, "
                f"${offset+5}, ${offset+6}::bool, ${offset+7}::bool, "
                f"${offset+8}, ${offset+9}::int, ${offset+10}, ${offset+11})"
            )
            line_id = line_id_map[(v["type_name"], v["line_name"])]
            params.extend([
                v["id"],
                line_id,
                v["name"],
                v["color"],
                v["flowering_type"],
                v["can_replace"],
                v["show"],
                v["weekly_sales_category"],
                v["item_group_id"],
                v["item_group_description"],
                None,  # hex_color — set by import_colors, not from Varieties CSV
            ])
        sql = (
            f"INSERT INTO varieties (id, product_line_id, name, color, flowering_type, "
            f"can_replace, show, weekly_sales_category, item_group_id, "
            f"item_group_description, hex_color) "
            f"VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (product_line_id, name) DO UPDATE SET "
            f"color = EXCLUDED.color, flowering_type = EXCLUDED.flowering_type, "
            f"can_replace = EXCLUDED.can_replace, show = EXCLUDED.show, "
            f"weekly_sales_category = EXCLUDED.weekly_sales_category, "
            f"item_group_id = EXCLUDED.item_group_id, "
            f"item_group_description = EXCLUDED.item_group_description "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.varieties_created += 1
            else:
                result.varieties_updated += 1

    return result


# ---------------------------------------------------------------------------
# import_pricing
# ---------------------------------------------------------------------------

async def import_pricing(rows: list[dict]) -> ImportPricingResult:
    """Import pricing rows from the PriceData CSV."""
    conn = Tortoise.get_connection("default")
    result = ImportPricingResult()

    # --- Ensure "Unknown" product type and product line exist ---
    unknown_type_id = str(uuid.uuid4())
    unknown_line_id = str(uuid.uuid4())

    _, res = await conn.execute_query(
        "INSERT INTO product_types (id, name) VALUES ($1, $2) "
        "ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name "
        "RETURNING id",
        [unknown_type_id, "Unknown"],
    )
    unknown_type_id = str(res[0]["id"])

    _, res = await conn.execute_query(
        "INSERT INTO product_lines (id, product_type_id, name) VALUES ($1, $2, $3) "
        "ON CONFLICT (product_type_id, name) DO UPDATE SET name = EXCLUDED.name "
        "RETURNING id",
        [unknown_line_id, unknown_type_id, "Unknown"],
    )
    unknown_line_id = str(res[0]["id"])

    # --- Collect unique customers ---
    customers: dict[int, dict] = {}  # cust_num -> {name, is_active}
    for row in rows:
        cust_num = _parse_int(row.get("Cust #"))
        if cust_num is None:
            continue
        cust_name = (row.get("Customer Name") or "").strip()
        is_active = (row.get("Active Customer") or "").strip().lower() == "active"
        customers[cust_num] = {"name": cust_name, "is_active": is_active}

    # Upsert customers
    for chunk in _chunks(list(customers.items()), 1000):
        values_parts = []
        params: list = []
        for i, (cust_num, info) in enumerate(chunk):
            offset = i * 4
            values_parts.append(f"(${offset+1}, ${offset+2}, ${offset+3}, ${offset+4}::bool)")
            params.extend([str(uuid.uuid4()), cust_num, info["name"], info["is_active"]])
        sql = (
            f"INSERT INTO customers (id, customer_id, name, is_active) "
            f"VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (customer_id) DO UPDATE SET "
            f"name = EXCLUDED.name, is_active = EXCLUDED.is_active "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.customers_created += 1
            else:
                result.customers_updated += 1

    # Fetch customer id map: customer_id (int) -> uuid
    _, cust_rows = await conn.execute_query("SELECT id, customer_id FROM customers", [])
    cust_id_map = {r["customer_id"]: str(r["id"]) for r in cust_rows}

    # --- Collect unique sales items ---
    # sales_item_name -> {variety_name, stems_per_order, retail_price}
    sales_items: dict[str, dict] = {}
    for row in rows:
        si_name = (row.get("Sales Item") or "").strip()
        if not si_name:
            continue
        variety_name = (row.get("Variety") or "").strip()
        stems = _parse_int(row.get("Stems per Order")) or 1
        retail = _parse_decimal(row.get("Retail Price")) or Decimal("0.00")
        sales_items[si_name] = {
            "variety_name": variety_name,
            "stems_per_order": stems,
            "retail_price": retail,
        }

    # Build variety name -> id map (fetch existing)
    _, var_rows = await conn.execute_query("SELECT id, name FROM varieties", [])
    variety_id_map: dict[str, str] = {r["name"]: str(r["id"]) for r in var_rows}

    # Create missing varieties with minimal data under Unknown product line
    missing_varieties = set()
    for info in sales_items.values():
        vn = info["variety_name"]
        if vn and vn not in variety_id_map:
            missing_varieties.add(vn)

    for chunk in _chunks(list(missing_varieties), 1000):
        values_parts = []
        params = []
        for i, vn in enumerate(chunk):
            offset = i * 3
            vid = str(uuid.uuid4())
            values_parts.append(f"(${offset+1}, ${offset+2}, ${offset+3})")
            params.extend([vid, unknown_line_id, vn])
            variety_id_map[vn] = vid
        sql = (
            f"INSERT INTO varieties (id, product_line_id, name) "
            f"VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (product_line_id, name) DO UPDATE SET name = EXCLUDED.name "
            f"RETURNING id, name"
        )
        _, rows_back = await conn.execute_query(sql, params)
        # Update map with actual DB ids in case of conflict
        for r in rows_back:
            variety_id_map[r["name"]] = str(r["id"])

    # Upsert sales items
    for chunk in _chunks(list(sales_items.items()), 1000):
        values_parts = []
        params = []
        for i, (si_name, info) in enumerate(chunk):
            offset = i * 5
            vid = variety_id_map.get(info["variety_name"])
            if not vid:
                continue
            values_parts.append(
                f"(${offset+1}, ${offset+2}, ${offset+3}, ${offset+4}::int, ${offset+5}::numeric)"
            )
            params.extend([
                str(uuid.uuid4()),
                vid,
                si_name,
                info["stems_per_order"],
                str(info["retail_price"]),
            ])
        if not values_parts:
            continue
        sql = (
            f"INSERT INTO sales_items (id, variety_id, name, stems_per_order, retail_price) "
            f"VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (name) DO UPDATE SET "
            f"variety_id = EXCLUDED.variety_id, "
            f"stems_per_order = EXCLUDED.stems_per_order, "
            f"retail_price = EXCLUDED.retail_price "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.sales_items_created += 1
            else:
                result.sales_items_updated += 1

    # Fetch sales item id map: name -> uuid
    _, si_rows = await conn.execute_query("SELECT id, name FROM sales_items", [])
    si_id_map = {r["name"]: str(r["id"]) for r in si_rows}

    # --- Upsert customer prices ---
    price_rows_to_insert: list[tuple] = []
    for row in rows:
        cust_num = _parse_int(row.get("Cust #"))
        si_name = (row.get("Sales Item") or "").strip()
        price = _parse_decimal(row.get("Price"))

        if cust_num is None or not si_name or price is None:
            continue

        cust_uuid = cust_id_map.get(cust_num)
        si_uuid = si_id_map.get(si_name)
        if not cust_uuid or not si_uuid:
            continue

        price_rows_to_insert.append((cust_uuid, si_uuid, price))

    # Deduplicate by (customer_id, sales_item_id) — keep last occurrence
    seen_prices: dict[tuple, int] = {}
    for i, (c, s, _p) in enumerate(price_rows_to_insert):
        seen_prices[(c, s)] = i
    price_rows_to_insert = [price_rows_to_insert[i] for i in sorted(seen_prices.values())]

    for chunk in _chunks(price_rows_to_insert, 1000):
        values_parts = []
        params = []
        for i, (cust_uuid, si_uuid, price) in enumerate(chunk):
            offset = i * 4
            values_parts.append(f"(${offset+1}, ${offset+2}, ${offset+3}, ${offset+4}::numeric)")
            params.extend([str(uuid.uuid4()), cust_uuid, si_uuid, str(price)])
        sql = (
            f"INSERT INTO customer_prices (id, customer_id, sales_item_id, price) "
            f"VALUES {', '.join(values_parts)} "
            f"ON CONFLICT (customer_id, sales_item_id) DO UPDATE SET "
            f"price = EXCLUDED.price "
            f"RETURNING (xmax = 0) AS inserted"
        )
        _, rows_back = await conn.execute_query(sql, params)
        for r in rows_back:
            if r["inserted"]:
                result.prices_created += 1
            else:
                result.prices_updated += 1

    return result


# ---------------------------------------------------------------------------
# import_colors
# ---------------------------------------------------------------------------

async def import_colors(rows: list[dict]) -> ImportColorsResult:
    """Import hex color values for varieties."""
    conn = Tortoise.get_connection("default")
    result = ImportColorsResult()

    for row in rows:
        variety_name = (row.get("Variety/Item") or "").strip()
        hex_color = (row.get("Hex Color") or "").strip()

        if not variety_name or not hex_color:
            continue

        _, affected = await conn.execute_query(
            "UPDATE varieties SET hex_color = $1 WHERE name = $2 RETURNING id",
            [hex_color, variety_name],
        )
        if affected:
            result.varieties_updated += len(affected)
        else:
            result.varieties_not_found += 1

    return result
