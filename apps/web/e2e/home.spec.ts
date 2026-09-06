import { expect, test } from "@playwright/test";

test("the home page states what M4 is", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("M4");
  await expect(page.getByText("Multi Model, Multi Modal.")).toBeVisible();
});
