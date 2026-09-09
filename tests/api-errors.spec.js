const { test, expect } = require("@playwright/test");

for (const [status, message] of [
  [200, "The backend returned an invalid response"],
  [502, "The backend is unavailable"],
]) {
  test(`session handles an HTML ${status} response without a runtime crash`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/auth/session/", (route) => route.fulfill({
      status,
      contentType: "text/html",
      body: "<html><body>Proxy response</body></html>",
    }));
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
