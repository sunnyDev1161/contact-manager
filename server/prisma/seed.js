const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "owner@example.com";
  const password = "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed skipped: ${email} already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const business = await prisma.business.create({
    data: { name: "My Grocery Store" }
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      name: "Owner",
      email,
      passwordHash,
      role: "OWNER"
    }
  });

  await prisma.product.createMany({
    data: [
      { businessId: business.id, name: "Chaat Masala", category: "Spices", unit: "G", pricePerUnit: 0.8, costPerUnit: 0.5, stockQty: 5000, lowStockThreshold: 500 },
      { businessId: business.id, name: "Basmati Rice", category: "Grains", unit: "KG", pricePerUnit: 220, costPerUnit: 180, stockQty: 100, lowStockThreshold: 10 },
      { businessId: business.id, name: "Vermicelli (Seviyan)", category: "Grains", unit: "G", pricePerUnit: 0.6, costPerUnit: 0.4, stockQty: 8000, lowStockThreshold: 1000 },
      { businessId: business.id, name: "Garlic Paste", category: "Pastes", unit: "G", pricePerUnit: 1.2, costPerUnit: 0.8, stockQty: 3000, lowStockThreshold: 300 },
      { businessId: business.id, name: "Cocoa Powder", category: "Baking", unit: "G", pricePerUnit: 2.5, costPerUnit: 1.7, stockQty: 2000, lowStockThreshold: 200 },
      { businessId: business.id, name: "Custard Powder", category: "Baking", unit: "G", pricePerUnit: 1.5, costPerUnit: 1.0, stockQty: 2500, lowStockThreshold: 250 }
    ]
  });

  console.log("Seeded business, owner login, and sample products.");
  console.log(`Login: ${email} / ${password}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
