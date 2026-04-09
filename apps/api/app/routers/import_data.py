"""Import endpoints for CSV data ingestion."""

from fastapi import APIRouter, File, UploadFile

from app.schemas.import_data import (
    ImportColorsResult,
    ImportPricingResult,
    ImportVarietiesResult,
)
from app.services.import_service import import_colors, import_pricing, import_varieties
from app.utils.csv_parser import parse_csv

router = APIRouter(prefix="/api/v1/import", tags=["import"])


@router.post("/varieties", response_model=dict)
async def upload_varieties(file: UploadFile = File(...)):
    """Import varieties from a CSV file."""
    content = await file.read()
    rows = parse_csv(content)
    result = await import_varieties(rows)
    return {"data": result.model_dump()}


@router.post("/pricing", response_model=dict)
async def upload_pricing(file: UploadFile = File(...)):
    """Import pricing data from a CSV file."""
    content = await file.read()
    rows = parse_csv(content)
    result = await import_pricing(rows)
    return {"data": result.model_dump()}


@router.post("/colors", response_model=dict)
async def upload_colors(file: UploadFile = File(...)):
    """Import hex color data for varieties from a CSV file."""
    content = await file.read()
    rows = parse_csv(content)
    result = await import_colors(rows)
    return {"data": result.model_dump()}
