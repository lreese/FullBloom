"""Pydantic response schemas for CSV import endpoints."""

from pydantic import BaseModel


class ImportVarietiesResult(BaseModel):
    types_created: int = 0
    types_updated: int = 0
    lines_created: int = 0
    lines_updated: int = 0
    varieties_created: int = 0
    varieties_updated: int = 0


class ImportPricingResult(BaseModel):
    customers_created: int = 0
    customers_updated: int = 0
    prices_created: int = 0
    prices_updated: int = 0
    sales_items_created: int = 0
    sales_items_updated: int = 0


class ImportColorsResult(BaseModel):
    varieties_updated: int = 0
    varieties_not_found: int = 0


class ImportCustomerInfoResult(BaseModel):
    customers_created: int = 0
    customers_updated: int = 0
    customers_skipped: int = 0


class ImportPriceCategoryResult(BaseModel):
    customers_updated: int = 0
    customers_not_found: int = 0
    customers_skipped: int = 0
