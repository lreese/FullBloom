"""One-time script to seed variety_colors from varieties.color field."""

import asyncio

from tortoise import Tortoise

from app.config import TORTOISE_ORM


async def main():
    await Tortoise.init(config=TORTOISE_ORM)
    conn = Tortoise.get_connection("default")

    result = await conn.execute_query(
        """
        INSERT INTO variety_colors (id, variety_id, color_name, is_active)
        SELECT gen_random_uuid(), v.id, v.color, true
        FROM varieties v
        WHERE v.color IS NOT NULL AND v.color != ''
        ON CONFLICT (variety_id, color_name) DO NOTHING
        """
    )

    created = result[0]
    print(f"Seeded {created} variety_colors rows.")

    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
