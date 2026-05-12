-- CreateTable
CREATE TABLE "PlanTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTemplateEntry" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "dishId" TEXT,
    "freeformText" TEXT,

    CONSTRAINT "PlanTemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTemplateMiscItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanTemplateMiscItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanTemplateEntry_templateId_idx" ON "PlanTemplateEntry"("templateId");

-- CreateIndex
CREATE INDEX "PlanTemplateMiscItem_templateId_idx" ON "PlanTemplateMiscItem"("templateId");

-- AddForeignKey
ALTER TABLE "PlanTemplateEntry" ADD CONSTRAINT "PlanTemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTemplateMiscItem" ADD CONSTRAINT "PlanTemplateMiscItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
