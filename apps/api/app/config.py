"""Application configuration loaded from environment variables."""

import os


DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgres://fullbloom:fullbloom@localhost:5432/fullbloom",  # dev-only default; production must set DATABASE_URL
)
# TODO: In production, remove default and use: os.environ["DATABASE_URL"]

ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174",
    ).split(",")
    if o.strip()
]

if ENVIRONMENT != "development" and "*" in CORS_ORIGINS:
    raise RuntimeError("Wildcard CORS origin ('*') is not allowed outside development")

TORTOISE_ORM = {
    "connections": {
        "default": DATABASE_URL,
    },
    "apps": {
        "models": {
            "models": [
                "app.models.customer",
                "app.models.product",
                "app.models.pricing",
                "app.models.order",
                "app.models.inventory",
                "app.models.standing_order",
                "aerich.models",
            ],
            "default_connection": "default",
        },
    },
}
