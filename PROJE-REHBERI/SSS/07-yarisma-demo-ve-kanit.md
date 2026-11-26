# SSS 07 · Yarışma, demo ve kanıt

**226. Proje Solana ile ilgili mi?**
Evet: tek bir Anchor programı, SPL Token, PDA emanet, Devnet deploy. Solana olmadan atomik bölüşüm, makbuz ve emanet olmaz.

**227. Devnet zorunlu muydu?**
Kurallar Devnet ya da mainnet adresini kabul ediyor. Devnet seçtik; gerçek para kullanmıyoruz.

**228. Devnet'te gerçekten çalıştı mı?**
Evet. Program yüklü, baytlar yerel derlemeyle aynı; tam 16 adım Devnet'te birden fazla kez çalıştı ve `npm run verify:devnet` ile zincirde doğrulandı. Son oturum `run-20261126160622-324f29`.

**229. Kaç Devnet oturumu var?**
`evidence/runs/` altında 5 Devnet kaydı: 4 tamamlandı, 1 hata (mint uyuşmazlığı; düzeltildi).

**230. İmzaları nerede görebilirim?**
`evidence/devnet-run-manifest.json`, `PROJECT-STATE.md`, bu klasördeki `tablolar/devnet-islemleri.csv`, canlı kopyanın Transactions sayfası.

**231. Atomik satın alma imzası?**
`5oEj3wfizEPwPiyxswq7zHBwCLzxHNr1QvqyNd3BxNZfSTSDHGbawnmvp7UKmoy4CAE7sFsyu9J1oFnRvHfnMRsW` (Devnet).

**232. Ödül kabul imzası?**
`2NGCd5nZTRkJk6BUXgcYVuCAtoxowe4d3f4fd2Ght5vS2azJZr1ojtUo9jPRLWPZMq1Lx13rsQvJDK8GcwfkXb61`.

**233. İade imzası?**
`nZYdksco2ZUivUFQsa5eg3ew7J8ZTUTdBPVWKwBhdKSL43VMHbtvRYQw2TgYnDzdtQKH3BAzgT6rLnwtutxKGQH`.

**234. Testler ne kadar kapsamlı?**
37 test: 2 Rust, 17 program (atomiklik, tekrar, yanlış hesap, takma, süre, emanet kötüye kullanımı, iade zamanı), 17 uygulama/API/MCP (sızıntı, yetki, ön kontrol, kurtarma, bütçe, yeniden satış, kopya, MCP), 1 tarayıcı (hata enjeksiyonu ve mobil dahil).

**235. Testleri nasıl çalıştırırım?**
Uygulama açıkken `npm test`. Sonuç `evidence/test-summary.json`.

**236. Video ne kadar?**
Yarışma videosu 3 dakikanın altında olmalı (kesin kural); plan 2:45, İngilizce (`DEMO-SCRIPT.md`). Bu klasördeki 7 dakikalık Türkçe video anlamak için, yarışma videosu değil.

**237. Videoda neler hızlandırıldı?**
Yalnızca kesinleşme beklemeleri; ekranda "finality waits shortened" yazacak. Hiçbir sonuç kesilmeyecek.

**238. Önceden yazılmış kod var mı?**
Kod yok; yalnızca planlama belgeleri vardı. Kural buna izin veriyor, README'de açıklandı.

**239. Hangi kısımlar yapay zekâ ile yapıldı?**
Kodun tamamı kurucunun yönlendirmesiyle Claude Code ile yazıldı; kararlar, kapsam ve dürüstlük kuralları kurucunun. Kurucu sistemi demo edip açıklayabilmeli (kural); bu rehber bunun için.

**240. Solana geliştirici araçlarından neler kullanıldı?**
Resmî Solana dev skill (revizyon c9da262) ve Solana docs MCP (`mcp.solana.com`), Anchor, Agave CLI.

**241. Neden yalnızca iki sağlayıcı?**
Atomik çok sahipli ödemeyi göstermek için en küçük anlamlı sayı. Program sağlayıcı sayısını sınırlamıyor; işlem boyutu sınırlıyor.

**242. Demo sırasında Devnet yavaşlarsa?**
Herkese açık RPC 429 verebilir; tempolu fetch ve yeniden deneme var. `SOLANA_RPC_URL` başka bir uca yönlendirilebilir. Yedek olarak yerel validator (videoda "Devnet" denmez).

**243. Jüri canlı demoyu nasıl doğrular?**
Canlı kopyada imzaları Explorer'da açar; repo'yu klonlayıp `npm run setup && npm start` ile tam uygulamayı çalıştırır; `npm test`.

**244. Neden deploy SOL'ü kurucu gönderdi?**
Devnet faucet'i oran sınırına takılıyordu (tüm airdrop'lar reddedildi). Kurucu 5 Devnet SOL gönderdi; değeri yok.

**245. Canlı kopya ne sıklıkla güncelleniyor?**
Otomatik değil; yeni bir Devnet oturumundan sonra `npm run export:public` ve `vercel deploy public --prod`.

**246. Repo kalitesi için neler yapıldı?**
README, PROJECT-STATE, SUBMISSION, DEMO-SCRIPT, kanıt klasörü, kural kaydı, araç zinciri kaydı, testler, tek komutlu kurulum, sabitlenmiş sürümler, anahtarsız geçmiş.

**247. Arayüzde neden İngilizce, tur Türkçe?**
Jüri uluslararası olabilir; arayüz İngilizce. Tur hem Türkçe hem İngilizce, tarayıcı diline göre açılır.

**248. Bu rehberdeki görseller nereden?**
Diyagramlar HTML ile tasarlanıp 3840×2160 çizildi (`kaynak/diyagram/`); ekran görüntüleri canlı kopyadan gerçek Devnet verisiyle alınıp çerçevelendi (`kaynak/ekran.ts`).

**249. Gerçek kullanıcı testi yaptınız mı?**
Hayır; kapsam bilinçli olarak geliştirmeye odaklandı (D19). Kullanıcı görüşmesi etkinlik sonrası.

**250. Hangi kanıt dosyası ne gösteriyor?**
`devnet-deploy.json` (deploy + bayt eşleşmesi), `devnet-run-manifest.json` (her imza, makbuz, değişim), `devnet-verify-output.txt` (zincir doğrulaması), `test-summary.json`, `ui-smoke.json`, `screenshots/`, `rules.md`, `h02-toolchain.md`.
