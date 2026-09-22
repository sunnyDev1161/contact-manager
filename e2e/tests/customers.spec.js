const { test, expect } = require("@playwright/test");
const { launchApp, registerFreshBusiness, ensureLoggedOut } = require("./fixtures");

test.describe("Customer credit ledger", () => {
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
    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
  });

  test("adds a customer with balance Rs. 0.00", async () => {
    await window.fill('label:has-text("Shop name") input', "Malik General Store");
    await window.fill('label:has-text("Shopkeeper name") input', "Malik Zafar");
    await window.fill('label:has-text("Phone") input', "0300-1234567");
    await window.click('button:has-text("Add customer")');

    const row = window.locator("tr", { hasText: "Malik General Store" });
    await expect(row).toBeVisible();
    await expect(row.locator(".balance-clear")).toContainText("Rs. 0.00");
  });

  test("records a standalone payment (not tied to any sale) and it appears in the ledger", async () => {
    await window.fill('label:has-text("Shop name") input', "Zafar Store");
    await window.click('button:has-text("Add customer")');

    const row = window.locator("tr", { hasText: "Zafar Store" });
    await row.locator('button:has-text("Ledger")').click();
    await expect(window.locator(".ledger-panel")).toContainText("No transactions yet.");

    await window.fill('.ledger-payment-form input[placeholder="Payment amount"]', "500");
    await window.fill('.ledger-payment-form input[placeholder="Note (optional)"]', "Advance payment");
    await window.click('.ledger-payment-form button:has-text("Record Payment")');

    await expect(window.locator(".ledger-row")).toContainText("Payment");
    await expect(window.locator(".ledger-row")).toContainText("Advance payment");
    await expect(window.locator(".ledger-amount.payment")).toContainText("Rs. 500.00");
  });

  test("rejects a zero or blank payment amount without calling the API", async () => {
    await window.fill('label:has-text("Shop name") input', "Bad Input Store");
    await window.click('button:has-text("Add customer")');
    await window.locator("tr", { hasText: "Bad Input Store" }).locator('button:has-text("Ledger")').click();
    await window.click('.ledger-payment-form button:has-text("Record Payment")');
    await expect(window.locator(".error-banner")).toContainText("Enter a valid payment amount.");
  });

  test("staff can access Customers and record payments, but cannot add or delete customers", async () => {
    await window.fill('label:has-text("Shop name") input', "Owner-Added Shop");
    await window.click('button:has-text("Add customer")');

    await window.click('a:has-text("Staff")');
    await window.waitForURL("**/staff");
    const staffEmail = `custaccess-${Date.now()}@example.com`;
    await window.fill('label:has-text("Name") input', "Limited Staff");
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Temporary password") input', "password123");
    await window.click('button:has-text("Add staff")');

    await ensureLoggedOut(window);
    await window.fill('label:has-text("Email") input', staffEmail);
    await window.fill('label:has-text("Password") input', "password123");
    await window.click('button[type="submit"]:has-text("Log in")');
    await window.waitForURL("**/pos");

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    await expect(window.locator("tr", { hasText: "Owner-Added Shop" })).toBeVisible();
    await expect(window.locator('button:has-text("Ledger")')).toBeVisible();
    // Staff must not see the add-customer form or Edit/Delete actions.
    await expect(window.locator('h2:has-text("Add customer")')).toHaveCount(0);
    await expect(window.locator("tr", { hasText: "Owner-Added Shop" }).locator('button:has-text("Delete")')).toHaveCount(0);

    // But recording a payment must still work for staff.
    await window.locator("tr", { hasText: "Owner-Added Shop" }).locator('button:has-text("Ledger")').click();
    await window.fill('.ledger-payment-form input[placeholder="Payment amount"]', "100");
    await window.click('.ledger-payment-form button:has-text("Record Payment")');
    await expect(window.locator(".ledger-amount.payment")).toContainText("Rs. 100.00");
  });
});
