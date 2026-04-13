"""Import endpoints for CSV data ingestion."""

import asyncio

from fastapi import Depends, APIRouter, File, HTTPException, UploadFile

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

from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User

router = APIRouter(prefix="/api/v1/import", tags=["import"], dependencies=[Depends(get_current_user)])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_CSV_ROWS = 50_000
_import_lock = asyncio.Lock()


ALLOWED_CSV_TYPES = {"text/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"}


async def _read_csv(file: UploadFile) -> list[dict]:
    """Read and parse a CSV upload, enforcing type, size, and row limits."""
    if file.content_type and file.content_type not in ALLOWED_CSV_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file type '{file.content_type}'. Expected a CSV file.",
        )
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes (10 MB).",
        )
    rows = parse_csv(content)
    if len(rows) > MAX_CSV_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many rows ({len(rows)}). Maximum is {MAX_CSV_ROWS}.",
        )
    return rows


@router.post("/varieties", response_model=dict)
async def upload_varieties(file: UploadFile = File(...), user: User = Depends(require_permission("import", "write"))):
    """Import varieties from a CSV file."""
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")
    async with _import_lock:
        rows = await _read_csv(file)
        result = await import_varieties(rows)
        return {"data": result.model_dump()}


@router.post("/pricing", response_model=dict)
async def upload_pricing(file: UploadFile = File(...), user: User = Depends(require_permission("import", "write"))):
    """Import pricing data from a CSV file."""
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")
    async with _import_lock:
        rows = await _read_csv(file)
        result = await import_pricing(rows)
        return {"data": result.model_dump()}


@router.post("/colors", response_model=dict)
async def upload_colors(file: UploadFile = File(...), user: User = Depends(require_permission("import", "write"))):
    """Import hex color data for varieties from a CSV file."""
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")
    async with _import_lock:
        rows = await _read_csv(file)
        result = await import_colors(rows)
        return {"data": result.model_dump()}


@router.post("/customer-info", response_model=dict)
async def upload_customer_info(file: UploadFile = File(...), user: User = Depends(require_permission("import", "write"))):
    """Import customer info from the Customer Info CSV."""
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")
    async with _import_lock:
        rows = await _read_csv(file)
        result = await import_customer_info(rows)
        return {"data": result.model_dump()}


@router.post("/price-categories", response_model=dict)
async def upload_price_categories(file: UploadFile = File(...), user: User = Depends(require_permission("import", "write"))):
    """Import price categories from the Customer Price Category CSV."""
    if _import_lock.locked():
        raise HTTPException(status_code=409, detail="Another import is in progress")
    async with _import_lock:
        rows = await _read_csv(file)
        result = await import_price_categories(rows)
        return {"data": result.model_dump()}
