import { test, expect, type Page } from '@playwright/test';

/** Seed localStorage/sessionStorage before Merlin App mounts. */
async function bootVisualClone(page: Page, view = 'briefing') {
  await page.addInitScript((initialView) => {
    const session = {
      userId: 'demo-user-alex',
      email: 'alex@meridian.example',
      name: 'Alex Morgan',
      company: 'Meridian Properties',
      role: 'facility',
      organizationId: 'demo-org-meridian',
      impersonatingOrgId: null,
      isPlatformAdmin: false,
      isMerlinOwner: false,
      platformRole: null,
      isSuperAdmin: false,
      isPlatformAdminOnly: false,
      isPlatformNormalUser: false,
      firstName: 'Alex',
      lastName: 'Morgan',
      phone: '',
      title: 'Facility Manager',
      picture: null,
      preferences: {
        theme: 'light',
        accent: 'pink',
        density: 'comfortable',
        sidebar: 'collapsed',
        variant: 'conservative',
      },
    };
    localStorage.setItem('merlin-session', JSON.stringify(session));
    localStorage.setItem('merlinChatOpen', '0');
    localStorage.setItem('merlinView', initialView);
    localStorage.setItem(
      'merlin-tweaks',
      JSON.stringify({
        building: 'hq',
        role: 'facility',
        theme: 'light',
        accent: 'pink',
        density: 'comfortable',
        sidebar: 'collapsed',
        variant: 'conservative',
      }),
    );
    sessionStorage.setItem('merlin-landed', '1');
  }, view);
}

async function waitForShell(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('MERLIN', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);
}

/** Mask live simulator values and 3D canvas noise. */
function screenshotOptions(page: Page) {
  return {
    fullPage: false,
    mask: [
      page.locator('canvas'),
      page.getByText(/OCCUPANCY · LIVE/i),
      page.getByText(/\d+%/),
    ],
  };
}

test('visual clone — My day', async ({ page }) => {
  await bootVisualClone(page, 'briefing');
  await waitForShell(page);
  await expect(page.getByRole('heading', { name: /need your attention/i })).toBeVisible();
  await expect(page).toHaveScreenshot('my-day.png', screenshotOptions(page));
});

test('visual clone — Now', async ({ page }) => {
  await bootVisualClone(page, 'now');
  await waitForShell(page);
  await expect(page).toHaveScreenshot('now.png', screenshotOptions(page));
});

test('visual clone — Metrics', async ({ page }) => {
  await bootVisualClone(page, 'dashboard');
  await waitForShell(page);
  await expect(page).toHaveScreenshot('metrics.png', screenshotOptions(page));
});

test('visual clone — AI Agents', async ({ page }) => {
  await bootVisualClone(page, 'agents');
  await waitForShell(page);
  await expect(page).toHaveScreenshot('agents.png', screenshotOptions(page));
});

test('visual clone — Hypervisor', async ({ page }) => {
  await bootVisualClone(page, 'hypervisor');
  await waitForShell(page);
  await expect(page).toHaveScreenshot('hypervisor.png', screenshotOptions(page));
});
