-- CreateTable
CREATE TABLE "BuffetItem" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "deviceId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "BuffetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuffetItem_restaurantId_deletedAt_idx" ON "BuffetItem"("restaurantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "BuffetItem" ADD CONSTRAINT "BuffetItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
