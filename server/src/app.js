const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const saleRoutes = require("./routes/sale.routes");
const businessRoutes = require("./routes/business.routes");
const customerRoutes = require("./routes/customer.routes");

// Building the Express app is split out from starting the HTTP listener
// (index.js) so tests can require this module and drive it with supertest
// without binding a real port.
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // The test suite makes far more than 30 auth calls in rapid succession
  // from a single "IP" (supertest talks to the app in-process) — that's
  // the rate limiter working as designed, not something to test around.
  skip: () => process.env.NODE_ENV === "test"
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/customers", customerRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// For desktop/laptop use, the backend also serves the built frontend so the
// whole app is one process on one port (no separate dev server, no CORS to
// think about). In local dev with `npm run dev` on both sides, client/dist
// won't exist yet — the frontend runs on its own Vite server instead, so
// this block is skipped rather than erroring.
const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else {
  console.log("client/dist not found — run `npm run build` in client/ to serve the frontend from here.");
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
