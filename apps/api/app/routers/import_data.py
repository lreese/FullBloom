"""Import endpoints for CSV data ingestion."""

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.import_data import (
    ImportColorsResult,
    ImportCustomerInfoResult,
    ImportPriceCategoryResult,
    ImportPricingResult,
    ImportVarietiesResult,
)
from app.services.import_service import (
    import_colors,
    import_customer_info,
    import_price_categories,
    import_pricing,
    import_varieties,
)
from app.utils.csv_parser import parse_csv

router = APIRouter(prefix="/api/v1/import", tags=["import"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


async def _read_csv(file: UploadFile) -> list[dict]:
    """Read and parse a CSV upload, enforcing a 10 MB size limit."""
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes (10 MB).",
        )
    return parse_csv(content)


@router.post("/varieties", response_model=dict)
async def upload_varieties(file: UploadFile = File(...)):
    """Import varieties from a CSV file."""
    rows = await _read_csv(file)
    result = await import_varieties(rows)
    return {"data": result.model_dump()}


@router.post("/pricing", response_model=dict)
async def upload_pricing(file: UploadFile = File(...)):
    """Import pricing data from a CSV file."""
    rows = await _read_csv(file)
    result = await import_pricing(rows)
    return {"data": result.model_dump()}


@router.post("/colors", response_model=dict)
async def upload_colors(file: UploadFile = File(...)):
    """Import hex color data for varieties from a CSV file."""
    rows = await _read_csv(file)
    result = await import_colors(rows)
    return {"data": result.model_dump()}


@router.post("/customer-info", response_model=dict)
async def upload_customer_info(file: UploadFile = File(...)):
    """Import customer info from the Customer Info CSV."""
    rows = await _read_csv(file)
    result = await import_customer_info(rows)
    return {"data": result.model_dump()}


@router.post("/price-categories", response_model=dict)
async def upload_price_categories(file: UploadFile = File(...)):
    """Import price categories from the Customer Price Category CSV."""
    rows = await _read_csv(file)
    result = await import_price_categories(rows)
    return {"data": result.model_dump()}
