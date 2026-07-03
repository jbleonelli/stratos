import { test, expect } from '@playwright/test';
import { smokeRoutes } from '../src/app/pillar-subnav';

for (const route of smokeRoutes()) {
  test(`page smoke — ${route.id} (${route.path})`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('#content-scroll')).toBeVisible();
    await expect(page.getByText("Couldn't load")).toHaveCount(0);
    if (route.pillar) {
      await expect(page.getByTestId('topbar-pillar-label')).toHaveText(route.label);
    }
  });
}

test('merlin chat opens and responds', async ({ page }) => {
  await page.goto('/briefing');
  await page.getByTestId('ask-merlin').click();
  await expect(page.getByTestId('merlin-chat-panel')).toBeVisible();
  await page.getByLabel('Message Merlin').fill('any open asks?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('You have 1 open ask waiting for approval')).toBeVisible();
});
