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
