import { expect, test, type Page } from '@playwright/test';

const sellerToken = process.env.E2E_SELLER_TOKEN?.trim();
const receiptToken = process.env.E2E_RECEIPT_TOKEN?.trim();
const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim();
const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim();
const adminPin = process.env.E2E_ADMIN_PIN?.trim() || '123456';
const lotteryId = process.env.E2E_LOTTERY_ID?.trim();
const sellerName = process.env.E2E_SELLER_NAME?.trim();

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(adminEmail!);
  await page.getByLabel('Contraseña').fill(adminPassword!);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  const setupPin = page.getByText('Configura tu PIN');
  const pinStep = page.getByText('Ingresa tu PIN');
  await expect(setupPin.or(pinStep)).toBeVisible({ timeout: 20_000 });

  if (await setupPin.isVisible()) {
    const inputs = page.locator('form input[type="password"]');
    await inputs.nth(0).fill(adminPin);
    await inputs.nth(1).fill(adminPin);
    await page.getByRole('button', { name: 'Guardar PIN' }).click();
  } else {
    await page.locator('form input[type="password"]').fill(adminPin);
    await page.getByRole('button', { name: 'Ingresar' }).click();
  }

  await page.waitForURL((url) => url.pathname === '/', { timeout: 20_000 });
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('lotteryAdminToken')),
    )
    .toBeTruthy();
}

test.describe('Lotería · flujo de jugadora', () => {
  test('compra una papeleta, comparte el recibo y la ve en el historial', async ({
    page,
    context,
  }) => {
    test.skip(
      !sellerToken,
      'Configura E2E_SELLER_TOKEN en .env.test.local para ejecutar este flujo',
    );
    test.slow();

    await page.goto(`/j/${sellerToken}`);
    await expect(page.getByText(/Jugadora:/)).toBeVisible();

    const available = page.locator('button[data-status="available"]');
    test.skip(
      (await available.count()) === 0,
      'No hay papeletas disponibles en el enlace de prueba',
    );

    await available.first().click();
    await expect(page.getByText('1 seleccionada')).toBeVisible();
    await page.getByRole('button', { name: 'VENDER' }).click();
    await expect(
      page.getByRole('heading', { name: 'Confirmar venta' }),
    ).toBeVisible();

    const buyer = `E2E ${Date.now()}`;
    await page.getByLabel(/Nombre del comprador/).fill(buyer);
    const physicalTicket = page.getByLabel('Se entrega papeleta física');
    await expect(physicalTicket).not.toBeChecked();
    await physicalTicket.check();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(
      page.getByRole('heading', { name: 'Venta confirmada' }),
    ).toBeVisible();

    const [receipt] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Ver recibo' }).last().click(),
    ]);
    await receipt.waitForLoadState('domcontentloaded');
    await expect(receipt.getByText('Recibo de compra')).toBeVisible();
    await expect(receipt.getByTestId('physical-ticket-delivered')).toBeVisible();
    await receipt.close();

    await page.getByRole('button', { name: 'Seguir vendiendo' }).click();
    const purchaseCard = page.getByTestId('seller-purchase').filter({ hasText: buyer });
    await expect(purchaseCard).toBeVisible();
    await expect(purchaseCard.getByTestId('physical-ticket-delivered')).toBeVisible();

    await page.reload();
    await expect(purchaseCard).toBeVisible();
    await expect(purchaseCard.getByTestId('physical-ticket-delivered')).toBeVisible();
  });

  test('en móvil no hay scroll horizontal y el zoom está permitido', async ({
    page,
  }) => {
    test.skip(
      !sellerToken,
      'Configura E2E_SELLER_TOKEN en .env.test.local para ejecutar este flujo',
    );

    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`/j/${sellerToken}`);
    await expect(page.getByText(/Jugadora:/)).toBeVisible();

    const columns = await page
      .locator('[data-testid="ticket-grid"]')
      .first()
      .evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
      );
    expect(columns).toBe(4);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewport).toContain('initial-scale=1');
    expect(viewport).not.toContain('user-scalable=no');
  });
});

test.describe('Lotería · enlaces públicos sin instalación', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  test('no muestra el banner de instalar app en lotería ni recibo', async ({
    page,
  }) => {
    test.skip(
      !sellerToken,
      'Configura E2E_SELLER_TOKEN en .env.test.local para ejecutar este flujo',
    );

    await page.goto(`/j/${sellerToken}`);
    await expect(page.getByText(/Jugadora:/)).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.getByText('Instala la app')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'VENDER' })).toBeVisible();

    if (receiptToken) {
      await page.goto(`/r/${receiptToken}`);
      await expect(page.getByText('Recibo de compra')).toBeVisible();
      await page.waitForTimeout(2500);
      await expect(page.getByText('Instala la app')).toHaveCount(0);
    }
  });
});

test.describe('Lotería · cobro solo donativo', () => {
  test('cobra el Club pendiente sin pedir papeletas', async ({ page }) => {
    test.skip(
      !process.env.E2E_RUN_ADMIN,
      'Configura E2E_RUN_ADMIN=1 para ejecutar el flujo de administración',
    );
    test.skip(
      !adminEmail || !adminPassword || !lotteryId || !sellerName,
      'Configura E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_LOTTERY_ID y E2E_SELLER_NAME',
    );
    test.slow();

    await loginAsAdmin(page);
    await page.goto(`/lotteries/${lotteryId}`);

    const sellerCard = page
      .locator('div.border.rounded-xl')
      .filter({
        has: page.getByRole('heading', { name: sellerName!, exact: true }),
      })
      .first();
    await expect(sellerCard).toBeVisible();
    await sellerCard.getByRole('button', { name: 'Cobrar' }).click();

    await expect(
      page.getByRole('heading', { name: /Cobro de/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Solo donativo' }).click();

    const submit = page.getByRole('button', { name: 'Guardar cobro' });
    await expect(submit).toBeEnabled();
    await expect(
      page.getByText(/Reparto del cobro: Lotería\s*0,00\s*€/),
    ).toBeVisible();

    await submit.click();
    await expect(page.getByText('Cobro registrado').first()).toBeVisible();
  });
});
