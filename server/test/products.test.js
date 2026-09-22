const { app, prisma, request, registerBusiness, createStaff, createProduct } = require("./helpers");

afterAll(() => prisma.$disconnect());

describe("product CRUD", () => {
  it("creates and lists a product, scoped to the caller's business", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { name: "Basmati Rice" });
    expect(p.id).toBeTruthy();

    const other = await registerBusiness();
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${other.token}`);
    expect(res.body.products).toHaveLength(0);
  });

  it("staff can read products but not create them", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;

    const list = await request(app).get("/api/products").set("Authorization", `Bearer ${staffToken}`);
    expect(list.status).toBe(200);

    const create = await request(app).post("/api/products").set("Authorization", `Bearer ${staffToken}`).send({
      name: "X", unit: "PCS", pricePerUnit: 1, tradePricePerUnit: 1, costPerUnit: 1, stockQty: 1
    });
    expect(create.status).toBe(403);
  });

  it("rejects a negative price", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/products").set("Authorization", `Bearer ${token}`).send({
      name: "Bad", unit: "PCS", pricePerUnit: -1, tradePricePerUnit: 1, costPerUnit: 1, stockQty: 1
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid unit", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/products").set("Authorization", `Bearer ${token}`).send({
      name: "Bad", unit: "GALLON", pricePerUnit: 1, tradePricePerUnit: 1, costPerUnit: 1, stockQty: 1
    });
    expect(res.status).toBe(400);
  });

  it("enforces a unique SKU per business but allows the same SKU across businesses", async () => {
    const { token } = await registerBusiness();
    await createProduct(token, { sku: "ABC123" });
    const dupe = await request(app).post("/api/products").set("Authorization", `Bearer ${token}`).send({
      name: "Other", sku: "ABC123", unit: "PCS", pricePerUnit: 1, tradePricePerUnit: 1, costPerUnit: 1, stockQty: 1
    });
    expect(dupe.status).toBe(409);

    const other = await registerBusiness();
    const ok = await request(app).post("/api/products").set("Authorization", `Bearer ${other.token}`).send({
      name: "Same SKU different biz", sku: "ABC123", unit: "PCS", pricePerUnit: 1, tradePricePerUnit: 1, costPerUnit: 1, stockQty: 1
    });
    expect(ok.status).toBe(201);
  });

  it("updates a product", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token);
    const res = await request(app).put(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`).send({ pricePerUnit: 999 });
    expect(res.status).toBe(200);
    expect(res.body.product.pricePerUnit).toBe(999);
  });

  it("404s updating a product that doesn't exist", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).put("/api/products/nonexistent-id").set("Authorization", `Bearer ${token}`).send({ pricePerUnit: 1 });
    expect(res.status).toBe(404);
  });

  it("409s renaming a product's SKU to one already used in the same business", async () => {
    const { token } = await registerBusiness();
    await createProduct(token, { sku: "TAKEN" });
    const p2 = await createProduct(token, { sku: "FREE" });
    const res = await request(app).put(`/api/products/${p2.id}`).set("Authorization", `Bearer ${token}`).send({ sku: "TAKEN" });
    expect(res.status).toBe(409);
  });

  it("hard-deletes a product with no sale history", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token);
    const res = await request(app).delete(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.softDeleted).toBe(false);
    const list = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);
    expect(list.body.products.find(x => x.id === p.id)).toBeUndefined();
  });

  it("soft-deletes a product that has sale history instead of destroying it", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 50 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000
    });

    const res = await request(app).delete(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.softDeleted).toBe(true);

    const activeList = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);
    expect(activeList.body.products.find(x => x.id === p.id)).toBeUndefined();
    const fullList = await request(app).get("/api/products?includeInactive=true").set("Authorization", `Bearer ${token}`);
    const found = fullList.body.products.find(x => x.id === p.id);
    expect(found.isActive).toBe(false);
  });

  it("404s for a product belonging to another business", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token);
    const other = await registerBusiness();
    const res = await request(app).get(`/api/products/${p.id}`).set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});
