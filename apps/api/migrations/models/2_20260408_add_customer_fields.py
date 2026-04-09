from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "salesperson" VARCHAR(10);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "contact_name" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "default_ship_via" VARCHAR(100);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "location" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(50);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
        ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "salesperson";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "contact_name";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "default_ship_via";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "phone";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "location";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "payment_terms";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "email";
        ALTER TABLE "customers" DROP COLUMN IF EXISTS "notes";
    """
