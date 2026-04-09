"""CLI seed command for importing CSV data into the database.

Usage:
    python -m app.seed --varieties path/to/varieties.csv
    python -m app.seed --pricing path/to/pricing.csv
    python -m app.seed --colors path/to/colors.csv
    python -m app.seed --varieties v.csv --pricing p.csv --colors c.csv
"""

import argparse
import asyncio

from tortoise import Tortoise

from app.config import TORTOISE_ORM
from app.services.import_service import import_colors, import_pricing, import_varieties
from app.utils.csv_parser import parse_csv


async def main(args: argparse.Namespace) -> None:
    await Tortoise.init(config=TORTOISE_ORM)

    try:
        if args.varieties:
            with open(args.varieties, "rb") as f:
                rows = parse_csv(f.read())
            result = await import_varieties(rows)
            print(f"Varieties import: {result.model_dump()}")

        if args.pricing:
            with open(args.pricing, "rb") as f:
                rows = parse_csv(f.read())
            result = await import_pricing(rows)
            print(f"Pricing import: {result.model_dump()}")

        if args.colors:
            with open(args.colors, "rb") as f:
                rows = parse_csv(f.read())
            result = await import_colors(rows)
            print(f"Colors import: {result.model_dump()}")
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database from CSV files")
    parser.add_argument("--varieties", type=str, help="Path to varieties CSV file")
    parser.add_argument("--pricing", type=str, help="Path to pricing CSV file")
    parser.add_argument("--colors", type=str, help="Path to colors CSV file")
    args = parser.parse_args()

    if not any([args.varieties, args.pricing, args.colors]):
        parser.error("At least one of --varieties, --pricing, or --colors is required")

    asyncio.run(main(args))
