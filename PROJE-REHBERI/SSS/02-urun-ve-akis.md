# SSS 02 · Ürün ve akış

**33. Bir "veri birimi" nedir?**
Küçük, kendi başına anlamlı bir bilgi parçası: örneğin "Voltara X100 invertör teknik datasheet'i" ya da "X100 stok ve teslim süresi". Sabit fiyatı, sürümü, içerik hash'i ve lisans hash'i zincirde kayıtlı.

**34. Katalogda kaç birim var?**
24 birim: NorthLab'den 12 (üretici datasheet'leri), SouthSupply'dan 12 (stok, fiyat, lojistik). Ödülle üretilen geri dönüşüm sertifikası 25. birim olarak eklenir.

**35. Fiyatlar ne kadar?**
0.010 ile 0.035 aUSD arası (ortalama ~0.0215). X100 datasheet ve stok bilgisi 0.03'er.

**36. Arama ücretli mi?**
Hayır. Başlık, etiket, özet, fiyat, sağlayıcı ve güven bilgisi ücretsiz. İçerik dönmez.

**37. Satın alırken tam olarak ne oluyor?**
Kesin teklif alınır (ön kontrolle), bütçeden rezervasyon yapılır, ajan tek işlemi imzalar (her birim için bir `purchase_unit`), program parayı 80/20 dağıtır ve her birim için makbuz yazar, ajan kesinleşmeyi bekleyip makbuzları doğrular.

**38. Bir işlemde en fazla kaç birim alınabiliyor?**
Demoda ve MCP'de 1–2 birim. İki birimlik işlem 784 bayt; 1232 bayt sınırı var. Üç ve üstü için v0 işlem + adres tablosu yol haritasında.

**39. Neden iki satıcı?**
Asıl değer, farklı sahiplerden gelen veriyi tek atomik işlemde almak. Tek satıcıdan almak sıradan bir ödeme olurdu.

**40. "Ya hepsi ya hiçbiri" neden önemli?**
Ajan yalnızca birini alıp diğeri başarısız olursa yarım bilgiye para ödemiş olur. Atomiklik bunu engeller.

**41. Satın alınan veriyi ajan nasıl alıyor?**
Makbuzuna karşılık tek kullanımlık mesajı cüzdanıyla imzalar; sunucu makbuzu zincirde doğrulayıp baytları verir; ajan hash'i kontrol eder.

**42. Makbuzu olmayan veri alabilir mi?**
Hayır. Makbuzsuz, sahte makbuzlu, başkasının makbuzlu ya da kötü imzalı istekler reddedilir (T18).

**43. Aynı veriyi tekrar indirmek ücretli mi?**
Hayır. Aynı makbuzla yeniden alınabilir; MCP kuralı da "aynı birimi iki kez satın alma, retrieve_data kullan" der.

**44. Satıcı listelemeyi geri çekerse eski alıcı ne olur?**
Önceki alıcıların hakkı korunur; yalnızca yeni satış durur (T43).

**45. Ödül (bounty) ne zaman açılıyor?**
Ajan gerekli etiketi taşıyan aktif bir birim bulamadığında (demoda `recycling`). Ajan veriyi uydurmak yerine ödül açar.

**46. Ödül ne kadar?**
Demoda 2 aUSD. Kabulde 1.6 sağlayıcıya, 0.4 platforma.

**47. Ödülün süresi ne kadar?**
En fazla 7 gün. Demoda ana ödül 1 saat, iade demosu 20 saniye.

**48. Kim cevap verebilir?**
Talep sahibi ve hazine dışındaki herhangi bir sağlayıcı, kendi pasif varlığını aday olarak gönderebilir.

**49. Aday neden "pasif" olmak zorunda?**
Aktif olsaydı cevap ödenmeden pazarda satılabilirdi; ya da talep sahibi pazardan ucuza alıp ödülü kabul etmeyebilirdi.

**50. Birden fazla aday gelirse?**
Her biri incelenir; talep sahibi geçen birini kabul eder. Kabul bir kez olur; ikinci kabul reddedilir (T30).

**51. Talep sahibi kabul etmezse?**
Süre dolunca parasını tam olarak geri alır. Dürüst ama kabul edilmeyen sağlayıcı ödeme almaz; bu bilinen bir sınır, itiraz mekanizması yol haritasında.

**52. Cevap ne zaman teslim ediliyor?**
Ancak kabulden sonra, bounty makbuzuyla. Önce talep sahibi yalnızca geçti/kaldı görür.

**53. Ödülle üretilen veriye sonra ne oluyor?**
Sağlayıcı aktif eder, kataloğa girer, başka ajanlar satın alır. Demoda ikinci ajan 0.03'e aldı, NorthLab tekrar 0.024 kazandı.

**54. Ödülü açan ajan, verinin yeniden satılmasından ne kazanıyor?**
Doğrudan bir pay almıyor. Lisans demoda münhasır olmayan yeniden satışa izin veriyor. Talep sahibine pay (royalty) gelecekte düşünülebilecek bir tasarım.

**55. İade nasıl çalışıyor?**
Süre dolduktan sonra talep sahibi `refund_expired_bounty` çağırır; ödülün tamamı komisyonsuz döner. Süre dolmadan çağrılırsa `DeadlineNotReached`.

**56. İade gelir sayılıyor mu?**
Hayır; platform iadeden pay almaz (hazine değişimi 0).

**57. 16 adım ne kadar sürüyor?**
Devnet'te gerçek zamanda 3–4 dakika; çoğu her işlemde ~13 saniyelik kesinleşme beklemesi. Yerelde daha hızlı.

**58. "New session" ne yapar?**
Yeni cüzdanlarla izole bir oturum başlatır. Eski oturumlar, makbuzlar ve anahtarlar silinmez.

**59. Rapor (brief) neyi içeriyor?**
Her bulgu: hangi birimden geldiği ve hangi makbuzla ödendiği. Ör. X100 tepe verimi %97.6, stok 18 adet (+42 yolda), standart teslim 5 iş günü, sertifika `WEEE-TR-2026-04817`.

**60. Kazançlar nasıl hesaplanıyor?**
Arayüz tahmin etmiyor; kesinleşmiş işlemlerden önce/sonra ölçülen token bakiyesi farklarını gösteriyor.

**61. Ajanın bütçesi nasıl çalışıyor?**
Araştırma ajanı 2.1 aUSD tavan + en fazla 1 ödül; ikinci ajan 0.1; iade talep sahibi 2. Harcamalar imzadan önce kalıcı olarak rezerve edilir; tavan genişletilemez.

**62. Ajan bütçeyi aşarsa?**
Aşamaz: rezervasyon tavanı geçiyorsa işlem hiç imzalanmaz (T47).

**63. Kullanıcı arayüzü olmadan kullanılabilir mi?**
Evet: `npm run demo` (başsız), CLI (`npm run cli -- search …`), HTTP API ve MCP.

**64. Kontrol (Control) sayfası ne için?**
Tüm görevi tek ekrandan yönetmek için: çalıştırma düğmeleri, cüzdanlar, market listesi, salt teklif, makbuz doğrulama, kasa durumu.

**65. Rehberli tur ne anlatıyor?**
13 adımda en basit dille: uygulama ne yapar, ağ ve para, pazar ve satıcılar, ajan, görevi başlatma, tek işlemde ödeme, ödül ve kasa, 80/20, Kontrol, kanıt ve riskler, kendi ajanını bağlama.

**66. Telefonda çalışıyor mu?**
Evet, 390 px genişlikte taşma yok; tarayıcı testi kontrol ediyor.

**67. Bir satıcı nasıl veri yayınlar?**
Bugün operatör betiği sağlayıcılar adına yayınlıyor (`register_data_asset`, sağlayıcının imzasıyla). Gerçek üründe sağlayıcı paneli/SDK ile kendisi yayınlar.

**68. Satıcı fiyatı değiştirebilir mi?**
Mevcut sürümde hayır; yalnızca aktif/pasif. Yeni fiyat = yeni sürüm (yeni PDA).

**69. Satıcı veriyi güncellerse?**
Yeni sürüm kaydeder. Eski alıcılar eski sürümün makbuzuna sahiptir; yeni sürüm ayrı satılır.

**70. Lisans nedir, nerede?**
`fixtures/LICENSE.txt`: "ADN Standard Data License v1 (ADN-STD-1)". Metninin hash'i her varlıkta ve makbuzda.
