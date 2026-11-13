/*
  Asistanın ikinci yeteneği: kaynakçayı DENETLER.

  Neden asistan: mekanik denetim zaten var (lib/apa7.ts ayrıştırıyor,
  lib/academic-reference-verification.ts Crossref/OpenAlex'te arıyor). Onun
  söyleyemediği üç şey var:
    - "Bulunamadı" her zaman hata değildir. Türkçe bir tez, kurum raporu ya
      da yerel dergi bu dizinlerde yoktur; asistan beklenen yoklukla gerçek
      şüpheyi ayırır. Aksi halde kullanıcı 25 kırmızı satır görüp hepsini
      görmezden gelmeyi öğreniyor.
    - Ayrıştırıcının göremediği biçim hataları (baş harf düzeni, "ve"/"&",
      basım yeri, cilt-sayı yazımı).
    - Önceliklendirme: jüri için hangisi gerçekten sorun.
    - ATIF–KAYNAKÇA UYUMU: mekanik karşılaştırma (lib/apa7.ts) yazar
      anahtarı ve yılın TAM eşleşmesini arıyor. Metinde "Demir (2020)",
      kaynakçada "Demir, A. (2021)" yazıyorsa bunu iki ayrı sorun olarak
      raporluyor — "karşılıksız atıf" ve "atıfsız kaynak". Oysa tek bir
      sorun var: yıl tutmuyor. Asistan bu ikilileri eşleştirir. Aynı şey
      yazım farkları (Yılmaz/Yilmaz), "vd."/"et al." kullanımı ve aynı
      yazarın aynı yıldaki iki kaynağı (2020a/2020b) için de geçerli.

  Sınır aynı: DENETLER, YAZMAZ. Düzeltilmiş kaynakça satırı ürettirmiyoruz —
  hem "yazmaz" kuralını çiğner hem de uydurmanın en kolay olduğu yer orasıdır
  (var olmayan DOI, yanlış cilt numarası). Sayı denetimi (lib/ai/bulgu.ts)
  uydurulan yılı ve numarayı yakalar; uydurulmuş bir yazar adını yakalayamaz,
  bu yüzden kural istem seviyesinde de yazılı.

  Saf modül; testi tests/unit/ai-kaynakca-denetimi.test.ts.
*/

import { stilTanimi } from "@/lib/atif/stiller";
import type { Dil } from "@/lib/dil";
import { baglamKur, type BaglamParca } from "./baglam";
import { YANIT_BICIMI, cikisDiliMesaji, dilliKaynak, jsonOku, type Bulgu } from "./bulgu";
import type { Mesaj } from "./saglayici";
import type { DogrulamaDurumu } from "@/lib/academic-reference-verification";

/* Dizin sonucu tek yerde tanımlı (lib/academic-reference-verification.ts). */
export type KaynakDurumu = DogrulamaDurumu;

export type KaynakSatiri = {
  sira: number;
  ham: string;
  durum: KaynakDurumu;
  /** Ayrıştırıcının bulduğu biçim sorunları (lib/apa7.ts). */
  bicimSorunlari?: string[];
  /** Dizinde bulunan en iyi eşleşmenin başlığı; "olası eşleşme" ayrımı için. */
  eslesmeBasligi?: string | null;
};

export type KaynakcaGirdisi = {
  /** Kullanıcının arayüz dili: bulgular bu dilde yazılır (lib/ai/bulgu.ts, cikisDiliMesaji). */
  dil?: Dil;
  /** Bağlı akademik çalışmanın künyesi (lib/ai/calisma-baglami.ts). */
  calisma?: string;
  kaynaklar: KaynakSatiri[];
  /** Metinde geçip kaynakçada olmayan atıflar. */
  eksikKaynaklar?: string[];
  /** Kaynakçada olup metinde hiç atıf yapılmayanlar. */
  kullanilmayanKaynaklar?: string[];
  /** Metindeki bütün atıflar; eşleştirme bunlarsız yapılamaz. */
  atiflar?: string[];
  /* Çalışmanın atıf sistemi (thesis_guidelines.citation_style).
     Bilinmiyorsa model belirli bir sistemin kuralını varsaymıyor. */
  atifStili?: string | null;
};

export const BAGLAM_BUTCESI = 9000;

const DURUM_ETIKETI: Record<KaynakDurumu, string> = {
  verified: "dizinde doğrulandı",
  possible_match: "olası eşleşme",
  not_found: "dizinde bulunamadı",
  insufficient_data: "ayrıştırılamadı (veri yetersiz)",
  /* Hüküm değil. Etiket bunu modele açıkça söylüyor; istemdeki kural da
     bu kayıtlar için şüphe bulgusu yazılmasını yasaklıyor (12.11.2026). */
  ulasilamadi: "dizine ulaşılamadı (geçici erişim sorunu; dizinde olup olmadığı BİLİNMİYOR)",
};

/*
  SİSTEM İSTEMİ ATIF SİSTEMİNİ ADIYLA SÖYLER (25.10.2026).

  Önceden sabitti: "Sen APA 7 kaynakça denetçisisin" ve "APA 7 biçim
  hatalarını grupla". Oysa atıf sistemi kılavuzdan geliyor ve beş
  seçenek var (lib/atif/stiller). Kılavuzu IEEE diyen öğrencinin
  kaynakçası APA kurallarına göre denetleniyor, üstelik asistan
  "APA 7 biçim hatası" diye bulgu yazıyordu — onun kılavuzunda
  hata olmayan bir şey için.

  Çalışma bağlamında stil zaten yazılıydı ama sistem istemi modelin
  KİMLİĞİNİ belirliyor ve bağlamdaki bir not onu ezmiyor.

  STİL BİLİNMİYORSA ADI HİÇ GEÇMİYOR ve modele açıkça "bir sistem
  varsayma" deniyor: yanlış sistemle denetlemek, denetlememekten
  kötüdür.
*/
export function sistemIstemi(stil?: string | null): string {
  const tanim = stil ? stilTanimi(stil) : null;
  const kimlik = tanim
    ? `Sen ${tanim.ad} kaynakça denetçisisin.`
    : "Sen akademik kaynakça denetçisisin. Çalışmanın atıf sistemi BİLİNMİYOR: " +
      "belirli bir sistemin kuralını varsayma, yalnızca sistemden bağımsız " +
      "tutarsızlıkları (eksik alan, çelişen yıl, karşılıksız atıf) bildir.";
  const bicimKurali = tanim
    ? `- ${tanim.ad} biçim hatalarını grupla:`
    : "- Biçim hatalarını grupla:";
  return KAYNAKCA_ISTEMI_GOVDESI.replace("{{KIMLIK}}", kimlik).replace("{{BICIM_KURALI}}", bicimKurali);
}

const KAYNAKCA_ISTEMI_GOVDESI = `{{KIMLIK}} Sana bir araştırmacının kaynakça listesi, her kaydın dizin (Crossref/OpenAlex) sonucu ve metin içi atıf tutarsızlıkları verilecek.

GÖREVİN: Listeyi denetlemek ve gerçekten sorun olanları önceliklendirmek.
- "dizinde bulunamadı" tek başına hata değildir: Türkçe tezler, kurum raporları, kitap bölümleri ve yerel dergiler bu dizinlerde çoğu zaman yer almaz. Böyle kayıtlar için beklenen bir durum olduğunu söyle, şüpheyi gerçekten tuhaf olanlara sakla (ör. uluslararası bir dergi makalesi gibi görünüp bulunamayan kayıt).
- "dizine ulaşılamadı" bir sonuç DEĞİLDİR: dizin o sırada cevap vermedi. Bu kayıtlar için kaynağın bulunamadığını, şüpheli ya da uydurma olabileceğini ASLA söyleme. Gerekirse tek bir bulguda denetimin tekrar çalıştırılmasını öner.
- Bir bulgu belirli kaynaklarla ilgiliyse açıklamada sıra numaralarını köşeli parantezle yaz (ör. [3], [7]) ve bulgu nesnesine "kaynaklar" alanını ekle (ör. "kaynaklar": [3, 7]). Belirli bir kaynağa bağlı olmayan bulguda (ör. karşılıksız atıf) "kaynaklar": [] yaz. Öteki alanlar aynen kalır.
- "olası eşleşme" kayıtlarında kullanıcıyı neyin kontrol etmesi gerektiğini söyle (yıl, cilt, yazar sırası gibi ALANIN ADINI söyle, değerini yazma).
{{BICIM_KURALI}} aynı hata 10 kayıtta varsa tek bir bulgu yaz, kaç kayıtta olduğunu sayı olarak değil "birden çok kayıtta" diye belirt.
- Metinde geçip kaynakçada olmayan atıflar en ciddi sorundur; varsa ilk bulgu o olsun.

ATIF–KAYNAKÇA UYUMU (bu denetimi mutlaka yap):
Sana verilen "karşılıksız atıf" ve "atıfsız kaynak" listeleri mekanik karşılaştırmadan geliyor; yazar ve yılın TAM eşleşmesini arıyor. İki listeyi yan yana koy ve aynı kaynağı gösteren ikilileri eşleştir:
- Yıl tutmuyor (metinde bir yıl, kaynakçada başka bir yıl): tek bir sorundur, iki ayrı değil. Hangisinin doğru olduğunu SÖYLEME, kaynağın aslından doğrulanması gerektiğini söyle.
- Yazar adı yazım farkı (Türkçe karakter, çift soyadı, kurum adı kısaltması).
- Metinde "vd."/"et al." kullanılmış ama kaynakçadaki yazar sayısı bu kullanımı gerektirmiyor ya da tersi.
- Aynı yazarın aynı yıldaki birden çok kaynağı: kaynakçada 2020a/2020b ayrımı yapılmamışsa metindeki atıf hangisini gösterdiği belirsiz kalır.
- Eşleşmeyi kuramadığın atıf gerçekten eksik kaynaktır; bunu ayrı bir bulguda topla.
Eşleştirmede emin değilsen "aynı kaynak olabilir, kontrol edin" de; kesinmiş gibi yazma.

KESİNLİKLE YAPMAYACAKLARIN:
1. Düzeltilmiş kaynakça satırı YAZMA. Kullanıcının kopyalayıp yapıştırabileceği hiçbir künye üretme; neyin yanlış olduğunu söyle, doğrusunu yazma.
2. DOI, yıl, cilt, sayı, sayfa aralığı ya da yazar adı UYDURMA. Sana verilmeyen hiçbir künye bilgisini "doğrusu şu" diye yazma; bilmiyorsan "kaynağın aslından doğrulayın" de.
3. Sana verilmeyen hiçbir sayı yazma. Kaç kayıtta sorun olduğunu sayıyla değil sözle ifade et.
4. Kaynakların bilimsel kalitesi, dergi itibarı ya da güncelliği hakkında yorum yapma; görevin biçim ve tutarlılık denetimi.

${YANIT_BICIMI}`;

/** Kaynak listesini modele okunur, kısa bir tabloya çevirir. */
export function kaynakOzeti(kaynaklar: KaynakSatiri[]): string {
  return kaynaklar
    .map((kaynak) => {
      const parcalar = [`[${kaynak.sira}] ${DURUM_ETIKETI[kaynak.durum]}`];
      if (kaynak.eslesmeBasligi) parcalar.push(`dizindeki başlık: ${kaynak.eslesmeBasligi}`);
      if (kaynak.bicimSorunlari?.length) parcalar.push(`biçim: ${kaynak.bicimSorunlari.join("; ")}`);
      return `${parcalar.join(" · ")}\n${kaynak.ham}`;
    })
    .join("\n\n");
}

/** Modele gönderilecek mesajlar ve doğrulamada kaynak sayılacak metin. */
export function kaynakcaIstemi(girdi: KaynakcaGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
{ baslik: "Çalışma", metin: girdi.calisma ?? "", oncelik: 1 },
        {
      baslik: "Metinde geçip kaynakçada olmayan atıflar",
      metin: (girdi.eksikKaynaklar ?? []).join("\n"),
      oncelik: 1,
    },
    // Eşleştirme bu iki listeyi yan yana koymayı gerektiriyor; ikisi de
    // kaynak künyelerinden önce gelir, yoksa uyum denetimi hiç yapılamaz.
    {
      baslik: "Kaynakçada olup metinde atıf yapılmayanlar",
      metin: (girdi.kullanilmayanKaynaklar ?? []).join("\n"),
      oncelik: 1,
    },
    { baslik: "Metindeki bütün atıflar", metin: (girdi.atiflar ?? []).join(", "), oncelik: 2 },
    { baslik: "Kaynakça ve dizin sonuçları", metin: kaynakOzeti(girdi.kaynaklar), oncelik: 3 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: sistemIstemi(girdi.atifStili) },
    ...cikisDiliMesaji(girdi.dil),
    { rol: "kullanici", metin: baglam.metin },
  ];
  return { mesajlar, kaynak: dilliKaynak(baglam.metin, girdi.dil), kirpilanlar: baglam.kirpilanlar };
}

/*
  ULAŞILAMAYAN KÜNYE HAKKINDA HÜKÜM: DETERMİNİSTİK SON DOĞRULAMA (T1, 14.11.2026).

  İstem, "dizine ulaşılamadı" kayıtları için "bulunamadı / şüpheli / uydurma"
  demeyi yasaklıyor; ama yalnızca istem düzeyinde bir yasak, modelin ona
  uyduğunu kimse denetlemiyordu. Dizin o sırada cevap vermediyse kaynağın
  dizinde olup olmadığı BİLİNMİYOR; öğrenciye "bu kaynak uydurma olabilir"
  demek, doğru yazdığı kaynağı jüriden önce şüpheli göstermektir.

  Yalnızca anahtar sözcüğe bakan bir süzgeç geçerli bulguları da silerdi
  ("kaynakçada bulunamadı" bir atıf–kaynakça bulgusudur, "uydurma olduğu
  anlamına gelmez" bir uyarıdır). Bu yüzden bir bulgu ancak ÜÇ koşul
  birlikte sağlanınca ayıklanır:
    1. Girdide en az bir "ulasilamadi" kaydı var (yoksa hiçbir şey değişmez).
    2. Bulgunun en az bir cümlesi olumsuz bir dizin/özgünlük hükmü kuruyor
       ve aynı cümle bu hükmü olumsuzlamıyor ya da erişim sorununa
       bağlamıyor.
    3. Hüküm yalnızca ulaşılamayan kayıtlara yöneliyor:
       - bulgu kaynak numarası veriyorsa ("kaynaklar" alanı ya da metindeki
         [n]), verdiği numaraların HEPSİ ulaşılamayan kayıt olmalı; karışık
         atıf (bir de "bulunamadı" kaydı varsa) silinmez, çünkü o kayıt için
         geçerli bir uyarı olabilir;
       - numara vermiyorsa, yalnızca güçlü bir hüküm (uydurma, şüpheli,
         dizinde yok …) sayılır ve yalnızca girdide hükmün yönelebileceği
         başka bir kayıt (bulunamadı, olası eşleşme, veri yetersiz) yoksa
         silinir.
  Ayıklanan bulgu kullanıcıya hiç gösterilmez; ham çıktı kayıtta aynen kalır
  (lib/ai/kayit.ts), gösterilen bulgular ayrı sütunda.
*/

/* Güçlü hüküm: kaynağın dizinde olmadığını ya da özgün olmadığını söyler. */
const GUCLU_HUKUM = [
  /uydurma/u,
  /sahte/u,
  /şüpheli/u,
  /kuşkulu/u,
  /güvenilmez/u,
  /var\s+olmay/u,
  /gerçek\s+olmay/u,
  /doğrulanamad/u,
  /dizin(?:de|lerde)\s+(?:bulunam|bulunmuyor|yer\s+alm|yok)/u,
  /(?:crossref|openalex)\S*\s+(?:bulunam|bulunmuyor|yer\s+alm|yok)/u,
  /fabricat/u,
  /\bfake\b/u,
  /suspicious/u,
  /questionable/u,
  /(?:may|might)\s+not\s+exist/u,
  /does\s+not\s+exist/u,
  /could\s*(?:not|n['’]t)\s+be\s+(?:verified|found)/u,
  /not\s+(?:found|listed)\s+in\s+(?:the\s+)?(?:index|indexes|crossref|openalex)/u,
  /not\s+indexed/u,
];
/* Zayıf hüküm: yalnızca bulgu numarayla ulaşılamayan bir kaydı gösteriyorsa sayılır. */
const ZAYIF_HUKUM = [/bulunam/u, /bulunmuyor/u, /yer\s+alm[ıi]yor/u, /\bnot\s+found\b/u];
/* Aynı cümlede bunlar varsa hüküm kurulmamıştır: olumsuzlama ya da erişim sorunu. */
const HUKUM_DEGIL = [
  /anlamına\s+gelm/u,
  /\bdeğil/u,
  /sayılmaz/u,
  /denemez/u,
  /söylenemez/u,
  /bilinmiyor/u,
  /ulaşılamad/u,
  /erişilemed/u,
  /erişim\s+sorun/u,
  /yeniden\s+(?:çalıştır|dene)/u,
  /tekrar\s+(?:çalıştır|dene)/u,
  /does\s*(?:not|n['’]t)\s+mean/u,
  /not\s+necessarily/u,
  /cannot\s+be\s+concluded/u,
  /\bunknown\b/u,
  /unreachable/u,
  /could\s*(?:not|n['’]t)\s+be\s+reached/u,
  /\bre-?run\b/u,
];
/* Atıf–kaynakça bulgusu: "kaynakçada bulunamadı" dizin hükmü değildir. */
const ATIF_BAGLAMI = /kaynakçada|kaynakça\s+listesinde|in\s+the\s+reference\s+list|reference\s+list/u;

const kucuk = (metin: string) => metin.toLocaleLowerCase("tr");
const cumleler = (metin: string) => metin.split(/(?<=[.!?;])\s+/u).filter(Boolean);

function hukumKuruyor(bulgu: Bulgu, zayifDahil: boolean): boolean {
  return cumleler(kucuk(`${bulgu.baslik}. ${bulgu.aciklama}`)).some((cumle) => {
    if (HUKUM_DEGIL.some((kalip) => kalip.test(cumle))) return false;
    if (GUCLU_HUKUM.some((kalip) => kalip.test(cumle))) return true;
    return zayifDahil && !ATIF_BAGLAMI.test(cumle) && ZAYIF_HUKUM.some((kalip) => kalip.test(cumle));
  });
}

/** Bulgu metninde geçen kaynak sıra numaraları: [3], "kaynak 3", "3. kaynak", #3. */
export function metindekiKaynaklar(metin: string): number[] {
  const bulunan = new Set<number>();
  const kaliplar = [
    /\[(\d{1,3})\]/gu,
    /(?:kaynak|kayıt|reference|source)\s*(?:no\.?\s*)?#?\s*(\d{1,3})\b/giu,
    /\b(\d{1,3})\.\s*(?:kaynak|kayıt)/giu,
    /#(\d{1,3})\b/gu,
  ];
  for (const kalip of kaliplar) for (const eslesme of metin.matchAll(kalip)) bulunan.add(Number(eslesme[1]));
  return [...bulunan];
}

const anahtar = (baslik: unknown, aciklama: unknown) =>
  `${String(baslik ?? "").replace(/\s+/g, " ").trim().slice(0, 60)}\u0000${String(aciklama ?? "").replace(/\s+/g, " ").trim().slice(0, 400)}`;

/**
 * Ham yanıttaki "kaynaklar" alanları; anahtar bulgunun başlık+açıklaması
 * (bulgulariCozumle ile aynı kırpma). Sıraya güvenilmiyor: çözümleyici
 * eksik satırları atıyor, dizin kayabilir.
 */
export function yapisalKaynaklar(ham: string): Map<string, number[]> {
  const harita = new Map<string, number[]>();
  const liste = (jsonOku(ham) as { bulgular?: unknown } | null)?.bulgular;
  if (!Array.isArray(liste)) return harita;
  for (const satir of liste) {
    const row = (satir ?? {}) as Record<string, unknown>;
    if (!Array.isArray(row.kaynaklar)) continue;
    const numaralar = row.kaynaklar.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 1000);
    harita.set(anahtar(row.baslik, row.aciklama), numaralar);
  }
  return harita;
}

export type HukumAyiklama = { gecerli: Bulgu[]; ayiklanan: Bulgu[] };

/** Ulaşılamayan künyeler hakkında hüküm kuran bulguları ayıklar (yukarıdaki üç koşul). */
export function ulasilamadiHukmunuAyikla(
  bulgular: Bulgu[],
  kaynaklar: Pick<KaynakSatiri, "sira" | "durum">[],
  yapisal: Map<string, number[]> = new Map(),
): HukumAyiklama {
  const ulasilamayan = new Set(kaynaklar.filter((k) => k.durum === "ulasilamadi").map((k) => k.sira));
  if (!ulasilamayan.size) return { gecerli: bulgular, ayiklanan: [] };
  const mevcut = new Set(kaynaklar.map((k) => k.sira));
  // Numara vermeyen bir hükmün yönelebileceği başka kayıt var mı?
  const baskaHedefVar = kaynaklar.some((k) => k.durum === "not_found" || k.durum === "possible_match" || k.durum === "insufficient_data");

  const gecerli: Bulgu[] = [];
  const ayiklanan: Bulgu[] = [];
  for (const bulgu of bulgular) {
    const numaralar = [
      ...new Set([...(yapisal.get(anahtar(bulgu.baslik, bulgu.aciklama)) ?? []), ...metindekiKaynaklar(`${bulgu.baslik} ${bulgu.aciklama}`)]),
    ].filter((n) => mevcut.has(n));
    const sil = numaralar.length
      ? numaralar.every((n) => ulasilamayan.has(n)) && hukumKuruyor(bulgu, true)
      : !baskaHedefVar && hukumKuruyor(bulgu, false);
    (sil ? ayiklanan : gecerli).push(bulgu);
  }
  return { gecerli, ayiklanan };
}
