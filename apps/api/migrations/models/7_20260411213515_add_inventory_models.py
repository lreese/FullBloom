from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "daily_counts" (
    "id" UUID NOT NULL PRIMARY KEY,
    "count_date" DATE NOT NULL,
    "count_value" INT,
    "is_done" BOOL NOT NULL DEFAULT False,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type_id" UUID NOT NULL REFERENCES "product_types" ("id") ON DELETE CASCADE,
    "variety_id" UUID NOT NULL REFERENCES "varieties" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_daily_count_variety_402849" UNIQUE ("variety_id", "count_date")
);
COMMENT ON TABLE "daily_counts" IS 'A single variety''s count value on a given date.';
        CREATE TABLE IF NOT EXISTS "count_audit_logs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "action" VARCHAR(10) NOT NULL,
    "amount" INT NOT NULL,
    "resulting_total" INT NOT NULL,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daily_count_id" UUID NOT NULL REFERENCES "daily_counts" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "count_audit_logs" IS 'Audit trail for daily count changes.';
        CREATE TABLE IF NOT EXISTS "count_sheet_templates" (
    "id" UUID NOT NULL PRIMARY KEY,
    "columns" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type_id" UUID NOT NULL UNIQUE REFERENCES "product_types" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "count_sheet_templates" IS 'Column configuration for a product type''s customer count sheet.';
        CREATE TABLE IF NOT EXISTS "customer_counts" (
    "id" UUID NOT NULL PRIMARY KEY,
    "count_date" DATE NOT NULL,
    "bunch_size" INT NOT NULL,
    "sleeve_type" VARCHAR(20) NOT NULL,
    "bunch_count" INT,
    "is_done" BOOL NOT NULL DEFAULT False,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" UUID NOT NULL REFERENCES "customers" ("id") ON DELETE CASCADE,
    "product_type_id" UUID NOT NULL REFERENCES "product_types" ("id") ON DELETE CASCADE,
    "variety_id" UUID NOT NULL REFERENCES "varieties" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_customer_co_variety_d906b0" UNIQUE ("variety_id", "customer_id", "count_date", "bunch_size", "sleeve_type")
);
COMMENT ON TABLE "customer_counts" IS 'A customer-specific bunch count for a variety on a given date.';
        CREATE TABLE IF NOT EXISTS "estimates" (
    "id" UUID NOT NULL PRIMARY KEY,
    "week_start" DATE NOT NULL,
    "pull_day" DATE NOT NULL,
    "estimate_value" INT,
    "is_done" BOOL NOT NULL DEFAULT False,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type_id" UUID NOT NULL REFERENCES "product_types" ("id") ON DELETE CASCADE,
    "variety_id" UUID NOT NULL REFERENCES "varieties" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_estimates_variety_cd61ec" UNIQUE ("variety_id", "pull_day")
);
COMMENT ON TABLE "estimates" IS 'A weekly harvest estimate for a variety on a specific pull day.';
        CREATE TABLE IF NOT EXISTS "pull_day_schedules" (
    "id" UUID NOT NULL PRIMARY KEY,
    "week_start" DATE UNIQUE,
    "pull_days" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE "pull_day_schedules" IS 'Pull day schedule: default (week_start=None) or week-specific override.';
        CREATE TABLE IF NOT EXISTS "sheet_completions" (
    "id" UUID NOT NULL PRIMARY KEY,
    "sheet_type" VARCHAR(20) NOT NULL,
    "sheet_date" DATE NOT NULL,
    "is_complete" BOOL NOT NULL DEFAULT False,
    "completed_by" VARCHAR(100),
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type_id" UUID NOT NULL REFERENCES "product_types" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_sheet_compl_product_ca3adb" UNIQUE ("product_type_id", "sheet_type", "sheet_date")
);
COMMENT ON TABLE "sheet_completions" IS 'Tracks whether a count/estimate sheet has been marked complete.';
        ALTER TABLE "varieties" ADD "stems_per_bunch" INT NOT NULL DEFAULT 10;
        ALTER TABLE "varieties" ADD "in_harvest" BOOL NOT NULL DEFAULT True;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "varieties" DROP COLUMN "stems_per_bunch";
        ALTER TABLE "varieties" DROP COLUMN "in_harvest";
        DROP TABLE IF EXISTS "count_sheet_templates";
        DROP TABLE IF EXISTS "customer_counts";
        DROP TABLE IF EXISTS "estimates";
        DROP TABLE IF EXISTS "sheet_completions";
        DROP TABLE IF EXISTS "pull_day_schedules";
        DROP TABLE IF EXISTS "daily_counts";
        DROP TABLE IF EXISTS "count_audit_logs";"""


MODELS_STATE = (
    "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"
    "+ps523NafTTjnsv/8PIk93CA=="
)
