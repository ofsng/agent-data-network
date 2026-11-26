# SSS 08 · Zor ve karşı-argüman soruları

Jürinin itiraz edebileceği sorular ve dürüst, savunulabilir cevaplar.

**251. "Bu sadece bir ödeme. Neden blokzincir gerekiyor? Stripe yapamaz mı?"**
Stripe bir şirketin söz verdiği ödemeyi yapar. Burada üç şey programla zorunlu ve herkes tarafından doğrulanabilir: çok sahibe tek işlemde atomik bölüşüm, değiştirilemez lisans makbuzu, kimsenin keyfi çekemeyeceği ödül emaneti. Ayrıca 0.03 $'lık mikro ödemeler kart ağlarında ekonomik değil.

**252. "Ajan için ödeme rayı zaten var: x402."**
x402 ödemeyi taşır; makbuz, lisans kanıtı, çok sahipli atomik bölüşüm ve ödül emaneti vermez. Standart kolaylaştırıcısı özel program talimatlarını da kabul etmiyor. Gelecekte x402 bizim için bir taşıma katmanı olabilir.

**253. "Veri hâlâ sizin sunucunuzda; merkezi değil mi?"**
Evet, teslim merkezi ve bu açıkça bir güven varsayımı. Zincirdeki kısım para, şartlar ve kanıttır; sunucu bu kanıtları değiştiremez, bozulmayı da hash ile gizleyemez.

**254. "Makbuz doğruluğu kanıtlamıyorsa ne işe yarıyor?"**
Kurumsal alıcı için "bu bilgiyi hangi kaynaktan, hangi sürüm ve lisansla, ne zaman aldım" sorusunun denetlenebilir cevabı. Doğruluk ise ekonomik araçlarla (itiraz, teminat, itibar) ve kaynak imzasıyla ele alınır.

**255. "Ödül incelemesi güvenilen bir doğrulayıcı. Bu emaneti anlamsız kılmıyor mu?"**
Hayır: para yine yalnızca talep sahibinin imzasıyla, yalnızca ödül kadar, bir kez çıkar; iade süresi programla korunur. İnceleme yalnızca talep sahibinin kararına yardım eder. Doğrulayıcının merkeziyetini kabul ediyoruz; itiraz süresi ve teminat yol haritasında.

**256. "Demodaki inceleme doğru cevabı zaten biliyor; bu hile değil mi?"**
Demo amaçlı deterministik bir doğrulayıcı ve bunu açıkça söylüyoruz. Gerçekte cevap önceden bilinmez; bu yüzden kaynak imzası ve itiraz mekanizması gerekiyor.

**257. "Sentetik veriyle 'gerçek ürün gibi' sunmak yanıltıcı değil mi?"**
Arayüz bir ürün gibi davranıyor; ama README, teslim metinleri, Kanıt sayfası ve videoda aUSD'nin test stablecoin'i, kataloğun örnek veri ve yerleşik ajanın kurallara dayalı olduğu açıkça yazıyor. Zincirdeki her işlem gerçek.

**258. "aUSD'yi siz basıyorsunuz; bu bir stablecoin değil."**
Doğru; Devnet'te test için, gerçek parayla karşılığı yok. Ürün USDC ile çalışacak; program mint'ten bağımsız (6 ondalıklı herhangi bir legacy SPL mint).

**259. "Ajan uygulamada LLM değilse bu bir 'AI' projesi mi?"**
Alıcı ajanlar için bir altyapı projesi. Yerleşik ajan deterministik gösterim için; gerçek LLM (Claude) MCP ile aynı araçları kendi cüzdanıyla kullanıyor ve test edildi (T55).

**260. "Kimse 0.03 $'a datasheet almaz; PDF'ler bedava."**
Doğru olabilir; değer bedava olmayan, güncel ve parçalı bilgide: distribütör stoğu, teslim süresi, fiyat kademeleri, iade oranları, sertifikalar. Datasheet örneği akışın tamamlayıcısı.

**261. "Makbuz kirası 0.0027 SOL; 0.03 $'lık alımda ekonomik değil."**
Kabul ediyoruz; bu ticari başlangıçtan önce çözülmesi gereken bir kapı. Seçenekler: sıkıştırılmış makbuzlar, toplu makbuz, daha büyük paketler.

**262. "Satıcı aynı veriyi başka hash ile birçok kez satabilir; spam?"**
Evet, hash farklıysa engellenmez. İtibar, listeleme maliyeti ve benzerlik kontrolü yol haritasında.

**263. "Upgrade authority sizde; istediğiniz an kuralları değiştirebilirsiniz."**
Doğru, Devnet demosu için. Üründe multisig + zaman kilidi, sonunda yükseltmenin kapatılması.

**264. "Bir LLM ajanına cüzdan vermek tehlikeli."**
Bu yüzden genel imza aracı yok, sabit harcama hakkı var, eşik üstü insan onayı var, cüzdanda yalnızca harçlık var. Üründe zincir üstü `approve` sınırı.

**265. "Hackathon'dan önce hazırlanmış belgeler var; bu adil mi?"**
Kurallar önceden çalışmaya izin veriyor; belgeler kod içermiyordu ve README'de açıklandı. Bütün kod etkinlik döneminde yazıldı; git geçmişi kanıt.

**266. "Neredeyse her şeyi yapay zekâ yazdı; senin katkın ne?"**
Ürün fikri, kapsam, versiyon planları (V1.3–V1.5), kararlar, dürüstlük kuralları, test ve teslim kabulü kurucunun. Kurallar yapay zekâya izin veriyor; önemli olan ürünü anlayıp anlatabilmek.

**267. "Neden yalnızca 2 sağlayıcı? Ölçeklenir mi?"**
Program sağlayıcı sayısını sınırlamıyor; her sağlayıcı kendi PDA'larıyla kayıt olur. İşlem başına birim sayısını boyut sınırlıyor (bugün 2; v0+ALT ile daha fazla).

**268. "Katalog 24 birim; arama ölçeklenir mi?"**
Bugün SQLite metadata araması. Ölçekte Postgres + tam metin/vektör arama gerekir; zincir tarafı etkilenmez.

**269. "Ödül 7 günle sınırlı; uzun araştırmalar?"**
Demo kapsamı; sınır programda sabit. Yeni sürüm daha uzun süre ya da uzatma mekanizması getirebilir.

**270. "Ödülde kısmi ödeme ya da birden çok kazanan yok."**
Doğru, kapsam dışı (D35). Gelecek tasarımı.

**271. "Teslim başarısız olursa alıcı parasını geri alamıyor."**
Bugün kurtarma ve ücretsiz tekrar var ama iade yok. Ticari sürüm için teslim garantisi/iade şart (G5–G7).

**272. "Talep sahibi incelemeden geçen cevabı reddedip parasını geri alabilir."**
Evet, cevabı görmeden. Üretici koruması (itiraz, hakem ya da süre sonunda otomatik ödeme) ticari kapılardan biri.

**273. "Neden Ethereum/L2 değil?"**
Ücret ve hız; atomik çok talimatlı işlem ve PDA emanet modeli Solana'da doğal. Yarışma da Solana.

**274. "Bu bir Ocean Protocol klonu mu?"**
Hayır: Ocean veri seti erişimi ve datatoken ekonomisi; biz ajanların küçük birim alımları, atomik çok sahipli ödeme, makbuz ve eksik veri ödülü.

**275. "Bunu kim kullanacak, somut bir müşteri söyle."**
Somut müşteri yok. Hedef profil: tedarik/araştırma ajanı geliştiren bir ekip ve onlara stok/teslim süresi satabilecek distribütörler. Bu bir hipotez.

**276. "Arayüz çok teknik."**
Bu yüzden Türkçe/İngilizce rehberli tur ve sade Kontrol sayfası var; teknik ayrıntılar Kanıt sayfasında.

**277. "Devnet'te bile operatör anahtarlarını tutuyorsunuz; güvenlik?"**
Yerel makinede 0600 dosyalarda; herkese açık sunucuya konmadı (canlı kopya salt okunur).

**278. "Bağımlılıklarda bilinen açıklar var."**
Dolaylı, Solana JS yığınından; kırılmayan düzeltmesi yok; loopback ve güvenilen girdiler. Kayıtlı ve izleniyor.

**279. "Verify script'iniz sizin; neden güveneyim?"**
Gerek yok: imzalar Explorer'da bağımsız olarak açılabilir; makbuz hesapları zincirde herkes tarafından okunabilir.

**280. "Hackathon bittiğinde ne olacak?"**
Yol haritası hazır; ama ticari başlangıç gerçek talep kanıtlanana kadar kapalı. Dürüst cevap: önce pilot ve kullanıcı görüşmeleri.

**281. "En büyük teknik risk ne?"**
Ödül incelemesinin doğrulanabilirliği ve teslimin ödemeyle atomik olmaması.

**282. "En büyük ticari risk ne?"**
Gerçek talep ve birim ekonomisi (makbuz kirası + %20 komisyon baskısı).

**283. "Bir şeyi tekrar yapsan farklı ne yapardın?"**
Makbuz maliyetini baştan sıkıştırılmış tasarımla düşünmek; ödülde itiraz süresini programa eklemek; kopya kontrolünü zincirde içerik hash indeksiyle yapmak.
