CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'KITCHEN', 'SCALE');
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'CLOSING');
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "OrderItemStatus" AS ENUM ('SENT', 'PREPARING', 'READY', 'SERVED');

CREATE TABLE "Restaurant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Table" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "location" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuCategory" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "code" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "waiterId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "variations" JSONB,
    "notes" TEXT,
    "status" "OrderItemStatus",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Restaurant_deletedAt_idx" ON "Restaurant"("deletedAt");
CREATE INDEX "User_restaurantId_deletedAt_idx" ON "User"("restaurantId", "deletedAt");
CREATE INDEX "User_restaurantId_role_idx" ON "User"("restaurantId", "role");
CREATE INDEX "Table_restaurantId_deletedAt_idx" ON "Table"("restaurantId", "deletedAt");
CREATE INDEX "Table_restaurantId_status_idx" ON "Table"("restaurantId", "status");
CREATE INDEX "MenuCategory_restaurantId_deletedAt_idx" ON "MenuCategory"("restaurantId", "deletedAt");
CREATE INDEX "MenuItem_restaurantId_deletedAt_idx" ON "MenuItem"("restaurantId", "deletedAt");
CREATE INDEX "MenuItem_categoryId_available_idx" ON "MenuItem"("categoryId", "available");
CREATE INDEX "Order_restaurantId_status_deletedAt_idx" ON "Order"("restaurantId", "status", "deletedAt");
CREATE INDEX "Order_tableId_status_idx" ON "Order"("tableId", "status");
CREATE INDEX "OrderItem_orderId_deletedAt_idx" ON "OrderItem"("orderId", "deletedAt");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

ALTER TABLE "User" ADD CONSTRAINT "User_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey"
  FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
