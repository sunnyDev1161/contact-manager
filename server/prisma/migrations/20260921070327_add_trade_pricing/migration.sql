/*
  Warnings:

  - Added the required column `tradePricePerUnit` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "pricePerUnit" REAL NOT NULL,
    "tradePricePerUnit" REAL NOT NULL,
    "costPerUnit" REAL NOT NULL,
    "stockQty" REAL NOT NULL,
    "lowStockThreshold" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("businessId", "category", "costPerUnit", "createdAt", "id", "isActive", "lowStockThreshold", "name", "pricePerUnit", "sku", "stockQty", "unit", "updatedAt") SELECT "businessId", "category", "costPerUnit", "createdAt", "id", "isActive", "lowStockThreshold", "name", "pricePerUnit", "sku", "stockQty", "unit", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
    "totalAmount" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "totalProfit" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("businessId", "createdAt", "id", "totalAmount", "totalCost", "totalProfit", "userId") SELECT "businessId", "createdAt", "id", "totalAmount", "totalCost", "totalProfit", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE TABLE "new_SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'RETAIL',
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "lineProfit" REAL NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SaleItem" ("id", "lineProfit", "lineTotal", "productId", "productName", "quantity", "saleId", "unit", "unitCost", "unitPrice") SELECT "id", "lineProfit", "lineTotal", "productId", "productName", "quantity", "saleId", "unit", "unitCost", "unitPrice" FROM "SaleItem";
DROP TABLE "SaleItem";
ALTER TABLE "new_SaleItem" RENAME TO "SaleItem";
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
