// Guided tour: plain-language walkthrough in Turkish or English. Each step switches to a
// view, dims everything else and spotlights one element. It never changes run state.
"use strict";
(function () {
  const STEPS = [
    { view: "overview", el: null,
      tr: ["Agent Data Network nedir?", "Yapay zekâ <b>ajanları</b>, ihtiyaç duydukları küçük <b>veri parçalarını</b> satın alır. Veriyi hazırlayan herkes <b>parasını anında</b> alır. Ödemeler <b>Solana</b> blokzincirinde yapılır. Bir dakikada gezelim."],
      en: ["What is Agent Data Network?", "AI <b>agents</b> buy the small <b>pieces of data</b> they need. Everyone who made the data <b>gets paid instantly</b>. Payments run on the <b>Solana</b> blockchain. Let's take a one-minute tour."] },
    { view: "overview", el: ["#badges"],
      tr: ["Ağ ve para birimi", "Uygulama <b>Solana</b> üzerinde çalışır. Ödemeler <b>aUSD</b> ile yapılır: Solana Devnet üzerinde bir test doları, gerçek parayla karşılığı yoktur. Her işlem zincire yazılır, buradaki adreslerden kontrol edilebilir."],
      en: ["Network and currency", "The app runs on <b>Solana</b>. Payments settle in <b>aUSD</b>, a test dollar on Solana Devnet with no real-money backing. Every transaction is written on chain and can be checked from the addresses here."] },
    { view: "market", el: [".units .unit", ".units"],
      tr: ["Pazar yeri: veri marketi", "Her kart <b>satılık bir veri parçası</b>. Başlığı ve fiyatı herkese açık. İçeriğini yalnızca <b>parasını ödeyen</b> görür."],
      en: ["The marketplace", "Each card is <b>one piece of data for sale</b>. Its title and price are public. Only the <b>buyer who pays</b> sees what is inside."] },
    { view: "providers", el: ["#v-providers .grid.g2", "#v-providers .card"],
      tr: ["Satıcılar", "Şu an iki satıcı var: üretici <b>NorthLab</b> ve distribütör <b>SouthSupply</b>. Veri listelenince fiyatı ve verinin <b>parmak izi</b> (hash) zincire yazılır. Sonradan gizlice değiştirilemez."],
      en: ["The sellers", "Two sellers today: the manufacturer <b>NorthLab</b> and the distributor <b>SouthSupply</b>. When they list data, its price and <b>fingerprint</b> (hash) are written on chain, so it cannot be changed secretly."] },
    { view: "agent", el: ["#v-agent .grid.g2", "#v-agent .welcome"],
      tr: ["Ajan: alışverişi yapan robot", "Ajan, senin yerine veri satın alan bir programdır. Görevi: <b>Voltara X100</b> invertörü için kısa bir satın alma raporu hazırlamak. <b>Harcama sınırı</b> vardır ve bu sınırı aşamaz."],
      en: ["The agent: a shopping robot", "An agent is a program that buys data for you. Its job: write a short procurement brief for the <b>Voltara X100</b> inverter. It has a <b>spending cap</b> it cannot exceed."] },
    { view: "overview", el: [".controls"],
      tr: ["Görevi başlatmak", "<b>Run agent task</b> ajanın görevini baştan sona çalıştırır. <b>Next step</b> ile adım adım izleyebilirsin. <b>New session</b> yeni cüzdanlarla yeni bir oturum açar."],
      en: ["Running a task", "<b>Run agent task</b> runs the agent's task end to end. <b>Next step</b> lets you follow it one step at a time. <b>New session</b> opens a fresh session with new wallets."] },
    { view: "tx", el: [() => [...document.querySelectorAll("#v-tx tbody tr")].find((r) => /Atomic two-provider/.test(r.textContent)), "#v-tx .card", "#v-tx .welcome"],
      tr: ["Tek işlemde iki satıcıya ödeme", "Ajan iki satıcıdan aynı anda alır ve <b>tek işlemle</b> öder: ya ikisi birden olur ya hiçbiri. Her alım için zincirde bir <b>makbuz</b> oluşur. Veri yalnızca makbuzu olana verilir."],
      en: ["One payment, two sellers", "The agent buys from both sellers in <b>one transaction</b>: both happen or neither does. Each purchase creates a <b>receipt</b> on chain, and data is only handed to receipt holders."] },
    { view: "bounties", el: ["#v-bounties .card"],
      tr: ["Aranan veri yoksa: ödül", "Ajan bulamadığı veri için <b>ödül koyar</b>. Para bir <b>kasada kilitlenir</b>. Satıcı cevabı getirir; ajan kabul edince para ödenir. Kimse getirmezse süre dolunca para <b>tamamen geri döner</b>."],
      en: ["Missing data? Post a bounty", "For data it cannot find, the agent <b>posts a reward</b>. The money is <b>locked in a vault</b>. A seller brings the answer and is paid when the agent accepts. If nobody answers, the money <b>comes back in full</b> after the deadline."] },
    { view: "earnings", el: ["#v-earnings .grid.g3", "#v-earnings .welcome"],
      tr: ["Kim ne kazandı", "Her ödemenin <b>%80'i satıcıya</b>, <b>%20'si platforma</b> aynı anda gider. Ödülle hazırlanan veri sonra başka bir ajana da satılır; satıcı aynı işten <b>tekrar kazanır</b>."],
      en: ["Who earned what", "Every payment sends <b>80% to the seller</b> and <b>20% to the platform</b> at once. Data made for a bounty is later sold to another agent, so the seller <b>earns again</b>."] },
    { view: "control", el: [".cx"],
      tr: ["Kontrol paneli", "Her şeyi <b>tek ekrandan</b> yönet: görevi çalıştır, cüzdan bakiyelerini izle, <b>fiyat teklifi</b> al, <b>makbuz doğrula</b>, ödül kasasına bak."],
      en: ["Control panel", "Run everything <b>from one screen</b>: drive the task, watch wallet balances, get a <b>price quote</b>, <b>verify a receipt</b> and check a bounty vault."] },
    { view: "evidence", el: ["#v-evidence .grid.g2"],
      tr: ["Kanıt", "Hiçbir şeye körü körüne inanman gerekmiyor: işlemler, makbuzlar ve test sonuçları burada. Hepsi <b>zincirden kontrol edilebilir</b>. Altta <b>açık riskler</b> listesi var: kopyalama, sahte veri ve bunlara karşı neler yapıldığı."],
      en: ["Proof", "You don't have to take anything on trust: transactions, receipts and test results are here, and all of it <b>can be checked on chain</b>. Below is a list of <b>open risks</b> (copying, fake data) and how each is handled."] },
    { view: "connect", el: ["#v-connect .grid.g2", "#v-connect .card"],
      tr: ["Kendi ajanını bağla", "Claude gibi kendi yapay zekâ ajanını <b>MCP</b> ile bağlayabilirsin. Ajan kendi cüzdanıyla ve senin koyduğun <b>harcama sınırıyla</b> alışveriş yapar. Cüzdanın anahtarı senin bilgisayarında kalır."],
      en: ["Connect your own agent", "Connect your own AI agent, such as Claude, over <b>MCP</b>. It shops with its own wallet under the <b>spending cap</b> you set. The wallet key stays on your machine."] },
    { view: "control", el: ["#btnTour"],
      tr: ["Hepsi bu", "Turu tekrar izlemek için bu düğmeye bas. Şimdi <b>Run agent task</b> ile ajanı çalıştırabilirsin."],
      en: ["That's it", "Press this button to replay the tour. Now try <b>Run agent task</b>."] },
  ];
  const find = (q) => (typeof q === "function" ? q() : document.querySelector(q));
  const UI = { tr: { next: "İleri", back: "Geri", done: "Bitir", skip: "Turu kapat" }, en: { next: "Next", back: "Back", done: "Done", skip: "Skip tour" } };
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  let lang = get("adn-tour-lang") || (/^tr/i.test(navigator.language || "") ? "tr" : "en");
  let i = 0; let nodes = null; let target = null;

  function open(start = 0) {
    if (!nodes) {
      nodes = { block: document.createElement("div"), hole: document.createElement("div"), card: document.createElement("div") };
      nodes.block.className = "tour-block"; nodes.hole.className = "tour-hole none"; nodes.card.className = "tour-card";
      nodes.card.setAttribute("role", "dialog"); nodes.card.setAttribute("aria-modal", "true"); nodes.card.setAttribute("aria-labelledby", "tourTitle");
      document.body.append(nodes.block, nodes.hole, nodes.card);
      nodes.card.addEventListener("click", onClick);
      nodes.card.style.transition = nodes.hole.style.transition = "none";
      show(start);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (nodes) nodes.card.style.transition = nodes.hole.style.transition = ""; }));
      return;
    }
    show(start);
  }
  function close() {
    if (!nodes) return;
    Object.values(nodes).forEach((n) => n.remove()); nodes = null; target = null;
    set("adn-tour-seen", "1");
  }
  function onClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.lang) { lang = b.dataset.lang; set("adn-tour-lang", lang); show(i); }
    if (b.dataset.t === "next") i === STEPS.length - 1 ? close() : show(i + 1);
    if (b.dataset.t === "back" && i > 0) show(i - 1);
    if (b.dataset.t === "skip") close();
  }
  function show(n) {
    i = n; const s = STEPS[i]; const [title, body] = s[lang]; const u = UI[lang];
    const nav = document.querySelector(`nav [data-view="${s.view}"]`);
    if (nav && app.view !== s.view) nav.click();
    nodes.card.innerHTML = `<div class="tour-top"><span class="tour-count">${String(i + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}</span>
      <span class="tour-lang"><button type="button" data-lang="tr" aria-pressed="${lang === "tr"}">TR</button><button type="button" data-lang="en" aria-pressed="${lang === "en"}">EN</button></span></div>
      <h3 id="tourTitle">${title}</h3><p>${body}</p>
      <div class="tour-bar">${STEPS.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <div class="tour-nav"><button type="button" class="skip" data-t="skip">${u.skip}</button><span style="display:flex;gap:8px">
      ${i > 0 ? `<button type="button" class="btn" data-t="back">${u.back}</button>` : ""}<button type="button" class="btn primary" data-t="next">${i === STEPS.length - 1 ? u.done : u.next}</button></span></div>`;
    target = (s.el ?? []).map(find).find((x) => x && x.getClientRects().length) ?? null;
    if (target) {
      const mobile = innerWidth < 900;
      const r = target.getBoundingClientRect();
      const top = r.top + scrollY - (mobile ? 70 : Math.max(90, (innerHeight - Math.min(r.height, innerHeight * 0.6)) / 2 - 60));
      scrollTo({ top: Math.max(0, top), behavior: "instant" });
    } else scrollTo({ top: 0, behavior: "instant" });
    place();
    nodes.card.querySelector('[data-t="next"]').focus({ preventScroll: true });
  }
  function place() {
    if (!nodes) return;
    const { hole, card } = nodes;
    const vw = innerWidth; const vh = innerHeight; const pad = 6;
    if (!target) {
      hole.className = "tour-hole none"; Object.assign(hole.style, { left: "", top: "", width: "", height: "" });
      card.style.left = `${Math.max(16, (vw - card.offsetWidth) / 2)}px`; card.style.top = `${Math.max(16, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    const r = target.getBoundingClientRect();
    const x = Math.max(8, r.left - pad); const y = Math.max(8, r.top - pad);
    const w = Math.min(vw - 8, r.right + pad) - x; const h = Math.min(vh - 8, r.bottom + pad) - y;
    hole.className = "tour-hole";
    Object.assign(hole.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
    if (vw < 900) return; // CSS docks the card at the bottom on small screens
    const cw = card.offsetWidth; const ch = card.offsetHeight; const gap = 14;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const cx = clamp(x + w / 2 - cw / 2, 16, vw - cw - 16); const cy = clamp(y, 16, vh - ch - 16);
    const spots = [
      [x + w + gap, cy], [x - cw - gap, cy], [cx, y + h + gap], [cx, y - ch - gap],
    ].filter(([l, t]) => l >= 16 && t >= 16 && l + cw <= vw - 16 && t + ch <= vh - 16);
    const [l, t] = spots[0] ?? [vw - cw - 24, vh - ch - 56];
    card.style.left = `${l}px`; card.style.top = `${t}px`;
  }
  addEventListener("resize", place);
  addEventListener("scroll", place, { passive: true });
  addEventListener("keydown", (e) => {
    if (!nodes) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") i === STEPS.length - 1 ? close() : show(i + 1);
    if (e.key === "ArrowLeft" && i > 0) show(i - 1);
  });
  document.getElementById("btnTour").addEventListener("click", () => open(0));
  // Re-measure after the app re-renders the view under the spotlight.
  new MutationObserver(() => { if (nodes && target && !target.isConnected) { const s = STEPS[i]; target = (s.el ?? []).map(find).find((x) => x && x.getClientRects().length) ?? null; place(); } })
    .observe(document.getElementById("main"), { childList: true, subtree: true });

  window.adnTour = { open, close, next: () => (i === STEPS.length - 1 ? close() : show(i + 1)), get step() { return i; }, get length() { return STEPS.length; }, setLang: (l) => { lang = l; if (nodes) show(i); } };
  // First visit: open once the app has rendered. Automated browsers (tests) skip it.
  const wantTour = /[?&]tour=1/.test(location.search) || (!get("adn-tour-seen") && !navigator.webdriver);
  if (wantTour) {
    const wait = setInterval(() => { if (document.querySelector("#nav button")) { clearInterval(wait); open(0); } }, 150);
  }
})();
