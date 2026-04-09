"""Application configuration loaded from environment variables."""

import os


DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgres://fullbloom:fullbloom@localhost:5432/fullbloom",
)

ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")

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
                "aerich.models",
            ],
            "default_connection": "default",
        },
    },
}
