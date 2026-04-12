from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "estimate_audit_logs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "action" VARCHAR(10) NOT NULL,
    "amount" INT NOT NULL,
    "resulting_total" INT NOT NULL,
    "entered_by" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimate_id" UUID NOT NULL REFERENCES "estimates" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "estimate_audit_logs" IS 'Audit trail for estimate changes.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "estimate_audit_logs";"""


MODELS_STATE = (
    "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"
    "ydBZ126sP++/94kEqo"
)
