const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// SQLite has no Decimal type, so money/quantity arithmetic happens in plain
// JS numbers. Rounding every intermediate result keeps floating-point noise
// (0.1 + 0.2 style drift) out of stored totals.
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = n => Math.round((n + Number.EPSILON) * 1000) / 1000;

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive()
      })
    )
    .min(1)
});

// Records a sale: validates stock, decrements it atomically, and snapshots
// price/cost per line so historic profit doesn't move if prices change later.
router.post("/", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { items } = parsed.data;
  const businessId = req.user.businessId;

  try {
    const sale = await prisma.$transaction(async tx => {
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

        const unitPrice = product.pricePerUnit;
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
          quantity,
          unitPrice,
          unitCost,
          lineTotal,
          lineProfit
        });
      }

      return tx.sale.create({
        data: {
          businessId,
          userId: req.user.id,
          totalAmount,
          totalCost,
          totalProfit,
          items: { create: lineData }
        },
        include: { items: true }
      });
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
    throw err;
  }
});

router.get("/", async (req, res) => {
  const { from, to, limit } = req.query;
  const where = { businessId: req.user.businessId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const sales = await prisma.sale.findMany({
    where,
    include: { items: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit ? Math.min(Number(limit), 200) : 50
  });
  res.json({ sales });
});

router.get("/summary", async (req, res) => {
  const { from, to } = req.query;
  const where = { businessId: req.user.businessId };
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

module.exports = router;
