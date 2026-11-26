# SSS 03 · Teknik ve Solana

**71. Neden Solana?**
Düşük ücret (5 000 lamport/işlem), hızlı kesinleşme, tek işlemde çok talimatla atomiklik, PDA ile anahtarsız emanet, olgun SPL Token ve Anchor araçları. Küçük veri alımlarının ekonomisi düşük ücret gerektiriyor.

**72. Neden Anchor?**
Hesap doğrulamalarını (seeds, has_one, address, associated_token) bildirimsel ve güvenli yazmayı sağlar; IDL üretir; test araçları olgun.

**73. Kaç instruction var?**
8: `initialize_config`, `register_data_asset`, `set_asset_active`, `purchase_unit`, `create_bounty`, `submit_bounty_solution`, `accept_bounty_solution`, `refund_expired_bounty`.

**74. Program ne kadar büyük?**
Kaynak 768 satır Rust; derlenmiş `adn.so` 370 960 bayt.

**75. Program yükseltilebilir mi?**
Evet, upgrade authority demo deployer. Bu bir güven varsayımı olarak yazıldı; gerçekte multisig/zaman kilidi gerekir.

**76. Devnet'teki programın kaynak koddan derlendiğini nasıl bilebilirim?**
`npm run devnet` yüklenen baytların sha256'sını yereldeki `target/deploy/adn.so` ile karşılaştırıyor: `94bb22a4…bbe687`, eşleşiyor. Doğrulanabilir (verifiable) build yol haritası için uygun bir adım.

**77. Config'i kim kurabilir?**
Yalnızca programın upgrade authority'si; ProgramData hesabından kontrol ediliyor. Config PDA `init` olduğu için ikinci kez kurulamaz.

**78. Hangi token kullanılıyor?**
aUSD: orijinal (legacy) SPL Token programında 6 ondalıklı mint. Program 6 ondalık dışındaki mint'i reddediyor.

**79. Neden Token-2022 değil?**
Basitlik ve uyumluluk: legacy SPL Token, USDC'nin kullandığı program. Token-2022 desteği ayrı inceleme ister.

**80. Neden USDC değil?**
Devnet'te doğrulanmış bir USDC mint'i kullanmak yerine, değersiz olduğu açık bir test mint'i seçildi; asla dolar gibi sunulmuyor. Gerçek üründe USDC.

**81. Komisyon nasıl hesaplanıyor?**
`platform = floor(tutar × 2000 / 10000)`, `sağlayıcı = tutar − platform`. u128 ile, taşma kontrollü. Yuvarlama artığı sağlayıcıya kalır.

**82. Komisyon oranı değiştirilebilir mi?**
Hayır, `FEE_BPS = 2000` sabit ve config'e yazılıyor.

**83. Ödeme nasıl transfer ediliyor?**
`TransferChecked` CPI ile: alıcının ATA'sından sağlayıcının ve hazinenin ATA'larına; ondalık kontrolüyle.

**84. Makbuz nedir, teknik olarak?**
`PurchaseReceipt` hesabı, PDA tohumları `["receipt", buyer, order_id, asset]`. Alanlar: buyer, provider, asset, mint, order_id, version, content_hash, license_hash, amount, provider_amount, platform_amount, timestamp, kind, bump. 254 bayt.

**85. Makbuzun kirasını kim ödüyor?**
Alıcı (`payer = buyer`). Yerelde ölçülen makbuz kirası 2 658 720 lamport.

**86. Makbuz kapatılabiliyor mu?**
Hayır; kapatma talimatı yok, makbuzlar kalıcı. Bilinçli bir karar (D34); maliyeti ölçeklenmede ele alınacak (sıkıştırılmış makbuzlar).

**87. Tekrar oynatma nasıl engelleniyor?**
Makbuz `init` ile açılıyor; aynı (alıcı, order ID, varlık) için ikinci kez açılamaz, işlem başarısız olur, para hareket etmez (T14).

**88. Fiyat teklif ile işlem arasında değişirse?**
Alıcı beklenen fiyatı ve hash'leri imzalıyor; zincirdeki değer farklıysa `InvalidTerms` (T16). MCP de `PRICE_CHANGED` döner.

**89. Teklifin süresi neden var?**
Eski bir teklifin sonsuza kadar kullanılmasını engellemek için; `expires_at` geçtiyse `ExpiredQuote`.

**90. Alıcı kendine ödeme yapabilir mi?**
Hayır; alıcı, sağlayıcı ve hazine farklı olmalı (`AliasedAccounts`).

**91. Sahte token hesabı verilirse?**
Sağlayıcı, hazine ve alıcı hesapları kanonik ATA olmak zorunda; mint config'teki mint olmalı. Aksi hâlde red (T15).

**92. Bakiye ilk birime yetip ikinciye yetmezse?**
Tüm paket başarısız olur, makbuz yazılmaz (T17).

**93. Atomikliği nasıl test ettiniz?**
T13: ikinci talimatı geçersiz yapıp işlemi `skipPreflight` ile zincire düşürdük; işlem başarısız oldu ve hiçbir bakiye değişmedi.

**94. İşlem boyutu ve CU?**
İki birim: 784 bayt, ~54–64 bin CU. Tek birim (yeniden satış): 571 bayt, ~25 bin CU. Ücret 5 000 lamport.

**95. Neden versioned transaction / ALT kullanmadınız?**
İki birim 1232 bayt sınırının çok altında. Daha büyük paketler için v0 + ALT yol haritasında.

**96. Ödül kasası nasıl çalışıyor?**
Sahibi bounty PDA'sı olan bir ATA (`init_if_needed`, talep sahibi öder). Programdan çıkış bounty tohumları `["bounty", requester, bounty_id, bump]` ile imzalanır.

**97. Kasaya biri fazladan jeton gönderirse?**
Kabul ya da iadede yalnızca `reward` kadar çıkar; fazlası kasada kalır (süpürme yok, T31).

**98. Ödül süresi neden en fazla 7 gün?**
Paranın uzun süre kilitli kalmasını ve demo kapsamını sınırlamak için (`MAX_BOUNTY_DURATION_SECS = 604800`).

**99. Zaman nereden alınıyor?**
`Clock::get()?.unix_timestamp`, yani zincir saati. Bir hata sırasında demo yerel saatle hesaplıyordu; düzeltilip zincir saatine geçildi.

**100. Kabulde talep sahibi neyi imzalıyor?**
Beklenen gereksinim hash'i, içerik hash'i ve lisans hash'i. Biri farklıysa `HashMismatch`. Böylece incelenen aday ile ödenen aday aynı olur.

**101. Kabul edilmiş ödül iade edilebilir mi?**
Hayır; durum ACCEPTED ise iade `BountyNotOpen` ile reddedilir (T30).

**102. Süresi dolmuş ödül kabul edilebilir mi?**
Hayır; `DeadlinePassed` (T29).

**103. Gönderim (submission) para hareket ettiriyor mu?**
Hayır; yalnızca bir referans hesabı yazıyor.

**104. Ödül makbuzu ile satın alma makbuzu farkı?**
Aynı yapı; `kind = 1`, `order_id = bounty_id`, `amount = reward`, tohumlar `["bounty_receipt", bounty, asset]`.

**105. Zincir dışında neler var?**
Veri baytları, katalog metadata'sı, güven kaydı, snapshot'lar, teklif ve bütçe kayıtları, ajan hesapları, teslim günlüğü (SQLite).

**106. Neden veriyi zincire koymadınız?**
Zincir herkese açık; ücretli içerik bedavaya okunurdu. Ayrıca depolama pahalı. Zincirde yalnızca hash'ler.

**107. Neden IPFS/Arweave kullanmadınız?**
Ücretli içerik herkese açık depoya konamaz (şifreleme ve anahtar yönetimi gerekir). Hackathon kapsamında yerel SQLite + snapshot yeterli; dağıtık depolama yol haritasında düşünülebilir.

**108. Hash nasıl hesaplanıyor?**
SHA-256, kanonik baytlar üzerinde: UTF-8, NFC normalizasyonu, LF satır sonu. Böylece aynı metin hep aynı hash'i verir.

**109. Teslimde imza nasıl doğrulanıyor?**
ed25519 (tweetnacl): sunucu 60 sn geçerli tek kullanımlık nonce'lu mesaj üretir, alıcı cüzdanı imzalar, sunucu imzayı makbuzdaki alıcı adresiyle doğrular ve nonce'u tüketir.

**110. Makbuzu sunucu nasıl doğruluyor?**
Hesabın sahibinin program olduğu, PDA'nın tohumlardan doğru türetildiği, alıcı, mint, sürüm, hash'ler ve 80/20 tutarları, kesinleşmiş (finalized) durumda.

**111. "Finalized" neden önemli?**
"Confirmed" işlem teorik olarak geri alınabilir; teslim ve doğrulama yalnızca kesinleşmiş durumu kabul eder.

**112. PENDING kalmış bir teklif ne olur?**
Uzlaştırma önce makbuz hesaplarına bakar; makbuz varsa FINALIZED yapar, yeni sipariş açmaz (T21).

**113. Hangi RPC'yi kullanıyorsunuz?**
Herkese açık Devnet RPC; 429 için paylaşılan, tempolu, geri çekilmeli bir fetch katmanı. `SOLANA_RPC_URL` ile değiştirilebilir; mainnet URL'leri reddedilir.

**114. "Blockhash not found" hatasını nasıl çözdünüz?**
24 kaydı paralel gönderirken blockhash bayatlıyordu. Devnet'te eşzamanlılığı 4'e indirdik ve `sendWithRetry` ekledik (yeniden göndermeden önce işlemin zaten düşüp düşmediğine bakıyor).

**115. Deploy neden 40 dakika takıldı?**
`--use-rpc` ayarı yaklaşık 370 yükleme işleminin hepsini herkese açık RPC'den gönderdi ve 429 aldı. Buffer kapatılıp 1.885 SOL geri alındı; işlemler doğrudan validator'lere (TPU) gönderilerek tekrar yüklendi.

**116. Deploy kaç SOL tuttu?**
Kalıcı program kirası 1.885 SOL; deploy sırasında aynı büyüklükte geçici buffer (iade edildi). Her Devnet oturumu ~0.15 SOL.

**117. Yerel validator neden ayrı test portları kullanıyor?**
Program testleri ana validator'ün durumunu bozmasın diye izole bir validator'de çalışır; portlar çakışıyordu, ayrıldı.

**118. IDL nerede?**
`idl/adn.json`, `idl/adn.ts`, `idl/adn_errors.ts` (8 instruction, 19 hata).

**119. İstemci tarafı hangi kütüphaneleri kullanıyor?**
`@solana/web3.js` 1.99, `@solana/spl-token` 0.4.15, `@anchor-lang/core` 1.2.2.

**120. Neden @solana/kit değil?**
Anchor 1.2.2 istemcisi ve mevcut ekosistem web3.js 1.x ile uyumlu; hackathon süresinde en düşük riskli yol.

**121. Compute budget ayarlıyor musunuz?**
Gerekmedi; işlemler varsayılan sınırların içinde (~64 bin CU).

**122. Ön kontrol (preflight) ne kontrol ediyor?**
Varlığın kesinleşmiş ve aktif olduğu, saklanan baytların zincirdeki hash ile aynı olduğu, doğrulanmış snapshot olduğu, güven kaydının bulunduğu, kopya olmadığı. Bozuk bayt → 422, snapshot yok → 503.

**123. Kopya tespiti nasıl çalışıyor?**
Aynı içerik hash'ine sahip ilk kesinleşmiş listeleme "original" kabul ediliyor (sağlayıcı, varlık, slot). Başka sağlayıcının sonraki aynı hash'li listelemesi "copy" işaretleniyor, aramadan çıkarılıyor, teklif `DUPLICATE_CONTENT` ile reddediliyor (T56).

**124. Bu kontrol neden zincirde değil?**
Zincirde içerik hash'ine göre global bir indeks tutmak ek hesap ve maliyet ister; hackathon'da ABI'yi değiştirmeden zincir dışında yapıldı. Zincir verisi (slot, sağlayıcı) kanıt olarak kullanılıyor.

**125. Snapshot nerede tutuluyor?**
`~/.config/adn-demo/snapshots/<cluster>/`, 0600 izinli, repo dışında; hash'i doğrulanmış.

**126. Kaç tablo var?**
14: assets, quotes, receipts, challenges, bounties, submissions, delivery_log, asset_trust, agent_runs, spend_reservations, demo_runs, agent_grants, agent_requests, agent_activity.

**127. Neden Next.js değil?**
Tek Node sunucusu + vanilla JS: derleme adımı yok, daha az bağımlılık, hızlı geliştirme. Spesifikasyondan bilinçli sapma olarak belgelendi.

**128. Arayüz gerçekten zincire bağlı mı?**
Evet; her sayı oturum durumundan gelir, simülasyon modu yok. Her imza Explorer'a bağlı.

**129. `npm run verify` tam olarak ne yapıyor?**
Manifest'teki her imza için `getTransaction` çağırır, her makbuz hesabını zincirden okuyup çözer ve alanları karşılaştırır.

**130. Testler nerede çalışıyor?**
Rust birim testleri yerel; Anchor testleri izole bir yerel validator'de; uygulama testleri çalışan uygulamaya karşı; tarayıcı testi sistem Chrome'u ile playwright-core.
