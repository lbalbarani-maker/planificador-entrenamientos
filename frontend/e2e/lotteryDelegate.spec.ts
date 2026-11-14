import { expect, test } from '@playwright/test';

const delegateToken = process.env.E2E_DELEGATE_TOKEN?.trim();

test.describe('Lotería - enlace de delegado', () => {
  test('muestra el equipo, las jugadoras y el formulario de cobro', async ({ page }) => {
    test.skip(
      !delegateToken,
      'Configura E2E_DELEGATE_TOKEN en .env.test.local para ejecutar este flujo',
    );

    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`/d/${delegateToken}`);
    await expect(page.getByText(/^Delegado /)).toBeVisible();
    await expect(page.getByText('Jugadoras')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const firstCollect = page.getByRole('button', { name: 'Cobrar' }).first();
    if (await firstCollect.isEnabled()) {
      await firstCollect.click();
      await expect(page.getByRole('heading', { name: /Cobro de/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cobrar todo' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();
    }
  });
});

test.describe('Lotería - delegado sin instalación', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('no muestra el banner de instalar app en el enlace de delegado', async ({
    page,
  }) => {
    test.skip(
      !delegateToken,
      'Configura E2E_DELEGATE_TOKEN en .env.test.local para ejecutar este flujo',
    );

    await page.goto(`/d/${delegateToken}`);
    await expect(page.getByText(/^Delegado /)).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.getByText('Instala la app')).toHaveCount(0);
  });
});
