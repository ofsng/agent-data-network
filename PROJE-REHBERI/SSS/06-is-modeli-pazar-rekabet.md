# SSS 06 · İş modeli, pazar ve rekabet

**201. Nasıl para kazanacaksınız?**
Her satıştan ve her kabul edilen ödülden %20 platform payı, programda zorunlu. Listeleme ücreti, abonelik ya da token yok.

**202. %20 fazla değil mi?**
Yüksek ve gerçek bir risk. Savunma: komisyon güven katmanının (ön kontrol, snapshot kurtarma, ücretsiz tekrar, makbuz, emanet) karşılığı. Henüz test edilmedi; pazar tepkisine göre değişebilir (programda sabit, yeni sürüm gerekir).

**203. Gelir var mı?**
Hayır. Müşteri, gelir ya da çekiş iddiamız yok.

**204. Pazar büyüklüğü?**
Güvenilir bir ölçüm yok; TAM iddia etmiyoruz. Örnek senaryo: 100 kuruluş × %10 × ayda 1 000 alım × 0.03 $ × 12 = yılda 3 600 $ GMV, 720 $ gelir. Bu bir hesap yöntemi, tahmin değil.

**205. Birim ekonomisi pozitif mi?**
Bilinmiyor. Formül: fiyat × komisyon × (1 − iade) − teslim/RPC − ücretsiz arama maliyeti − üstlenilen ücret/kira − destek/dolandırıcılık. Makbuz kirası küçük alımlarda önemli bir kalem.

**206. Makbuz kirası iş modelini bozmaz mı?**
Bugünkü tasarımda her makbuz ~0.0027 SOL depozit kilitler ve geri alınmaz. 0.03 $'lık alım için bu orantısız. Çözüm: sıkıştırılmış/Merkle makbuzlar ya da toplu makbuz; ayrı tasarım ve denetim gerektiriyor.

**207. Marketplace'ler genelde başarısız olmuyor mu?**
Evet; dört sorun: tavuk-yumurta, platformu atlama, toplama değeri, komisyon baskısı. İlk üçüne mimari cevaplarımız var (talep-önce ödül; satılan şey ispat; çok sahipli atomik alım). Dördüncüsü açık risk.

**208. Tavuk-yumurta sorununu nasıl çözüyorsunuz?**
Talep önce gelir: ajan veriyi bulamayınca parayı kilitler, sağlayıcı ancak parası hazır veriyi üretir. Kabul edilen veri kataloğa girip yeniden satılır. Alıcı katılımı tek satır (MCP). Sağlayıcıya pazar dolmadan da araç olarak değer. Tek dikeyle ve platform fonlu ilk ödüllerle başlamak. Hipotez, kanıt değil.

**209. Alıcı ve satıcı platformu atlarsa?**
Alıcı bir ajan; dışarıda anlaşma ilişkisi yok. Atlayan taraf lisans makbuzunu, hash doğrulamasını, atomik çok sahipli alımı ve bütçe korumasını kaybeder. Kurumsal alıcı için asıl değer bu kanıt.

**210. Sağlayıcılar neden katılsın?**
Küçük birimleri tekrar tekrar satma, kullanım başına otomatik %80, parası hazır talepleri görme, makbuzla lisans kanıtı; entegrasyon yükü yok.

**211. Alıcılar neden ödesin, web aramasında bedava?**
Ancak benzersiz, güncel, lisanslı ve kanıtlı bilgi zaman kazandırıyor ya da risk azaltıyorsa (yanlış teslim süresiyle sipariş vermek pahalı). Bedava bilgiyle rekabet etmiyoruz.

**212. Rakipleriniz kim?**
ipto.ai (en doğrudan; birim bazlı, API/MCP, Stripe ödeme), DataBazaar (veri seti + ödül, Stripe emanet), Ocean Protocol (datatoken lisanslama), x402 (ödeme taşıması), web araması ve lisanslı veri akışları.

**213. ipto.ai'den farkınız?**
İncelediğimiz belgelerde zincir üstü çok sağlayıcılı makbuz ve programın uyguladığı ödül emaneti görmedik. Onlar Stripe Connect (min. 10 $ ödeme) kullanıyor; biz anında, kullanım başına, atomik ödüyoruz. Bağımsız test etmedik.

**214. DataBazaar da ödül yapıyor, farkınız?**
Onların emaneti Stripe ile, bizimki programla; ödeme, iade ve kabul kuralları zincirde zorunlu ve herkes doğrulayabilir. Ayrıca birim bazlı, çok sahipli atomik alım.

**215. Ocean Protocol başaramadı, siz neden başarasınız?**
Ocean veri seti erişimi ve datatoken ekonomisine odaklandı. Biz ajanların küçük, anlık alımlarına ve eksik verinin finansmanına odaklanıyoruz, düşük ücretli Solana'da. Ama alanın zor olduğunu kabul ediyoruz; bu bir garanti değil.

**216. "İlk biz yaptık" diyebilir misiniz?**
Hayır, demiyoruz. Fark birleşim.

**217. Kopyalanması kolay değil mi?**
Kod açık kaynak, evet. Olası hendek: kalite/sürüm geçmişi, talep grafiği (hangi eksikler soruldu), benzersiz arz, entegrasyon derinliği. Bunlar henüz yok.

**218. Hedef pazar neden tek dikey?**
"Her türlü veri" klasik pazar sorunlarına geri götürür. Tek dikeyde bir avuç sağlayıcı yeterli kapsama sağlar.

**219. Pazara giriş planı?**
Ekipman tedarik verisi; platformun fonladığı ilk ödüller; sağlayıcılara araç olarak değer; MCP kayıt defterleri ve ajan geliştirici toplulukları; etkinlik sonrası çevrimiçi pilot.

**220. Fiyatı kim belirliyor?**
Sağlayıcı, kayıt sırasında. Sürüm başına sabit.

**221. Hangi metrikleri izleyeceksiniz?**
Bağımsız ödeyen alıcı tutunması, tekrar eden sağlayıcılar, karşılanan eksikler, ödül başına sonraki satış, net katkı, itiraz oranı, alıcının toplam SOL maliyeti.

**222. Yatırım arıyor musunuz?**
Belgelerde yatırım talebi yok; önce gerçek talep ve birim ekonomisi kanıtlanmalı.

**223. Neden ödül açan ajan yeniden satıştan pay almıyor?**
Demo basitliği. Talep sahibine pay (veriyi finanse ettiği için) ödülü daha cazip yapabilir; gelecek tasarımı.

**224. Lisans modeli?**
Demo lisansı münhasır olmayan, yeniden satışa izin veren kurgusal "ADN-STD-1". Gerçekte lisans şablonları ve hukuki inceleme gerekir.

**225. Ticari olarak ne zaman başlarsınız?**
Kira ekonomisi, teslim kurtarma/iade, üretici koruması, veri hakları ve gerçek talep kanıtlanmadan değil (D48, NO-GO).
