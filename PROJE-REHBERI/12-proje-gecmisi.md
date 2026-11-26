# 12 · Proje geçmişi ve kararlar

## Zaman çizelgesi (2026)

| Tarih (UTC) | Olay |
|---|---|
| 25 Kasım öncesi | Planlama paketi (V1.3, sonra V1.4 ve V1.5): iş planı, PRD, program özellikleri, mimari, testler. Kod yok. |
| 25 Kas, 18:08 | V1.3 uygulaması başladı (Claude Code). H01 kurallar, H02 araçlar (Solana CLI 4.1.2, Anchor 1.2.2, Rust 1.89, Node 22; resmî Solana skill ve docs MCP kuruldu). x402 45 dakikada denendi, uyumsuz bulundu. |
| 25 Kas | `acd8401` H01–H03, H05, H06, H09, H10: kural kanıtı, araçlar, Anchor programı, yerel testler. `ba91248` veri deposu, API, ajan CLI, bounty akışı, dashboard, yerel uçtan uca. Devnet faucet'i sınırladığı için Devnet bekledi. |
| 25 Kas, 19:29 | V1.5 "Single-Session Demo" paketi: güven katmanı, snapshot, kalıcı bütçe, tipli ajan araçları, sınırlı inceleme, yeniden satış, rehberli demo, ürün arayüzü (8 bölüm). `758e298`, `d6fb14a`. |
| 25 Kas, 21:39 | "Final release" talimatı. Kurucu deployer'a 5 Devnet SOL gönderdi. İlk deploy `--use-rpc` yüzünden takıldı, buffer kapatıldı, TPU ile tekrar yüklendi. Tam döngü Devnet'te çalıştı ve doğrulandı (`run-20261125222532-6b1667`). Salt okunur MCP eklendi. `0b0e0e6`. |
| 26 Kas, 14:07 | GitHub'da private repo, sonra kurucu herkese açık yaptı. `cfcbd77`. Ledger tam geçmişe geri alındı `46988da`. |
| 26 Kas, 14:32 | Kurucu "hiçbir şey anlamadım" dedi: Türkçe/İngilizce rehberli tur, Kontrol sayfası, Türkçe anlatımlı açıklama videosu (eski arayüzle). |
| 26 Kas (paralel oturum) | "Gerçek ürün gibi sun" değişikliği: TEST → **aUSD**, gerçekçi 24 birimlik katalog (Voltara ürünleri, NorthLab, SouthSupply), demo etiketleri kaldırıldı, MCP üzerinden kendi cüzdanıyla satın alan ajan, "Connect your agent" sayfası, Devnet'te yeni oturum. |
| 26 Kas, 15:20–15:30 | Jüri soruları tartışıldı (tavuk-yumurta, kopyalama, sahte veri, doğrulama katmanı). Kopya koruması (T56), "Accuracy: provider-declared", açık riskler tablosu, Vercel'de canlı salt okunur kopya. `3718807`, `b9c0d0e`. |
| 26 Kas, 15:57 | "Ajana bırak" talimatı: ajan kendini kurar, insan yalnızca onaylar. `get_started`, harcama hakları, onay penceresi / web onayı, Your agent sayfası. Canlı site yeni Devnet oturumuyla güncellendi (`run-20261126160622-324f29`). `0957baf`. |
| 26 Kas, akşam | Bu rehber klasörü (`PROJE-REHBERI/`). |

## Commit geçmişi

| Commit | Açıklama |
|---|---|
| `acd8401` | H01-H03, H05, H06, H09, H10: kural kanıtı, araç zinciri, Anchor programı ve yerel testler |
| `16030fd` | Yerel ledger dosyalarını yok say |
| `ba91248` | H04, H07, H08, H11, H12: veri deposu, API, ajan CLI, bounty akışı, dashboard, yerel E2E |
| `f51bad4` | README, Devnet betiği, PROJECT-STATE |
| `792a530` | V1.5 belge paketi; bounty fixture v2 |
| `758e298` | V1.5: güven katmanı, snapshot, kalıcı bütçe, tipli araçlar, sınırlı inceleme, yeniden satış, rehberli orkestratör, ürün arayüzü |
| `d6fb14a` | V1.5: tek komutla setup/start/demo/test, izole program testleri, arayüz cilası, tarayıcı testi |
| `f986516`, `4918631` | Tam yerel ledger geçmişi, `npm run verify` |
| `0b0e0e6` | Final release: Devnet deploy ve doğrulanmış oturum, salt okunur MCP |
| `cfcbd77` | SUBMISSION: gerçek repo adresi |
| `46988da` | Tam yerel ledger geçmişi geri; `ADN_LEDGER_SHREDS` |
| `3718807` | Rehberli tur, Control konsolu, kopya koruması, açık riskler, herkese açık salt okunur kopya |
| `b9c0d0e` | Belgeler: Vercel'deki canlı Devnet kopyası |
| `0957baf` | Ajan öncelikli kurulum: ajan kendini kurar, insandan yalnızca onay ister |

## Önemli kararlar (STRATEGIC-DECISIONS özetinden)

| No | Karar |
|---|---|
| D01 | Paylaşılan veri havuzu; atom düzeyinde ücretli erişim; katkıda bulunana ödeme |
| D19 | Önce geliştirme; fiziksel müşteri görüşmesi yok |
| D20 | Sentetik veri serbest |
| D29 | Anchor, zincir üstü varlık/makbuz, atomik çoklu sağlayıcı ödeme, fonlu ödül |
| D30 | x402 yerine doğrudan alıcı imzalı Anchor işlemi (x402 denendi, uyumsuz) |
| D31 | Tek işlemde iki ayrı `purchase_unit`; dinamik hesap dizisi yok |
| D32 | Orijinal SPL Token programı, sabit 6 ondalık, USDC taklidi yok, 2000 bps |
| D33 | Sağlayıcı payı = tutar − floor(tutar×2000/10000); alıcı SOL ücretini ve makbuz kirasını öder |
| D34 | Makbuz ödenmiş hakkı kanıtlar; sahiplik, kullanım, doğruluk, teslim değil. Kapatma yok |
| D35 | Ödülde ödeme alıcının imzalı onayıyla; süre sonunda iade; hakemlik yok |
| D37 | Ödül adayı pasif kaydedilir; kabulden sonra satışa açılabilir |
| D38 | İmza uç noktası herkese açık değil; ham ücretli içerik açığa çıkmaz |
| D42 | Zincir dışı güven katmanı: kaynak beyanı, zaman, lisans, şema, SHA-256; bütünlük, şema ve doğruluk ayrı |
| D43 | Teklif öncesi bayt kontrolü, kalıcı yedek ve kurtarma, ücretsiz tekrar; "fair exchange" iddiası yok |
| D44 | Ödül incelemesi yalnızca geçti/kaldı; cevap gizli |
| D46 | 8 instruction, PDA tohumları, mint, config korunur; program yalnızca gerçek hata için yükseltilir |
| D48 | Ticari başlangıç NO-GO: kira ekonomisi, teslim kurtarma, üretici koruması, haklar, gerçek talep kanıtlanana kadar |
| D53 | Ödül sonrası yeniden satış, ABI değişmeden |

## Kurucunun belirlediği dürüstlük kuralları

- Sahte işlem imzası, sahte makbuz ya da zincir doğrulaması gösterme.
- Test edilmemiş özelliği tamamlandı diye işaretleme.
- Sentetik veriyi gerçek veri gibi sunma; deterministik ajanı LLM gibi tanıtma.
- Yerel işlemleri Devnet işlemi gibi gösterme.
- Gerçek SOL satın alma, mainnet işlemi ya da izinsiz repo yayınlama yapma.

Bu kurallar "gerçek program gibi sun" talebiyle birlikte şu şekilde dengelendi: arayüz bir ürün gibi davranır (demo engelleri yok), ama README, teslim metinleri ve kanıt sayfası test stablecoin, örnek katalog ve kurallara dayalı yerleşik ajanı açıkça belirtir.
