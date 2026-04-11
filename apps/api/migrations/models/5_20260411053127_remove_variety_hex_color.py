from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" DROP COLUMN "hex_color";"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" ADD "hex_color" VARCHAR(7);"""


MODELS_STATE = (
    "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"
)
