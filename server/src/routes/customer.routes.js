const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

async function balancesByCustomer(businessId) {
  const sums = await prisma.ledgerEntry.groupBy({
    by: ["customerId", "type"],
    where: { businessId },
    _sum: { amount: true }
  });
  const map = {};
  for (const s of sums) {
    // "SALE" increases what's owed; "PAYMENT" and "VOID" (a reversal of a
    // voided credit sale) both decrease it.
    const delta = s.type === "SALE" ? s._sum.amount : -s._sum.amount;
    map[s.customerId] = round2((map[s.customerId] || 0) + delta);
  }
  return map;
}

// List customers with their current outstanding balance (SUM of SALE
// ledger entries minus SUM of PAYMENT entries — computed here, never
// stored, so it can't drift out of sync with the ledger).
router.get("/", async (req, res) => {
  const { includeInactive } = req.query;
  const customers = await prisma.customer.findMany({
    where: {
      businessId: req.user.businessId,
      ...(includeInactive === "true" ? {} : { isActive: true })
    },
    orderBy: { shopName: "asc" }
  });
  const balances = await balancesByCustomer(req.user.businessId);
  res.json({
    customers: customers.map(c => ({ ...c, balance: balances[c.id] || 0 }))
  });
});

router.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { customerId: customer.id, businessId: req.user.businessId },
    include: { recordedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  const balance = ledgerEntries.reduce(
    (sum, e) => round2(sum + (e.type === "SALE" ? e.amount : -e.amount)),
    0
  );

  res.json({ customer: { ...customer, balance }, ledgerEntries });
});

const customerSchema = z.object({
  shopName: z.string().min(1).max(160),
  shopkeeperName: z.string().max(160).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  address: z.string().max(300).optional().nullable()
});

router.post("/", requireRole("OWNER"), async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      businessId: req.user.businessId,
      shopName: data.shopName,
      shopkeeperName: data.shopkeeperName || null,
      phone: data.phone || null,
      address: data.address || null
    }
  });
  res.status(201).json({ customer: { ...customer, balance: 0 } });
});

router.put("/:id", requireRole("OWNER"), async (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!existing) return res.status(404).json({ error: "Customer not found" });

  const data = parsed.data;
  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: {
      ...(data.shopName !== undefined && { shopName: data.shopName }),
      ...(data.shopkeeperName !== undefined && { shopkeeperName: data.shopkeeperName || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive })
    }
  });
  res.json({ customer });
});

// Hard-deletes a customer with no history. One with sales or ledger entries
// is soft-deleted instead, since deleting it would corrupt those records.
router.delete("/:id", requireRole("OWNER"), async (req, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!existing) return res.status(404).json({ error: "Customer not found" });

  const entryCount = await prisma.ledgerEntry.count({ where: { customerId: existing.id } });
  if (entryCount > 0) {
    await prisma.customer.update({ where: { id: existing.id }, data: { isActive: false } });
    return res.json({ softDeleted: true, message: "Customer has sales/payment history; marked inactive instead of deleted." });
  }

  await prisma.customer.delete({ where: { id: existing.id } });
  res.json({ softDeleted: false });
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(300).optional().nullable()
});

// Records a payment against a customer's balance, independent of any sale —
// covers the common case of a shopkeeper paying down their tab on a day
// they aren't buying anything.
router.post("/:id/payments", async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, businessId: req.user.businessId }
  });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const entry = await prisma.ledgerEntry.create({
    data: {
      businessId: req.user.businessId,
      customerId: customer.id,
      type: "PAYMENT",
      amount: round2(parsed.data.amount),
      note: parsed.data.note || null,
      recordedByUserId: req.user.id
    }
  });
  res.status(201).json({ ledgerEntry: entry });
});

module.exports = router;
