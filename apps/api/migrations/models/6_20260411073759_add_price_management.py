from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "price_change_logs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_type" VARCHAR(50) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "sales_item_id" UUID,
    "price_list_id" UUID,
    "customer_id" UUID,
    "old_price" DECIMAL(10,2),
    "new_price" DECIMAL(10,2)
);
COMMENT ON TABLE "price_change_logs" IS 'Append-only audit trail for all price changes.';
        CREATE TABLE IF NOT EXISTS "price_lists" (
    "id" UUID NOT NULL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "is_active" BOOL NOT NULL DEFAULT True
);
COMMENT ON TABLE "price_lists" IS 'Named pricing tier that customers can be assigned to.';
        CREATE TABLE IF NOT EXISTS "price_list_items" (
    "id" UUID NOT NULL PRIMARY KEY,
    "price" DECIMAL(10,2) NOT NULL,
    "price_list_id" UUID NOT NULL REFERENCES "price_lists" ("id") ON DELETE CASCADE,
    "sales_item_id" UUID NOT NULL REFERENCES "sales_items" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_price_list__price_l_0bed4b" UNIQUE ("price_list_id", "sales_item_id")
);
COMMENT ON TABLE "price_list_items" IS 'Per-sales-item price within a price list (matrix cell data).';
        ALTER TABLE "customers" ADD "price_list_id" UUID;
        ALTER TABLE "sales_items" ADD "cost_price" DECIMAL(10,2);
        ALTER TABLE "customers" ADD CONSTRAINT "fk_customer_price_li_8ef83aac" FOREIGN KEY ("price_list_id") REFERENCES "price_lists" ("id") ON DELETE SET NULL;
        INSERT INTO "price_lists" ("id", "name", "is_active")
            SELECT gen_random_uuid(), dt.price_type, true
            FROM (
                SELECT DISTINCT price_type FROM "customers"
                WHERE price_type IS NOT NULL
                  AND price_type != ''
                  AND price_type NOT IN ('Retail', 'Not Managed')
            ) AS dt;
        UPDATE "customers" SET price_list_id = pl.id
            FROM "price_lists" pl
            WHERE "customers".price_type = pl.name;
        ALTER TABLE "customers" DROP COLUMN "price_type";"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "fk_customer_price_li_8ef83aac";
        ALTER TABLE "customers" ADD "price_type" VARCHAR(50) NOT NULL DEFAULT 'Retail';
        ALTER TABLE "customers" DROP COLUMN "price_list_id";
        ALTER TABLE "sales_items" DROP COLUMN "cost_price";
        DROP TABLE IF EXISTS "price_list_items";
        DROP TABLE IF EXISTS "price_change_logs";
        DROP TABLE IF EXISTS "price_lists";"""


MODELS_STATE = (
    "eJztXVtv2zgW/iuEn1IgybaZpB0sFgs4bjqTrXNB4s4WMxgItETbQmVRlagkRrf/fUnqYl"
    "0oWZSlWLL5Mp1QPLT08ZA8d/4YLLGBLO905HsEL5E7+Cf4MbDhEtH/yT07BgPoOOsnrIHA"
    "qcU762Ev3gqnHnGhTuiDGbQ8RJsM5Omu6RAT26z7EEQE4Gjqr5D7Bpg2IAsEvJVH0PKUDW"
    "NgnY5j2vPKFL5tfveRRvAc0Sfsc/76mzabtoFekBf96XzTZiayjNTXmgYbgLdrZOXwti9f"
    "rj9+4j3Z20w1HVv+0l73dlZkge24u++bximjYc/myEYuJMhIgGD7lhUCFjUFb0wbiOuj+F"
    "WNdYOBZtC3GJSDf818W2cIAv5L7D/n/x7kwGW/kkEvbNKxzSbGtAnD4sfP4KvW38xbB+yn"
    "Rr8PH45+ef+GfyX2yNzlDzkig5+cEBIYkHJc10BG06TZ/nIasE0a1WubiEEVUGYQpm/eDr"
    "YRZvWApC9E/zk5e3f+4fzXX96f/0q78DeJWz6UYH19O+GQriHk/+ZwGy2gKwYu6p9Bi75i"
    "HbSihjVc60XcEF5L+KJZyJ6TBQPp4qIEnT+GD5wZaS/OjZhuLMGWcxs+OguepSE0PY1uQO"
    "aTAMdLjC0E7YKFnaTL4DmlhG0BGnNk0yv58u5uzF566XnfLd5wPcng+OXm8urh6B2Hl3Yy"
    "CRKzpQct5Dl0j6cvJ8GdGbJaTBrCszMeffe2Aou+e1vIoexRGkz6c4Rymia71rN0vYSzlS"
    "UfvqrmLUxHezKhDKoi2l4i++5tNU4tY9UcrzoUBykmjQl6ieFFFQgvihG8yAFoYR3yd5LA"
    "MEnTSxhbWeQOXC2RTTSC3KUnxZJZwl5i2jxroiU0LRkgY4JeAtgKU9qYIAEzTtBLgaYTE/"
    "QEwxLIJldfJyn5MkLq6Gb4lYO4XIVPxne3v0XdE8iOxneXWeHIRezzNUjyqH6kT4i5RAXi"
    "UYoyA68Rkp5G/9NR9Yh+g3FnW6twrsvQv765epwMb+5TU/BxOLliT85S8EetR+8zvB0PAv"
    "57PfkdsD/Bn3e3V1nlP+43+XPA3gn6BGs2ftagkVCqo9YImNTE+o5Rc2LTlGpidzqx4csn"
    "jmXX1JFmmR7R5AxpOcItbGqd2hc3WNCYHXL2TWhAW0OSB/ITdpE5tz+jFYfzmr4NtHWRqB"
    "1ab+/ZYONwrK7it25dv4ULn2MrbZ5L6IfSz0OBpeLxagJuv4zHA47qFOrfnqFraAXwegS7"
    "otP6MqT79PkBWUWSd4jqIxujm3tMEaT55bolBpFfgHNYj7HArhG6LepjccfG6BkGbK3gM5"
    "xYI6nVk3+0PFtmW6AN5/yt2W+zX0qtD4EzKV44xZ6k9fqs4kbivcE/ADPcnBAMIq0ZTJGF"
    "7TlFBtBWGDuPRI6lWmMIXE1/xR4M1oF/+d/K/dTC4Xlc4n5SvpOt1Vmlfe2FkJ7XvmIHq9"
    "xukyFrctvpqYie3Oe3FNCT4RWdRW+jgJ5hkZR4Pho+joYfr8qk8zZlkRG2sDiwhT8olUV0"
    "1qV6SAvrDVw0Qy6icw5m9K8n6Jp0s0OeMKJlI4EKaDl0iaL12JX23YcL9KLp0WKrimKKqC"
    "dm8jSWZTE/EZIfCnH8oCJa2oloyR3rVYxG8a68nZ3gDz7MqpPMuxNDwb2LDV8nY9MWmguS"
    "j0sPaifoqFm0Z+XzOiQCjAg8m2Rh2lTLj1rZ1IEjdDo/BQ+YDTDxLdN5IzrH6w8ktCJEH8"
    "OZ51hZEg7y3N+LwCF1ZjUfhZncHaSdbTlSpcznttutPW58uEk4WmdBrOB0y3GLrF6/QwGq"
    "Q8C+hgQ1CXAqkqAibtwsQQWrqpIENcHOiYWekBWLOjqdjzl2V6G4M/IJ+GThZ+Qeg3tM6F"
    "yBewvaRCBEbTmWspMcury0B3YSJS3tUMPPaZD1D6mM1qoOqsD1z9KArglaio6p9cPSQ4qn"
    "Eml0spfVlXzf1RfQYyOAx89fAJVBjMCdH4gk9HyhsLJJByyNFOjYtwmAtgFcRKDJziNTR2"
    "K1v8Gh1QGmDrDeH2CMyz3NQa6Go4CoNJaFqb8CymZSf1/BjNJw8m+wN2hOFFaXib9AurmE"
    "lhjFLGk2ACOgPQ3H6CacJVh9vBpd3wzHlPOOzzIHf8Sw54I8S4/UAjNNuDWUnQpOroWkEk"
    "+bN+aFgoKkHS9NpUx4ESANWO96aWA6zlju0vxR32gXR/WoeHFxqkukiGyjK4b5GZHy01NU"
    "uNjWhPLMQ+mV6pxSnaNNSaA4J/arYrU5ZXyvFFXvULlmZuqxIptzarOZFsbSV6cs9X1bIQ"
    "co3/cBqsJ74fuecWcFfYkCx2IxmHnKXsa/NV+rQIe25iLHgiJlrlQHyVC+ohYi3mM7poZ4"
    "C/wsiWhEohQ6pSS3jOkzQt+slRYY/yO3sMyGWjhAL/fVdnyPVP3Q5i72HaEtotBwm6OrZb"
    "bdAaQNW20TOCTfSIJJi0foJZe2k5nIEgJks9cSNAdSXEIULsgUqprhgglSZWvMaajNhAv2"
    "z+JxXBAumOAWseUxt6AbQDHO5evqKt6cQZnYprapbpKOkKhvh0tFZPSHK1u1w6VN2CW10m"
    "Mb9+aC6QnbeqVwFuSexIXQOSnAT8h1TSNIH4WAcwAwC4qoS9NvrHOx5jhlp3t1O10dx7YK"
    "D1AlERoQLNfrXhK7HOGhoFciVKqCEnUKSojZsQEMeyr8ZEHMrbQu1eXgMtJoAe05GuO5SJ"
    "rK9CgVpwKvvM47axaeVxWoHAfZxgm2rRWAvmESwAC1AlHICiN0QTCsqISHNLmK89290BTM"
    "R636VilKVd+qa/WtguUv62/NkPXTh928txXqsibsNUU/MTyrguFZMYZn+Yj4LgjJ/TVdq6"
    "LStcHbuWLbV+AwJa5jVknRqXSBgY2ea+GYojtQHCUyWFtX0Xjx+CLtLKosv0kxY3txRZXs"
    "lv6MwTUnXnjZRC4gC0ji6sse0CErzQyg51Glnqdc5jWz2qMoBe21ttyuRp/uQSKmikLbYS"
    "WB1FXI2+fLdPmQK88JOfD0mFc5mYsKKuSAq3JCy1RWuEfuCVdSTxhRaOlMJHuwP9mY4GgJ"
    "KYAvQEeWBdiWL6ilsO1gBakkyXt0lJt6hwe6clNvqUx1whTSLRyVq/rArifr0Nl+LHU/mf"
    "JXV4Sx0/7q4I4vgagVX/5VLGKt7xirdI9EFJ/HyYQXR+R7KLvF7sWcIAne9pdTUSRPsf0i"
    "S9dHO0bzvrMAFeZMF7vpy7CMqMpc9J3eK4WS43BylUvcNB3tyYQy3Jak6WVqUSsms+AIlw"
    "0dSFP10+vdfOTAjIkvC8LCsdw50kxbt3wDCU6ZUmNkySgqfzsN+BS/hDBJKtlpwgP1tqXu"
    "KsKWacBVxHSOLooRK0NUPMB+IntxfF4ZWF4YBlr12DRPvJ+ASrFqen+URDRPrBCN5HBMRE"
    "WsJuilIAc+Q9YTmaos7vPq6yR1MkWH/dHN8CtHMw77HN/d/hZ1Txxco/HdZVbAwjU0oxRR"
    "T4B9jUK7zFDiINejcKAlNC0p+V9E3EtsW6kxEFayg1MkhWqGTOGpbpMe7He0ve8YNSc2Ta"
    "kmdqcTmwvb2HnkcLesbiqpsyu3hK+RVXVm23NxFd3FmgJsg6tL7h5WjwJhoeD2VB7/g20A"
    "7WLv18b+wnCg+GIJXqAm1CpUKNBr+8ig52GXSBuDk2TK+iuqilZYA78k8TFL2Eutpb2rbP"
    "JYll9gI4DwYK6t4cEvgTuMXePjCQNbSk2SBSOo8L/IzVgTVwWp8DYbFmU0Q3VcPFnS/bSc"
    "yzh3YkQMTD9KoPBUw3NNvZ+QSjEoms0Qz8XZblctG0btA/RrZL09ys9T7udhIQXffWgTUy"
    "SMFgpQWbIDrSM9pTrcAgVXIVJIZADMUx4ohuvLJDkmslJ8mvJAMWTL0UUz5CJblLlTrFPm"
    "CHuyTbYdE2d6WhjFImn5SBMq20dmrVsIidKcS9zfMUUvObMVH63v6DIQht17iV/zKztpT6"
    "5+1GSoDtVsFLgL5KzrSZpDcTOqdMaWnLQFN5VLe2jjLLDO4rbRPZtcVyqBce8SGIfINfXF"
    "QODaDZ8cl/l14brPJpduMawNJykW30ol2t0EZ2o4h9s5XrtwoBb7W5+Q60mW8UyQ9DOjqR"
    "UZmS0NCRDD7v0EsBWXKv1FgmyBs+U/j3e3RQ7qmCRrqzZ1Av4HrK6XDhDhx7633OyatbBm"
    "pBo2wOWuywT+/D/f9asH"
)
