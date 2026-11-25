/// <reference lib="dom" />
// Browser smoke test (T49 happy path, T50 privacy, T51 failure/retry) against the
// running app, using system Chrome via playwright-core. Writes screenshots to
// evidence/screenshots/ and a JSON result to evidence/ui-smoke.json.
import { chromium, Page } from "playwright-core";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, loadConfig } from "../src/config";
import { snapshotDir } from "../src/data/trust";
import { openDb } from "../src/data/store";

const URL = process.env.ADN_APP_URL ?? "http://127.0.0.1:8787/";
const CHROME = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const SHOTS = join(ROOT, "evidence", "screenshots");
const SECRETS = ["Peak efficiency 97.4%", "Stock 18 units", "FICT-RECYCLE-2026"];
const VIEWS = ["overview", "agent", "market", "providers", "bounties", "tx", "earnings", "evidence"];

async function status(page: Page) {
  return (await page.textContent("#statusDot"))?.trim() ?? "";
}
async function waitIdle(page: Page, timeoutMs = 120_000) {
  const t0 = Date.now();
  await page.waitForTimeout(500);
  while (Date.now() - t0 < timeoutMs) {
    const s = await status(page);
    if (!/Running/.test(s)) return s;
    await page.waitForTimeout(700);
  }
  throw new Error("step did not finish in time");
}
async function next(page: Page) {
  await page.click("#btnNext");
  return waitIdle(page);
}
async function textOf(page: Page) {
  return page.evaluate(() => document.body.innerText);
}

(async () => {
  mkdirSync(SHOTS, { recursive: true });
  const result: Record<string, unknown> = { url: URL, startedAt: new Date().toISOString(), checks: {} as Record<string, unknown> };
  const checks = result.checks as Record<string, unknown>;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("dialog", (d) => d.accept());

  await page.goto(URL);
  await page.waitForSelector("#btnReset");
  await page.screenshot({ path: join(SHOTS, "00-welcome-desktop.png") });

  // New isolated run, then step-by-step through discovery.
  await page.click("#btnReset");
  await waitIdle(page, 120_000);
  await page.waitForFunction(() => /Run run-/.test(document.querySelector("#badges")?.textContent ?? ""), null, { timeout: 120_000 });
  for (let i = 0; i < 2; i++) await next(page); // PUBLISHED, SEARCHED
  const preText = await textOf(page);
  checks.noPaidContentBeforePurchase = SECRETS.every((s) => !preText.includes(s));

  // T51: make the quote preflight fail for real (remove A01's snapshot), expect a visible error and no charge.
  const cfg = loadConfig();
  const db = openDb(cfg.dbPath);
  const a01 = (db.prepare("SELECT asset_pda FROM assets WHERE title='Solar inverter X100 technical profile'").get() as { asset_pda: string }).asset_pda;
  const snap = join(snapshotDir(cfg.cluster), `${a01}.json`);
  renameSync(snap, `${snap}.bak`);
  let failState = "";
  try {
    failState = await next(page);
    await page.screenshot({ path: join(SHOTS, "05-failure-state-desktop.png") });
  } finally {
    renameSync(`${snap}.bak`, snap);
  }
  const failText = await textOf(page);
  checks.failureVisible = /Error/.test(failState) && /SNAPSHOT_UNAVAILABLE|snapshot/i.test(failText) && /Next step to retry/.test(failText);
  checks.noChargeOnFailure = /Spent \(finalized\)\s*0 TEST/.test(failText);
  await next(page); // retry QUOTED succeeds
  checks.retrySucceeded = /Exact quote \+ trust preflight[\s\S]*quote 0\.06 TEST/.test(await textOf(page));

  // Run to the end with the same controls a presenter uses.
  await page.click("#btnRun");
  await page.waitForFunction(() => /Complete/.test(document.querySelector("#statusDot")?.textContent ?? ""), null, { timeout: 600_000, polling: 1000 });
  const done = await textOf(page);
  checks.completed = /16\/16/.test(done);
  for (const [i, v] of VIEWS.entries()) {
    await page.click(`nav [data-view="${v}"]`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${String(i + 1).padStart(2, "0")}-${v}-desktop.png`), fullPage: true });
  }
  await page.click('nav [data-view="agent"]');
  checks.briefShowsPaidFactsAfterPurchase = (await textOf(page)).includes("Peak efficiency 97.4%");
  await page.click('nav [data-view="market"]');
  const market = await textOf(page);
  checks.marketplaceHasNoPaidContent = SECRETS.every((s) => !market.includes(s));
  await page.click('nav [data-view="bounties"]');
  const bounties = await textOf(page);
  checks.bountyViewHasNoAnswer = !bounties.includes("FICT-RECYCLE-2026");

  // Mobile layout: no horizontal page scroll, every view renders.
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(`mobile pageerror: ${e.message}`));
  await mp.goto(URL);
  const token = await page.evaluate(() => localStorage.getItem("adn-run"));
  await mp.evaluate((t) => localStorage.setItem("adn-run", t ?? ""), token);
  await mp.reload();
  await mp.waitForTimeout(1500);
  const overflow: Record<string, boolean> = {};
  for (const v of ["overview", "market", "tx", "earnings"]) {
    await mp.evaluate((id) => (document.querySelector(`nav [data-view="${id}"]`) as HTMLElement).click(), v);
    await mp.waitForTimeout(400);
    overflow[v] = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await mp.screenshot({ path: join(SHOTS, `m-${v}-mobile.png`) });
  }
  checks.mobileNoHorizontalScroll = Object.values(overflow).every((x) => !x);
  checks.mobileOverflow = overflow;
  checks.consoleErrors = errors;
  result.passed = Object.entries(checks).filter(([k]) => !["consoleErrors", "mobileOverflow"].includes(k)).every(([, v]) => v === true) && errors.length === 0;
  result.finishedAt = new Date().toISOString();
  writeFileSync(join(ROOT, "evidence", "ui-smoke.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.passed ? 0 : 1);
})().catch((e) => {
  console.error("UI smoke failed:", e.message);
  process.exit(1);
});
