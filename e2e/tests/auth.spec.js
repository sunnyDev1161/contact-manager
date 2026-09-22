const { test, expect } = require("@playwright/test");
const { launchApp, registerFreshBusiness, ensureLoggedOut } = require("./fixtures");

test.describe("Auth and staff management", () => {
  let app, window;

  test.beforeAll(async () => {
    ({ app, window } = await launchApp());
  });

  test.afterAll(async () => {
    await app.close();
  });

  test("registers a new business and lands on the POS screen", async () => {
    await registerFreshBusiness(window);
    await expect(window.locator(".scanner-input")).toBeVisible();
  });

  test("logs out and back in with the same credentials", async () => {
    await ensureLoggedOut(window);

    // Registering again gives us fresh, known-good credentials to log in with.
    const creds = await registerFreshBusiness(window);
    await window.click('button:has-text("Log out")');
    await window.waitForURL("**/login");

    await window.fill('label:has-text("Email") input', creds.email);
    await window.fill('label:has-text("Password") input', creds.password);
    await window.click('button[type="submit"]:has-text("Log in")');
    await window.waitForURL("**/pos");
    await expect(window.locator(".scanner-input")).toBeVisible();
  });

  test("shows an error for the wrong password instead of logging in", async () => {
    await ensureLoggedOut(window);
    const creds = await registerFreshBusiness(window);
    await window.click('button:has-text("Log out")');
    await window.waitForURL("**/login");

    await window.fill('label:has-text("Email") input', creds.email);
    await window.fill('label:has-text("Password") input', "totally-wrong-password");
    await window.click('button[type="submit"]:has-text("Log in")');
    await expect(window.locator(".error-banner")).toContainText("Invalid email or password");
    expect(window.url()).toContain("/login");
  });

  // Regression test for a real bug found earlier: Chromium's built-in
  // Autofill popup for the adjacent password field could intercept the
  // click hit-test on the "Add staff" submit button, hanging a plain
  // (non-forced) click indefinitely. Fixed via disable-features=Autofill
  // in desktop/main.js. This exercises the exact sequence that reproduced
  // it: fill name/email/password, then a real (unforced) click.
  test("creates a staff account, and the account can log in and out", async () => {
    await ensureLoggedOut(window);
    await registerFreshBusiness(window);

    await window.click('a:has-text("Staff")');
    await window.waitForURL("**/staff");

    const staffEmail = `cashier-${Date.now()}@example.com`;
    await window.fill('label:has-text("Name") input', "Cashier Ali");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Temporary password") input', "password123");
    await window.click('button:has-text("Add staff")');

    await expect(window.locator(".success-banner")).toContainText("Staff account created.");
    await expect(window.locator("td", { hasText: "Cashier Ali" })).toBeVisible();

    await window.click('button:has-text("Log out")');
    await window.waitForURL("**/login");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Password") input', "password123");
    await window.click('button[type="submit"]:has-text("Log in")');
    await window.waitForURL("**/pos");

    // Staff must not see owner-only nav links.
    await expect(window.locator('nav a:has-text("Staff")')).toHaveCount(0);
    await expect(window.locator('nav a:has-text("Inventory")')).toHaveCount(0);
  });

  test("deactivating a staff account blocks their next login", async () => {
    await ensureLoggedOut(window);
    await registerFreshBusiness(window);

    await window.click('a:has-text("Staff")');
    await window.waitForURL("**/staff");
    const staffEmail = `revoke-${Date.now()}@example.com`;
    await window.fill('label:has-text("Name") input', "To Revoke");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Temporary password") input', "password123");
    await window.click('button:has-text("Add staff")');
    await expect(window.locator("td", { hasText: "To Revoke" })).toBeVisible();

    const row = window.locator("tr", { hasText: "To Revoke" });
    window.once("dialog", d => d.accept());
    await row.locator('button:has-text("Deactivate")').click();
    await expect(row.locator("td", { hasText: "Deactivated" })).toBeVisible();

    await window.click('button:has-text("Log out")');
    await window.waitForURL("**/login");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Password") input', "password123");
    await window.click('button[type="submit"]:has-text("Log in")');
    await expect(window.locator(".error-banner")).toContainText("deactivated");
    expect(window.url()).toContain("/login");
  });
});
