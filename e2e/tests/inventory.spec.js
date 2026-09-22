const { test, expect } = require("@playwright/test");
const { launchApp, registerFreshBusiness, ensureLoggedOut } = require("./fixtures");

test.describe("Inventory management", () => {
  let app, window;

  test.beforeAll(async () => {
    ({ app, window } = await launchApp());
  });

  test.afterAll(async () => {
    await app.close();
  });

  test.beforeEach(async () => {
    await ensureLoggedOut(window);
    await registerFreshBusiness(window);
    await window.click('a:has-text("Inventory")');
    await window.waitForURL("**/inventory");
  });

  test("adds a product and shows its computed profit preview live", async () => {
    await window.fill('label:has-text("Name") input', "Basmati Rice");
    await window.fill('label:has-text("Retail price") input', "220");
    await window.fill('label:has-text("Trade price") input', "200");
    await window.fill('label:has-text("Cost") input', "180");
    await expect(window.locator(".profit-preview")).toContainText("Rs. 40.00");
    await expect(window.locator(".profit-preview")).toContainText("Rs. 20.00");

    await window.fill('label:has-text("Stock quantity") input', "100");
    await window.click('button:has-text("Add product")');
    await expect(window.locator("tr", { hasText: "Basmati Rice" })).toBeVisible();
  });

  test("edits a product's price and it reflects immediately in the table", async () => {
    await window.fill('label:has-text("Name") input', "Chaat Masala");
    await window.fill('label:has-text("Retail price") input', "80");
    await window.fill('label:has-text("Trade price") input', "65");
    await window.fill('label:has-text("Cost") input', "50");
    await window.fill('label:has-text("Stock quantity") input', "500");
    await window.click('button:has-text("Add product")');

    const row = window.locator("tr", { hasText: "Chaat Masala" });
    await row.locator('button:has-text("Edit")').click();
    const priceInput = window.locator('label:has-text("Retail price") input');
    await priceInput.fill("95");
    await window.click('button:has-text("Save changes")');

    await expect(row.locator("td").nth(3)).toHaveText("Rs. 95.00");
  });

  test("marks a low-stock product with a visible warning row", async () => {
    await window.fill('label:has-text("Name") input', "Garlic Paste");
    await window.fill('label:has-text("Retail price") input', "120");
    await window.fill('label:has-text("Trade price") input', "100");
    await window.fill('label:has-text("Cost") input', "80");
    await window.fill('label:has-text("Stock quantity") input', "5");
    await window.fill('label:has-text("Low stock alert below") input', "10");
    await window.click('button:has-text("Add product")');

    await expect(window.locator("tr", { hasText: "Garlic Paste" })).toHaveClass(/low-stock-row/);

    // The topbar badge refetches on navigation (Layout stays mounted across
    // the whole session, so it can't react to a sibling page's own state) —
    // check it after moving to another page, matching how it's actually used.
    await window.click('a:has-text("POS")');
    await window.waitForURL("**/pos");
    await expect(window.locator('nav a:has-text("Inventory") .low-stock-badge')).toBeVisible();
  });

  test("soft-deletes a product with sale history instead of destroying it", async () => {
    await window.fill('label:has-text("Name") input', "Cocoa Powder");
    await window.fill('label:has-text("Retail price") input', "250");
    await window.fill('label:has-text("Trade price") input', "210");
    await window.fill('label:has-text("Cost") input', "170");
    await window.fill('label:has-text("Stock quantity") input', "50");
    await window.click('button:has-text("Add product")');

    await window.click('a:has-text("POS")');
    await window.waitForURL("**/pos");
    await window.click('.product-tile:has-text("Cocoa Powder")');
    await window.click('button:has-text("Pay Rs. 250.00")');
    await window.click('.payment-panel .keypad-key:has-text("2")');
    await window.click('.payment-panel .keypad-key:has-text("5")');
    await window.click('.payment-panel .keypad-key:has-text("0")');
    await window.click('.payment-actions button:has-text("Confirm Sale")');
    await expect(window.locator(".success-banner")).toContainText("Sale complete");

    await window.click('a:has-text("Inventory")');
    await window.waitForURL("**/inventory");
    const row = window.locator("tr", { hasText: "Cocoa Powder" });
    window.once("dialog", d => d.accept());
    await row.locator('button:has-text("Delete")').click();
    // Soft-deleted (isActive: false) products are hidden from the default
    // view — must show removed items before it (or its "(removed)" label)
    // is visible again.
    await expect(window.locator("tr", { hasText: "Cocoa Powder" })).toHaveCount(0);

    await window.click('label:has-text("Show removed") input');
    await expect(window.locator("text=Cocoa Powder (removed)")).toBeVisible();
    await expect(window.locator('tr:has-text("Cocoa Powder") button:has-text("Restore")')).toBeVisible();
  });

  test("staff cannot reach the Inventory page at all", async () => {
    await window.click('a:has-text("Staff")');
    await window.waitForURL("**/staff");
    const staffEmail = `stock-${Date.now()}@example.com`;
    await window.fill('label:has-text("Name") input', "No Inventory Access");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Temporary password") input', "password123");
    await window.click('button:has-text("Add staff")');

    await ensureLoggedOut(window);
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Password") input', "password123");
    await window.click('button[type="submit"]:has-text("Log in")');
    await window.waitForURL("**/pos");

    await expect(window.locator('nav a:has-text("Inventory")')).toHaveCount(0);
  });
});
