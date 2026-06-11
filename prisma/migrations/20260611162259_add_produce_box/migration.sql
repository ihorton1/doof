-- CreateTable
CREATE TABLE "ProduceBox" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduceBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduceBoxItem" (
    "id" TEXT NOT NULL,
    "produceBoxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "carriedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduceBoxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduceBoxItemLink" (
    "id" TEXT NOT NULL,
    "produceBoxItemId" TEXT NOT NULL,
    "mealPlanEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduceBoxItemLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProduceBox_weekStartDate_key" ON "ProduceBox"("weekStartDate");

-- CreateIndex
CREATE INDEX "ProduceBoxItem_produceBoxId_idx" ON "ProduceBoxItem"("produceBoxId");

-- CreateIndex
CREATE INDEX "ProduceBoxItem_carriedFromId_idx" ON "ProduceBoxItem"("carriedFromId");

-- CreateIndex
CREATE INDEX "ProduceBoxItemLink_mealPlanEntryId_idx" ON "ProduceBoxItemLink"("mealPlanEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduceBoxItemLink_produceBoxItemId_mealPlanEntryId_key" ON "ProduceBoxItemLink"("produceBoxItemId", "mealPlanEntryId");

-- AddForeignKey
ALTER TABLE "ProduceBoxItem" ADD CONSTRAINT "ProduceBoxItem_produceBoxId_fkey" FOREIGN KEY ("produceBoxId") REFERENCES "ProduceBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceBoxItem" ADD CONSTRAINT "ProduceBoxItem_carriedFromId_fkey" FOREIGN KEY ("carriedFromId") REFERENCES "ProduceBoxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceBoxItemLink" ADD CONSTRAINT "ProduceBoxItemLink_produceBoxItemId_fkey" FOREIGN KEY ("produceBoxItemId") REFERENCES "ProduceBoxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduceBoxItemLink" ADD CONSTRAINT "ProduceBoxItemLink_mealPlanEntryId_fkey" FOREIGN KEY ("mealPlanEntryId") REFERENCES "MealPlanEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
