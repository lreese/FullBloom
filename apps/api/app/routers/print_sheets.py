"""Print sheet endpoint — generate print-optimized HTML count sheets."""

import html
from datetime import date, timedelta
from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

logger = structlog.get_logger()


def _e(s) -> str:
    """HTML-escape a value for safe interpolation."""
    return html.escape(str(s))

from app.models.customer import Customer
from app.models.inventory import CountSheetTemplate
from app.models.product import ProductType, Variety
from app.services.inventory_service import get_pull_dates

from app.auth.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/api/v1", tags=["print"], dependencies=[Depends(get_current_user)])


@router.get("/print/count-sheet", response_class=HTMLResponse)
async def print_count_sheet(
    product_type_id: UUID = Query(...),
    sheet_type: str = Query(...),
    query_date: date = Query(default_factory=date.today, alias="date"),
) -> HTMLResponse:
    """Generate a print-optimized blank count sheet as HTML."""
    logger.info("print_count_sheet", product_type_id=str(product_type_id), sheet_type=sheet_type, date=str(query_date))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    if sheet_type not in ("daily_count", "customer_count", "estimate"):
        raise HTTPException(status_code=422, detail=f"Unknown sheet type: {sheet_type}")

    # Get in-harvest, active varieties grouped by product line
    varieties = (
        await Variety.filter(
            product_line__product_type_id=product_type_id,
            in_harvest=True,
            is_active=True,
        )
        .prefetch_related("product_line")
        .order_by("product_line__name", "name")
    )

    # Group by product line
    pl_groups: dict[str, list] = {}
    pl_names: dict[str, str] = {}
    for v in varieties:
        pl_id = str(v.product_line_id)
        pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]
        pl_groups.setdefault(pl_id, []).append(v)

    # Build HTML
    if sheet_type == "daily_count":
        title = f"{_e(product_type.name)} — Daily Count Sheet — {query_date.isoformat()}"
        columns = ["Variety", "Count", "Done"]
        table_html = _build_daily_count_html(pl_groups, pl_names, columns)

    elif sheet_type == "customer_count":
        template = await CountSheetTemplate.get_or_none(product_type_id=product_type_id)
        cols_raw = template.columns if template else []
        # Batch-fetch all customers in one query
        customer_ids = [col["customer_id"] for col in cols_raw]
        customers = await Customer.filter(id__in=customer_ids) if customer_ids else []
        cust_map = {str(c.id): c.name for c in customers}
        col_headers = []
        for col in cols_raw:
            name = cust_map.get(str(col["customer_id"]), "Unknown")
            bunch_size = col["bunch_size"]
            col_headers.append(f"{_e(name)} {bunch_size}s/{_e(col['sleeve_type'])}")

        title = f"{_e(product_type.name)} — Specials Sheet — {query_date.isoformat()}"
        columns = ["Variety"] + col_headers + ["Done"]
        table_html = _build_customer_count_html(pl_groups, pl_names, columns, len(col_headers))

    elif sheet_type == "estimate":
        pull_days = await get_pull_dates(query_date)
        day_headers = [pd.strftime("%a %m/%d") for pd in pull_days]
        title = f"{_e(product_type.name)} — Estimate Sheet — Week of {query_date.isoformat()}"
        columns = ["Variety"] + day_headers + ["Done"]
        table_html = _build_estimate_html(pl_groups, pl_names, columns, len(day_headers))

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
@media print {{
    body {{ font-size: 10pt; margin: 0; }}
    table {{ page-break-inside: auto; }}
    tr {{ page-break-inside: avoid; }}
    .no-print {{ display: none; }}
}}
body {{ font-family: Arial, sans-serif; margin: 16px; }}
h1 {{ font-size: 14pt; margin-bottom: 8px; }}
table {{ border-collapse: collapse; width: 100%; margin-bottom: 16px; }}
th, td {{ border: 1px solid #333; padding: 4px 8px; text-align: left; }}
th {{ background-color: #f0f0f0; font-size: 9pt; }}
td {{ min-height: 20px; }}
.pl-header {{ background-color: #e0e0e0; font-weight: bold; }}
.empty-cell {{ min-width: 60px; }}
</style>
</head>
<body>
<h1>{title}</h1>
{table_html}
</body>
</html>"""
    return HTMLResponse(content=html)


def _build_daily_count_html(
    pl_groups: dict[str, list],
    pl_names: dict[str, str],
    columns: list[str],
) -> str:
    rows = ["<table>", "<thead><tr>"]
    for col in columns:
        rows.append(f"<th>{col}</th>")
    rows.append("</tr></thead><tbody>")
    for pl_id, varieties in pl_groups.items():
        rows.append(
            f'<tr class="pl-header"><td colspan="{len(columns)}">{_e(pl_names[pl_id])}</td></tr>'
        )
        for v in varieties:
            rows.append(
                f"<tr><td>{_e(v.name)}</td>"
                f'<td class="empty-cell"></td>'
                f'<td class="empty-cell"></td></tr>'
            )
    rows.append("</tbody></table>")
    return "\n".join(rows)


def _build_customer_count_html(
    pl_groups: dict[str, list],
    pl_names: dict[str, str],
    columns: list[str],
    num_customer_cols: int,
) -> str:
    rows = [
        "<style>@page { size: landscape; }</style>",
        "<table>", "<thead><tr>",
    ]
    for col in columns:
        rows.append(f"<th>{_e(col)}</th>")
    rows.append("</tr></thead><tbody>")
    for pl_id, varieties in pl_groups.items():
        rows.append(
            f'<tr class="pl-header"><td colspan="{len(columns)}">{_e(pl_names[pl_id])}</td></tr>'
        )
        for v in varieties:
            empty_cells = ''.join(f'<td class="empty-cell"></td>' for _ in range(num_customer_cols))
            rows.append(
                f"<tr><td>{_e(v.name)}</td>"
                f"{empty_cells}"
                f'<td class="empty-cell"></td></tr>'
            )
    rows.append("</tbody></table>")
    return "\n".join(rows)


def _build_estimate_html(
    pl_groups: dict[str, list],
    pl_names: dict[str, str],
    columns: list[str],
    num_day_cols: int,
) -> str:
    rows = ["<table>", "<thead><tr>"]
    for col in columns:
        rows.append(f"<th>{_e(col)}</th>")
    rows.append("</tr></thead><tbody>")
    for pl_id, varieties in pl_groups.items():
        rows.append(
            f'<tr class="pl-header"><td colspan="{len(columns)}">{_e(pl_names[pl_id])}</td></tr>'
        )
        for v in varieties:
            empty_cells = ''.join(f'<td class="empty-cell"></td>' for _ in range(num_day_cols))
            rows.append(
                f"<tr><td>{_e(v.name)}</td>"
                f"{empty_cells}"
                f'<td class="empty-cell"></td></tr>'
            )
    rows.append("</tbody></table>")
    return "\n".join(rows)
