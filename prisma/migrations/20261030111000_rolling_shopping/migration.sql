ALTER TABLE "ProduceBox" ADD COLUMN "scope" TEXT;
ALTER TABLE "ShoppingList" ADD COLUMN "scope" TEXT;
ALTER TABLE "ShoppingListItem" ADD COLUMN "dismissed" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "ProduceBox_scope_key" ON "ProduceBox"("scope");
CREATE UNIQUE INDEX "ShoppingList_scope_key" ON "ShoppingList"("scope");
