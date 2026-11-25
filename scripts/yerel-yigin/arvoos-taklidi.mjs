// ARVOOS KÖPRÜSÜNÜN YEREL TAKLİDİ (24.11.2026).
//
// Bireysel abonelik verisi ArvoOS'tan geliyor; yerel yığında o servis yok ve
// durum her zaman "unreachable" düşüyor. Ayarlar penceresinin abonelik
// sekmesinin VERİ DÖNEN yolunu (plan, durum, dönem bitişi, yerelleştirilmiş
// tarih) sınamak için sabit bir yanıt veren küçük bir sunucu.
//
// Yalnızca kabul içindir; ürün kodu değişmiyor, taklit ortam değişkeniyle
// devreye giriyor (ARVOOS_BRIDGE_URL).
import http from "node:http";

const PORT = Number(process.env.TAKLIT_PORT ?? 54777);
/* Dönem bitişi kabul metninde birebir aranıyor: 23 Mayıs 2027. */
const DONEM_BITISI = process.env.TAKLIT_DONEM_BITISI ?? "2027-05-23T00:00:00.000Z";
/* Deneme bitişi: kabul metninde birebir aranıyor. */
const DENEME_BITISI = process.env.TAKLIT_DENEME_BITISI ?? "2026-12-08T00:00:00.000Z";


/*
  İKİ KATALOG BİÇİMİ, AYRI AYRI (24.11.2026).

  KATALOG_BUGUN gerçek ArvoOS'un BUGÜN bildirdiği biçim: yalnızca kod,
  dönem ve tutar. Ad ve plana dahil kredi YOK — ArvoOS ücreti tek bir
  `individual_monthly_fee` sütununda tutuyor (lib/billing-plan.ts'teki
  kayıtlı gözlem) ve kademe kavramı iki tarafta da yok. Varsayılan bu:
  kabul, müşterinin ÜRETİMDE gördüğü ekranı ölçmeli.

  KATALOG_DOLU ArvoOS adı ve krediyi bildirmeye BAŞLADIĞINDA oluşacak
  biçim; e-postası "ayar-katalog" ile başlayan kullanıcıya veriliyor ki
  karşılaştırma penceresinin dolu hâli de ölçülebilsin. Bu listedeki
  "Standart / Plus / Pro" ve fiyatlar UYDURMA örnek değerlerdir; gerçek
  katalogda karşılığı yoktur.

  PAKETLER'in biçimi gerçek (ArvoOS lib/ai-kredi-paketleri.ts, alanlar
  kod/ad/kredi/fiyat), ama buradaki MİKTAR ve FİYATLAR da uydurma örnek
  değerlerdir.
*/
const KATALOG_BUGUN = [
  { code: "arvolab-aylik", interval: "month", price: 14900 },
  { code: "arvolab-yillik", interval: "year", price: 149000 },
];

const KATALOG_DOLU = [
  { code: "standart-ay", ad: "Standart", interval: "month", price: 14900, kredi: 1000,
    avantajlar: ["3 çalışma", "Kaynakça ve atıf denetimi"] },
  { code: "plus-ay", ad: "Plus", interval: "month", price: 24900, kredi: 2500,
    avantajlar: ["10 çalışma", "Literatür tarama asistanı", "Danışman paylaşımı"] },
  { code: "pro-ay", ad: "Pro", interval: "month", price: 39900, kredi: 6000,
    avantajlar: ["Sınırsız çalışma", "Öncelikli destek", "Makale çalışma alanı"] },
  { code: "standart-yil", ad: "Standart", interval: "year", price: 149000, kredi: 1000,
    avantajlar: ["3 çalışma", "Kaynakça ve atıf denetimi"] },
  { code: "pro-yil", ad: "Pro", interval: "year", price: 399000, kredi: 6000,
    avantajlar: ["Sınırsız çalışma", "Öncelikli destek"] },
];

/*
  ÖDEME SENARYOLARI (25.11.2026). Gerçek akış: ArvoLab checkout ister,
  ArvoOS bir ödeme adresi döndürür, kullanıcı orada öder ve ONAYI
  ArvoOS alır; ArvoLab bir sonraki "ensure"da yeni durumu okur.
  Taklit bunu şöyle canlandırıyor:
    - checkout → uygulamaya geri dönen bir adres verir,
    - "başarı" senaryosunda abonelik BELLEKTE etkinleşir (seçilen kodla),
    - "iptal" ve "hata" senaryolarında hiçbir şey değişmez; kullanıcı
      denemede kalır — ürünün davranışı da bu olmalı.
  Senaryo e-postadan: ...-basari, ...-iptal, ...-hata.
*/
const ETKINLESENLER = new Map();
const senaryo = (eposta) =>
  eposta.includes("-basari") ? "basari" : eposta.includes("-iptal") ? "iptal" : eposta.includes("-hata") ? "hata" : null;

const PAKETLER = [
  { kod: "k250", ad: "250 kredi", kredi: 250, fiyat: 12500 },
  { kod: "k500", ad: "500 kredi", kredi: 500, fiyat: 22500 },
  { kod: "k1000", ad: "1.000 kredi", kredi: 1000, fiyat: 40000 },
];

/*
  Dolu katalog senaryosunda abonenin plan kodu. E-posta hangi kademeyi
  istediğini söylüyor: ayar-katalog-std → Standart, -plus → Plus,
  başka her "ayar-katalog…" → Pro.
*/
function planKodu(eposta) {
  if (!eposta.startsWith("ayar-katalog")) return null;
  if (eposta.startsWith("ayar-katalog-std")) return "standart-ay";
  if (eposta.startsWith("ayar-katalog-plus")) return "plus-ay";
  return "pro-ay";
}

const sunucu = http.createServer((istek, yanit) => {
  if (istek.method !== "POST" || !istek.url?.startsWith("/api/bridge/subscription")) {
    yanit.writeHead(404).end("yok");
    return;
  }
  let govde = "";
  istek.on("data", (parca) => (govde += parca));
  istek.on("end", () => {
    let eylem = "ensure";
    let eposta = "";
    let secilenPlan = null;
    try {
      const g = JSON.parse(govde);
      eylem = g.action ?? "ensure";
      eposta = String(g.email ?? "");
      secilenPlan = typeof g.plan === "string" && g.plan ? g.plan : null;
    } catch { /* biçim bozuksa varsayılan */ }

    /*
      CHECKOUT: gerçek ArvoOS bir ödeme adresi döndürüyor. Taklit
      uygulamaya geri dönen bir adres veriyor ve senaryoya göre:
        başarı → aboneliği SEÇİLEN KODLA etkinleştiriyor (ArvoOS'un
                 PayTR onayından sonra yaptığı şeyin karşılığı),
        iptal  → hiçbir şey değiştirmiyor, kullanıcı denemede kalıyor,
        hata   → ödeme adresi vermiyor; ürün "ödeme başlatılamadı" der
                 ve üyelik yine denemede kalır.
    */
    if (eylem === "checkout") {
      const s = senaryo(eposta);
      if (s === "hata") {
        yanit.writeHead(409, { "content-type": "application/json" }).end(JSON.stringify({ error: "fee_not_set" }));
        return;
      }
      if (s === "basari" && secilenPlan) ETKINLESENLER.set(eposta, secilenPlan);
      /* Ürün yalnızca https adresine gidiyor (payArvolabSubscription:
         köprü yanıtı bozulursa başka şemaya gidilmesin). Taklit ödeme
         sayfası bu yüzden https; kabul betiği bu adresi yakalayıp
         uygulamaya geri yönlendiriyor. */
      const donus = s === "iptal" ? "kart=hata" : "kart=tamam";
      yanit.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ checkoutUrl: `https://odeme.arvoos.taklit/ode?senaryo=${s ?? "basari"}&plan=${encodeURIComponent(secilenPlan ?? "")}&donus=${encodeURIComponent(donus)}` }));
      return;
    }
    /*
      "ulaşılamıyor" yolunu da sınayabilmek için: e-postası ayar-kopuk ile
      başlayan kullanıcıya 503. Ürün bunu geçici arıza sayıp durumu
      "unreachable" yapıyor ve kimseyi engellemiyor.
    */
    if (eposta.startsWith("ayar-kopuk")) {
      yanit.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: "taklit: ulaşılamıyor" }));
      return;
    }
    const cevap =
      eylem === "close"
        ? { closed: true }
        : {
            /* DENEME durumu ayrı bir kullanıcıyla sınanıyor: e-postası
               "ayar-deneme" ile başlayana ArvoOS'un deneme yanıtı
               veriliyor (status trialing + trialEndsAt). Üretimde yeni
               açılan her bireysel hesap bu durumda başlıyor. */
            status: ETKINLESENLER.has(eposta)
              ? "active"
              : eposta.startsWith("ayar-deneme") || senaryo(eposta) ? "trialing" : "active",
            access: true,
            trialEndsAt: ETKINLESENLER.has(eposta)
              ? null
              : eposta.startsWith("ayar-deneme") || senaryo(eposta) ? DENEME_BITISI : null,
            currentPeriodEnd: ETKINLESENLER.has(eposta) || !(eposta.startsWith("ayar-deneme") || senaryo(eposta)) ? DONEM_BITISI : null,
            plans: eposta.startsWith("ayar-katalog") || senaryo(eposta) ? KATALOG_DOLU : KATALOG_BUGUN,
            /* ABONENİN PLAN KODU. Gerçek ArvoOS bugün bildirmiyor;
               yalnızca dolu katalog senaryosunda veriliyor ki "Üyelik
               tipi" satırının ve "Mevcut plan" işaretinin DOLU hâli de
               ölçülebilsin. Kademe e-postadan seçiliyor: üç kademenin
               ÜÇÜ DE ayrı ayrı sınanabilsin diye (yalnızca Pro'yu
               görmek, etiketin plana göre değiştiğini göstermezdi). */
            /* Ödeme öncesi (deneme) plan kodu BİLDİRİLMİYOR: denemedeki
               hesap ücretli bir planın adını taşımamalı. Etkinleşince
               seçilen kod bildiriliyor. */
            ...(ETKINLESENLER.has(eposta)
              ? { planCode: ETKINLESENLER.get(eposta) }
              : senaryo(eposta) ? {} : planKodu(eposta) ? { planCode: planKodu(eposta) } : {}),
            /* Kredi paketleri okuyucunun beklediği anahtarla: creditPackages. */
            creditPackages: PAKETLER,
            cardStorage: false,
          };
    yanit.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(cevap));
  });
});
sunucu.listen(PORT, "127.0.0.1", () => console.log(`arvoos taklidi: http://127.0.0.1:${PORT}`));
