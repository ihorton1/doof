CREATE TABLE "ManualLeftover" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cookedDate" TIMESTAMP(3) NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualLeftover_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualLeftover_cookedDate_idx" ON "ManualLeftover"("cookedDate");
