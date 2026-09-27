const { app, prisma, request, registerBusiness, createStaff, createProduct, createCustomer } = require("./helpers");

afterAll(() => prisma.$disconnect());

describe("customer CRUD", () => {
  it("creates a customer with balance 0", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/customers").set("Authorization", `Bearer ${token}`).send({ shopName: "Malik General Store" });
    expect(res.status).toBe(201);
    expect(res.body.customer.balance).toBe(0);
  });

  it("staff cannot create a customer", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const res = await request(app).post("/api/customers").set("Authorization", `Bearer ${staffToken}`).send({ shopName: "X" });
    expect(res.status).toBe(403);
  });

  it("staff CAN record a payment (deliberately not owner-only)", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const c = await createCustomer(token);
    const res = await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${staffToken}`).send({ amount: 100 });
    expect(res.status).toBe(201);
  });

  it("a delivery rider CAN record a payment — that's their whole job", async () => {
    const { token } = await registerBusiness();
    const rider = await createStaff(token, { role: "DELIVERY_RIDER" });
    const riderToken = (await request(app).post("/api/auth/login").send({ email: rider.email, password: rider.password })).body.token;
    const c = await createCustomer(token);
    const res = await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${riderToken}`).send({ amount: 100 });
    expect(res.status).toBe(201);
  });

  it("an order booker cannot record a payment — that's not their job", async () => {
    const { token } = await registerBusiness();
    const booker = await createStaff(token, { role: "ORDER_BOOKER" });
    const bookerToken = (await request(app).post("/api/auth/login").send({ email: booker.email, password: booker.password })).body.token;
    const c = await createCustomer(token);
    const res = await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${bookerToken}`).send({ amount: 100 });
    expect(res.status).toBe(403);
  });

  it("rejects an invalid create payload (missing shopName)", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/customers").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("rejects an invalid update payload", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token);
    const res = await request(app).put(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`).send({ shopName: "" });
    expect(res.status).toBe(400);
  });

  it("404s updating a customer that doesn't exist", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).put("/api/customers/nonexistent-id").set("Authorization", `Bearer ${token}`).send({ shopName: "X" });
    expect(res.status).toBe(404);
  });

  it("updates a customer", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token, { shopName: "Old Name" });
    const res = await request(app).put(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`).send({ shopName: "New Name" });
    expect(res.body.customer.shopName).toBe("New Name");
  });

  it("hard-deletes a customer with no ledger history", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token);
    const res = await request(app).delete(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.softDeleted).toBe(false);
  });

  it("soft-deletes a customer that has ledger history", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token);
    await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${token}`).send({ amount: 10 });
    const res = await request(app).delete(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.softDeleted).toBe(true);
  });

  it("404s a customer belonging to another business", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token);
    const other = await registerBusiness();
    const res = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });
});

describe("balance calculation (SUM(SALE) - SUM(PAYMENT) - SUM(VOID))", () => {
  it("tracks balance across multiple sales and payments", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 100, stockQty: 100 });
    const c = await createCustomer(token);

    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ customerId: c.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 0 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ customerId: c.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 0 });
    await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${token}`).send({ amount: 75 });

    const res = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.customer.balance).toBe(125); // 200 owed - 75 paid
    expect(res.body.ledgerEntries).toHaveLength(3);
  });

  it("reflects the same balance in the list endpoint as the detail endpoint", async () => {
    const { token } = await registerBusiness();
    const p = await createProduct(token, { pricePerUnit: 50, stockQty: 100 });
    const c = await createCustomer(token);
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ customerId: c.id, items: [{ productId: p.id, quantity: 1 }], amountTendered: 0 });

    const list = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);
    const detail = await request(app).get(`/api/customers/${c.id}`).set("Authorization", `Bearer ${token}`);
    const listed = list.body.customers.find(x => x.id === c.id);
    expect(listed.balance).toBe(detail.body.customer.balance);
  });

  it("rejects a non-positive payment amount", async () => {
    const { token } = await registerBusiness();
    const c = await createCustomer(token);
    const res = await request(app).post(`/api/customers/${c.id}/payments`).set("Authorization", `Bearer ${token}`).send({ amount: 0 });
    expect(res.status).toBe(400);
  });
});
