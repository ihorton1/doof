-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "servings" INTEGER,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dishId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "dishId" TEXT,
    "freeformText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "cookedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlanEntry_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealPlanEntry_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shoppingListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "dishId" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShoppingListItem_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShoppingListItem_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_idx" ON "DishIngredient"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_weekStartDate_key" ON "MealPlan"("weekStartDate");

-- CreateIndex
CREATE INDEX "MealPlanEntry_mealPlanId_idx" ON "MealPlanEntry"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_date_idx" ON "MealPlanEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingList_weekStartDate_key" ON "ShoppingList"("weekStartDate");

-- CreateIndex
CREATE INDEX "ShoppingListItem_shoppingListId_idx" ON "ShoppingListItem"("shoppingListId");
