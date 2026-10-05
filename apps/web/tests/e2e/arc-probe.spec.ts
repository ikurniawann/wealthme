import { expect, test } from "@playwright/test";

// Historical interactive Batch 0 browser evidence was recorded before the
// probe was retired. Keep this guard so the diagnostic URL cannot ship
// publicly; Batch 1 must use a non-public interactive harness.
test("retired Arc probe route is unavailable and login has no Arc CSS", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/hydration|hydrated but/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/hydration|hydrated but/i.test(error.message))
      hydrationErrors.push(error.message);
  });

  const probe = await page.goto("/legal/arc-probe");
  expect(probe?.status()).toBe(404);

  const login = await page.goto("/login");
  expect(login?.status()).toBe(200);
  await expect(page.locator('button[type="submit"]')).toBeVisible();
  expect(await page.locator('link[href*="arc-foundation"]').count()).toBe(0);
  expect(
    await page.getByRole("heading", { name: "Arc Button probe" }).count(),
  ).toBe(0);
  expect(hydrationErrors).toEqual([]);
});
