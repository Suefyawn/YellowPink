import { test, expect } from '@playwright/test';

// Golden-path checkout flow. In CI this runs against the demo-mode dev
// server (no Supabase env vars), which serves DEMO_PRODUCTS and drives the
// real cart/checkout UI — everything up to the place_order RPC works
// without a backend. Actually placing the order needs a real database, so
// the final submission test is gated behind E2E_FULL_CHECKOUT=1 for runs
// against a staging deployment (set PLAYWRIGHT_BASE_URL accordingly).

const DEMO_PDP = '/product/demo-cerave-moisturising-cream';

async function addDemoProductToCart(page: import('@playwright/test').Page) {
  await page.goto(DEMO_PDP);
  await expect(page.getByText('Moisturising Cream').first()).toBeVisible();
  // Two Add to Cart buttons exist (main + sticky mobile bar); click the
  // visible one.
  await page.locator('button:visible', { hasText: 'Add to Cart' }).first().click();
  // Wait for the cart to acknowledge the add (toast) before navigating away —
  // on slow CI runners an immediate goto can outrun the state update +
  // localStorage persistence and land on an empty cart (observed flake).
  await expect(page.getByText(/added to cart/i).first()).toBeVisible();
}

test('PDP → cart → checkout golden path', async ({ page }) => {
  await addDemoProductToCart(page);

  await page.goto('/cart');
  await expect(page.getByText('Moisturising Cream').first()).toBeVisible();
  // Demo product price — the line total and the summary must agree.
  await expect(page.getByText('PKR 4,500').first()).toBeVisible();

  await page.getByRole('button', { name: /proceed to checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // COD is the default payment method; the form accepts a valid PK address.
  await page.locator('#co-phone').fill('03001234567');
  await page.locator('#co-fname').fill('Test');
  await page.locator('#co-lname').fill('Customer');
  await page.locator('#co-address').fill('House 1, Street 2, Test Town');
  await page.locator('#co-city').fill('Lahore');

  const placeOrder = page.getByRole('button', { name: /place order/i });
  await expect(placeOrder).toBeVisible();
  await expect(placeOrder).toBeEnabled();
});

test('checkout blocks submission until required fields are valid', async ({ page }) => {
  await addDemoProductToCart(page);
  await page.goto('/checkout');

  await page.getByRole('button', { name: /place order/i }).click();
  // Inline field errors, not a navigation.
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.locator('#co-phone-error')).toBeVisible();
  await expect(page.locator('#co-address-error')).toBeVisible();

  // A non-Pakistani mobile number is rejected with a specific message.
  await page.locator('#co-phone').fill('12345');
  await page.getByRole('button', { name: /place order/i }).click();
  await expect(page.locator('#co-phone-error')).toContainText(/valid pakistani mobile/i);
});

test('full COD order reaches the thank-you page', async ({ page }) => {
  test.skip(!process.env.E2E_FULL_CHECKOUT, 'needs a real backend — set E2E_FULL_CHECKOUT=1 against staging');

  await addDemoProductToCart(page);
  await page.goto('/checkout');
  await page.locator('#co-phone').fill('03001234567');
  await page.locator('#co-fname').fill('E2E');
  await page.locator('#co-lname').fill('Test');
  await page.locator('#co-address').fill('House 1, Street 2, Test Town');
  await page.locator('#co-city').fill('Lahore');
  await page.getByRole('button', { name: /place order/i }).click();

  await page.waitForURL(/\/thank-you\?order=YP-/, { timeout: 20_000 });
  await expect(page.getByText(/YP-[A-Z0-9]+/).first()).toBeVisible();
});
