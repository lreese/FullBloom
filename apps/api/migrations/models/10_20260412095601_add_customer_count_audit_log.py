from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "customer_count_audit_logs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "action" VARCHAR(10) NOT NULL,
    "amount" INT NOT NULL,
    "resulting_total" INT NOT NULL,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_count_id" UUID NOT NULL REFERENCES "customer_counts" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "customer_count_audit_logs" IS 'Audit trail for customer count changes.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "customer_count_audit_logs";"""


MODELS_STATE = (
    "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"
)
