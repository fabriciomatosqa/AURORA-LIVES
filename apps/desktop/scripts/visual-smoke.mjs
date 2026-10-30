// Visual smoke suite for the real Vite/React interface.
// Screenshots are stored only as GitHub Actions artifacts for QA.
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screenshots = resolve(desktop, 'artifacts', 'ui');
mkdirSync(screenshots, { recursive: true });
const browserBinary = process.env.CHROME_BIN ||
  execFileSync('sh', ['-c', 'command -v google-chrome || command -v chromium || command -v chromium-browser'], { encoding: 'utf8' }).trim();
if (!browserBinary) throw new Error('Chromium/Chrome não encontrado.');
const server = spawn('npm', ['run', 'dev'], { cwd: desktop, stdio: 'inherit', env: process.env });
let browser = null;

async function waitForVite() {
  for (let i = 0; i < 90; i++) {
    try {
      const response = await fetch('http://127.0.0.1:1420');
      if (response.ok) return;
    } catch { /* server booting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Vite não ficou disponível.');
}

async function checkNoOverflow(page, view) {
  const measurements = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(measurements.scroll <= measurements.inner + 1,
    'Overflow horizontal no viewport ' + view + ': ' + JSON.stringify(measurements));
}

try {
  await waitForVite();
  browser = await chromium.launch({
    executablePath: browserBinary,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Criar sala agora' }).waitFor();
  await page.getByRole('button', { name: 'Entrar na sala' }).waitFor();
  await checkNoOverflow(page, '1440');
  await page.screenshot({ path: resolve(screenshots, 'aurora-desktop-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Abrir configurações' }).click();
  await page.getByRole('button', { name: 'Claro', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('button', { name: 'Fechar configurações' }).click();
  await page.screenshot({ path: resolve(screenshots, 'aurora-desktop-light.png'), fullPage: true });
  await checkNoOverflow(page, '1440 light');

  await page.setViewportSize({ width: 1024, height: 768 });
  await checkNoOverflow(page, '1024');
  await page.screenshot({ path: resolve(screenshots, 'aurora-compact.png'), fullPage: true });

  await page.setViewportSize({ width: 680, height: 800 });
  await checkNoOverflow(page, '680');
  await page.getByRole('button', { name: 'Mostrar canais' }).click();
  assert.ok((await page.locator('.channel-sidebar').getAttribute('class')).includes('sidebar-visible'));
  await page.screenshot({ path: resolve(screenshots, 'aurora-narrow-navigation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Fechar painel de canais' }).click();
  await page.screenshot({ path: resolve(screenshots, 'aurora-narrow-lobby.png'), fullPage: true });

  console.log('AURORA UI visual smoke OK — 1440, 1024, 680; temas; painel lateral.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
