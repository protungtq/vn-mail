// Vietnamese twin of screenshots.mjs: the same pictures, with the app in
// Tiếng Việt, written to docs/vi/ instead of docs/.
//
//   pnpm dev                         (in another terminal)
//   node scripts/screenshots-vi.mjs
//
// Needs a Chromium: set CHROME to its path, or have Playwright's browsers
// installed (`pnpm dlx playwright install chromium`). The sample mail comes
// from src/backend/sample.ts, so the pictures show no real messages.
//
// Why this is a separate file instead of a flag on screenshots.mjs: the
// sample backend keeps settings in an in-memory Map (src/backend/sample.ts),
// so a page reload resets the language to English. This script therefore
// switches to Vietnamese once per colour scheme (Settings → Appearance →
// "Tiếng Việt") and then never reloads: `open()` resets the view by
// clicking "All Inbox" inside the app instead of `page.goto()`.
//
// The README banner (docs/cover.png) is English-only copy, so this script
// does not render a cover.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, existsSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.env.VNMAIL_URL ?? "http://localhost:1420";
const out = fileURLToPath(new URL("../docs/vi/", import.meta.url));

// Vietnamese strings the script waits for / clicks (src/lib/i18n.ts).
// "All Inbox" is the same in both languages, so it needs no translation.
const LIST = "Danh sách thư"; // list.label
const MESSAGES = "Thư"; // list.messages
const PANE = "Khung đọc thư"; // reading.paneLabel
const SHOW = "Hiện"; // list.show
const SETTINGS = "Cài đặt"; // common.settings
const SECTIONS = "Các mục cài đặt"; // settings.sections
const FOLDERS = "Thư mục"; // folders.label
const MORE = "Thêm thao tác"; // reading.moreActions
const NEW_MESSAGE = "Thư mới"; // compose.newMessage
const SEARCH = "Tìm thư"; // search.placeholder
const ALL_INBOX = "All Inbox"; // folders.allInboxes
const NEW_MAIL = "Thư mới"; // common.newMail
const OTHER = "Khác"; // tabs.other
const DETAILS = "Chi tiết"; // warning.details
const MOVE_TO = "Chuyển tới"; // actions.moveTo
const PRIVACY = "Riêng tư"; // settings.page.privacy
const ABOUT = "Giới thiệu"; // settings.page.about
const SHOW_WELCOME = "Hiện lại các màn hình chào mừng"; // about.showWelcome
const WELCOME = "Chào mừng đến với VN Mail"; // onboarding.dialogLabel
const SUBJECT = "Chủ đề"; // compose.subject

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), ".cache", "ms-playwright");
  for (const dir of existsSync(cache) ? readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse() : []) {
    for (const sub of ["chrome-linux64", "chrome-linux"]) {
      const file = join(cache, dir, sub, "chrome");
      if (existsSync(file)) return file;
    }
  }
  throw new Error("No Chromium found. Set CHROME=/path/to/chrome.");
}

const browser = await chromium.launch({ executablePath: findChrome() });
mkdirSync(out, { recursive: true });

// The app starts in English (fresh browser context, no stored settings).
// Switch it to Vietnamese once, then leave the page loaded: a reload would
// reset the language, so later steps reset the view inside the app.
async function useVietnamese(page) {
  await page.locator('button[aria-label="Settings"]').click();
  await page.locator('nav[aria-label="Settings sections"] button', { hasText: "Appearance" }).click();
  await page.locator('div[role="radiogroup"][aria-label="Language"] button', { hasText: "Tiếng Việt" }).click();
  await page.waitForSelector(`[aria-label="${LIST}"] [role=option]`);
  await page.keyboard.press("Escape");
  await page.locator(`[role="dialog"][aria-label="${SETTINGS}"]`).waitFor({ state: "detached" });
}

async function shots(scheme) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 850 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await context.newPage();
  const name = (base) => join(out, scheme === "dark" ? `${base}-dark.png` : `${base}.png`);
  // Reset the view inside the app (no reload: a reload would reset the
  // language to English, see useVietnamese above).
  const open = async () => {
    await page.locator(`nav[aria-label="${FOLDERS}"] button`, { hasText: ALL_INBOX }).click();
    await page.waitForSelector(`[aria-label="${LIST}"] [role=option]`);
    await page.evaluate(() => document.fonts.ready);
  };
  const row = (text) => page.locator(`[aria-label="${LIST}"] [role=option]`, { hasText: text }).first();

  await page.goto(url);
  await page.waitForSelector('[aria-label="Message list"] [role=option]');
  await page.evaluate(() => document.fonts.ready);
  await useVietnamese(page);

  // The inbox with an ordinary message open.
  await open();
  await row("Mona Kane").click();
  await page.waitForSelector(`[aria-label="${PANE}"] h1`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: name("inbox") });

  // A suspicious message, with the reasons shown.
  await row("PayPal Security").click();
  await page.locator(`[aria-label="${PANE}"] [role=alert] button`, { hasText: DETAILS }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: name("warning") });

  // A mailing: trackers removed, unsubscribe offered.
  await page.locator(`[aria-label="${SHOW}"] button`, { hasText: OTHER }).click();
  await row("Spotify").click();
  await page.waitForSelector(`[aria-label="${PANE}"] iframe`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: name("mailing") });

  if (scheme === "light") await features(page, open, row);

  // The welcome screen.
  await page.locator(`button[aria-label="${SETTINGS}"]`).click();
  await page.locator(`nav[aria-label="${SECTIONS}"] button`, { hasText: ABOUT }).click();
  await page.locator("[role=dialog] button", { hasText: SHOW_WELCOME }).click();
  await page.waitForSelector(`[aria-label="${WELCOME}"]`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: name("welcome") });
  await context.close();
}

/** Smaller pictures, one per feature, for the README's feature list. */
async function features(page, open, row) {
  const dir = join(out, "features");
  mkdirSync(dir, { recursive: true });
  const pane = page.locator(`[aria-label="${PANE}"]`);
  // The top part of an area, without the empty space below it.
  const top = async (area, file, height) => {
    const box = await area.boundingBox();
    await page.screenshot({ path: join(dir, file), clip: { x: box.x, y: box.y, width: box.width, height } });
  };
  const left = { x: 0, y: 0, width: 600, height: 760 };

  // Several accounts, one inbox.
  await open();
  await page.locator(`nav[aria-label="${FOLDERS}"] button`, { hasText: ALL_INBOX }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, "accounts.png"), clip: left });

  // Search with operators and filters.
  await page.locator(`input[aria-label="${SEARCH}"]`).fill("invoice");
  await page.waitForTimeout(700);
  const list = await page.locator(`[aria-label="${MESSAGES}"]`).boundingBox();
  await page.screenshot({ path: join(dir, "search.png"), clip: { x: list.x, y: 0, width: list.width, height: 620 } });
  await page.locator(`input[aria-label="${SEARCH}"]`).fill("");

  // A suspicious message.
  await open();
  await row("PayPal Security").click();
  await pane.locator("[role=alert] button", { hasText: DETAILS }).click();
  await page.waitForTimeout(300);
  await top(pane, "phishing.png", 430);

  // Trackers removed and unsubscribe.
  await page.locator(`[aria-label="${SHOW}"] button`, { hasText: OTHER }).click();
  await row("Spotify").click();
  await page.waitForSelector(`[aria-label="${PANE}"] iframe`);
  await page.waitForTimeout(400);
  await top(pane, "trackers.png", 350);

  // The "more" menu: move, colours, block, view source.
  await open();
  await row("Mona Kane").click();
  await page.waitForTimeout(400);
  await page.locator(`[aria-label="${MORE}"]`).click();
  await page.locator("[role=menu] [role=menuitem]", { hasText: MOVE_TO }).click();
  await page.waitForTimeout(200);
  await top(pane, "organise.png", 560);
  await page.keyboard.press("Escape");

  // Writing a message.
  await open();
  await page.locator(`nav[aria-label="${FOLDERS}"] button`, { hasText: NEW_MAIL }).click();
  const composer = page.locator(`section[aria-label="${NEW_MESSAGE}"]`);
  await composer.locator('input[placeholder="name@company.com"]').fill("Mona Kane <mona.kane@example.com>");
  await composer.locator("label", { hasText: SUBJECT }).locator("input").fill("Agenda for Thursday");
  await composer.locator(".ProseMirror").click();
  await page.keyboard.type("Hi Mona,");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Here is the agenda for Thursday. I have added the budget review as the first point.");
  await page.waitForTimeout(1800);
  const box = await composer.boundingBox();
  await page.screenshot({ path: join(dir, "writing.png"), clip: { x: box.x, y: box.y, width: box.width, height: 330 } });

  // Privacy settings.
  await open();
  await page.locator(`button[aria-label="${SETTINGS}"]`).click();
  await page.locator(`nav[aria-label="${SECTIONS}"] button`, { hasText: PRIVACY }).click();
  await page.waitForTimeout(300);
  await page.locator(`[role=dialog][aria-label="${SETTINGS}"]`).screenshot({ path: join(dir, "privacy.png") });
  await page.keyboard.press("Escape");
  await open();
}

await shots("light");
await shots("dark");
await browser.close();
console.log(`Screenshots written to ${out}`);
