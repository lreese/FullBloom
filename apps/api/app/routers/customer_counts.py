"""Customer count endpoints — list and save customer-specific bunch counts."""

from datetime import date
from typing import Literal
from uuid import UUID

import structlog
from fastapi import Depends, APIRouter, HTTPException, Query

logger = structlog.get_logger()

from app.models.customer import Customer
from app.models.inventory import CountSheetTemplate, CustomerCount, CustomerCountAuditLog, DailyCount, SheetCompletion
from app.models.product import ProductType, Variety
from app.schemas.inventory import (
    CustomerCountItem,
    CustomerCountProductLineResponse,
    CustomerCountSaveRequest,
    CustomerCountSaveResponse,
    CustomerCountSheetResponse,
    CustomerCountVarietyResponse,
    TemplateColumn,
)

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["customer_counts"], dependencies=[Depends(get_current_user)])


@router.get("/customer-counts")
async def list_customer_counts(
    product_type_id: UUID = Query(...),
    count_date: date = Query(default_factory=date.today),
    _user: User = Depends(require_permission("inventory_counts", "read")),
) -> dict:
    """List customer counts for a product type on a date."""
    logger.info("list_customer_counts", product_type_id=str(product_type_id), count_date=str(count_date))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    # Load template columns
    template = await CountSheetTemplate.get_or_none(product_type_id=product_type_id)
    columns_raw = template.columns if template else []
    # Batch-fetch all customers in one query
    customer_ids = [col["customer_id"] for col in columns_raw]
    customers = await Customer.filter(id__in=customer_ids) if customer_ids else []
    cust_map = {str(c.id): c.name for c in customers}
    template_columns: list[TemplateColumn] = []
    for col in columns_raw:
        template_columns.append(
            TemplateColumn(
                customer_id=str(col["customer_id"]),
                customer_name=cust_map.get(str(col["customer_id"]), "Unknown"),
                bunch_size=col["bunch_size"],
                sleeve_type=col["sleeve_type"],
            )
        )

    # Get in-harvest, active varieties
    varieties = (
        await Variety.filter(
            product_line__product_type_id=product_type_id,
            in_harvest=True,
            is_active=True,
        )
        .prefetch_related("product_line")
        .order_by("product_line__name", "name")
    )

    # Existing customer counts
    existing_counts = await CustomerCount.filter(
        product_type_id=product_type_id, count_date=count_date
    )
    # key: "variety_id|customer_id|bunch_size|sleeve_type"
    cc_map: dict[str, CustomerCount] = {}
    for cc in existing_counts:
        key = f"{cc.variety_id}|{cc.customer_id}|{cc.bunch_size}|{cc.sleeve_type}"
        cc_map[key] = cc

    # Sheet completion
    completion = await SheetCompletion.get_or_none(
        product_type_id=product_type_id,
        sheet_type="customer_count",
        sheet_date=count_date,
    )

    # Group by product line, compute totals
    pl_map: dict[str, list[CustomerCountVarietyResponse]] = {}
    pl_names: dict[str, str] = {}
    pl_totals: dict[str, dict[str, int]] = {}
    grand_totals: dict[str, int] = {}

    for v in varieties:
        pl_id = str(v.product_line_id)
        pl_names[pl_id] = v.product_line.name  # type: ignore[attr-defined]

        counts_dict: dict[str, int | None] = {}
        for col in template_columns:
            col_key = f"{v.id}|{col.customer_id}|{col.bunch_size}|{col.sleeve_type}"
            lookup = f"{col.customer_id}|{col.bunch_size}|{col.sleeve_type}"
            cc = cc_map.get(col_key)
            counts_dict[lookup] = cc.bunch_count if cc else None

            # Accumulate totals as 10-stem equivalents
            if cc and cc.bunch_count is not None:
                tier_key = f"total_{col.bunch_size}_stem"
                equiv = round(cc.bunch_count * col.bunch_size / 10)
                pl_totals.setdefault(pl_id, {})
                pl_totals[pl_id][tier_key] = pl_totals[pl_id].get(tier_key, 0) + equiv
                grand_totals[tier_key] = grand_totals.get(tier_key, 0) + equiv

        # Check is_done from any existing customer count for this variety
        variety_ccs = [
            cc_map[k] for k in cc_map if k.startswith(f"{v.id}|")
        ]
        is_done = all(cc.is_done for cc in variety_ccs) if variety_ccs else False

        item = CustomerCountVarietyResponse(
            variety_id=str(v.id),
            variety_name=v.name,
            is_done=is_done,
            counts=counts_dict,
        )
        pl_map.setdefault(pl_id, []).append(item)

    # Compute customer-only total (sum of all stem-tier equivalents)
    total_customer = sum(grand_totals.values())
    grand_totals["total_customer_bunched"] = total_customer

    # Fetch remaining counts from DailyCount (Story 1) for same date/product_type
    daily_counts = await DailyCount.filter(
        product_type_id=product_type_id,
        count_date=count_date,
        count_value__isnull=False,
    ).values("variety_id", "count_value")
    total_remaining = sum(dc["count_value"] for dc in daily_counts)
    grand_totals["total_remaining"] = total_remaining
    grand_totals["total_all_bunched"] = total_customer + total_remaining

    product_lines = [
        CustomerCountProductLineResponse(
            product_line_id=pl_id,
            product_line_name=pl_names[pl_id],
            varieties=vars_list,
            totals=pl_totals.get(pl_id, {}),
        )
        for pl_id, vars_list in pl_map.items()
    ]

    return {
        "data": CustomerCountSheetResponse(
            count_date=count_date,
            product_type_id=str(product_type_id),
            product_type_name=product_type.name,
            sheet_complete=completion.is_complete if completion else False,
            template_columns=template_columns,
            product_lines=product_lines,
            grand_totals=grand_totals,
        )
    }


@router.put("/customer-counts")
async def save_customer_counts(body: CustomerCountSaveRequest, user: User = Depends(require_permission("inventory_counts", "write"))) -> dict:
    """Batch save/update customer counts."""
    logger.info("save_customer_counts", product_type_id=str(body.product_type_id), count_date=str(body.count_date), count=len(body.counts))

    # Reject writes if the sheet is already completed
    completion = await SheetCompletion.get_or_none(
        product_type_id=body.product_type_id,
        sheet_type="customer_count",
        sheet_date=body.count_date,
    )
    if completion and completion.is_complete:
        raise HTTPException(status_code=409, detail="Sheet is complete — reopen it before making changes")

    # Validate variety IDs belong to this product type and are active
    variety_ids = list({item.variety_id for item in body.counts})
    valid_ids = set(
        await Variety.filter(
            id__in=variety_ids,
            product_line__product_type_id=body.product_type_id,
            is_active=True,
        ).values_list("id", flat=True)
    )
    saved = 0
    for item in body.counts:
        if item.variety_id not in valid_ids:
            logger.warning("save_customer_counts_skipped_invalid_variety", variety_id=str(item.variety_id), product_type_id=str(body.product_type_id))
            continue
        existing = await CustomerCount.get_or_none(
            variety_id=item.variety_id,
            customer_id=item.customer_id,
            count_date=body.count_date,
            bunch_size=item.bunch_size,
            sleeve_type=item.sleeve_type,
        )
        if existing:
            existing.bunch_count = item.bunch_count
            existing.is_done = item.is_done
            existing.entered_by = user.email
            await existing.save()
            cc_record = existing
        else:
            cc_record = await CustomerCount.create(
                variety_id=item.variety_id,
                product_type_id=body.product_type_id,
                customer_id=item.customer_id,
                count_date=body.count_date,
                bunch_size=item.bunch_size,
                sleeve_type=item.sleeve_type,
                bunch_count=item.bunch_count,
                is_done=item.is_done,
                entered_by=user.email,
            )
        # Create audit log entry
        await CustomerCountAuditLog.create(
            customer_count=cc_record,
            action="set",
            amount=item.bunch_count if item.bunch_count is not None else 0,
            resulting_total=item.bunch_count if item.bunch_count is not None else 0,
            entered_by=user.email,
        )
        saved += 1

    return {"data": CustomerCountSaveResponse(saved_count=saved)}


@router.get("/customer-counts/{variety_id}/audit-log")
async def get_customer_count_audit_log(
    variety_id: UUID,
    customer_id: UUID = Query(...),
    bunch_size: int = Query(...),
    sleeve_type: Literal["Plastic", "Paper"] = Query(...),
    count_date: date = Query(...),
    _user: User = Depends(require_permission("inventory_counts", "read")),
) -> dict:
    """Return last 20 audit log entries for a specific customer count."""
    logger.info(
        "get_customer_count_audit_log",
        variety_id=str(variety_id),
        customer_id=str(customer_id),
        count_date=str(count_date),
    )
    # Find the matching CustomerCount record
    cc = await CustomerCount.get_or_none(
        variety_id=variety_id,
        customer_id=customer_id,
        bunch_size=bunch_size,
        sleeve_type=sleeve_type,
        count_date=count_date,
    )
    if cc is None:
        return {"data": []}

    entries = (
        await CustomerCountAuditLog.filter(customer_count=cc)
        .order_by("-created_at")
        .limit(20)
    )
    return {
        "data": [
            {
                "id": str(e.id),
                "action": e.action,
                "amount": e.amount,
                "resulting_total": e.resulting_total,
                "entered_by": e.entered_by or "anonymous",
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ]
    }
