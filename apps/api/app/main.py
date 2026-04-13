"""FastAPI application entry point."""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException, Request

logger = structlog.get_logger()
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from tortoise import Tortoise

from app.config import CORS_ORIGINS, LOG_LEVEL, TORTOISE_ORM
from app.routers.auth import auth_router
from app.routers.users import users_router
from app.routers.profile import profile_router
from app.routers.colors import router as colors_router
from app.routers.customers import router as customers_router
from app.routers.health import router as health_router
from app.routers.import_data import router as import_router
from app.routers.orders import router as orders_router
from app.routers.standing_orders import router as standing_orders_router
from app.routers.price_lists import router as price_lists_router
from app.routers.pricing import router as pricing_router
from app.routers.product_lines import router as product_lines_router
from app.routers.product_types import router as product_types_router
from app.routers.products import router as products_router
from app.routers.sales_items import router as sales_items_router

# Inventory routers
from app.routers.availability import router as availability_router
from app.routers.comparison import router as comparison_router
from app.routers.counts import router as counts_router
from app.routers.customer_counts import router as customer_counts_router
from app.routers.estimates import router as estimates_router
from app.routers.harvest_status import router as harvest_status_router
from app.routers.print_sheets import router as print_sheets_router
from app.routers.pull_days import router as pull_days_router
from app.routers.sheet_completion import router as sheet_completion_router
from app.routers.sheet_templates import router as sheet_templates_router

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(__import__("logging"), "getLevelName")(LOG_LEVEL.upper())
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage Tortoise ORM connection lifecycle."""
    await Tortoise.init(config=TORTOISE_ORM)
    log.info("tortoise_orm_initialized")
    yield
    await Tortoise.close_connections()
    log.info("tortoise_orm_closed")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FullBloom API",
    description="CRM API for Oregon Flowers",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Exception handlers — normalize error responses to {"error": "message"}
# per the constitution's API envelope convention.
# ---------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Convert FastAPI's {"detail": ...} to {"error": ...}."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail if isinstance(exc.detail, str) else str(exc.detail)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions — log the full traceback and return a structured error."""
    import traceback
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        traceback=traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Convert Pydantic validation errors to {"error": ...} with a readable message."""
    errors = exc.errors()
    if len(errors) == 1:
        e = errors[0]
        field = " → ".join(str(loc) for loc in e.get("loc", []) if loc != "body")
        message = f"{field}: {e['msg']}" if field else e["msg"]
    else:
        messages = []
        for e in errors:
            field = " → ".join(str(loc) for loc in e.get("loc", []) if loc != "body")
            messages.append(f"{field}: {e['msg']}" if field else e["msg"])
        message = "; ".join(messages)
    return JSONResponse(
        status_code=422,
        content={"error": message},
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(profile_router)
app.include_router(health_router)
app.include_router(import_router)
app.include_router(customers_router)
app.include_router(harvest_status_router)  # before products_router to avoid /varieties/{variety_id} catching /varieties/harvest-status
app.include_router(products_router)
app.include_router(product_lines_router)
app.include_router(product_types_router)
app.include_router(colors_router)
app.include_router(sales_items_router)
app.include_router(pricing_router)
app.include_router(price_lists_router)
app.include_router(orders_router)
app.include_router(standing_orders_router)

# Inventory routers
app.include_router(counts_router)
app.include_router(customer_counts_router)
app.include_router(estimates_router)
app.include_router(availability_router)
app.include_router(sheet_completion_router)
app.include_router(sheet_templates_router)
app.include_router(pull_days_router)
app.include_router(comparison_router)
app.include_router(print_sheets_router)
