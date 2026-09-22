const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.user.businessId } });
  res.json({ business });
});

const businessSchema = z.object({
  name: z.string().min(1).max(160),
  tagline: z.string().max(160).optional().nullable(),
  proprietors: z.string().max(300).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(100).optional().nullable()
});

// A full JSON export of everything this business owns — the practical
// safety net given the whole app runs off one local SQLite file with no
// server, no replication, and no automatic off-machine backup. Restoring
// from it isn't implemented here: a restore has to first decide what to do
// with newer local data, which is a real design decision, not something to
// bolt on as an afterthought — so for now this is export-only, and a
// restore path is a deliberate scope cut rather than a rushed, unsafe one.
router.get("/backup", requireRole("OWNER"), async (req, res) => {
  const businessId = req.user.businessId;
  const [business, users, products, customers, sales, ledgerEntries] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.user.findMany({ where: { businessId }, select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } }),
    prisma.product.findMany({ where: { businessId } }),
    prisma.customer.findMany({ where: { businessId } }),
    prisma.sale.findMany({ where: { businessId }, include: { items: true } }),
    prisma.ledgerEntry.findMany({ where: { businessId } })
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    business,
    users,
    products,
    customers,
    sales,
    ledgerEntries
  };

  res.setHeader("Content-Disposition", `attachment; filename="backup-${businessId}-${Date.now()}.json"`);
  res.json(backup);
});

router.put("/", requireRole("OWNER"), async (req, res) => {
  const parsed = businessSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  const business = await prisma.business.update({
    where: { id: req.user.businessId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.tagline !== undefined && { tagline: data.tagline || null }),
      ...(data.proprietors !== undefined && { proprietors: data.proprietors || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.phone !== undefined && { phone: data.phone || null })
    }
  });
  res.json({ business });
});

module.exports = router;
