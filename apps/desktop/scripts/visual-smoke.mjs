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

// Exercise the actual React player, not just CSS rules or a mocked button.
// Force Android WebView's "native fullscreen unsupported" behavior to verify
// the reliable viewport fallback, then restore the normal stage.
async function checkPlayerFullscreen(page, device) {
  await page.evaluate(async () => {
    const { mountFullscreenHarness } = await import('/scripts/fullscreen-harness.tsx');
    mountFullscreenHarness();
  });
  const tile = page.locator('#aurora-fullscreen-smoke-host .stream-tile');
  await tile.waitFor();
  await tile.evaluate(element => {
    Object.defineProperty(element, 'requestFullscreen', {
      configurable: true,
      value: async () => { throw new Error('WebView não suporta fullscreen nativo'); },
    });
  });
  await tile.getByRole('button', { name: 'Exibir em tela cheia: Transmissão de teste' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#aurora-fullscreen-smoke-host .stream-tile')?.getAttribute('data-fullscreen') === 'true');
  const bounds = await tile.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && viewport &&
    bounds.width >= viewport.width - 2 && bounds.height >= viewport.height - 2,
    'Fullscreen viewport insuficiente em ' + device + ': ' + JSON.stringify({ bounds, viewport }));
  await tile.getByRole('button', { name: 'Sair da tela cheia de Transmissão de teste' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#aurora-fullscreen-smoke-host .stream-tile')?.getAttribute('data-fullscreen') === 'false');
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
  await checkPlayerFullscreen(page, 'desktop 1440 × 900');
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
  await page.waitForFunction(() => {
    const side = document.querySelector('.channel-sidebar');
    return !!side && side.getBoundingClientRect().right <= 2;
  });
  await page.screenshot({ path: resolve(screenshots, 'aurora-narrow-lobby.png'), fullPage: true });

  // Android viewport emulation: actual native APK still requires physical-device QA.
  // The app reuses the React frontend, but mobile tabs and safe areas are verified here.
  const android = await browser.newPage({
    viewport: { width: 393, height: 873 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 16; POCO X6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
  });
  await android.goto('http://127.0.0.1:1420', { waitUntil: 'networkidle' });
  await android.getByRole('navigation', { name: 'Navegação Android' }).waitFor();
  await android.getByRole('button', { name: 'Criar sala agora' }).waitFor();
  await checkPlayerFullscreen(android, 'Android retrato 393 × 873');
  await checkNoOverflow(android, 'Android portrait 393');
  await android.screenshot({ path: resolve(screenshots, 'aurora-android-portrait.png'), fullPage: true });

  // A conexão na navegação inferior deve abrir o velocímetro, não alternar
  // um painel invisível. Capture e cheque layout real na largura do POCO.
  await android.getByRole('button', { name: 'Conexão', exact: true }).click();
  await android.waitForFunction(() => {
    const nav = [...document.querySelectorAll('.mobile-bottom-nav button')];
    return nav.some(button => button.textContent?.includes('Conexão') && button.classList.contains('selected'));
  });
  assert.equal(await android.locator('.speedometer-svg').count(), 1);
  assert.equal(await android.locator('.speed-consent').count(), 0);
  await checkNoOverflow(android, 'Android speedometer portrait 393');
  await android.screenshot({ path: resolve(screenshots, 'aurora-android-speedtest.png'), fullPage: false });


  await android.setViewportSize({ width: 873, height: 393 });
  const tileLandscape = android.locator('#aurora-fullscreen-smoke-host .stream-tile');
  await tileLandscape.getByRole('button', { name: 'Exibir em tela cheia: Transmissão de teste' }).click();
  await android.waitForFunction(() =>
    document.querySelector('#aurora-fullscreen-smoke-host .stream-tile')?.getAttribute('data-fullscreen') === 'true');
  const landscapeBounds = await tileLandscape.boundingBox();
  assert.ok(landscapeBounds && landscapeBounds.width >= 871 && landscapeBounds.height >= 391,
    'Fullscreen Android paisagem não preenche a tela: ' + JSON.stringify(landscapeBounds));
  // Android's Back button is routed through the app's existing popstate handler.
  await android.evaluate(() => window.history.back());
  await android.waitForFunction(() =>
    document.querySelector('#aurora-fullscreen-smoke-host .stream-tile')?.getAttribute('data-fullscreen') === 'false');
  await checkNoOverflow(android, 'Android landscape 873');
  await android.screenshot({ path: resolve(screenshots, 'aurora-android-landscape.png'), fullPage: true });
  await android.close();

  console.log('AURORA UI visual smoke OK — desktop + Android retrato/paisagem.');

} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
