import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotsDir = join(root, "docs", "screenshots");

mkdirSync(screenshotsDir, { recursive: true });

const server = spawn(process.execPath, [join(root, "scripts", "dev-server.js")], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForServer(baseUrl);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(screenshotsDir, "home.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true });
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: join(screenshotsDir, "home-mobile.png"), fullPage: true });
  await browser.close();
  console.log(`Screenshots written to ${screenshotsDir}`);
} finally {
  server.kill();
}

async function waitForServer(url) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Server did not start at ${url}`);
}
