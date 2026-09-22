# Grocery POS

A point-of-sale system for a grocery shop: authenticated inventory management
and sales tracking, with per-sale profit computed automatically.

Runs as a real desktop app on your own laptop — its own window, no browser
tab, no address bar. No internet connection needed after the one-time setup,
no hosting account, no monthly bill. It can also be deployed to the web later
(see **Hosting it instead**) if you decide you need that.

Login is required either way — there's no "desktop mode" that skips auth.
Wrapping the app in a native window doesn't change that; it's the same
login screen either way, just without browser chrome around it.

Every table is scoped to a `businessId` from day one, so the same codebase
can later host more than one shop (a reseller/multi-tenant model) without a
schema rewrite. That mode isn't built yet — today, each business is created
via the **Register** page and runs independently.

## Stack

- **Backend**: Node.js, Express, SQLite (via Prisma ORM), JWT auth (bcrypt password hashing)
- **Frontend**: React (Vite), React Router, Axios — built and served by the backend as one app
- **Desktop shell**: Electron — opens the app in its own native window and
  manages starting/stopping the backend for you

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
desktop/           Electron shell — native window + starts/stops the backend
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
3. First run takes a few minutes (installs dependencies, builds the app,
   downloads the ~150MB Electron runtime — needs internet for this step
   only). Every run after that opens in a couple of seconds, no internet
   required.
4. A native app window opens — no browser, no address bar. Register your
   real business there.

To stop it: close the app window (this also stops the background server —
you don't need to close anything else separately).

To use it again later, just run the same script — your data is already
there, in `server/dev.db`.

**No packaged installer (.exe/.dmg) is provided.** I can't build and verify
one from here — a Windows installer needs to actually run on Windows to
confirm it works, and this environment has neither a Windows nor a Mac
machine to test on. Shipping an installer I haven't verified would be worse
than not having one. What you have instead is source code plus a script that
installs Electron directly on your machine and runs it — I tested that exact
path end-to-end (fresh install through to a working native window with a
real login and checkout) before handing it to you. If a proper installer
matters to you later (e.g. handing this to staff who shouldn't see any of
this folder structure), that's a `electron-builder` packaging step — ask
when you're ready and we can look at what's needed for your OS specifically.

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

Then open `http://localhost:4000` in a browser — or, for the native window
instead of a browser tab, run the desktop shell separately (it starts the
server itself, so skip `npm start` above if you're using this):

```bash
cd desktop
npm install
npm start
```

Seeded login (if you ran `npm run seed`): `owner@example.com` / `changeme123`.

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

## Testing

Three layers, each runnable independently:

```bash
cd server && npm test              # Jest + Supertest, against a real migrated SQLite db
cd client && npm test              # Jest + React Testing Library
cd e2e && npx playwright test      # drives the real Electron app end-to-end (needs a display; use `xvfb-run -a npx playwright test` if there isn't one)
```

`server` and `client` also have `npm run test:coverage`. All three run in CI
on every PR (see `.github/workflows/ci.yml`).

The `e2e` suite is the one that actually launches Electron and clicks
through it like a real user would — it's what caught, for example, that
`window.prompt()` throws in Electron (Chromium's embedder there doesn't
implement it) even though it works fine in a browser or in a Jest/jsdom
test. Worth keeping in mind if you add a feature that needs to ask the
user something: use an in-app modal, not `prompt()`.

## What's deliberately not built yet

- Multi-tenant onboarding/admin (billing, inviting other businesses to sign
  up themselves, a reseller dashboard) — the schema supports it, but the
  onboarding flow and access model for reselling this to other vendors is a
  separate project once there's a business reason to build it.
- Multi-device sync for the laptop version — each install has its own data.
- Restoring from a backup. Settings can export a full JSON backup, but
  restoring it isn't implemented — a restore has to decide what to do with
  newer local data first, which is a real design decision, not a quick
  addition. For now, treat the exported JSON as an off-machine safety net,
  and use a raw copy of `server/prisma/dev.db` if you actually need to
  restore a machine's state.
- Receipts/printing, barcode scanning, purchase orders, supplier tracking.
