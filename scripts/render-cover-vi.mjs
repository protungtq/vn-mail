// Renders the Vietnamese README banner to docs/vi/cover.png.
//
//   node scripts/render-cover-vi.mjs
//
// Needs a Chromium: set CHROME to its path, or have Playwright's browsers
// installed (`pnpm dlx playwright install chromium`). No dev server needed:
// cover-vi.html is a static page that embeds docs/vi/inbox.png.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const out = fileURLToPath(new URL("../docs/vi/", import.meta.url));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), ".cache", "ms-playwright");
  for (const dir of existsSync(cache) ? readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse() : []) {
    for (const sub of ["chrome-win64", "chrome-linux64", "chrome-linux"]) {
      const file = join(cache, dir, sub, sub === "chrome-win64" ? "chrome.exe" : "chrome");
      if (existsSync(file)) return file;
    }
  }
  throw new Error("No Chromium found. Set CHROME=/path/to/chrome.");
}

const browser = await chromium.launch({ executablePath: findChrome() });
mkdirSync(out, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(new URL("./cover-vi.html", import.meta.url).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "cover.png") });
await context.close();
await browser.close();
console.log("Cover written to", join(out, "cover.png"));
