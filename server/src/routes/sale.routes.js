const express = require("express");
const { z } = require("zod");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const { Decimal } = Prisma;

router.use(requireAuth);

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
      let totalAmount = new Decimal(0);
      let totalCost = new Decimal(0);
      let totalProfit = new Decimal(0);

      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId, isActive: true }
        });
        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
        }

        const quantity = new Decimal(item.quantity);
        const updated = await tx.product.updateMany({
          where: { id: product.id, stockQty: { gte: quantity } },
          data: { stockQty: { decrement: quantity } }
        });
        if (updated.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        const unitPrice = product.pricePerUnit;
        const unitCost = product.costPerUnit;
        const lineTotal = unitPrice.mul(quantity);
        const lineCost = unitCost.mul(quantity);
        const lineProfit = lineTotal.sub(lineCost);

        totalAmount = totalAmount.add(lineTotal);
        totalCost = totalCost.add(lineCost);
        totalProfit = totalProfit.add(lineProfit);

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
