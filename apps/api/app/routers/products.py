"""Product / variety endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.order import OrderLine
from app.models.product import SalesItem, Variety, VarietyColor
from app.schemas.product import SalesItemResponse, VarietyResponse

router = APIRouter(prefix="/api/v1", tags=["products"])


@router.get("/products")
async def list_products(
    type: str | None = None,
    search: str | None = None,
    show_all: bool = False,
) -> dict:
    """List varieties with nested sales items.

    Filters:
      - type: filter by ProductType name
      - search: partial match on variety name
      - show_all: include varieties with show=False (default: only show=True)
    """
    qs = Variety.all()
    if not show_all:
        qs = qs.filter(show=True)
    if type:
        qs = qs.filter(product_line__product_type__name__iexact=type)
    if search:
        qs = qs.filter(name__icontains=search)

    varieties = await qs.prefetch_related(
        "sales_items", "product_line", "product_line__product_type"
    ).order_by("name")

    data = []
    for v in varieties:
        data.append(
            VarietyResponse(
                id=str(v.id),
                type=v.product_line.product_type.name,  # type: ignore[attr-defined]
                product_line=v.product_line.name,  # type: ignore[attr-defined]
                name=v.name,
                color=v.color,
                hex_color=v.hex_color,
                flowering_type=v.flowering_type,
                show=v.show,
                sales_items=[
                    SalesItemResponse(
                        id=str(si.id),
                        name=si.name,
                        stems_per_order=si.stems_per_order,
                        retail_price=str(si.retail_price),
                    )
                    for si in v.sales_items  # type: ignore[attr-defined]
                ],
            )
        )
    return {"data": data}


@router.get("/varieties/{variety_id}/colors")
async def get_variety_colors(variety_id: str) -> dict:
    """Return known color values for a variety.

    Unions two sources:
      1. Distinct color_variety values from OrderLines for this variety's sales items
      2. Colors stored in the VarietyColor helper table
    Also includes the variety's own color field if set.
    """
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    colors: set[str] = set()

    # Add the variety's own color if present
    if variety.color:
        colors.add(variety.color)

    # Get sales item IDs for this variety
    si_ids = await SalesItem.filter(variety_id=variety_id).values_list("id", flat=True)

    if si_ids:
        # Distinct color_variety values from order lines
        order_colors = (
            await OrderLine.filter(sales_item_id__in=si_ids, color_variety__not_isnull=True)
            .distinct()
            .values_list("color_variety", flat=True)
        )
        colors.update(c for c in order_colors if c)

    # Colors from the helper table
    helper_colors = await VarietyColor.filter(variety_id=variety_id).values_list(
        "color_name", flat=True
    )
    colors.update(helper_colors)

    return {"data": sorted(colors)}


@router.post("/varieties/{variety_id}/colors")
async def add_variety_color(variety_id: str, body: dict) -> dict:
    """Add a new color for a variety via the VarietyColor helper table."""
    variety = await Variety.get_or_none(id=variety_id)
    if variety is None:
        raise HTTPException(status_code=404, detail="Variety not found")

    color = body.get("color")
    if not color:
        raise HTTPException(status_code=422, detail="color is required")

    await VarietyColor.get_or_create(
        variety_id=variety_id, color_name=color
    )

    return {"data": {"color": color}}
