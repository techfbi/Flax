
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = 4300;
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('dist');
const outputFile = path.join(outputDir, 'landingpage.html');

const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { stdio: 'inherit' },
);

let browser;

try {
  let ready = false;

  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) {
      throw new Error('Vite preview server exited unexpectedly.');
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // The preview server may still be starting.
    }

    await sleep(500);
  }

  if (!ready) {
    throw new Error('Vite preview server did not become ready.');
  }

  browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(60000);

  await page.goto(`${baseUrl}/landingpage`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // Wait for React to render the landing page.
  await page.waitForFunction(
    () => {
      const root = document.querySelector('#root');
      return root?.children.length > 0;
    },
    { timeout: 30000 },
  );

  // Ensure the page has meaningful content before saving it.
  const content = await page.$eval(
    '#root',
    (root) => root.innerText.trim(),
  );

  if (!content) {
    throw new Error(
      'Landing page rendered no text. Refusing to save an empty snapshot.',
    );
  }

  const html = await page.content();

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, html, 'utf8');

  console.log(`Prerendered landing page: ${outputFile}`);
} finally {
  if (browser) await browser.close();

  if (server.exitCode === null) {
    server.kill();
  }
}
