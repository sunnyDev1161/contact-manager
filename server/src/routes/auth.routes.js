const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, businessId: user.businessId, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function sanitize(user) {
  const { passwordHash, business, ...rest } = user;
  return { ...rest, businessName: business?.name };
}

const registerSchema = z.object({
  businessName: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

// Creates a brand new business (tenant) with its first user as OWNER.
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { businessName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async tx => {
    const business = await tx.business.create({ data: { name: businessName } });
    return tx.user.create({
      data: {
        businessId: business.id,
        name,
        email,
        passwordHash,
        role: "OWNER"
      },
      include: { business: { select: { name: true } } }
    });
  });

  const token = signToken(user);
  res.status(201).json({ token, user: sanitize(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: { select: { name: true } } }
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { business: { select: { name: true } } }
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitize(user) });
});

const staffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

// Owner adds a staff account (cashier) to their own business.
router.post("/staff", requireAuth, requireRole("OWNER"), async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      businessId: req.user.businessId,
      name,
      email,
      passwordHash,
      role: "STAFF"
    }
  });

  res.status(201).json({ user: sanitize(user) });
});

router.get("/staff", requireAuth, requireRole("OWNER"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { createdAt: "asc" }
  });
  res.json({ users: users.map(sanitize) });
});

module.exports = router;
