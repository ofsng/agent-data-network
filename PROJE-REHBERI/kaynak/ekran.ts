// Captures the live read-only Devnet copy (real session data) at 2x, then places each
// capture in a designed browser frame (kaynak/cerceve.html) and renders 3840x2160 PNGs.
// Usage (repo root): npx tsx PROJE-REHBERI/kaynak/ekran.ts
import { chromium } from "playwright-core";
import { existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(__dirname, "..");
const RAW = join(ROOT, "kaynak/ekran-ham");
const OUT = join(ROOT, "gorseller/ekran");
const SITE = process.env.ADN_SITE ?? "https://agent-data-network.vercel.app";
const CHROME = process.env.CHROME_PATH ?? ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

const SHOTS: [string, string, string, string][] = [
  ["01-overview", "overview", "Overview", "Ajanın görevi, bütçesi, canlı bakiyeler ve makbuzlar tek ekranda"],
  ["02-control", "control", "Control", "Borsa tarzı kontrol paneli: çalıştır, teklif al, makbuz doğrula"],
  ["03-agent", "agent", "Agent workspace", "Yerleşik ajanın tipli araç izi ve bütçe tüketimi"],
  ["04-market", "market", "Data marketplace", "24 veri birimi: başlık, fiyat, köken ve güven etiketleri; içerik gizli"],
  ["05-providers", "providers", "Provider workspace", "NorthLab ve SouthSupply'ın yayınladığı birimler"],
  ["06-bounties", "bounties", "Data bounties", "Kasadaki ödül, adaylar ve yalnızca geçti/kaldı incelemesi"],
  ["07-tx", "tx", "Transactions & receipts", "Her işlem Solana Explorer'a bağlı; makbuzlar zincirden çözülmüş"],
  ["08-earnings", "earnings", "Provider earnings", "Ölçülmüş bakiye değişimlerinden 80/20 kazançlar"],
  ["09-evidence", "evidence", "Verification & evidence", "Program, mint, doğrulamalar ve açık riskler tablosu"],
  ["10-connect", "connect", "Your agent", "Kendi ajanını bağlamak için tek mesaj ve onay paneli"],
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "tr-TR" });
  await ctx.addInitScript(() => { try { localStorage.setItem("adn-tour-seen", "1"); localStorage.setItem("adn-tour-lang", "tr"); } catch {} });
  const page = await ctx.newPage();
  for (const [file, view] of SHOTS) {
    await page.goto(`${SITE}/#${view}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(RAW, file + ".png") });
    console.log("raw", file);
  }
  // Tour spotlight (first visit experience)
  const t = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "tr-TR" });
  await t.addInitScript(() => { try { localStorage.setItem("adn-tour-lang", "tr"); } catch {} });
  const tp = await t.newPage();
  await tp.goto(`${SITE}/#overview`, { waitUntil: "networkidle" });
  await tp.waitForTimeout(2000);
  if (!(await tp.locator(".tour-card").count())) await tp.click("#btnTour");
  await tp.waitForTimeout(800);
  for (let i = 0; i < 5; i++) { await tp.keyboard.press("ArrowRight"); await tp.waitForTimeout(700); }
  await tp.screenshot({ path: join(RAW, "11-tour.png") });
  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: "dark", isMobile: true });
  await m.addInitScript(() => { try { localStorage.setItem("adn-tour-seen", "1"); } catch {} });
  const mp = await m.newPage();
  for (const v of ["overview", "market", "earnings"]) {
    await mp.goto(`${SITE}/#${v}`, { waitUntil: "networkidle" });
    await mp.waitForTimeout(1500);
    await mp.screenshot({ path: join(RAW, `m-${v}.png`) });
  }

  // Frames
  const f = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const frame = (q: Record<string, string>) => "file://" + join(ROOT, "kaynak/cerceve.html") + "?" + new URLSearchParams(q);
  for (const [file, , title, cap] of [...SHOTS, ["11-tour", "", "Rehberli tur", "İlk açılışta Türkçe tur: anlatılan kısım aydınlanır, gerisi kararır"] as const]) {
    await f.goto(frame({ img: `ekran-ham/${file}.png`, title, cap, n: file.slice(0, 2) }));
    await f.evaluate(() => document.fonts.ready);
    await f.waitForTimeout(300);
    await f.screenshot({ path: join(OUT, file + ".png") });
    console.log("framed", file);
  }
  await f.goto(frame({ mobile: "1", title: "Telefonda", cap: "Aynı arayüz 390 px genişlikte taşmadan çalışır", n: "12" }));
  await f.evaluate(() => document.fonts.ready);
  await f.waitForTimeout(300);
  await f.screenshot({ path: join(OUT, "12-mobil.png") });
  await browser.close();
})();
