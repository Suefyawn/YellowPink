import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
await page.goto('https://www.yellowpink.pk/product/simzee-zinc-syrup', { waitUntil: 'load', timeout: 50000 });
await page.waitForTimeout(2500);
const main = (await page.locator('main').first().innerText().catch(()=>'')).replace(/\s+/g,' ');
console.log('LIVE main snippet:', main.slice(0, 130));
