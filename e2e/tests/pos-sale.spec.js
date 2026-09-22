const { test, expect } = require("@playwright/test");
const { launchApp, registerFreshBusiness, ensureLoggedOut } = require("./fixtures");

async function addProduct(window, { name, retail, trade, cost, stock }) {
  await window.click('a:has-text("Inventory")');
  await window.waitForURL("**/inventory");
  await window.fill('label:has-text("Name") input', name);
  await window.fill('label:has-text("Retail price") input', String(retail));
  await window.fill('label:has-text("Trade price") input', String(trade));
  await window.fill('label:has-text("Cost") input', String(cost));
  await window.fill('label:has-text("Stock quantity") input', String(stock));
  await window.click('button:has-text("Add product")');
  await expect(window.locator("td", { hasText: name })).toBeVisible();
  await window.click('a:has-text("POS")');
  await window.waitForURL("**/pos");
}

test.describe("POS checkout flow", () => {
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
  });

  test("completes a walk-in cash sale and decrements stock", async () => {
    await addProduct(window, { name: "Basmati Rice", retail: 220, trade: 200, cost: 180, stock: 100 });

    await window.click('.product-tile:has-text("Basmati Rice")');
    await expect(window.locator(".total-display")).toContainText("Rs. 220.00");

    await window.click('button:has-text("Pay Rs. 220.00")');
    await window.click('.payment-panel .keypad-key:has-text("2")');
    await window.click('.payment-panel .keypad-key:has-text("2")');
    await window.click('.payment-panel .keypad-key:has-text("0")');
    await expect(window.locator(".payment-actions button:has-text(\"Confirm Sale\")")).toBeEnabled();
    await window.click('.payment-actions button:has-text("Confirm Sale")');

    await expect(window.locator(".success-banner")).toContainText("Sale complete");
    // Note: "Print Bill" is deliberately not clicked here — window.print()
    // opens a real native OS print dialog in Electron (correct, expected
    // behavior for an actual cash register), which would just hang waiting
    // for human interaction in a headless run rather than indicating a bug.

    await window.click('a:has-text("Inventory")');
    await window.waitForURL("**/inventory");
    const row = window.locator("tr", { hasText: "Basmati Rice" });
    await expect(row.locator("td").nth(7)).toHaveText("99"); // stock 100 - 1
  });

  test("blocks a walk-in sale from confirming until fully paid", async () => {
    await addProduct(window, { name: "Chaat Masala", retail: 80, trade: 65, cost: 50, stock: 500 });
    await window.click('.product-tile:has-text("Chaat Masala")');
    await window.click('button:has-text("Pay Rs. 80.00")');
    await expect(window.locator(".payment-actions button:has-text(\"Confirm Sale\")")).toBeDisabled();
    await window.click('.payment-panel .keypad-key:has-text("5")');
    await expect(window.locator(".payment-actions button:has-text(\"Confirm Sale\")")).toBeDisabled();
    await window.click('.payment-actions button:has-text("Cancel")'); // leave the overlay closed for the next test
  });

  test("a credit sale to a customer updates their ledger balance", async () => {
    await addProduct(window, { name: "Garlic Paste", retail: 120, trade: 100, cost: 80, stock: 200 });

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    await window.fill('label:has-text("Shop name") input', "Malik General Store");
    await window.click('button:has-text("Add customer")');
    await expect(window.locator("td", { hasText: "Malik General Store" })).toBeVisible();

    await window.click('a:has-text("POS")');
    await window.waitForURL("**/pos");
    await window.fill('.customer-search input', "Malik");
    await window.click('.customer-option:has-text("Malik General Store")');
    await expect(window.locator(".sale-type-btn.trade")).toHaveClass(/active/); // auto-switched to trade

    await window.click('.product-tile:has-text("Garlic Paste")');
    await expect(window.locator(".total-display")).toContainText("Rs. 100.00"); // trade price

    await window.click('button:has-text("Pay Rs. 100.00")');
    await window.click('.payment-panel .keypad-key:has-text("4")');
    await window.click('.payment-panel .keypad-key:has-text("0")');
    await expect(window.locator(".payment-row.credit")).toContainText("Rs. 60.00");
    await window.click('.payment-actions button:has-text("Confirm Sale")');
    await expect(window.locator(".success-banner")).toContainText("added to Malik General Store's account");

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    const row = window.locator("tr", { hasText: "Malik General Store" });
    await expect(row.locator(".balance-owed")).toContainText("Rs. 60.00");
  });

  test("voiding a sale restocks the item and reverses any credit", async () => {
    await addProduct(window, { name: "Cocoa Powder", retail: 250, trade: 210, cost: 170, stock: 50 });

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    await window.fill('label:has-text("Shop name") input', "Zafar Store");
    await window.click('button:has-text("Add customer")');

    await window.click('a:has-text("POS")');
    await window.waitForURL("**/pos");
    await window.fill('.customer-search input', "Zafar");
    await window.click('.customer-option:has-text("Zafar Store")');
    await window.click('.product-tile:has-text("Cocoa Powder")');
    await window.click('button:has-text("Pay Rs. 210.00")'); // trade price
    await window.click('.payment-actions button:has-text("Confirm Sale")'); // 0 tendered, fully on credit

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    await expect(window.locator("tr", { hasText: "Zafar Store" }).locator(".balance-owed")).toContainText("Rs. 210.00");

    await window.click('a:has-text("Sales")');
    await window.waitForURL("**/sales");
    await window.click('button:has-text("Void")');
    await window.fill('label:has-text("Reason") input', "Wrong item scanned");
    await window.click('button:has-text("Void Sale")');
    await expect(window.locator("text=VOIDED")).toBeVisible();

    await window.click('a:has-text("Customers")');
    await window.waitForURL("**/customers");
    await expect(window.locator("tr", { hasText: "Zafar Store" }).locator(".balance-clear")).toContainText("Rs. 0.00");

    await window.click('a:has-text("Inventory")');
    await window.waitForURL("**/inventory");
    await expect(window.locator("tr", { hasText: "Cocoa Powder" }).locator("td").nth(7)).toHaveText("50"); // fully restocked
  });
});
