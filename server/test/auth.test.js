const jwt = require("jsonwebtoken");
const { app, prisma, request, uniqueEmail, registerBusiness, createStaff } = require("./helpers");

afterAll(() => prisma.$disconnect());

describe("POST /api/auth/register", () => {
  it("creates a business and an OWNER user", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/auth/register").send({
      businessName: "Takbeer Traders",
      name: "Owner",
      email,
      password: "password123"
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("OWNER");
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    const { email } = await registerBusiness();
    const res = await request(app).post("/api/auth/register").send({
      businessName: "Another Biz",
      name: "Someone",
      email,
      password: "password123"
    });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid payload", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { email } = await registerBusiness({ password: "correcthorse" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "correcthorse" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const { email } = await registerBusiness({ password: "correcthorse" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: uniqueEmail(), password: "whatever" });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed login payload", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rejects a deactivated staff account", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false });
    const res = await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    const { token, user } = await registerBusiness();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("rejects a missing token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("rejects a well-formed token for a user that no longer exists", async () => {
    const fakeToken = jwt.sign({ id: "nope", businessId: "nope", role: "OWNER", email: "x@x.com" }, process.env.JWT_SECRET);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  it("revokes access mid-session — an already-issued token stops working the instant the account is deactivated", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const loginRes = await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password });
    const staffToken = loginRes.body.token;

    const before = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${staffToken}`);
    expect(before.status).toBe(200);

    await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false });

    const after = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${staffToken}`);
    expect(after.status).toBe(401);
  });
});

describe("staff management", () => {
  it("lets an owner create a staff account", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${token}`).send({
      name: "Cashier", email: uniqueEmail("cashier"), password: "password123"
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("STAFF");
    expect(res.body.user.isActive).toBe(true);
  });

  it("lets an owner create an order-booker account", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${token}`).send({
      name: "Bilal", email: uniqueEmail("booker"), password: "password123", role: "ORDER_BOOKER"
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("ORDER_BOOKER");
  });

  it("lets an owner create a delivery-rider account", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${token}`).send({
      name: "Usman", email: uniqueEmail("rider"), password: "password123", role: "DELIVERY_RIDER"
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("DELIVERY_RIDER");
  });

  it("rejects an unknown role when creating a staff account", async () => {
    const { token } = await registerBusiness();
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${token}`).send({
      name: "X", email: uniqueEmail(), password: "password123", role: "OWNER"
    });
    expect(res.status).toBe(400);
  });

  it("lets an owner reassign a staff account's role", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token, { role: "STAFF" });
    const res = await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({
      role: "DELIVERY_RIDER"
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("DELIVERY_RIDER");
  });

  it("rejects trying to promote a staff account to OWNER through the staff route", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token, { role: "STAFF" });
    const res = await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({
      role: "OWNER"
    });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email for a staff account", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${token}`).send({
      name: "Dupe", email: staff.email, password: "password123"
    });
    expect(res.status).toBe(409);
  });

  it("blocks a staff member from creating another staff account", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const staffToken = (await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password })).body.token;
    const res = await request(app).post("/api/auth/staff").set("Authorization", `Bearer ${staffToken}`).send({
      name: "X", email: uniqueEmail(), password: "password123"
    });
    expect(res.status).toBe(403);
  });

  it("lets an owner list staff, scoped to their own business", async () => {
    const { token } = await registerBusiness();
    await createStaff(token);
    const other = await registerBusiness();
    await createStaff(other.token);

    const res = await request(app).get("/api/auth/staff").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // the owner themself + the one staff member created for this business
    expect(res.body.users).toHaveLength(2);
  });

  it("lets an owner rename a staff account and reset their password", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    const res = await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({
      name: "New Name", password: "brandnewpassword"
    });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("New Name");

    const oldPw = await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password });
    expect(oldPw.status).toBe(401);
    const newPw = await request(app).post("/api/auth/login").send({ email: staff.email, password: "brandnewpassword" });
    expect(newPw.status).toBe(200);
  });

  it("reactivates a deactivated staff account", async () => {
    const { token } = await registerBusiness();
    const staff = await createStaff(token);
    await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false });
    await request(app).put(`/api/auth/staff/${staff.user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: true });
    const res = await request(app).post("/api/auth/login").send({ email: staff.email, password: staff.password });
    expect(res.status).toBe(200);
  });

  it("refuses to let the owner account be edited via the staff route (prevents self-lockout)", async () => {
    const { token, user } = await registerBusiness();
    const res = await request(app).put(`/api/auth/staff/${user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it("404s editing a staff id that doesn't belong to this business", async () => {
    const { token } = await registerBusiness();
    const other = await registerBusiness();
    const otherStaff = await createStaff(other.token);
    const res = await request(app).put(`/api/auth/staff/${otherStaff.user.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false });
    expect(res.status).toBe(404);
  });

  it("a staff account cannot edit another staff account", async () => {
    const { token } = await registerBusiness();
    const staffA = await createStaff(token);
    const staffB = await createStaff(token);
    const staffAToken = (await request(app).post("/api/auth/login").send({ email: staffA.email, password: staffA.password })).body.token;
    const res = await request(app).put(`/api/auth/staff/${staffB.user.id}`).set("Authorization", `Bearer ${staffAToken}`).send({ isActive: false });
    expect(res.status).toBe(403);
  });
});
