const { app, prisma, request, registerBusiness, createStaff, createProduct, createCustomer } = require("./helpers");

afterAll(() => prisma.$disconnect());

describe("GET/PUT /api/business", () => {
  it("returns the caller's own business profile", async () => {
    const { token } = await registerBusiness({ businessName: "Takbeer Traders" });
    const res = await request(app).get("/api/business").set("Authorization", `Bearer ${token}`);
    expect(res.body.business.name).toBe("Takbeer Traders");
  });

  it("lets the owner update the profile", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).put("/api/business").set("Authorization", `Bearer ${token}`).send({
      tagline: "Trading • Supply", phone: "0300-1234567"
    });
    expect(res.status).toBe(200);
    expect(res.body.business.tagline).toBe("Trading • Supply");
  });

  it("blocks staff from updating the profile", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const res = await request(app).put("/api/business").set("Authorization", `Bearer ${staffToken}`).send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/business/backup", () => {
  it("exports everything scoped to the caller's business only", async () => {
    const { token } = await registerBusiness({ businessName: "Biz A" });
    const p = await createProduct(token);
    const c = await createCustomer(token);
    await request(app).post("/api/sales").set("Authorization", `Bearer ${token}`).send({ items: [{ productId: p.id, quantity: 1 }], amountTendered: 1000 });

    const other = await registerBusiness({ businessName: "Biz B" });
    await createProduct(other.token);

    const res = await request(app).get("/api/business/backup").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.business.name).toBe("Biz A");
    expect(res.body.products).toHaveLength(1);
    expect(res.body.customers).toHaveLength(1);
    expect(res.body.sales).toHaveLength(1);
  });

  it("is owner-only", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const res = await request(app).get("/api/business/backup").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });
});
