from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "customers" (
    "id" UUID NOT NULL PRIMARY KEY,
    "customer_id" INT NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "price_type" VARCHAR(50) NOT NULL DEFAULT 'Retail',
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE "customers" IS 'A customer (buyer) in the system.';
CREATE TABLE IF NOT EXISTS "stores" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" UUID NOT NULL REFERENCES "customers" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_stores_custome_deaf5b" UNIQUE ("customer_id", "name")
);
COMMENT ON TABLE "stores" IS 'A store / ship-to location belonging to a customer.';
CREATE TABLE IF NOT EXISTS "product_types" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE
);
COMMENT ON TABLE "product_types" IS 'Top-level product category (e.g. Cut Flower, Potted Plant).';
CREATE TABLE IF NOT EXISTS "product_lines" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "product_type_id" UUID NOT NULL REFERENCES "product_types" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_product_lin_product_214d5f" UNIQUE ("product_type_id", "name")
);
COMMENT ON TABLE "product_lines" IS 'A product line within a product type (e.g. Rose, Tulip).';
CREATE TABLE IF NOT EXISTS "varieties" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(100),
    "hex_color" VARCHAR(7),
    "flowering_type" VARCHAR(50),
    "can_replace" BOOL NOT NULL DEFAULT False,
    "show" BOOL NOT NULL DEFAULT True,
    "weekly_sales_category" VARCHAR(100),
    "item_group_id" INT,
    "item_group_description" VARCHAR(255),
    "product_line_id" UUID NOT NULL REFERENCES "product_lines" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_varieties_product_5c2f9d" UNIQUE ("product_line_id", "name")
);
COMMENT ON TABLE "varieties" IS 'A specific variety within a product line.';
CREATE TABLE IF NOT EXISTS "sales_items" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "stems_per_order" INT NOT NULL,
    "retail_price" DECIMAL(10,2) NOT NULL,
    "variety_id" UUID NOT NULL REFERENCES "varieties" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "sales_items" IS 'A purchasable SKU tied to a variety (defines stem count and retail price).';
CREATE TABLE IF NOT EXISTS "variety_colors" (
    "id" UUID NOT NULL PRIMARY KEY,
    "color_name" VARCHAR(100) NOT NULL,
    "variety_id" UUID NOT NULL REFERENCES "varieties" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_variety_col_variety_7e9f85" UNIQUE ("variety_id", "color_name")
);
COMMENT ON TABLE "variety_colors" IS 'Helper table for tracking known color names for a variety.';
CREATE TABLE IF NOT EXISTS "customer_prices" (
    "id" UUID NOT NULL PRIMARY KEY,
    "price" DECIMAL(10,2) NOT NULL,
    "customer_id" UUID NOT NULL REFERENCES "customers" ("id") ON DELETE CASCADE,
    "sales_item_id" UUID NOT NULL REFERENCES "sales_items" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_customer_pr_custome_2c28e3" UNIQUE ("customer_id", "sales_item_id")
);
COMMENT ON TABLE "customer_prices" IS 'A per-customer price override for a sales item.';
CREATE TABLE IF NOT EXISTS "orders" (
    "id" UUID NOT NULL PRIMARY KEY,
    "order_number" VARCHAR(20) NOT NULL UNIQUE,
    "order_date" DATE NOT NULL,
    "ship_via" VARCHAR(100),
    "price_type" VARCHAR(50) NOT NULL,
    "freight_charge_included" BOOL NOT NULL DEFAULT False,
    "box_charge" DECIMAL(10,2),
    "holiday_charge_pct" DECIMAL(5,4),
    "special_charge" DECIMAL(10,2),
    "freight_charge" DECIMAL(10,2),
    "order_notes" TEXT,
    "po_number" VARCHAR(100),
    "salesperson_email" VARCHAR(255),
    "store_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" UUID NOT NULL REFERENCES "customers" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "orders" IS 'A customer order.';
CREATE TABLE IF NOT EXISTS "order_lines" (
    "id" UUID NOT NULL PRIMARY KEY,
    "assorted" BOOL NOT NULL DEFAULT False,
    "color_variety" VARCHAR(100),
    "stems" INT NOT NULL,
    "list_price_per_stem" DECIMAL(10,2) NOT NULL,
    "price_per_stem" DECIMAL(10,2) NOT NULL,
    "item_fee_pct" DECIMAL(5,4),
    "item_fee_dollar" DECIMAL(10,2),
    "effective_price_per_stem" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "box_quantity" INT,
    "bunches_per_box" INT,
    "stems_per_bunch" INT,
    "box_reference" VARCHAR(50),
    "is_special" BOOL NOT NULL DEFAULT False,
    "sleeve" VARCHAR(255),
    "upc" VARCHAR(50),
    "line_number" INT NOT NULL,
    "order_id" UUID NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
    "sales_item_id" UUID NOT NULL REFERENCES "sales_items" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_order_lines_order_i_663c7d" UNIQUE ("order_id", "line_number")
);
COMMENT ON TABLE "order_lines" IS 'A single line item on an order.';
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
    "9YXv8F4oidSw=="
)
