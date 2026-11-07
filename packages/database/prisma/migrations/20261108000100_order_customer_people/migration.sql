-- CreateTable: Customer
CREATE TABLE "Customer" (
    "id"           UUID        NOT NULL,
    "restaurantId" UUID        NOT NULL,
    "name"         TEXT        NOT NULL,
    "phone"        TEXT,
    "email"        TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(3) NOT NULL,
    "version"      INTEGER     NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId"     TEXT,
    "deletedAt"    TIMESTAMPTZ(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Add new columns to Order
ALTER TABLE "Order"
    ADD COLUMN "customerId"   UUID,
    ADD COLUMN "customerName" TEXT,
    ADD COLUMN "peopleCount"  INTEGER;

-- Indexes
CREATE INDEX "Customer_restaurantId_deletedAt_idx"  ON "Customer"("restaurantId", "deletedAt");
CREATE INDEX "Customer_restaurantId_name_idx"        ON "Customer"("restaurantId", "name");
CREATE INDEX "Order_customerId_idx"                  ON "Order"("customerId");

-- FK: Customer → Restaurant
ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: Order → Customer (nullable)
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
