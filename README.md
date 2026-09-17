# Grocery POS

A point-of-sale system for a grocery shop: authenticated inventory management
and sales tracking, with per-sale profit computed automatically.

Every table is scoped to a `businessId` from day one, so the same codebase
can later host more than one shop (a reseller/multi-tenant model) without a
schema rewrite. That mode isn't built yet — today, each business is created
via `/register` and runs independently.

## Stack

- **Backend**: Node.js, Express, PostgreSQL, Prisma ORM, JWT auth (bcrypt password hashing)
- **Frontend**: React (Vite), React Router, Axios

## Features

- Email/password auth, JWT sessions, owner vs. staff roles
- Owner can add/edit/remove products: name, category, SKU, unit
  (pcs/kg/g/litre/ml), selling price, cost, stock quantity, low-stock threshold
- A product with existing sales is soft-deleted (marked inactive, restorable)
  instead of hard-deleted, so historic sales records stay intact
- POS screen: search products, build a cart, check out — stock is decremented
  atomically and rejected if insufficient
- Every sale line snapshots the price/cost at the time of sale, so editing a
  product's price later doesn't change historic profit figures
- Sales history with date filtering and revenue/cost/profit totals
- Owner can create staff (cashier) logins; every sale records who made it

## Project layout

```
server/   Express API + Prisma schema/migrations
client/   React (Vite) frontend
```

## Running locally

### 1. Database

Needs a PostgreSQL instance. Create a database and point `DATABASE_URL` at it.

### 2. Backend

```bash
cd server
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev
npm run seed            # optional: creates a demo business + owner login + sample products
npm run dev             # starts on :4000
```

Seeded login (if you ran `npm run seed`): `owner@example.com` / `changeme123`

### 3. Frontend

```bash
cd client
npm install
npm run dev              # starts on :5173, proxies /api to :4000
```

Open `http://localhost:5173`. Register a new business, or log in with the
seeded owner account above.

## Deploying (Render, one click)

`render.yaml` at the repo root is a Render "Blueprint" — it describes both
services and the database in one file, so Render provisions all three
together instead of you configuring each by hand.

1. Go to [render.com](https://render.com) and sign in (create an account if
   you don't have one — this is your account, your billing, nothing to do
   with this session).
2. **New** → **Blueprint** → connect the `sunnyDev1161/contact-manager`
   GitHub repo → pick the `claude/relaxed-gauss-4516nq` branch (or `main`
   once this is merged) → **Apply**.
3. Render creates three things: the `pos-db` Postgres database, the
   `pos-server` backend, and the `pos-client` frontend. `JWT_SECRET` is
   generated automatically; `DATABASE_URL` is wired to the database
   automatically. Wait for `pos-server` to finish deploying and copy its URL
   (shown on its dashboard page, looks like `https://pos-server-xxxx.onrender.com`).
4. Open the `pos-client` service → **Environment** → set `VITE_API_URL` to
   the `pos-server` URL from step 3 → save (this triggers a rebuild, since
   Vite bakes the API URL into the frontend at build time, not runtime).
5. Once `pos-client` finishes deploying, open its URL — that's your live
   POS. Register your real business there (don't use the seeded demo
   login in production).

**Two things worth knowing, not hidden in fine print:**
- Render's free Postgres tier expires after a set period (historically ~30
  days) and free web services spin down after inactivity, so the first
  request after a quiet spell will be slow. Fine for trying this out; if
  you're running a real shop on it day to day, budget for Render's paid
  tier (a few dollars/month) so your sales data doesn't get wiped and the
  POS doesn't lag every morning.
- `CORS_ORIGIN` isn't set in the blueprint, so the backend defaults to
  accepting requests from any origin. That's safe here because auth is a
  bearer JWT (not a cookie), so there's no CSRF exposure — but once you know
  your `pos-client` URL, set `CORS_ORIGIN` on `pos-server` to that exact URL
  to close it down to just your frontend.

## Data model

- `Business` — a tenant (one shop)
- `User` — belongs to a business, role `OWNER` or `STAFF`
- `Product` — belongs to a business: unit, price, cost, stock quantity
- `Sale` / `SaleItem` — a completed transaction and its line items, with
  price/cost snapshotted at sale time and profit computed per line

## Deploying

Any host that can run Node + Postgres works (Railway, Render, Fly.io, a VPS,
etc.). Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `PORT` as
environment variables on the backend; point the frontend's API calls at the
deployed backend URL (or serve both behind the same origin/proxy).

## What's deliberately not built yet

- Multi-tenant onboarding/admin (billing, inviting other businesses to sign
  up themselves, a reseller dashboard) — the schema supports it, but the
  onboarding flow and access model for reselling this to other vendors is a
  separate project once there's a business reason to build it.
- Receipts/printing, barcode scanning, purchase orders, supplier tracking.
