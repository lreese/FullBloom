from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "colors" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "hex_color" VARCHAR(7),
    "is_active" BOOL NOT NULL DEFAULT True
);
COMMENT ON TABLE "colors" IS 'A color reference for varieties.';
        ALTER TABLE "varieties" ADD "color_id" UUID;
        ALTER TABLE "varieties" DROP COLUMN "color";
        DROP TABLE IF EXISTS "variety_colors";
        ALTER TABLE "varieties" ADD CONSTRAINT "fk_varietie_colors_3e0effb5" FOREIGN KEY ("color_id") REFERENCES "colors" ("id") ON DELETE SET NULL;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" DROP CONSTRAINT IF EXISTS "fk_varietie_colors_3e0effb5";
        ALTER TABLE "varieties" ADD "color" VARCHAR(100);
        ALTER TABLE "varieties" DROP COLUMN "color_id";
        DROP TABLE IF EXISTS "colors";"""


MODELS_STATE = (
    "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"
)
