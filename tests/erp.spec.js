const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");
const password = "Cedar!River-827364";

async function signup(page) {
  const username = `browser_${randomUUID().slice(0, 8)}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Connected to your database", { exact: true }),
  ).toBeVisible();
  return username;
}
async function nav(page, name) {
  await expect(
    page.getByText("Refreshing saved data...", { exact: true }),
  ).not.toBeVisible();
  await page
    .locator("aside")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name, exact: true }).first(),
  ).toBeVisible();
}
async function saved(page) {
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Refreshing saved data...", { exact: true }),
  ).not.toBeVisible();
}
async function firstChoice(page, label) {
  await page
    .getByRole("dialog")
    .getByLabel(label, { exact: true })
    .selectOption({ index: 1 });
}
async function draft(
  page,
  module,
  { bill = false, quantity = "2", tax = "0" } = {},
) {
  await nav(page, module);
  if (bill)
    await page.getByRole("button", { name: "Bills", exact: true }).click();
  await page
    .getByRole("button", {
      name:
        module === "Sales"
          ? "Create invoice"
          : bill
            ? "Create purchase bill"
            : "Create purchase order",
      exact: true,
    })
    .click();
  await firstChoice(page, module === "Sales" ? "Customer" : "Supplier");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantity", { exact: true }).fill(quantity);
  await dialog.getByLabel("Tax (%)", { exact: true }).fill(tax);
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Edit draft" }),
  ).toBeVisible();
}
async function post(page, order = false) {
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: order ? "Confirm order" : "Post document",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Posted", { exact: true }),
  ).toBeVisible();
}
async function accountPost(page, path, body) {
  const session = await (await page.request.get("/api/auth/session/")).json();
  const response = await page.request.post(`/api/${path}`, {
    data: body,
    headers: {
      "X-CSRFToken": session.csrfToken,
      Origin: "http://localhost:3100",
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("all V1 modules persist and stock/payment workflows reach Django", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signup(page);
  await nav(page, "Settings");
  await page.getByLabel("Company name").fill("Browser verification company");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page.getByText("Company settings saved.", { exact: true }),
  ).toBeVisible();

  for (const [module, button, field, name] of [
    ["Customers", "Add customer", "Customer name", "Browser customer"],
    ["Suppliers", "Add supplier", "Supplier name", "Browser supplier"],
  ]) {
    await nav(page, module);
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.getByRole("dialog").getByLabel(field).fill(name);
    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await saved(page);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  }
  await nav(page, "Inventory");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const form = page.getByRole("dialog");
  for (const [label, value] of [
    ["Product name", "Browser keyboard"],
    ["SKU", "BROWSER-KEY"],
    ["Category", "Electronics"],
    ["Cost price", "20"],
    ["Selling price", "35"],
    ["Minimum stock", "2"],
  ])
    await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole("button", { name: "Create record" }).click();
  await saved(page);

  await draft(page, "Purchases", { quantity: "5" });
  await post(page, true);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create bill from order" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Post document", exact: true }),
  ).toBeVisible();
  await post(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Payment method")
    .selectOption("Bank transfer");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await saved(page);

  await draft(page, "Sales", { tax: "5" });
  await expect(
    page.getByRole("dialog").getByText("$73.50", { exact: true }).first(),
  ).toBeVisible();
  await post(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await saved(page);
  await page
    .getByRole("button", { name: "View Browser customer", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create return", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Reason", { exact: true })
    .fill("One item returned");
  await page
    .getByRole("dialog")
    .getByLabel(/Browser keyboard \(2 available/)
    .fill("1");
  await page.getByRole("button", { name: "Save return", exact: true }).click();
  await saved(page);
  await page
    .getByRole("button", { name: "View Browser customer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record refund", exact: true })
    .click();
  await page.getByRole("button", { name: "Save refund", exact: true }).click();
  await saved(page);

  await nav(page, "Expenses");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Expense name")
    .fill("Browser expense");
  await page
    .getByRole("dialog")
    .getByLabel("Category", { exact: true })
    .fill("Office");
  await page
    .getByRole("dialog")
    .getByLabel("Amount", { exact: true })
    .fill("5");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await saved(page);
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "Browser expense", exact: true }),
  ).toBeVisible();

  await nav(page, "Reports");
  await page
    .getByRole("button", { name: "Profit & Loss Summary", exact: true })
    .click();
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Profit" })
      .getByText("$10.00", { exact: true }),
  ).toBeVisible();
  await nav(page, "Accounting");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "Cash balance" })
      .getByText("$31.75", { exact: true }),
  ).toBeVisible();
  await nav(page, "Dashboard");
  await expect(
    page.getByRole("img", { name: /Monthly net sales/ }),
  ).toBeVisible();
  await nav(page, "Inventory");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "BROWSER-KEY" })
      .getByRole("cell", { name: "4", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantity (new balance for adjustment)")
    .fill("1");
  await page
    .getByRole("dialog")
    .getByLabel("Reason", { exact: true })
    .fill("Counted extra unit");
  await page.getByRole("button", { name: "Save movement" }).click();
  await saved(page);
  await page.getByRole("button", { name: "Movements", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Counted extra unit", exact: true }),
  ).toBeVisible();

  await nav(page, "Users");
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Username", { exact: true })
    .fill(`staff_${randomUUID().slice(0, 8)}`);
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Browser staff");
  await page
    .getByRole("dialog")
    .getByLabel("Password", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await saved(page);
  await expect(
    page.getByRole("cell", { name: "Browser staff", exact: true }),
  ).toBeVisible();
  await nav(page, "Settings");
  await expect(page.getByLabel("Company name")).toHaveValue(
    "Browser verification company",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Customers", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Staff enters business data without administration or deletion access", async ({
  page,
}) => {
  await signup(page);
  await accountPost(page, "customers/", { name: "Shared contact" });
  const username = `staff_${randomUUID().slice(0, 8)}`;
  await accountPost(page, "users/", { username, password, role: "Staff" });
  await accountPost(page, "auth/logout/", {});
  await page.reload();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await nav(page, "Customers");
  await expect(
    page.getByRole("cell", { name: "Shared contact", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add customer", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByRole("button", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Shared contact", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Customer name"),
  ).toBeEnabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Customer name")
    .fill("Staff entered contact");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await saved(page);
  await expect(
    page.getByRole("cell", { name: "Staff entered contact", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(0);
  await nav(page, "Settings");
  await expect(page.getByLabel("Company name")).toBeDisabled();
});

test("failed saves retain form data and never claim success", async ({
  page,
}) => {
  await signup(page);
  await nav(page, "Expenses");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Expense name")
    .fill("Retry expense");
  await page
    .getByRole("dialog")
    .getByLabel("Category", { exact: true })
    .fill("Office");
  await page
    .getByRole("dialog")
    .getByLabel("Amount", { exact: true })
    .fill("5");
  await page.route("**/api/expenses/", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Verification outage" }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Verification outage",
  );
  await expect(page.getByRole("dialog").getByLabel("Expense name")).toHaveValue(
    "Retry expense",
  );
  await page.unroute("**/api/expenses/");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await saved(page);
  await expect(
    page.getByRole("cell", { name: "Retry expense", exact: true }),
  ).toBeVisible();
});

test("Swagger renders its schema and signs in with an ERP account", async ({
  page,
}) => {
  const username = await signup(page);
  await page.goto("http://127.0.0.1:8001/api/docs/");
  await expect(
    page.getByRole("heading", { name: "Folio API explorer" }),
  ).toBeVisible();
  await page.locator('#api-login [name="username"]').fill(username);
  await page.locator('#api-login [name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#api-session")).toContainText(
    `Signed in as ${username}`,
  );
  await expect(page.locator(".opblock").first()).toBeVisible();
  const response = await page.request.get("http://127.0.0.1:8001/api/schema/");
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toContain("/api/documents/");
});

test("workspace contains scrolling and keeps the navbar visible", async ({
  page,
}) => {
  await signup(page);
  await expect(
    page.locator("aside").getByRole("button", { name: "Learning Guide" }),
  ).toHaveCount(0);
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 650 });
    await page.goto("/#Settings");
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    const content = await page.locator("main").boundingBox();
    expect(Math.round(content.x + content.width)).toBe(width);
    const before = await page.getByRole("banner").boundingBox();
    await page.locator("main").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const after = await page.getByRole("banner").boundingBox();
    expect(after.y).toBe(before.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBeTruthy();
  }
});

test("profile stays compact and shows real account details", async ({
  page,
}) => {
  const username = await signup(page);
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page
      .getByRole("button", { name: "Your profile", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Your profile",
      exact: true,
    });
    await expect(dialog.getByRole("heading", { name: username })).toBeVisible();
    await expect(
      dialog.getByText("Business records, team and settings", { exact: true }),
    ).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds.width).toBeLessThanOrEqual(560);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log in", exact: true }),
  ).toBeVisible();
});
