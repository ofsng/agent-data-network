// Records the Turkish explainer: the guided tour over a completed run, then a fresh run
// from the Control page (sped up later by build.py), then quote / verify / bounty checks.
// Each scene lasts as long as its narration clip; scene start times go to timeline.json.
// Usage: ADN_TTS_DIR=<dir with <id>.mp3 + durations.json> ADN_RUN='{"runId":..,"token":..}' npx tsx video/record.ts
import { chromium, Page } from "playwright-core";
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

const URL = process.env.ADN_URL ?? "http://127.0.0.1:8787/";
const DIR = process.env.ADN_TTS_DIR!;
const dur: Record<string, number> = JSON.parse(readFileSync(join(DIR, "durations.json"), "utf8"));
const CHROME = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: DIR, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (k: string) => (marks[k] = (Date.now() - t0) / 1000);
  page.on("dialog", (d) => d.accept());
  const say = async (id: string, extra = 900) => { mark(id); await sleep(dur[id] * 1000 + extra); };
  const js = (f: string) => page.evaluate(f);
  // The page CSP forbids eval, so string predicates are polled from Node instead of waitForFunction.
  const until = async (expr: string, ms: number) => { const end = Date.now() + ms; while (!(await js(expr))) { if (Date.now() > end) throw new Error(`timeout: ${expr}`); await sleep(500); } };

  await page.goto(URL);
  await page.evaluate((run) => { localStorage.setItem("adn-run", run); localStorage.setItem("adn-tour-lang", "tr"); }, process.env.ADN_RUN!);
  await page.goto(`${URL}?v=1#overview`);
  await page.waitForFunction(() => /Run run-/.test(document.querySelector("#badges")?.textContent ?? ""));
  await sleep(800);

  // Part 1: the tour, one narration clip per step (the last "that's it" card is skipped).
  await js("adnTour.open(0)");
  for (const [k, id] of ["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10", "t11"].entries()) {
    if (k > 0) await js("adnTour.next()");
    await sleep(400);
    await say(id);
  }
  await js("adnTour.close()");

  // Part 2: a fresh run from the Control page.
  await page.click('nav [data-view="control"]');
  await sleep(600);
  await say("c01", 0);
  mark("runStart");
  await page.click('#v-control [data-action="new"]');
  await until('app.run?.step === "READY" && !app.busy', 120_000);
  await page.click('#v-control [data-action="run"]');
  await until('app.run?.step === "COMPLETE" && !app.auto', 900_000);
  await sleep(1500);
  mark("runEnd");
  await say("c03");

  // Part 3: read-only tools on the Control page.
  mark("c04");
  const pick = (re: RegExp) => page.locator("#v-control [data-pick]", { hasText: re }).first().click();
  await sleep(2500); await pick(/X100 technical/);
  await sleep(1200); await pick(/X100 stock/);
  await sleep(2500); await page.click('#v-control [data-action="ctl-quote"]');
  await sleep(Math.max(1500, dur.c04 * 1000 - 7000));
  mark("c05");
  await sleep(2500); await page.locator("#v-control [data-fill]").first().click();
  await sleep(1800); await page.click('#v-control [data-action="ctl-verify"]');
  await sleep(Math.max(1500, dur.c05 * 1000 - 3600));
  mark("c06");
  await page.selectOption("#ctlBounty", { index: 1 });
  await sleep(1500); await page.click('#v-control [data-action="ctl-bounty"]');
  await sleep(Math.max(1500, dur.c06 * 1000 - 600));
  await page.click('nav [data-view="earnings"]');
  await sleep(500);
  await say("c07", 2000);
  mark("end");

  const video = page.video()!;
  await ctx.close();
  renameSync(await video.path(), join(DIR, "raw.webm"));
  writeFileSync(join(DIR, "timeline.json"), JSON.stringify(marks, null, 2));
  console.log(JSON.stringify(marks));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
