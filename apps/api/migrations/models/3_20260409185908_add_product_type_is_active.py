from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "product_types" ADD "is_active" BOOL NOT NULL DEFAULT True;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "product_types" DROP COLUMN "is_active";"""


MODELS_STATE = (
    "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"
)
