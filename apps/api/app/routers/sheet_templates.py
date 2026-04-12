"""Count sheet template endpoints — manage customer column configurations."""

from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException

logger = structlog.get_logger()

from app.models.customer import Customer
from app.models.inventory import CountSheetTemplate
from app.models.product import ProductType
from app.schemas.inventory import (
    TemplateColumn,
    TemplateResponse,
    TemplateUpdateRequest,
)

router = APIRouter(prefix="/api/v1", tags=["sheet_templates"])


async def _resolve_columns(columns_raw: list[dict]) -> list[TemplateColumn]:
    """Resolve customer names for template columns."""
    customer_ids = [col["customer_id"] for col in columns_raw]
    customers = await Customer.filter(id__in=customer_ids) if customer_ids else []
    cust_map = {str(c.id): c.name for c in customers}
    result = []
    for col in columns_raw:
        result.append(
            TemplateColumn(
                customer_id=str(col["customer_id"]),
                customer_name=cust_map.get(str(col["customer_id"]), "Unknown"),
                bunch_size=col["bunch_size"],
                sleeve_type=col["sleeve_type"],
            )
        )
    return result


@router.get("/count-sheet-templates/{product_type_id}")
async def get_template(product_type_id: UUID) -> dict:
    """Return the count sheet template with customer names resolved."""
    logger.info("get_template", product_type_id=str(product_type_id))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    template = await CountSheetTemplate.get_or_none(product_type_id=product_type_id)
    columns_raw = template.columns if template else []
    columns = await _resolve_columns(columns_raw)

    return {
        "data": TemplateResponse(
            product_type_id=str(product_type_id),
            columns=columns,
        )
    }


@router.put("/count-sheet-templates/{product_type_id}")
async def save_template(product_type_id: UUID, body: TemplateUpdateRequest) -> dict:
    """Save or update the count sheet template columns."""
    logger.info("save_template", product_type_id=str(product_type_id), column_count=len(body.columns))
    product_type = await ProductType.get_or_none(id=product_type_id)
    if product_type is None:
        raise HTTPException(status_code=404, detail="Product type not found")

    columns_data = [
        {
            "customer_id": str(col.customer_id),
            "bunch_size": col.bunch_size,
            "sleeve_type": col.sleeve_type,
        }
        for col in body.columns
    ]

    template = await CountSheetTemplate.get_or_none(product_type_id=product_type_id)
    if template:
        template.columns = columns_data
        await template.save()
    else:
        template = await CountSheetTemplate.create(
            product_type_id=product_type_id,
            columns=columns_data,
        )

    columns = await _resolve_columns(columns_data)
    return {
        "data": TemplateResponse(
            product_type_id=str(product_type_id),
            columns=columns,
        )
    }
