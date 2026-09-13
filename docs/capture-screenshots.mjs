/**
 * Capture README UI screenshots from the local Vite desk.
 * Usage: node docs/capture-screenshots.mjs
 * Requires: Vite on http://127.0.0.1:3000 and Windows Chrome (WSL).
 */
import puppeteer from '/tmp/pp-install/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ||
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
const WIN_DIR = '/mnt/c/Users/Public/tally-shots';
const OUT_DIR = new URL('./screenshots/', import.meta.url).pathname;
const BASE = process.env.TALLY_URL || 'http://127.0.0.1:3000/';

mkdirSync(WIN_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const winPath = join(WIN_DIR, name);
  await page.screenshot({ path: winPath, fullPage: true });
  copyFileSync(winPath, join(OUT_DIR, name));
  console.log('wrote', name);
}

async function clickText(page, text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t);
    if (!el) throw new Error(`button not found: ${t}`);
    el.click();
  }, text);
}

async function fillByPlaceholder(page, placeholder, value) {
  await page.evaluate(
    ({ placeholder, value }) => {
      const input = document.querySelector(`input[placeholder="${placeholder}"]`);
      if (!input) throw new Error(`input not found: ${placeholder}`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { placeholder, value },
  );
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', `--window-size=1440,900`],
  defaultViewport: { width: 1440, height: 900 },
});

try {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60_000 });
  await sleep(800);

  // 01 — hero + connect / wallet chip
  await shot(page, '01-connect.png');

  // Switch to Local desk for circuit demo without Lace
  await clickText(page, 'Local desk');
  await sleep(400);

  await fillByPlaceholder(page, 'how much', '50');
  await fillByPlaceholder(page, '30', '30');
  await shot(page, '02-offer.png');

  await clickText(page, 'Offer');
  await sleep(600);

  // Instrument shows status; amount is off-ledger
  await shot(page, '03-instrument.png');

  await clickText(page, 'Borrower');
  await sleep(300);
  await clickText(page, 'Accept');
  await sleep(500);

  await clickText(page, 'Lender');
  await sleep(300);
  await clickText(page, 'Disburse');
  await sleep(500);

  await clickText(page, 'Borrower');
  await sleep(300);
  await clickText(page, 'Repay');
  await sleep(500);

  await clickText(page, 'Settle');
  await sleep(600);

  await clickText(page, 'Prove standing');
  await sleep(800);

  await clickText(page, 'Verifier');
  await sleep(400);
  await clickText(page, 'Verify access');
  await sleep(600);

  await shot(page, '04-standing.png');
} finally {
  await browser.close();
}
