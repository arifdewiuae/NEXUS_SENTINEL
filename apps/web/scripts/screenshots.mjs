/**
 * Capture dashboard screenshots for the README, deterministically, against a
 * running dev server (default :5051). Not part of CI — a one-off doc helper.
 *
 *   pnpm --filter @nexus/web exec node scripts/screenshots.mjs
 *
 * Override the target / output dir with BASE and OUT env vars.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:5051';
const OUT = process.env.OUT ?? new URL('../../../docs/img', import.meta.url).pathname;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 820 },
  deviceScaleFactor: 2,
});

const sample = (name) => page.getByRole('button', { name, exact: true });
const verify = () => page.getByRole('button', { name: /verify/i });

await page.goto(BASE, { waitUntil: 'networkidle' });
await sample('Clean').waitFor();

// 1) Hero — a hidden (zero-width) injection: de-obfuscated, blocked, escalated.
await sample('Hidden injection').click();
await verify().click();
await page.getByTestId('verdict-card').waitFor();
await page.getByTestId('screening-tier').waitFor();
await page.screenshot({ path: `${OUT}/dashboard-hidden-injection.png` });

// 2) A PII redact, to show the redacted-preview path.
await sample('PII').click();
await verify().click();
await page.getByTestId('verdict-card').waitFor();
await page.screenshot({ path: `${OUT}/dashboard-pii-redact.png` });

await browser.close();
console.log(`wrote screenshots to ${OUT}`);
