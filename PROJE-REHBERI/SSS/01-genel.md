# SSS 01 · Genel sorular

**1. Agent Data Network nedir?**
Yapay zekâ ajanlarının küçük, lisanslı veri parçalarını satın aldığı; birden fazla satıcıya tek bir Solana işlemiyle ödediği; satın almayı zincir üstü makbuzla kanıtladığı ve eksik veriyi ödül emanetiyle sipariş ettiği bir altyapı.

**2. Tek cümlede ne yapıyorsunuz?**
"AI agents buy exactly the licensed data units they need, pay every provider in one Solana transaction, prove it with on-chain receipts, and fund missing data with escrowed bounties."

**3. Hangi problemi çözüyorsunuz?**
Ajanların veriyi kazıması, uydurması ya da tek bilgi için koca veri seti alması; neyin hangi lisansla alındığının kanıtlanamaması; veri hazırlayanların kullanım başına ödenmemesi; eksik verinin eksik kalması.

**4. Hedef kullanıcı kim?**
Araştırma ve tedarik iş akışları kuran ajan geliştiricileri (alıcı) ve küçük, güncel veri kayıtlarını satma hakkı olan üretici, distribütör, uzman gibi sağlayıcılar.

**5. Neden şimdi?**
Ajanlar araç kullanmaya başladı (MCP standart hâline geldi), ödeme standartları (x402 vb.) ve programlanabilir ödeme olgunlaştı. Ajanlar artık kendi başına küçük alımlar yapabilecek durumda. Gerçek alıcı hacmi ise henüz kanıtlanmadı.

**6. Proje hangi aşamada?**
Çalışan bir hackathon prototipi: program Devnet'te, tam ekonomik döngü gerçek işlemlerle çalışıyor ve zincirde doğrulandı, 37 test geçiyor. Müşteri ya da gelir yok.

**7. Kaç kişisiniz?**
Tek kişi: Ömer Faruk Şengül (GitHub `ofsng`). Geliştirmede Claude Code kullanıldı ve bu açıkça belirtildi.

**8. Yapay zekâ ile mi yazdınız?**
Evet, kurucunun yönlendirmesiyle Claude Code (Anthropic) kullanıldı. Yarışma yapay zekâ araçlarına izin veriyor; README'de açıklandı.

**9. Kod ne zaman yazıldı?**
Bütün kod 25 Kasım 2026'dan itibaren yazıldı. Planlama belgeleri (STARTUP-PACKAGE) daha önce hazırlandı ama kod içermiyordu. Git geçmişi zaman çizelgesini gösteriyor.

**10. Kod açık kaynak mı?**
Evet: https://github.com/ofsng/agent-data-network, MIT lisansı.

**11. Canlı görebilir miyim?**
https://agent-data-network.vercel.app adresinde son Devnet oturumunun salt okunur kopyası var. Tüm imzalar Explorer'da açılıyor. Tam uygulama yerelde çalışır: `npm run setup && npm start` ya da `npm run start:devnet`.

**12. Canlı kopya neden salt okunur?**
Tam uygulama sağlayıcı ve operatör anahtarlarını tutuyor; bunları herkese açık sunucuya koymak güvenli olmaz. Vitrin imza atmaz, anahtar içermez, ücretli içeriği gizler.

**13. Hangi ağda çalışıyor?**
Solana Devnet (canlı kanıt) ve yerel validator (geliştirme/test). Mainnet yok.

**14. Program adresi nedir?**
`3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8`.

**15. Gerçek para kullanılıyor mu?**
Hayır. Ödemeler aUSD ile: Devnet'te 6 ondalıklı bir test stablecoin'i, gerçek değeri yok.

**16. Veriler gerçek mi?**
Hayır, örnek veri. Voltara ürünleri, NorthLab ve SouthSupply kurgusal. Ama gerçekçi tasarlandı: invertör verimi, stok, teslim süresi, sertifika gibi.

**17. Neden sentetik veri?**
Hackathon kuralları buna izin veriyor; gerçek bir şirketin verisini izinsiz satmak hukuken sorunlu olur; amaç sistemin çalışabilirliğini göstermek.

**18. Ajan gerçek bir yapay zekâ mı?**
Uygulamanın kendi ajanı kurallara dayalı bir planlayıcı, LLM değil. Gerçek bir LLM (Claude) MCP ile bağlanıp aynı araçları kendi cüzdanıyla kullanabiliyor; bu da test edildi.

**19. Neden yerleşik ajanı LLM yapmadınız?**
Ana demoya API anahtarı ve öngörülemezlik eklememek için. Jüriye gösterilen 16 adım her seferinde aynı sonucu vermeli. LLM tarafı ayrıca MCP ile gösteriliyor.

**20. Projenin en güçlü yanı ne?**
Birleşim: birim başına alım + çok sağlayıcıya tek atomik işlem + zincir üstü lisans makbuzu + programın uyguladığı ödül emaneti + yeniden satış, hepsi gerçek işlemlerle ve testlerle.

**21. En zayıf yanı ne?**
Gerçek talep kanıtlanmadı; ödül incelemesi güvenilen bir zincir dışı doğrulayıcıya dayanıyor; %20 komisyon test edilmedi; makbuz kirası küçük alımlarda maliyet.

**22. "Marketplace" değil misiniz?**
Sonuçta bir pazar oluşuyor ama ürün bir **ödeme + lisans + kanıt rayı**. Ana mesaj: "AI ajanları için lisanslı veri satın alma ve ispat altyapısı."

**23. Hangi sektörle başlıyorsunuz?**
Ekipman tedarik verisi (güneş enerjisi invertörü, batarya, panel vb.): teknik özellik, stok, teslim süresi, sertifika.

**24. Neden bu sektör?**
Veri parçalı (üretici, distribütör, sertifika kurumu ayrı), değerli, sık değişiyor (stok, teslim süresi) ve tedarik ajanları için somut bir iş.

**25. Projenin adı neden "Agent Data Network"?**
Ajanların (agent) veri (data) aldığı ve sağlayıcıların ağ (network) olarak bağlandığı bir yapı.

**26. "Discover → Purchase → Verify → Commission → Reuse" ne demek?**
Keşfet (ücretsiz ara) → Satın al (atomik işlem) → Doğrula (makbuz ve hash) → Sipariş et (ödül) → Yeniden sat.

**27. Bu bir token projesi mi?**
Hayır. Kendi yatırım token'ımız yok. aUSD yalnızca test stablecoin'i; gerçekte USDC kullanılır.

**28. Ne kadar sürede yapıldı?**
Kod 25–26 Kasım arasında, yaklaşık iki günde, bir dizi Claude Code oturumunda yazıldı.

**29. Projeyi nasıl çalıştırırım?**
`npm run setup` (bir kez), `npm start`, sonra http://127.0.0.1:8787 → **Run agent task**. Önkoşullar: Solana CLI 4.1.2, Anchor 1.2.2, Rust 1.89, Node 22.

**30. Projenin dürüstlük ilkeleri neler?**
Sahte imza/makbuz yok, test edilmemiş özellik "tamam" denmez, sentetik veri gerçek gibi sunulmaz, yerel işlem Devnet gibi gösterilmez, mainnet ve gerçek para yok.

**31. Bu proje yarışma sonrası devam edecek mi?**
Yol haritası var (merkezi servis, npm MCP paketi, USDC, itiraz/teminat, denetim). Ticari başlangıç gerçek talep ve hukuki inceleme kanıtlanana kadar kapalı (NO-GO).

**32. Jüri neyi kendisi kontrol edebilir?**
Explorer'da program ve tüm imzalar; repo'daki testler (`npm test`); `npm run verify:devnet`; canlı kopyadaki makbuz doğrulama.
