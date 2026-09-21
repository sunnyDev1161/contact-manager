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
