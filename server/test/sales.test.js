const { app, prisma, request, registerBusiness, createStaff, createProduct, createCustomer } = require("./helpers");

afterAll(() => prisma.$disconnect());

describe("POST /api/sales — checkout", () => {
  it("resolves retail price server-side and ignores any client-sent price", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 220, tradePricePerUnit: 200, costPerUnit: 180, stockQty: 100 });

    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: p.id, quantity: 2, unitPrice: 1 }], // a client-sent price must be ignored
      amountTendered: 440
    });

    expect(res.status).toBe(201);
    expect(res.body.sale.totalAmount).toBe(440);
    expect(res.body.sale.totalCost).toBe(360);
    expect(res.body.sale.totalProfit).toBe(80);
    expect(res.body.sale.items[0].unitPrice).toBe(220);
  });

  it("charges trade price when saleType is TRADE", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 220, tradePricePerUnit: 200, costPerUnit: 180, stockQty: 100 });
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      saleType: "TRADE", items: [{ productId: p.id, quantity: 1 }], amountTendered: 200
    });
    expect(res.body.sale.totalAmount).toBe(200);
  });

  it("decrements stock", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: p.id, quantity: 3 }], amountTendered: 10000
    });
    const after = await request(app).get(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(after.body.product.stockQty).toBe(7);
  });

  it("rejects a sale that would oversell stock", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 2 });
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: p.id, quantity: 5 }], amountTendered: 10000
    });
    expect(res.status).toBe(409);
    const after = await request(app).get(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(after.body.product.stockQty).toBe(2); // untouched — the whole transaction rolled back
  });

  it("requires a walk-in (no customer) sale to be paid in full", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: p.id, quantity: 1 }], amountTendered: 50
    });
    expect(res.status).toBe(400);
  });

  it("allows a customer-attached sale to be partially paid, putting the rest on credit", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const c = await createCustomer(token);
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      customerId: c.id, items: [{ productId: p.id, quantity: 2 }], amountTendered: 50
    });
    expect(res.status).toBe(201);
    expect(res.body.sale.totalAmount).toBe(200);
    expect(res.body.sale.amountPaid).toBe(50);

    const balance = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(balance.body.customer.balance).toBe(150);
  });

  it("allows a customer-attached sale to be entirely on credit (0 tendered)", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const c = await createCustomer(token);
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      customerId: c.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 0
    });
    expect(res.status).toBe(201);
    expect(res.body.sale.amountPaid).toBe(0);
  });

  it("caps amountPaid at totalAmount even if tendered is more (no negative credit)", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const c = await createCustomer(token);
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      customerId: c.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 500
    });
    expect(res.body.sale.amountPaid).toBe(100);
    const balance = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(balance.body.customer.balance).toBe(0);
  });

  it("rejects checkout against a customer from another business", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10 });
    const other = await registerBusiness();
    const foreignCustomer = await createCustomer(other.token);
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      customerId: foreignCustomer.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000
    });
    expect(res.status).toBe(404);
  });

  it("assigns sequential per-business invoice numbers, independent of other businesses", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10 });
    const s1 = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000 });
    const s2 = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000 });
    expect(s1.body.sale.invoiceNo).toBe(1);
    expect(s2.body.sale.invoiceNo).toBe(2);

    const other = await registerBusiness();
    const p2 = await createProduct(other.token, { stockQty: 10 });
    const t1 = await request(app).post("/api/sales").set("Authorization", `Bearer ${other.token}`).send({ items: [{ productId: p2.id, quantity: 1 }], amountTendered: 1000 });
    expect(t1.body.sale.invoiceNo).toBe(1);
  });

  it("rejects an empty item list", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [], amountTendered: 0 });
    expect(res.status).toBe(400);
  });

  it("404s a product id that doesn't belong to this business", async () => {
    const { token } = await registerBusiness();
    const other = await registerBusiness();
    const foreignProduct = await createProduct(other.token, { stockQty: 10 });
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      items: [{ productId: foreignProduct.id, quantity: 1 }], amountTendered: 1000
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/sales", () => {
  it("returns totalCount alongside the (possibly capped) list", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 100, pricePerUnit: 1 });
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1 });
    }
    const res = await request(app).get("/api/sales?limit=2").set("Authorization", `Bearer ${token}`);
    expect(res.body.sales).toHaveLength(2);
    expect(res.body.totalCount).toBe(3);
  });

  it("filters by a from/to date range", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10, pricePerUnit: 1 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1 });

    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/sales?from=${farFuture}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.sales).toHaveLength(0);
    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/sales/summary date filtering", () => {
  it("excludes sales outside the given range", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10, pricePerUnit: 100 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 100 });

    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/sales/summary?from=${farFuture}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.salesCount).toBe(0);
    expect(res.body.totalRevenue).toBe(0);
  });
});

describe("GET /api/sales/:id", () => {
  it("fetches a single sale with items", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10 });
    const created = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000 });
    const res = await request(app).get(`/api/sales/${created.body.sale.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sale.items).toHaveLength(1);
  });

  it("404s a sale from another business", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { stockQty: 10 });
    const created = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000 });
    const other = await registerBusiness();
    const res = await request(app).get(`/api/sales/${created.body.sale.id}`).set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sales/:id/void", () => {
  async function makeCreditSale(token, customerId, productId, qty, tendered) {
    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({
      customerId, items: [{ productId, quantity: qty }], amountTendered: tendered
    });
    return res.body.sale;
  }

  it("restocks items and reverses credit when a credit sale is voided", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const c = await createCustomer(token);
    const sale = await makeCreditSale(token, c.id, p.id, 5, 50); // total 500, paid 50, credit 450

    const balanceBefore = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(balanceBefore.body.customer.balance).toBe(450);

    const voidRes = await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${token}`).send({ reason: "Wrong item" });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.sale.voidedAt).toBeTruthy();

    const stock = await request(app).get(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(stock.body.product.stockQty).toBe(10); // 10 - 5 + 5 restocked

    const balanceAfter = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(balanceAfter.body.customer.balance).toBe(0);
  });

  it("restocks a walk-in sale with no ledger entry to reverse", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const sale = await makeCreditSale(token, null, p.id, 3, 300);
    const voidRes = await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${token}`).send({ reason: "test" });
    expect(voidRes.status).toBe(200);
    const stock = await request(app).get(`/api/products/${p.id}`).set("Authorization", `Bearer ${token}`);
    expect(stock.body.product.stockQty).toBe(10);
  });

  it("rejects voiding the same sale twice", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const sale = await makeCreditSale(token, null, p.id, 1, 100);
    await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${token}`).send({ reason: "a" });
    const res = await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${token}`).send({ reason: "b" });
    expect(res.status).toBe(409);
  });

  it("404s voiding a sale that doesn't exist", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/sales/nonexistent-id/void").set("Authorization", `Bearer ${token}`).send({ reason: "x" });
    expect(res.status).toBe(404);
  });

  it("requires a reason", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const sale = await makeCreditSale(token, null, p.id, 1, 100);
    const res = await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("blocks staff from voiding a sale", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 10 });
    const sale = await makeCreditSale(token, null, p.id, 1, 100);
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const res = await request(app).post(`/api/sales/${sale.id}/void`).set("Authorization", `Bearer ${staffToken}`).send({ reason: "x" });
    expect(res.status).toBe(403);
  });

  it("excludes a voided sale from /sales/summary but not from /sales list", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, costPerUnit: 60, stockQty: 20 });
    const keep = await makeCreditSale(token, null, p.id, 1, 100);
    const toVoid = await makeCreditSale(token, null, p.id, 1, 100);
    await request(app).post(`/api/sales/${toVoid.id}/void`).set("Authorization", `Bearer ${token}`).send({ reason: "x" });

    const summary = await request(app).get("/api/sales/summary").set("Authorization", `Bearer ${token}`);
    expect(summary.body.salesCount).toBe(1);
    expect(summary.body.totalRevenue).toBe(100);

    const list = await request(app).get("/api/sales").set("Authorization", `Bearer ${token}`);
    expect(list.body.sales).toHaveLength(2);
    const voidedRow = list.body.sales.find(s => s.id === toVoid.id);
    expect(voidedRow.voidedAt).toBeTruthy();
  });
});
