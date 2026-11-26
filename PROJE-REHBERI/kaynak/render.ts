// Renders every kaynak/diyagram/*.html to gorseller/diyagram/*.png at 3840x2160 (2x).
// Usage (repo root): npx tsx PROJE-REHBERI/kaynak/render.ts [name-filter]
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "kaynak/diyagram");
const OUT = join(ROOT, "gorseller/diyagram");
const CHROME = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

(async () => {
  const filter = process.argv[2] ?? "";
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  for (const f of readdirSync(SRC).filter((f) => f.endsWith(".html") && f.includes(filter)).sort()) {
    await page.goto("file://" + join(SRC, f));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll<HTMLElement>(".page *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > 1921 || r.bottom > 1081)) bad.push(`${el.tagName}.${el.className}`.slice(0, 60));
      });
      return bad.slice(0, 5);
    });
    await page.screenshot({ path: join(OUT, f.replace(/\.html$/, ".png")) });
    console.log(f, overflow.length ? "OVERFLOW " + overflow.join(", ") : "ok");
  }
  await browser.close();
})();
