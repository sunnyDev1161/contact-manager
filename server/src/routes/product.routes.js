const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

const UNITS = ["PCS", "KG", "G", "LITRE", "ML"];

const productSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional().nullable(),
  sku: z.string().max(80).optional().nullable(),
  unit: z.enum(UNITS),
  pricePerUnit: z.number().nonnegative(),
  costPerUnit: z.number().nonnegative(),
  stockQty: z.number().nonnegative(),
  lowStockThreshold: z.number().nonnegative().optional(),
  isActive: z.boolean().optional()
});

// List products for the caller's business. Available to owner and staff
// (staff need prices/stock visible at the POS screen).
router.get("/", async (req, res) => {
  const { includeInactive } = req.query;
  const products = await prisma.product.findMany({
    where: {
      businessId: req.user.businessId,
      ...(includeInactive === "true" ? {} : { isActive: true })
    },
    orderBy: { name: "asc" }
  });
  res.json({ products });
});

router.get("/:id", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});

router.post("/", requireRole("OWNER"), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;

  try {
    const product = await prisma.product.create({
      data: {
        businessId: req.user.businessId,
        name: data.name,
        category: data.category || null,
        sku: data.sku || null,
        unit: data.unit,
        pricePerUnit: data.pricePerUnit,
        costPerUnit: data.costPerUnit,
        stockQty: data.stockQty,
        lowStockThreshold: data.lowStockThreshold ?? 0
      }
    });
    res.status(201).json({ product });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "SKU already in use for this business" });
    }
    throw err;
  }
});

router.put("/:id", requireRole("OWNER"), async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const data = parsed.data;
  try {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.sku !== undefined && { sku: data.sku || null }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.pricePerUnit !== undefined && { pricePerUnit: data.pricePerUnit }),
        ...(data.costPerUnit !== undefined && { costPerUnit: data.costPerUnit }),
        ...(data.stockQty !== undefined && { stockQty: data.stockQty }),
        ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });
    res.json({ product });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "SKU already in use for this business" });
    }
    throw err;
  }
});

// Hard-deletes a product that has never been sold. A product with sale
// history is soft-deleted (isActive=false) instead, since deleting it would
// corrupt past sales records that reference it.
router.delete("/:id", requireRole("OWNER"), async (req, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const saleCount = await prisma.saleItem.count({ where: { productId: existing.id } });

  if (saleCount > 0) {
    await prisma.product.update({ where: { id: existing.id }, data: { isActive: false } });
    return res.json({ softDeleted: true, message: "Product has sale history; marked inactive instead of deleted." });
  }

  await prisma.product.delete({ where: { id: existing.id } });
  res.json({ softDeleted: false });
});

module.exports = router;
