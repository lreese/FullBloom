from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1. Create colors table
        CREATE TABLE IF NOT EXISTS "colors" (
            "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" VARCHAR(100) NOT NULL UNIQUE,
            "hex_color" VARCHAR(7),
            "is_active" BOOL NOT NULL DEFAULT True
        );

        -- 2. Populate from distinct variety colors
        INSERT INTO "colors" ("id", "name", "is_active")
        SELECT gen_random_uuid(), DISTINCT_colors.color, True
        FROM (SELECT DISTINCT "color" FROM "varieties" WHERE "color" IS NOT NULL AND "color" != '') AS DISTINCT_colors
        ON CONFLICT ("name") DO NOTHING;

        -- 3. Add color_id FK to varieties
        ALTER TABLE "varieties" ADD COLUMN "color_id" UUID REFERENCES "colors" ("id") ON DELETE SET NULL;

        -- 4. Backfill color_id from varieties.color text matching colors.name
        UPDATE "varieties" v SET "color_id" = c."id"
        FROM "colors" c WHERE v."color" = c."name";

        -- 5. Drop the old free-text color column
        ALTER TABLE "varieties" DROP COLUMN IF EXISTS "color";

        -- 6. Drop the variety_colors table
        DROP TABLE IF EXISTS "variety_colors";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" ADD COLUMN "color" VARCHAR(100);
        UPDATE "varieties" v SET "color" = c."name" FROM "colors" c WHERE v."color_id" = c."id";
        ALTER TABLE "varieties" DROP COLUMN IF EXISTS "color_id";
        DROP TABLE IF EXISTS "colors";
    """
