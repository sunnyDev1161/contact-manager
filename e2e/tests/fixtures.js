const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { _electron: electron } = require("@playwright/test");

const DESKTOP_DIR = path.join(__dirname, "..", "..", "desktop");
const ELECTRON_BIN = require(path.join(DESKTOP_DIR, "node_modules", "electron"));

let nextPort = 4500; // each test file gets its own port so parallel-ish runs never collide

// Launches a real Electron app (same binary the user runs), backed by the
// real Express server and the shared e2e SQLite database migrated by
// global-setup.js. Returns { app, window }; caller must call app.close().
async function launchApp() {
  const port = nextPort++;
  // Electron persists its session (including localStorage — pos_token,
  // pos_user) to an on-disk userData directory that's shared by default
  // across every launch of the same app. Without an isolated one here, one
  // test file's logged-in session bleeds into the next file's "fresh"
  // launch, since they're really sharing one profile on disk.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pos-e2e-profile-"));
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [DESKTOP_DIR, "--no-sandbox", `--user-data-dir=${userDataDir}`],
    cwd: DESKTOP_DIR,
    env: {
      ...process.env,
      DATABASE_URL: "file:./e2e-test.db",
      JWT_SECRET: "e2e-test-secret-do-not-use-in-production",
      PORT: String(port)
    }
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return { app, window };
}

function uniqueBusinessName() {
  return `E2E Traders ${crypto.randomUUID().slice(0, 8)}`;
}

// Registers a brand-new business through the real UI (not a direct API
// call) so every test file gets an isolated business with no data left
// over from any other test, and exercises the actual registration form.
// Assumes the app just cold-started, landing on /login (no session yet).
async function registerFreshBusiness(window) {
  await window.waitForURL("**/login");
  await window.click('a:has-text("Create a business account")');
  await window.waitForURL("**/register");

  const businessName = uniqueBusinessName();
  const email = `owner-${crypto.randomUUID()}@example.com`;
  const password = "password123";

  await window.fill('label:has-text("Business name") input', businessName);
  await window.fill('label:has-text("Your name") input', "E2E Owner");
  await window.fill('label:has-text("Email") input', email);
  await window.fill('label:has-text("Password") input', password);
  await window.click('button:has-text("Create account")');
  await window.waitForURL("**/pos");

  return { businessName, email, password };
}

// Logs out if a session is active, otherwise no-ops — lets each test start
// from a known state without assuming exactly how the previous test ended
// (e.g. a failed-login test correctly ends back on /login, not /pos).
async function ensureLoggedOut(window) {
  if (window.url().includes("/login") || window.url().includes("/register")) return;
  // A test that ends mid-flow (payment panel, held-sales list, ledger
  // overlay) would otherwise block the Log out click behind an overlay
  // that intercepts pointer events — close it first defensively so one
  // test's leftover UI state can never hang the next.
  const overlayClose = window.locator(".overlay-close, .payment-actions button:has-text(\"Cancel\")");
  if (await overlayClose.count()) await overlayClose.first().click();

  const logoutBtn = window.locator('button:has-text("Log out")');
  if (await logoutBtn.count()) {
    await logoutBtn.click();
    await window.waitForURL("**/login");
  }
}

module.exports = { launchApp, registerFreshBusiness, uniqueBusinessName, ensureLoggedOut };
