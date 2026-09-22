/*
  Warnings:

  - Added the required column `invoiceNo` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "proprietors" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "nextInvoiceNo" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Business" ("address", "createdAt", "id", "name", "phone", "proprietors", "tagline") SELECT "address", "createdAt", "id", "name", "phone", "proprietors", "tagline" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
    "invoiceNo" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "totalProfit" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "voidedAt" DATETIME,
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- invoiceNo has no default and is NOT NULL, so existing rows are backfilled
-- with a sequential number per business, ordered by when they were actually
-- created (id as a tiebreaker for any exact-timestamp collisions) — this
-- reproduces the order sales would have been numbered in if invoiceNo had
-- existed from day one.
INSERT INTO "new_Sale" ("id", "businessId", "userId", "customerId", "saleType", "invoiceNo", "totalAmount", "totalCost", "totalProfit", "amountPaid", "createdAt")
SELECT "id", "businessId", "userId", "customerId", "saleType",
  ROW_NUMBER() OVER (PARTITION BY "businessId" ORDER BY "createdAt" ASC, "id" ASC),
  "totalAmount", "totalCost", "totalProfit", "amountPaid", "createdAt"
FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE UNIQUE INDEX "Sale_businessId_invoiceNo_key" ON "Sale"("businessId", "invoiceNo");

-- Point each business's counter past whatever we just backfilled, so the
-- next real sale doesn't collide with a backfilled invoice number.
UPDATE "Business" SET "nextInvoiceNo" = COALESCE((SELECT MAX("invoiceNo") + 1 FROM "Sale" WHERE "Sale"."businessId" = "Business"."id"), 1);
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("businessId", "createdAt", "email", "id", "name", "passwordHash", "role") SELECT "businessId", "createdAt", "email", "id", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
