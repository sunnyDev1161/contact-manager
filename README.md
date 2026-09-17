# Grocery POS

A point-of-sale system for a grocery shop: authenticated inventory management
and sales tracking, with per-sale profit computed automatically.

Runs entirely on your own laptop by default — no internet connection needed
after the one-time setup, no hosting account, no monthly bill. It can also be
deployed to the web later (see **Hosting it instead**) if you decide you need
that.

Every table is scoped to a `businessId` from day one, so the same codebase
can later host more than one shop (a reseller/multi-tenant model) without a
schema rewrite. That mode isn't built yet — today, each business is created
via the **Register** page and runs independently.

## Stack

- **Backend**: Node.js, Express, SQLite (via Prisma ORM), JWT auth (bcrypt password hashing)
- **Frontend**: React (Vite), React Router, Axios — built and served by the backend as one app

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
server/            Express API + Prisma schema/migrations + serves the built frontend
client/            React (Vite) frontend
start-windows.bat  Double-click to run on Windows
start-mac.command  Double-click to run on macOS
start-linux.sh     Run on Linux
```

## Running it on your laptop

You need [Node.js](https://nodejs.org) installed (the LTS version) — that's
the only prerequisite. No database server to install; the app stores its data
in a single SQLite file next to the code.

1. Download or `git clone` this repository onto your laptop.
2. Double-click the script for your OS:
   - **Windows**: `start-windows.bat`
   - **Mac**: `start-mac.command` (first time, right-click → Open, since it's
     an unsigned script — macOS will ask you to confirm once)
   - **Linux**: run `./start-linux.sh` in a terminal
3. First run takes a minute or two (installs dependencies, builds the app).
   Every run after that starts in a couple of seconds.
4. Your browser opens to `http://localhost:4000` automatically. Register your
   real business there.

To stop it: close the terminal/server window the script opened.

To use it again later, just run the same script — your data is already
there, in `server/dev.db`.

**Backing up your data** is copying one file: `server/dev.db`. Do this
regularly (copy it to a USB drive, cloud folder, email it to yourself —
whatever you'll actually do). If that file is lost with no copy, your
inventory and sales history are gone.

**Only this laptop can see it.** There's no sync between devices and no
remote access — if you want to run the POS from a second computer, or have
it reachable when you're not physically at this machine, that's the hosted
version below, not this one.

### Manual run (without the scripts)

```bash
cd server
cp .env.example .env      # generates nothing automatically — edit JWT_SECRET to any random string
npm install
npx prisma migrate deploy
npm run seed               # optional: demo business + owner login + sample products
npm start                  # starts on :4000

# in a separate step, once, to build the frontend the server serves:
cd ../client
npm install
npm run build
```

Then open `http://localhost:4000`. Seeded login (if you ran `npm run seed`):
`owner@example.com` / `changeme123`.

For frontend development with hot-reload instead of a static build:
`cd client && npm run dev` (starts on :5173, proxies `/api` to :4000 — run
the backend with `npm run dev` too in that case).

## Hosting it instead

If you later want this reachable from anywhere (not just this laptop), or
usable by staff on their own devices, `render.yaml` at the repo root is a
one-click deployment blueprint for [Render](https://render.com).

**This requires switching the database back to PostgreSQL first** —
`server/prisma/schema.prisma` currently has `provider = "sqlite"`, chosen
specifically for single-laptop use. SQLite's file-based storage doesn't
survive restarts on most hosts. Change it to `provider = "postgresql"`,
point `DATABASE_URL` at a real Postgres instance, and re-run
`npx prisma migrate dev` to regenerate migrations for Postgres before
deploying — worth asking for help with this step when you're ready, rather
than guessing at it.

Once that switch is done:

1. Go to [render.com](https://render.com), sign in (your account, your
   billing).
2. **New** → **Blueprint** → connect this GitHub repo → **Apply**. Render
   provisions the database, backend, and frontend together.
3. Copy the backend (`pos-server`) URL once it's deployed, set it as
   `VITE_API_URL` on the frontend (`pos-client`) service, save (triggers a
   rebuild).
4. Open the frontend's URL — that's your live POS.

Known trade-offs of the free tier: Render's free Postgres expires after a
set period and free web services sleep when idle (slow first request after a
quiet spell). Fine for trying it out; budget for the paid tier if you're
running a real shop on it day to day.

## Data model

- `Business` — a tenant (one shop)
- `User` — belongs to a business, role `OWNER` or `STAFF`
- `Product` — belongs to a business: unit, price, cost, stock quantity
- `Sale` / `SaleItem` — a completed transaction and its line items, with
  price/cost snapshotted at sale time and profit computed per line

Money and quantity fields are plain floating-point numbers (SQLite has no
native decimal type), rounded consistently on every calculation. Fine at
grocery-shop scale; if this ever needs bank-grade precision, that's a
Postgres + `Decimal` change, not a rewrite.

## What's deliberately not built yet

- Multi-tenant onboarding/admin (billing, inviting other businesses to sign
  up themselves, a reseller dashboard) — the schema supports it, but the
  onboarding flow and access model for reselling this to other vendors is a
  separate project once there's a business reason to build it.
- Multi-device sync for the laptop version — each install has its own data.
- Receipts/printing, barcode scanning, purchase orders, supplier tracking.
