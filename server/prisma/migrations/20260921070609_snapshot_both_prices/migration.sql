/*
  Warnings:

  - Added the required column `retailUnitPrice` to the `SaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tradeUnitPrice` to the `SaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'RETAIL',
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "retailUnitPrice" REAL NOT NULL,
    "tradeUnitPrice" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "lineProfit" REAL NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Sales made before this migration only ever charged pricePerUnit (retail)
-- — trade pricing didn't exist yet. Backfilling both new columns from the
-- historic unitPrice keeps old receipts reprintable and correct, instead of
-- crashing the migration or inventing a fake trade price for a sale that
-- was never charged one.
INSERT INTO "new_SaleItem" ("id", "lineProfit", "lineTotal", "priceType", "productId", "productName", "quantity", "saleId", "unit", "unitCost", "unitPrice", "retailUnitPrice", "tradeUnitPrice") SELECT "id", "lineProfit", "lineTotal", "priceType", "productId", "productName", "quantity", "saleId", "unit", "unitCost", "unitPrice", "unitPrice", "unitPrice" FROM "SaleItem";
DROP TABLE "SaleItem";
ALTER TABLE "new_SaleItem" RENAME TO "SaleItem";
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
