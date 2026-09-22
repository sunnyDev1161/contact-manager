const crypto = require("crypto");
const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/lib/prisma");

function uniqueEmail(prefix = "owner") {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

// Registers a brand new business + owner, so every test gets its own
// isolated businessId (and therefore never sees another test's data,
// even though all tests share one physical SQLite file).
async function registerBusiness(overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      businessName: overrides.businessName || "Test Traders",
      name: overrides.name || "Test Owner",
      email,
      password: overrides.password || "password123"
    });
  return { token: res.body.token, user: res.body.user, email };
}

async function createStaff(token, overrides = {}) {
  const email = overrides.email || uniqueEmail("staff");
  const res = await request(app)
    .post("/api/auth/staff")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: overrides.name || "Test Staff",
      email,
      password: overrides.password || "password123"
    });
  return { user: res.body.user, email, password: overrides.password || "password123" };
}

async function createProduct(token, overrides = {}) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: overrides.name || "Test Rice",
      category: overrides.category ?? "Grains",
      sku: overrides.sku ?? null,
      unit: overrides.unit || "KG",
      pricePerUnit: overrides.pricePerUnit ?? 200,
      tradePricePerUnit: overrides.tradePricePerUnit ?? 180,
      costPerUnit: overrides.costPerUnit ?? 160,
      stockQty: overrides.stockQty ?? 100,
      lowStockThreshold: overrides.lowStockThreshold ?? 10
    });
  return res.body.product;
}

async function createCustomer(token, overrides = {}) {
  const res = await request(app)
    .post("/api/customers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      shopName: overrides.shopName || "Test Shop",
      shopkeeperName: overrides.shopkeeperName ?? null,
      phone: overrides.phone ?? null,
      address: overrides.address ?? null
    });
  return res.body.customer;
}

module.exports = { app, prisma, request, uniqueEmail, registerBusiness, createStaff, createProduct, createCustomer };
