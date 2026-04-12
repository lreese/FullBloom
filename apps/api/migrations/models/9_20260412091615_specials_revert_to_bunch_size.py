from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customer_counts" DROP CONSTRAINT IF EXISTS "uid_customer_co_variety_8b4e3e";
        ALTER TABLE "customer_counts" DROP CONSTRAINT IF EXISTS "fk_customer_sales_it_7f1b8b3f";
        ALTER TABLE "customer_counts" ADD "bunch_size" INT NOT NULL;
        ALTER TABLE "customer_counts" DROP COLUMN "sales_item_id";
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_customer_co_variety_d906b0" ON "customer_counts" ("variety_id", "customer_id", "count_date", "bunch_size", "sleeve_type");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uid_customer_co_variety_d906b0";
        ALTER TABLE "customer_counts" ADD "sales_item_id" UUID NOT NULL;
        ALTER TABLE "customer_counts" DROP COLUMN "bunch_size";
        ALTER TABLE "customer_counts" ADD CONSTRAINT "fk_customer_sales_it_7f1b8b3f" FOREIGN KEY ("sales_item_id") REFERENCES "sales_items" ("id") ON DELETE CASCADE;
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_customer_co_variety_8b4e3e" ON "customer_counts" ("variety_id", "customer_id", "count_date", "sales_item", "sleeve_type");"""


MODELS_STATE = (
    "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"
)
