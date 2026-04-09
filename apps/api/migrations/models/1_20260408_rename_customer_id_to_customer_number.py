from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" RENAME COLUMN "customer_id" TO "customer_number";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" RENAME COLUMN "customer_number" TO "customer_id";
    """
