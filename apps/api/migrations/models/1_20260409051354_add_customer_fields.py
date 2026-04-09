from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" ADD "location" VARCHAR(255);
        ALTER TABLE "customers" ADD "salesperson" VARCHAR(10);
        ALTER TABLE "customers" ADD "email" VARCHAR(255);
        ALTER TABLE "customers" RENAME COLUMN "customer_id" TO "customer_number";
        ALTER TABLE "customers" ADD "payment_terms" VARCHAR(50);
        ALTER TABLE "customers" ADD "default_ship_via" VARCHAR(100);
        ALTER TABLE "customers" ADD "phone" VARCHAR(50);
        ALTER TABLE "customers" ADD "contact_name" VARCHAR(255);
        ALTER TABLE "customers" ADD "notes" TEXT;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" RENAME COLUMN "customer_number" TO "customer_id";
        ALTER TABLE "customers" DROP COLUMN "location";
        ALTER TABLE "customers" DROP COLUMN "salesperson";
        ALTER TABLE "customers" DROP COLUMN "email";
        ALTER TABLE "customers" DROP COLUMN "payment_terms";
        ALTER TABLE "customers" DROP COLUMN "default_ship_via";
        ALTER TABLE "customers" DROP COLUMN "phone";
        ALTER TABLE "customers" DROP COLUMN "contact_name";
        ALTER TABLE "customers" DROP COLUMN "notes";"""


MODELS_STATE = (
    "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"
    "9vvdu16GEtaDV8gmO1L9FrX7A8/ws7C/WY"
)
