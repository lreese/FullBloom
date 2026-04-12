from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "standing_orders" (
    "id" UUID NOT NULL PRIMARY KEY,
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "frequency_weeks" INT NOT NULL,
    "days_of_week" JSONB NOT NULL,
    "reference_date" DATE NOT NULL,
    "ship_via" VARCHAR(100),
    "salesperson_email" VARCHAR(255),
    "box_charge" DECIMAL(10,2),
    "holiday_charge_pct" DECIMAL(5,4),
    "special_charge" DECIMAL(10,2),
    "freight_charge" DECIMAL(10,2),
    "freight_charge_included" BOOL NOT NULL DEFAULT False,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" UUID NOT NULL REFERENCES "customers" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "standing_orders" IS 'A recurring order template for a customer.';
        CREATE TABLE IF NOT EXISTS "standing_order_audit_logs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "action" VARCHAR(10) NOT NULL,
    "reason" TEXT,
    "changes" JSONB NOT NULL,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "standing_order_id" UUID NOT NULL REFERENCES "standing_orders" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "standing_order_audit_logs" IS 'Audit trail for standing order changes with required reasons.';
        CREATE TABLE IF NOT EXISTS "standing_order_lines" (
    "id" UUID NOT NULL PRIMARY KEY,
    "stems" INT NOT NULL,
    "price_per_stem" DECIMAL(10,2) NOT NULL,
    "item_fee_pct" DECIMAL(5,4),
    "item_fee_dollar" DECIMAL(10,2),
    "color_variety" VARCHAR(100),
    "notes" TEXT,
    "line_number" INT NOT NULL,
    "sales_item_id" UUID NOT NULL REFERENCES "sales_items" ("id") ON DELETE CASCADE,
    "standing_order_id" UUID NOT NULL REFERENCES "standing_orders" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_standing_or_standin_331ca7" UNIQUE ("standing_order_id", "line_number")
);
COMMENT ON TABLE "standing_order_lines" IS 'A single sales item within a standing order template.';
        ALTER TABLE "orders" ADD "standing_order_id" UUID;
        ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_standing_eec4296c" FOREIGN KEY ("standing_order_id") REFERENCES "standing_orders" ("id") ON DELETE SET NULL;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "fk_orders_standing_eec4296c";
        ALTER TABLE "orders" DROP COLUMN "standing_order_id";
        DROP TABLE IF EXISTS "standing_order_audit_logs";
        DROP TABLE IF EXISTS "standing_orders";
        DROP TABLE IF EXISTS "standing_order_lines";"""


MODELS_STATE = (
    "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"
    "mTGdhVlLBs8uN5a//w9VXWJM"
)
