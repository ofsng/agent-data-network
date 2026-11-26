# 10 · Yarışma kuralları ve teslim

## Dev3pack kuralları (resmî FAQ, 25 ve 26 Kasım'da okundu)

Kaynak: https://hack.dev3pack.xyz/faq · https://hack.dev3pack.xyz/ · https://tr.superteam.fun/dev3pack. Kayıt: `evidence/rules.md`.

| Konu | Kural | Bizim durumumuz |
|---|---|---|
| Tarih | 27–29 Kasım 2026, hibrit, üç gün | — |
| Son teslim | Pazar 29 Kasım 2026; kesin UTC saati yalnızca katılımcı panelinde | **Saati panelden kontrol et** |
| Etkinlikten önce kod | Serbest, tek şart proje Solana ile ilgili olmalı | Uygun |
| Önceden var olan kod | Kendi Solana projelerinden serbest; README'de neyin önce, neyin etkinlikte yapıldığı açıklanmalı | README "Hackathon disclosure" bölümünde |
| Yapay zekâ araçları | Serbest; anlaman, demo edip açıklayabilmen gerek | Claude Code kullanımı README'de açık |
| Açık kaynak | **Zorunlu** | Repo herkese açık, MIT |
| Takım | Tek kişi serbest, en fazla 4 | Tek kişi |
| Ağ | Devnet veya mainnet adresi kabul | Devnet |
| Video | **3 dakikadan kısa, kesin**; uzunsa ödülden diskalifiye; gerçek ürün demosu, sunum slaytı değil; herkese açık link (YouTube/Loom) | DEMO-SCRIPT.md, hedef 2:45 |
| Teslim formu | 5 adım: proje (ad, tek cümle, kategori, kontrat adresi, hub, açıklama) → görseller → video + repo + canlı link → takım → gözden geçirme | SUBMISSION.md hazır metinler |
| Değerlendirme | Ürün + teknik rubrik; ilk 100'e derin inceleme: kod incelemesi, canlı demo doğrulaması. Sinyaller: uygunluk, netlik, etki, demo kalitesi, deploy, repo kalitesi, Solana/SDK derinliği | — |
| Kayıt | Etkinlik başlamadan Dev3pack'e kayıt gerekli | Hesabın kabul edildiğini kontrol et |

## Teslim formu için hazır bilgiler

| Alan | Değer |
|---|---|
| Ad | Agent Data Network |
| Tek cümle | AI agents buy exactly the licensed data units they need, pay every provider in one Solana transaction, prove it with on-chain receipts, and fund missing data with escrowed bounties. |
| Kategori | AI / Agents · Data infrastructure |
| Kontrat adresi (Devnet) | `3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8` |
| Hub | Formda yerel hub seçilecek (ör. Türkiye) |
| Açıklama | `SUBMISSION.md` → Step 1 → Description |
| Görseller | `evidence/screenshots/` ya da bu klasördeki [gorseller/ekran/](gorseller/ekran/) ve [gorseller/diyagram/](gorseller/diyagram/) (4K) |
| Video | YouTube/Loom linki (3 dakikanın altında) |
| Repo | https://github.com/ofsng/agent-data-network |
| Canlı link | https://agent-data-network.vercel.app |
| Takım | Ömer Faruk Şengül (GitHub `ofsng`) |

## Demo videosu planı (İngilizce, < 3:00)

| Zaman | Ekran | Anlatım özü |
|---|---|---|
| 0:00–0:15 | Overview (Devnet rozeti, program, mint) | Problem ve tek cümlelik çözüm |
| 0:15–0:35 | Next step ×3: yayın, arama, teklif | Şartlar zincirde sabit; ücretsiz arama; ön kontrol |
| 0:35–1:00 | İmza + ödeme, Live balances | Tek işlem, iki talimat, 80/20 ya da hiçbiri; Explorer'da imza |
| 1:00–1:15 | Doğrulama, Transactions & receipts | Makbuz → imzalı challenge → hash kontrollü baytlar |
| 1:15–1:50 | Eksik → ödül → gönderim → inceleme | Uydurmak yerine ödül; yalnızca geçti/kaldı |
| 1:50–2:15 | Kabul → teslim → satışa açma → yeniden satış | Kasa öder, satıcı tekrar kazanır |
| 2:15–2:35 | Claude Code + Your agent sayfası | Herhangi bir ajan MCP ile bağlanır, kendi cüzdanıyla alır |
| 2:35–2:50 | Verification & evidence, Explorer | Testler, kanıt, kapanış cümlesi |

**Çekim notları:**
- Tercihen Devnet: `npm run start:devnet`, 1440×900, **New session**, bir kez ısınma koşusu.
- Tam koşu gerçek zamanda 3–4 dakika (her işlemde ~13 sn kesinleşme). Bir kez tam kaydet, beklemeleri kurguda kes, ekrana "finality waits shortened" yaz. Hiçbir sonucu kesme.
- Public RPC 429 verirse `SOLANA_RPC_URL` ile başka bir Devnet RPC kullan.

**Videoda söylenmeyecekler:** mainnet, gerçek para, müşteri, gelir; yerleşik ajanın LLM olduğu; x402; verinin doğru olduğu; yerelde çektiysen "Devnet".

## Açıklama yükümlülüğü (disclosure)

- **Önce ve sonra:** Planlama belgeleri (`STARTUP-PACKAGE/`, V1.3 → V1.5) koddan önce. Bütün kod 2026-11-25'ten itibaren yazıldı; git geçmişi zaman çizelgesini gösteriyor.
- **Yapay zekâ:** Kurucunun yönlendirmesiyle Claude Code (Anthropic) ile geliştirildi.
- **Lisans:** Kod MIT. Fixture'lar kurgusal (`fixtures/LICENSE.txt`, "ADN Standard Data License v1 (ADN-STD-1)").
- **Ağ ve para:** Yalnızca Devnet, test stablecoin (aUSD), örnek katalog. Mainnet, gerçek para, müşteri yok.

## Teslim öncesi kontrol listesi

- [x] Program Devnet'te, baytlar yerel derlemeyle aynı
- [x] Tam ekonomik döngü Devnet'te gerçek işlemlerle çalıştı ve zincirde doğrulandı
- [x] 37/37 test geçiyor
- [x] Repo herkese açık, anahtar/secret yok
- [x] README, SUBMISSION, DEMO-SCRIPT güncel; açıklamalar yapılmış
- [x] Canlı salt okunur kopya Vercel'de
- [ ] **Demo videosu (< 3:00) çekildi ve YouTube/Loom'a yüklendi** (kurucu)
- [ ] **Dev3pack formu 29 Kasım'dan önce gönderildi** (kurucu; UTC saatini panelden kontrol et)
- [ ] Dev3pack kaydının kabul edildiği kontrol edildi (kurucu)
