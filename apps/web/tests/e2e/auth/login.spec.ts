import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";

test.describe("Login — redirect behavior", () => {
  test("unauthenticated access to /beranda redirects to /login", async ({
    page,
  }) => {
    await page.goto("/beranda");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated access to /transaksi redirects to /login", async ({
    page,
  }) => {
    await page.goto("/transaksi");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });
});

test.describe("Login — page rendering", () => {
  test("login page renders email input, password input, and submit button", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test("/login is accessible when unauthenticated without redirect loop", async ({
    page,
  }) => {
    const response = await page.goto("/login");
    // Should land on /login directly — no redirect to a third URL
    expect(page.url()).toContain("/login");
    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe("Login — credentials", () => {
  test("invalid credentials show error toast", async ({ page }) => {
    test.skip(
      !process.env.API_AVAILABLE,
      "requires live API (set API_AVAILABLE=1 when dev server is running)",
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("wrong@example.com", "wrongpassword");

    await expect(loginPage.errorToast).toBeVisible({ timeout: 10_000 });
  });
});
