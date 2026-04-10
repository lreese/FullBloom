from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "product_lines" ADD "is_active" BOOL NOT NULL DEFAULT True;
        ALTER TABLE "sales_items" ADD "is_active" BOOL NOT NULL DEFAULT True;
        ALTER TABLE "varieties" ADD "is_active" BOOL NOT NULL DEFAULT True;
        ALTER TABLE "variety_colors" ADD "is_active" BOOL NOT NULL DEFAULT True;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" DROP COLUMN "is_active";
        ALTER TABLE "sales_items" DROP COLUMN "is_active";
        ALTER TABLE "product_lines" DROP COLUMN "is_active";
        ALTER TABLE "variety_colors" DROP COLUMN "is_active";"""


MODELS_STATE = (
    "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"
)
