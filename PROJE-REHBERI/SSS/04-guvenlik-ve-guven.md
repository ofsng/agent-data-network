# SSS 04 · Güvenlik, güven ve veri doğruluğu

**131. Makbuz neyi kanıtlar?**
Bu cüzdanın, bu birimin bu sürümü için (içerik hash'i), bu lisans şartlarıyla (lisans hash'i), şu tutarı ödediğini ve tutarın 80/20 nasıl bölündüğünü, zincir saatiyle.

**132. Makbuz neyi kanıtlamaz?**
Verinin doğru olduğunu, satıcının sahibi olduğunu, verinin teslim edildiğini ya da kullanıldığını, hukuki sahiplik devrini.

**133. Veri yanlışsa ne olur?**
Bugün: makbuz yalnızca ödemeyi kanıtlar; doğruluk "provider-declared" olarak etiketlenir. Yol haritası: kaynak imzası, itiraz süresi, teminat, itibar.

**134. Veri doğruluğunu neden doğrulamıyorsunuz?**
"Veri doğru mu" genel olarak hiçbir sistemde kanıtlanamaz. Doğru hedef hesap sorulabilirlik: kim neyi ne zaman sattı, yanlışsa bedelini kim öder.

**135. Satıcı sahte veri yüklerse?**
Bugün engel yok; makbuz satıcıyı ve baytları kayda geçirir, yani kimin sattığı kanıtlanabilir. Kaynak imzası ve teminat bunu kârsız hâle getirecek.

**136. Ödüle sahte cevap verip parayı alabilir mi?**
Kendi başına alamaz: kasa yalnızca talep sahibinin imzalı kabulüyle öder. Ama talep sahibi "geçti" diyen incelemeye güvenir; inceleme kandırılırsa sahte veri ödeme alabilir. Bu açıkça yazılmış bir güven varsayımı.

**137. Bunu nasıl kapatacaksınız?**
İtiraz süresi (ödeme 48 saat kasada beklesin), sağlayıcı teminatı (sahte kanıtlanırsa kaybetsin), kaynağın imzası (sertifikayı veren kurum kendi anahtarıyla imzalasın, program kontrol etsin), birden fazla bağımsız kaynağın örtüşmesi.

**138. İnceleme neden zincirde değil?**
Doğrulama mantığı veriye özgü ve cevabı gizli tutmalı; zincirde herkese açık olurdu. Program yalnızca talep sahibinin kararını (imzasını) zorlar.

**139. Talep sahibi cevabı görüp ödemezse?**
Göremez: ödemeden önce yalnızca geçti/kaldı raporunu görür; aday pasif olduğu için pazardan da alamaz. Cevap ancak kabulden sonra teslim edilir.

**140. Ama talep sahibi geçen cevabı reddedip süreyi bekleyebilir mi?**
Evet, bugün dürüst ama kabul edilmeyen sağlayıcıyı koruyan bir mekanizma yok. Cevabı görmediği için bundan bilgi kazancı da yok. Üretici koruması (D48) ticari başlangıçtan önceki şartlardan biri.

**141. Alıcı veriyi kopyalayıp daha ucuza satarsa?**
Birebir kopya: aynı hash'li sonraki listeleme kopya işaretlenir, aramada çıkmaz, teklif verilmez (T56). İlk listelemenin slotu ve kopyacının kendi makbuzu kimin önce olduğunu kanıtlar.

**142. Bir karakter değiştirip satarsa?**
Yeni hash kontrolü geçer; bu açık bir risk. Savunmalar: alıcıya özel filigran (sızıntının makbuzunu bulmak), benzerlik kontrolü, lisansta yeniden satış yasağı, verinin güncelliği (stok, teslim süresi çabuk eskir).

**143. Bir veriyi bir kez teslim edince kopyalanmasını önlemek mümkün mü?**
Tamamen değil (müzik ve film sektörü de çözemedi). Amaç kopyalamayı tespit edilebilir ve kârsız yapmak.

**144. Satıcı ödemeden sonra veriyi değiştirirse?**
Hash zincirde sabit; teslimde baytlar uyuşmazsa teslim kapanır, snapshot'tan birebir geri yüklenir, alıcı ücretsiz tekrar alır.

**145. Sunucudaki veri bozulursa/silinirse?**
Snapshot varsa birebir kurtarılır; yoksa teslim "çözülemedi" olarak raporlanır, uydurma veri verilmez (T20/T43).

**146. Ödeme ve teslim atomik mi?**
Hayır. Ödeme zincirde atomik; teslim ayrı, tekrar denenebilir bir adım. "Fair exchange" iddiası yok; açıkça yazılı.

**147. Sunucu ödeme alıp veriyi vermezse?**
Bugün operatöre güven gerekiyor; makbuz alıcının hakkını kanıtladığı için anlaşmazlıkta delil olur. Ticari sürümde teslim garantisi/iade mekanizması şart (G5–G7).

**148. Ücretli içerik başka bir uçtan sızıyor mu?**
Hayır; arama, katalog, bounty, sağlık, kanıt uçları ve loglar test ediliyor (T41/T50). Erken bir sürümde kanıt dosyası içerik sızdırıyordu, bulunup düzeltildi.

**149. Canlı kopyada ücretli içerik var mı?**
Hayır; "yalnızca makbuz sahibine teslim edilir" yazısıyla değiştirildi ve dışa aktarma sızıntı kontrolü yapıyor.

**150. Repo'da özel anahtar var mı?**
Hayır. Anahtarlar `~/.config/adn-demo/` ve `~/.config/adn-agent/` altında, 0600. Git geçmişi tarandı.

**151. Ajanın anahtarı çalınırsa?**
Saldırgan cüzdandaki bakiyeyi harcayabilir. Bu yüzden cüzdanda yalnızca küçük bir harçlık tutulur. Gerçek üründe SPL `approve` ile zincir üstü sınır ya da yönetilen cüzdan.

**152. Ajan bütçeyi aşabilir mi?**
Hayır; harcama imzadan önce rezerve edilir, bekleyenler sayılır, hak genişletilemez, eşik üstü insan onayı gerekir.

**153. Ajan onayı kendi verebilir mi?**
Hayır; onay yalnızca tarayıcıdan (aynı köken) kabul edilir, komut satırından gelen istek 403 alır. Onay penceresi istemcinin insan arayüzünde.

**154. Onay başka bir alım için kullanılabilir mi?**
Hayır; onay belirli birimlere ve tutara bağlı. Farklı birim ya da daha yüksek tutar `NOT_APPROVED`.

**155. Prompt injection ile ajan kandırılırsa?**
Ajanın genel imza aracı yok; yalnızca 1–2 birim satın alabilir, bütçe ve eşik içinde. En kötü durumda hak kadar harcar. Veri içeriklerinin talimat gibi okunmaması ajan istemcisinin sorumluluğu.

**156. Demo API'si kötüye kullanılabilir mi?**
Yalnızca loopback, aynı köken, oturum token'ı; önceden tanımlı adımları çalıştırır; anahtar, işlem ya da alıcı kabul etmez (test edildi).

**157. Sunucu internete açık mı?**
Hayır, `127.0.0.1`'e bağlı.

**158. Bağımlılıklarda güvenlik açığı var mı?**
`npm audit` Solana JS yığınının dolaylı bağımlılıklarında (bigint-buffer, toml, stream-json) uyarılar gösteriyor; kırılmayan düzeltme yok; loopback ve güvenilen girdiler nedeniyle risk sınırlı. Kayıtlı.

**159. Program denetlendi mi?**
Hayır. Kapsamlı negatif testler var (17 program testi) ama mainnet öncesi bağımsız denetim şart.

**160. Upgrade authority riski?**
Deployer programı değiştirebilir; bu yazılı bir güven varsayımı. Üründe multisig + zaman kilidi ya da yükseltmeyi kapatma.

**161. Kaynak ve haklar beyanı doğrulanıyor mu?**
Hayır, sağlayıcı beyanı; içerik hash'i bunları kapsamaz. Arayüz "provider-declared" der.

**162. Satıcı başkasının verisini kendi adına satarsa (hak ihlali)?**
Bugün engellenemez; makbuz ve köken kaydı delil sağlar. Gerçek üründe hak beyanı + hukuki inceleme + kaynak imzası.

**163. Kişisel veri satılırsa?**
Kapsam dışı; demo yalnızca ürün/tedarik verisi. Gerçek üründe kişisel veri yasağı ve KVKK/GDPR incelemesi gerekir.

**164. Ödül cevabı herkese açık gereksinimde sızıyor mu?**
Hayır; gereksinim v2 cevabı içermiyor (T44/T45), yalnızca format ve kriterler.

**165. Snapshot'lar da bozulursa?**
Snapshot hash'i doğrulanıyor; bozuksa kullanılmaz ve teslim "çözülemedi" olur, teklif 503 ile engellenir.

**166. Bir işlemin sahte olduğunu nasıl anlarım?**
Explorer'da açarsın; program ID, hesaplar ve bakiye değişimleri görünür. `npm run verify:devnet` hepsini kontrol eder.

**167. Arayüz sahte sayı gösterebilir mi?**
Simülasyon modu yok; sayılar oturum durumundan, kazançlar ölçülmüş bakiye farklarından. Tarayıcı testi hata enjekte edip görünürlüğü kontrol ediyor.

**168. Hangi açık riskleri kabul ediyorsunuz?**
Küçük değişiklikli kopya, ödüle sahte veri (güvenilen inceleme), yanlış katalog verisi, %20 komisyon baskısı, tavuk-yumurta, teslimin ödemeyle atomik olmaması, upgrade authority. Hepsi uygulamada "Open risks" tablosunda.
