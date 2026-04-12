from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customer_counts" DROP CONSTRAINT IF EXISTS "uid_customer_co_variety_d906b0";
        ALTER TABLE "customer_counts" ADD "sales_item_id" UUID NOT NULL;
        ALTER TABLE "customer_counts" DROP COLUMN "bunch_size";
        ALTER TABLE "customer_counts" ADD CONSTRAINT "fk_customer_sales_it_7f1b8b3f" FOREIGN KEY ("sales_item_id") REFERENCES "sales_items" ("id") ON DELETE CASCADE;
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_customer_co_variety_996534" ON "customer_counts" ("variety_id", "customer_id", "count_date", "sales_item_id", "sleeve_type");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uid_customer_co_variety_996534";
        ALTER TABLE "customer_counts" DROP CONSTRAINT IF EXISTS "fk_customer_sales_it_7f1b8b3f";
        ALTER TABLE "customer_counts" ADD "bunch_size" INT NOT NULL;
        ALTER TABLE "customer_counts" DROP COLUMN "sales_item_id";
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_customer_co_variety_d906b0" ON "customer_counts" ("variety_id", "customer_id", "count_date", "bunch_size", "sleeve_type");"""


MODELS_STATE = (
    "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"
)
