ALTER TABLE "Restaurant"
ADD COLUMN "comandaNumbers" TEXT NOT NULL DEFAULT '{20-110}';

ALTER TABLE "Order"
ADD COLUMN "comandaNumber" INTEGER;

WITH numbered_orders AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "restaurantId"
      ORDER BY "createdAt", "id"
    ) + 19 AS "number"
  FROM "Order"
  WHERE "status" = 'OPEN' AND "deletedAt" IS NULL
)
UPDATE "Order" AS orders
SET "comandaNumber" = numbered_orders."number"::INTEGER
FROM numbered_orders
WHERE orders."id" = numbered_orders."id";

CREATE UNIQUE INDEX "Order_restaurantId_comandaNumber_open_key"
ON "Order"("restaurantId", "comandaNumber")
WHERE "status" = 'OPEN' AND "deletedAt" IS NULL AND "comandaNumber" IS NOT NULL;
