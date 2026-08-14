import { chromium } from '@playwright/test';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await b.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://localhost:3100/admin', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Enter admin password"]', 'localtest-9f2!X');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto('http://localhost:3100/admin/coupons', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const body = await page.textContent('body');
console.log('has Discount type:', body.includes('Discount type'));
console.log('has Buy X get Y option:', body.includes('Buy X get Y'));

// Switch discount type to BXGY and check sections appear
const sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Buy X get Y' }) }).first();
await sel.selectOption({ label: 'Buy X get Y' });
await page.waitForTimeout(800);
const body2 = await page.textContent('body');
console.log('has Customer buys:', body2.includes('Customer buys'));
console.log('has Customer gets:', body2.includes('Customer gets'));
console.log('has Maximum uses per order:', body2.includes('Maximum uses per order'));
console.log('has Free option:', body2.includes('Free'));
await page.screenshot({ path: 'pw-bxgy-form.png', fullPage: false });
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await b.close();
