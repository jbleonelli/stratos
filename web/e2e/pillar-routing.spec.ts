import { test, expect } from '@playwright/test';
import { PILLAR_LABELS, PILLAR_LANDING, viewPath, type PillarId } from '../src/app/pillar-subnav';

const PILLARS: PillarId[] = ['monitor', 'operate', 'report', 'predict', 'innovate'];

test.describe('Journey 7 — customer shell 5-pillar routing', () => {
  test('lands on briefing and routes each pillar', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/briefing$/);
    await expect(page.getByTestId('topbar-pillar-label')).toHaveText(PILLAR_LABELS.monitor);

    for (const pillar of PILLARS) {
      await page.getByTestId(`pillar-${pillar}`).click();
      await expect(page).toHaveURL(new RegExp(`${viewPath(PILLAR_LANDING[pillar]).replace('/', '\\/')}$`));
      await expect(page.getByTestId('topbar-pillar-label')).toHaveText(PILLAR_LABELS[pillar]);
    }
  });

  test('monitor sub-nav switches views', async ({ page }) => {
    await page.goto('/briefing');
    await page.getByTestId('subnav-now').click();
    await expect(page).toHaveURL(/\/now$/);
    await page.getByTestId('subnav-agents').click();
    await expect(page).toHaveURL(/\/agents$/);
  });
});
