# 13 · Sözlük (teknik terimler, basit anlatım)

| Terim | Basit anlamı |
|---|---|
| **Ajan (agent)** | Kendi başına adım adım iş yapan yapay zekâ programı: araç kullanır, karar verir, işi bitirir |
| **Yerleşik ajan** | ADN uygulamasının içindeki, kurallarla çalışan araştırma ajanı (LLM değil) |
| **LLM** | Büyük dil modeli; Claude, GPT gibi |
| **MCP (Model Context Protocol)** | Yapay zekâ asistanlarının dış araçlara takıldığı standart priz |
| **MCP sunucusu** | Bir hizmeti bu prize uygun hâle getiren küçük program; ADN'nin `src/mcp/server.ts` |
| **Elicitation** | MCP'de sunucunun, istemci üzerinden insana soru sorması (onay penceresi) |
| **Solana** | Hızlı ve ucuz işlemli bir blokzincir |
| **Devnet** | Solana'nın gerçek parasız deneme ağı; işlemler gerçek, para değersiz |
| **Mainnet** | Gerçek paralı ana ağ |
| **Yerel validator (localnet)** | Bilgisayarda çalışan özel, tek kişilik Solana ağı |
| **Program / akıllı sözleşme** | Zincirde çalışan, kurallarını kimsenin değiştiremediği kod (yükseltme yetkisi hariç) |
| **Anchor** | Solana programlarını Rust ile yazmayı kolaylaştıran çatı |
| **Instruction (talimat)** | Programa verilen tek bir komut; ör. `purchase_unit` |
| **İşlem (transaction)** | Bir ya da daha çok talimatın imzalı paketi; ya hepsi olur ya hiçbiri |
| **Atomik** | Bölünemez: tamamı gerçekleşir ya da hiçbiri |
| **İmza** | Cüzdan sahibinin "bu işlemi ben onaylıyorum" kanıtı; işlemin kimliği de imzadır |
| **Cüzdan / anahtar çifti** | Herkese açık adres + gizli anahtar; gizli anahtar imza atar |
| **PDA (Program Derived Address)** | Gizli anahtarı olmayan, yalnızca programın kontrol ettiği, tohumlardan hesaplanan adres |
| **Tohum (seed)** | PDA'yı hesaplamak için kullanılan değerler (ör. "receipt", alıcı, sipariş, varlık) |
| **SPL Token** | Solana'nın standart jeton sistemi |
| **Mint** | Bir jetonun "darphanesi"; ne kadar basılacağını mint yetkilisi belirler |
| **aUSD** | ADN'nin Devnet'teki 6 ondalıklı test stablecoin'i; gerçek değeri yok |
| **Stablecoin** | Değeri dolara sabitlenmiş jeton (gerçekte USDC gibi) |
| **Baz birim** | En küçük jeton birimi; 1 aUSD = 1 000 000 baz birim |
| **ATA (Associated Token Account)** | Bir cüzdanın belirli bir jeton için kanonik hesabı |
| **SOL / lamport** | Solana'nın yerel parası / en küçük birimi (1 SOL = 1 000 000 000 lamport); ücretler SOL ile |
| **Ücret (fee)** | İşlem başına ağ ücreti; burada 5 000 lamport |
| **Kira (rent)** | Hesabın zincirde durması için kilitlenen SOL depoziti |
| **CU (compute unit)** | İşlemin harcadığı hesaplama miktarı |
| **Finalized (kesinleşmiş)** | Geri alınamaz hâle gelmiş işlem durumu (~13 sn) |
| **Slot** | Solana'nın zaman dilimi numarası |
| **Explorer** | Zincirdeki işlemleri gösteren site (explorer.solana.com) |
| **Upgrade authority** | Programı yükseltebilen anahtar |
| **Hash (SHA-256)** | Verinin parmak izi; tek karakter değişse tamamen değişir |
| **İçerik hash'i / lisans hash'i** | Verinin baytlarının / lisans metninin parmak izi, zincirde |
| **Makbuz (receipt)** | Satın almanın zincirdeki değiştirilemez kaydı |
| **Bounty (ödül)** | Eksik veri için kasaya kilitlenen para |
| **Escrow (emanet) / kasa (vault)** | Paranın koşul gerçekleşene kadar bekletildiği hesap |
| **Order ID** | Bir siparişin 16 baytlık kimliği; tekrar oynatmayı engeller |
| **Tekrar oynatma (replay)** | Aynı işlemi/isteği ikinci kez kullanma saldırısı |
| **Alias (takma)** | Aynı kişinin iki rolde (ör. hem alıcı hem satıcı) görünmesi |
| **Nonce / challenge** | Tek kullanımlık rastgele mesaj; imzalanarak sahiplik kanıtlanır |
| **Snapshot** | Verinin doğrulanmış yedeği |
| **Fail closed** | Şüphe varsa güvenli tarafta kalıp hizmeti vermemek |
| **Güven katmanı (trust layer)** | Biçim, bütünlük, kurtarma ve köken kontrollerinin toplamı |
| **Provenance (köken)** | Verinin ilk kim tarafından listelendiği |
| **Provider-declared** | Sağlayıcının beyanı; platform doğrulamadı |
| **Harcama hakkı (allowance)** | İnsanın ajana onayladığı sabit bütçe |
| **Onay eşiği** | Bu tutarın üstündeki alımlar için insan onayı gerekir (varsayılan 0.1 aUSD) |
| **Tipli araç** | Girdi ve çıktısı tanımlı, sınırlı iş yapan araç (genel "imzala" aracının tersi) |
| **x402** | HTTP 402 tabanlı bir ödeme standardı; ADN'de kullanılmadı |
| **zkTLS** | Verinin belirli bir web sitesinden geldiğini sıfır bilgi ispatıyla kanıtlama tekniği |
| **Watermark (filigran)** | Alıcıya özel, fark edilmeyen iz; sızıntının kaynağını gösterir |
| **Stake (teminat)** | Kötü davranışta kaybedilen, önceden yatırılan para |
| **Cold start / tavuk-yumurta** | Satıcı yokken alıcı, alıcı yokken satıcı gelmemesi sorunu |
| **Disintermediation** | Alıcı ile satıcının platformu atlayıp doğrudan anlaşması |
| **Take rate** | Platformun komisyon oranı (%20) |
| **GMV** | Pazardaki toplam işlem hacmi |
| **Vercel** | Web sitelerini yayınlayan bulut servisi; canlı salt okunur kopya burada |
| **Headless** | Ekransız çalıştırma |
| **Smoke test** | Uygulamanın baştan sona temel olarak çalıştığını gösteren test |
