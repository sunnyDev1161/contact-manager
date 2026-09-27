const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// SQLite has no Decimal type, so money/quantity arithmetic happens in plain
// JS numbers. Rounding every intermediate result keeps floating-point noise
// (0.1 + 0.2 style drift) out of stored totals.
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = n => Math.round((n + Number.EPSILON) * 1000) / 1000;

const checkoutSchema = z.object({
  saleType: z.enum(["RETAIL", "TRADE"]).default("RETAIL"),
  customerId: z.string().min(1).optional().nullable(),
  amountTendered: z.number().nonnegative(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive()
      })
    )
    .min(1)
});

// Checkout and sales history are a cashier/owner concern — an ORDER_BOOKER or
// DELIVERY_RIDER token has no legitimate reason to create a sale or read
// financial history directly (their own mobile-app work is order-taking and
// delivery, both still separate from a POS Sale). Without this, adding those
// roles silently opened up every route below to them, since they only ever
// needed requireAuth to pass.
const DESKTOP_SALE_ROLES = ["OWNER", "STAFF"];

// Records a sale: validates stock, decrements it atomically, and snapshots
// price/cost per line so historic profit doesn't move if prices change later.
router.post("/", requireRole(...DESKTOP_SALE_ROLES), async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { items, saleType, customerId, amountTendered } = parsed.data;
  const businessId = req.user.businessId;

  try {
    const sale = await prisma.$transaction(async tx => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, businessId, isActive: true }
        });
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      }

      // Atomically claim the next sequential invoice number for this
      // business. The UPDATE...increment happens inside this same
      // transaction, so two concurrent checkouts can't be handed the same
      // number (SQLite serializes writers, and Prisma's increment compiles
      // to a single SET x = x + 1 rather than a read-then-write).
      const biz = await tx.business.update({
        where: { id: businessId },
        data: { nextInvoiceNo: { increment: 1 } },
        select: { nextInvoiceNo: true }
      });
      const invoiceNo = biz.nextInvoiceNo - 1;

      const lineData = [];
      let totalAmount = 0;
      let totalCost = 0;
      let totalProfit = 0;

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId, isActive: true }
        });
        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
        }

        const quantity = round3(item.quantity);
        if (product.stockQty < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        // Optimistic lock: only write if stockQty still matches what we just
        // read, so a concurrent sale on the same product can't double-spend
        // stock between the read and the write.
        const updated = await tx.product.updateMany({
          where: { id: product.id, stockQty: product.stockQty },
          data: { stockQty: round3(product.stockQty - quantity) }
        });
        if (updated.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        // Price is always resolved from the product record server-side,
        // never trusted from the client — a client could otherwise send an
        // arbitrary discounted price.
        const unitPrice = saleType === "TRADE" ? product.tradePricePerUnit : product.pricePerUnit;
        const unitCost = product.costPerUnit;
        const lineTotal = round2(unitPrice * quantity);
        const lineCost = round2(unitCost * quantity);
        const lineProfit = round2(lineTotal - lineCost);

        totalAmount = round2(totalAmount + lineTotal);
        totalCost = round2(totalCost + lineCost);
        totalProfit = round2(totalProfit + lineProfit);

        lineData.push({
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          priceType: saleType,
          quantity,
          unitPrice,
          retailUnitPrice: product.pricePerUnit,
          tradeUnitPrice: product.tradePricePerUnit,
          unitCost,
          lineTotal,
          lineProfit
        });
      }

      // A walk-in (no customer attached) can't be extended credit — there's
      // no account to put the shortfall on — so it must be paid in full.
      // A customer-attached sale can be paid any amount from 0 up to the
      // total; whatever isn't covered becomes a SALE ledger entry against
      // their account.
      if (!customerId && amountTendered < totalAmount) {
        throw new Error("WALKIN_MUST_BE_PAID_IN_FULL");
      }
      const amountPaid = round2(Math.min(amountTendered, totalAmount));
      const creditAmount = round2(totalAmount - amountPaid);

      const createdSale = await tx.sale.create({
        data: {
          businessId,
          userId: req.user.id,
          customerId: customerId || null,
          saleType,
          invoiceNo,
          totalAmount,
          totalCost,
          totalProfit,
          amountPaid,
          items: { create: lineData }
        },
        include: { items: true, customer: { select: { shopName: true } } }
      });

      if (creditAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            businessId,
            customerId,
            type: "SALE",
            amount: creditAmount,
            saleId: createdSale.id,
            note: `Credit from sale`,
            recordedByUserId: req.user.id
          }
        });
      }

      return createdSale;
    });

    res.status(201).json({ sale });
  } catch (err) {
    if (typeof err.message === "string" && err.message.startsWith("PRODUCT_NOT_FOUND:")) {
      return res.status(404).json({ error: "One of the selected products was not found." });
    }
    if (typeof err.message === "string" && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const name = err.message.split(":")[1];
      return res.status(409).json({ error: `Not enough stock for "${name}".` });
    }
    if (err.message === "CUSTOMER_NOT_FOUND") {
      return res.status(404).json({ error: "Selected customer was not found." });
    }
    if (err.message === "WALKIN_MUST_BE_PAID_IN_FULL") {
      return res.status(400).json({ error: "A walk-in sale (no customer selected) must be paid in full. Select a customer to allow credit." });
    }
    throw err;
  }
});

router.get("/", requireRole(...DESKTOP_SALE_ROLES), async (req, res) => {
  const { from, to, limit } = req.query;
  const where = { businessId: req.user.businessId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const take = limit ? Math.min(Number(limit), 200) : 50;
  // totalCount lets the UI show "showing N of M" instead of silently
  // truncating a range with more sales than the page size.
  const [sales, totalCount] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: true,
        user: { select: { name: true, email: true } },
        customer: { select: { shopName: true } },
        voidedBy: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take
    }),
    prisma.sale.count({ where })
  ]);
  res.json({ sales, totalCount });
});

router.get("/summary", requireRole(...DESKTOP_SALE_ROLES), async (req, res) => {
  const { from, to } = req.query;
  // Voided sales are excluded from these totals — they never actually
  // happened from an accounting standpoint — but the sale row itself is
  // kept (see the void endpoint below) so the list/history view can still
  // show it for the audit trail.
  const where = { businessId: req.user.businessId, voidedAt: null };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const agg = await prisma.sale.aggregate({
    where,
    _sum: { totalAmount: true, totalCost: true, totalProfit: true },
    _count: true
  });

  res.json({
    salesCount: agg._count,
    totalRevenue: agg._sum.totalAmount || 0,
    totalCost: agg._sum.totalCost || 0,
    totalProfit: agg._sum.totalProfit || 0
  });
});

router.get("/:id", requireRole(...DESKTOP_SALE_ROLES), async (req, res) => {
  const sale = await prisma.sale.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId },
    include: {
      items: true,
      user: { select: { name: true, email: true } },
      customer: { select: { shopName: true } },
      voidedBy: { select: { name: true } }
    }
  });
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  res.json({ sale });
});

const voidSchema = z.object({
  reason: z.string().min(1).max(300)
});

// Voids a completed sale: restocks every line item and, if any of it was
// put on a customer's credit, reverses that with a compensating ledger
// entry. The sale row is never deleted — it's marked voided and kept for
// the audit trail, and excluded from revenue/profit totals from then on.
router.post("/:id/void", requireRole("OWNER"), async (req, res) => {
  const parsed = voidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A reason is required to void a sale." });
  }
  const businessId = req.user.businessId;

  try {
    const sale = await prisma.$transaction(async tx => {
      const existing = await tx.sale.findFirst({
        where: { id: req.params.id, businessId },
        include: { items: true }
      });
      if (!existing) throw new Error("SALE_NOT_FOUND");
      if (existing.voidedAt) throw new Error("ALREADY_VOIDED");

      for (const item of existing.items) {
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } }
        });
      }

      const creditFromThisSale = await tx.ledgerEntry.aggregate({
        where: { saleId: existing.id, type: "SALE" },
        _sum: { amount: true }
      });
      const creditAmount = creditFromThisSale._sum.amount || 0;
      if (creditAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            businessId,
            customerId: existing.customerId,
            type: "VOID",
            amount: creditAmount,
            saleId: existing.id,
            note: `Reversal for voided sale`,
            recordedByUserId: req.user.id
          }
        });
      }

      return tx.sale.update({
        where: { id: existing.id },
        data: {
          voidedAt: new Date(),
          voidedByUserId: req.user.id,
          voidReason: parsed.data.reason
        },
        include: { items: true, user: { select: { name: true } }, customer: { select: { shopName: true } } }
      });
    });

    res.json({ sale });
  } catch (err) {
    if (err.message === "SALE_NOT_FOUND") return res.status(404).json({ error: "Sale not found" });
    if (err.message === "ALREADY_VOIDED") return res.status(409).json({ error: "This sale has already been voided." });
    throw err;
  }
});

module.exports = router;
