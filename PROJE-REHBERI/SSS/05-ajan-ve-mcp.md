# SSS 05 · Ajanlar, MCP ve cüzdan

**169. Biz bir MCP miyiz?**
Hayır. Biz bir veri pazarıyız (Solana programı + servis). MCP, ajanların pazara takıldığı standart priz; biz bunun için bir MCP sunucusu yazdık.

**170. Hangi ajanlar bağlanabilir?**
MCP destekleyen her istemci: Claude Code, Claude Desktop, Cursor vb. Test edilen: gerçek bir MCP istemcisi (T54, T55) ve Claude Code kaydı (`claude mcp add`).

**171. Kurulum ne kadar zor?**
İnsan bir mesajı yapıştırır. Ajan `npm run connect` çalıştırır; insan bir kez `/mcp` ile yeniler; ajan `get_started` ile READY olana kadar kendisi ilerler.

**172. `npm run connect` ne yapıyor?**
Cüzdan dosyası (0600), operatör anahtarı varsa fonlama (varsayılan 1 aUSD + gerekirse SOL), 0.5 aUSD başlangıç hakkı ve 0.1 onay eşiği, Claude Code'a kullanıcı düzeyinde `adn` kaydı. Tekrar çalıştırmak güvenli.

**173. Başka projelerde de çalışır mı?**
Evet, kayıt `--scope user`; Claude Code hangi klasörde açılırsa açılsın araçlar mevcut.

**174. Kaç araç var?**
14: get_started, create_wallet, fund_wallet, request_budget, check_request, network_status, search_data, get_data_quote, verify_receipt, list_bounties, get_bounty_status, wallet_status, purchase_data, retrieve_data. Ayrıca 2 prompt: get_started, procurement_brief.

**175. Neden "imzala" aracı yok?**
Genel bir imza aracı, kandırılan bir ajanın her şeyi imzalayabilmesi demek. Her araç tek, sınırlı bir iş yapıyor; test T54 imza/transfer/send adlı araç olmadığını doğruluyor.

**176. Ajan ne zaman insana soruyor?**
0.1 aUSD üstü alımlarda, harcama hakkı bitince, cüzdanı fonlayamayınca (operatör anahtarı yoksa), RPC'ye ulaşamayınca.

**177. İnsan nasıl onaylıyor?**
İstemci destekliyorsa onay penceresi (MCP elicitation, 10 dk zaman aşımı); yoksa web uygulamasındaki Your agent sayfasında Approve/Decline. Ajan `check_request` ile takip eder.

**178. Harcama hakkı (allowance) nedir?**
İnsanın onayladığı sabit bütçe. Kendiliğinden büyümez; daha fazlası yeni bir onaylı hak demek. Önceki harcamalar sayılmaya devam eder.

**179. Hak nasıl verilir?**
Onay penceresinde, web sayfasında ya da `npm run cli -- allow 0.5`.

**180. Ajanın cüzdanı nerede?**
`~/.config/adn-agent/<cluster>/agent.json`, 0600; makineden çıkmaz, sunucuya gönderilmez.

**181. Bu cüzdana para nereden geliyor?**
Bugün: operatörün anahtarları aynı makinedeyse test aUSD basılıyor ve deployer'dan SOL gönderiliyor. Operatör yoksa ajan insandan para göndermesini istiyor.

**182. Gerçek üründe de böyle mi olacak?**
Hayır. Kimse para basamaz; kullanıcı ajan cüzdanına kendi USDC'sini yatırır ya da kendi cüzdanından zincir üstü harcama izni (SPL `approve`) verir. Cüzdan, imza, hak, onay ve makbuz mantığı aynı kalır.

**183. Delegate (approve) yöntemi nedir?**
Para kullanıcının cüzdanında kalır; ajana "en fazla X USDC harcayabilirsin" izni zincirde verilir. Sınırı Solana korur; yazılım hata yapsa bile aşılamaz.

**184. Yönetilen cüzdan seçeneği?**
Privy, Turnkey gibi servisler ajan için cüzdan açıp harcama kurallarını kendi tarafında uygulayabilir; teknik olmayan kullanıcılar için.

**185. Herkes projeyi kendi bilgisayarına mı kuracak?**
Gerçek üründe hayır. Pazar servisi merkezi bir sunucuda; kullanıcının makinesinde yalnızca küçük MCP cüzdan istemcisi çalışır (`npx` paketi).

**186. Bugün başka biri ajanını bağlayabilir mi?**
Repo'yu kurması gerekir; aUSD'yi yalnızca operatör basabildiği için ona aUSD gönderilmesi gerekir. Vercel'deki kopyaya ajan bağlanamaz (vitrin).

**187. MCP ajanı ödül açabilir mi?**
Bugün hayır; `list_bounties` ve `get_bounty_status` ile görebilir. Ödül açma yerleşik ajanda (oturum başına 1).

**188. MCP ajanı kaç birim alabilir?**
Her çağrıda 1–2 birim, tek işlemde.

**189. Ajan aynı birimi iki kez alır mı?**
Kurallar bunu yasaklıyor; makbuz varsa `retrieve_data` kullanmalı.

**190. Ajan neden her bilginin yanına makbuz yazıyor?**
Kaynak ve lisans kanıtı için; MCP talimatlarında zorunlu. Kullanıcı makbuzu kendisi doğrulayabilir.

**191. Ajan veriyi bulamazsa?**
"Yok" demeli; veri uydurmamalı (kural). Açık ödüller varsa `list_bounties` gösterir.

**192. Yerleşik ajanla MCP ajanı aynı araçları mı kullanıyor?**
Aynı servis ve aynı tipli araç katmanı (`AgentTools`), aynı ön kontrol ve bütçe mantığı.

**193. Yerleşik ajanın bütçeleri?**
Araştırma ajanı 2.1 aUSD + 0.05 SOL, en fazla 1 ödül; ikinci ajan 0.1 aUSD + 0.01 SOL, yalnızca alım; iade talep sahibi 2 aUSD + 0.01 SOL. Her oturumda cüzdanlar tam bu tavanlar kadar fonlanır.

**194. Ajan fiyatı nasıl seçiyor?**
Kesin teklifi alır; `maxSpend` kalan haktan büyükse ya da fiyat değiştiyse satın almaz.

**195. Onaylanmış bir alımı ajan nasıl tamamlıyor?**
Aynı birimlerle `purchase_data` çağırır, `approvalId` olarak onaylanan istek kimliğini verir; istek USED olur.

**196. Your agent sayfası neyi gösteriyor?**
Ajanın cüzdanı, kalan hak çubuğu, eşik, bekleyen onaylar, her eylemin canlı akışı (5 sn'de bir yenilenir), elle kurulum.

**197. MCP akışı test edildi mi?**
Evet, T55 uçtan uca: cüzdan, fonlama, bütçe isteği, web onayı, eşik altı alım, eşik üstü reddedilen alım, reddedilen onayla tekrar deneme engeli, pencereyle onaylı alım, hash kontrollü içerik, aktivite akışı.

**198. Videoda Claude gösterilecek mi?**
Demo planında 2:15–2:35 arası Claude Code'un MCP ile arama, alım, makbuz doğrulama ve not yazması var. Gerçek bir Claude oturumunun video için önceden kurulması gerekiyor.

**199. Neden x402 yok?**
Standart x402 "exact SVM" kolaylaştırıcısı yalnızca ComputeBudget, TransferChecked ve Memo'ya izin veriyor; özel Anchor talimatlarını (iki `purchase_unit` + makbuz hesapları) doğrulayamaz. 45 dakikalık denemede uyumsuz bulundu; sahte x402 etiketi konmadı.

**200. Ajanların birbirinden veri alması mümkün mü?**
Bir ajan sağlayıcı cüzdanıyla veri yayınlarsa evet; protokol açısından satıcının insan ya da ajan olması fark etmez. Demoda sağlayıcılar operatör betiğiyle yayınlıyor.
