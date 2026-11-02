/*
  KILAVUZ KURALLARINI YAPAY ZEKÂYLA OKUMA (02.11.2026, kurum sahibinin
  isteği: "üniversiteden üniversiteye kurallar değişiyor, gelen evrağa göre
  esneyebilsin; her müşteri için sıfırdan kural üretmeyelim, yapay zekâ
  kurallar konusunda aktif olsun").

  Kalıpla okuma (lib/guideline-scan.ts) her yeni yazım biçiminde elle
  genişletiliyordu: DEÜ SBE'nin "Satır Aralıkları : 1,5" tablosu, "İki
  yana yaslanmış" içindeki büyük İ, "Arial 11 / Times New Roman 12"
  eşlemesi. Model metni bağlamıyla okuyor; kalıp yedek olarak kalıyor.

  UYDURMAYA KARŞI (AGENTS.md: "asistanın ürettiği her sayı girdide geçmek
  zorunda"): her kural kılavuzdan BİREBİR bir alıntıyla gelir.
    - Alıntı kılavuz metninde geçmeli (boşluk, satır sonu, tırnak ve büyük/
      küçük harf farkı gözetilmez).
    - Kuraldaki her sayı kendi alıntısında geçmeli: "üst 3 cm" kuralının
      alıntısı "Üst boşluk (top) : 3 cm" ise 3 orada yazıyor.
    - Bölüm adları kılavuz metninde geçmeli.
  Tek bir ihlal varsa yanıtın TAMAMI düşer ve kalıpla okunan kurallar
  kullanılır (kısmen doğru bir kural listesinde hangisinin uydurulduğunu
  öğrenci ayıklayamaz). Çıkarılan kurallar öğrenciye alıntılarıyla
  gösterilir ve onaylanmadan uygulanmaz.

  Saf modül; testi tests/unit/kilavuz-kurallari.test.ts.
*/

import { jsonOku } from "./bulgu";
import { sayiOkumalari } from "./sayi-denetimi";
import type { Mesaj } from "./saglayici";

export const KILAVUZ_METIN_BUTCESI = 45_000;

const YAZI_TIPLERI = ["Times New Roman", "Arial", "Calibri", "Cambria", "Garamond", "Georgia", "Verdana", "Book Antiqua"];
const ATIF_STILLERI = ["apa7", "harvard", "chicago", "ieee", "vancouver", "mla", "dipnot"];
const SAYFA_NUMARASI = ["bottom-center", "bottom-right", "top-center", "top-right"];

export const KILAVUZ_ISTEMI = `Sen bir veri çıkarma aracısın. Sana bir üniversitenin tez yazım kılavuzunun metni verilecek. Görevin, kılavuzun BİÇİM kurallarını yapılandırılmış bir listeye çevirmek.

KURALLAR:
- Yalnızca metinde AÇIKÇA YAZAN kuralları çıkar. Tahmin etme, genel bilgiyle doldurma; metinde yoksa o alanı hiç yazma.
- Her kuralın "alinti" alanına, kuralı söyleyen metin parçasını KELİMESİ KELİMESİNE kopyala (6–300 karakter). Kuraldaki sayı alıntıda geçmeli. Alıntıyı değiştirme, kısaltma, düzeltme.
- Gövde metnine ait kuralları al; başlık, tablo, dipnot ya da kapak için verilen ölçüleri gövdeninkiyle karıştırma.
- Birden fazla seçeneğe izin veriliyorsa (ör. "Arial veya Times New Roman") yazı tipi olarak ilk geçen değil Times New Roman varsa onu, puntoyu da o yazı tipininkini seç.
- Ölçüler: cm, punto (pt / nk), satır aralığı çarpanı (1, 1,5, 2).

ALANLAR (hepsi isteğe bağlı; her biri {"deger": …, "alinti": "…"}):
- kenar_ust_cm, kenar_alt_cm, kenar_sol_cm, kenar_sag_cm: sayı
- yazi_tipi: ${YAZI_TIPLERI.map((y) => `"${y}"`).join(", ")}
- punto: gövde yazı boyutu (sayı)
- satir_araligi: gövde satır aralığı çarpanı (sayı)
- paragraf_girintisi_cm: ilk satır girintisi (sayı)
- paragraf_once_nk, paragraf_sonra_nk: paragraf öncesi/sonrası boşluk (sayı)
- iki_yana_yasla: true/false
- dipnot_punto: dipnot yazı boyutu (sayı)
- kagit: "a4" | "letter"
- sayfa_numarasi_yeri: ${SAYFA_NUMARASI.map((y) => `"${y}"`).join(" | ")}
- on_sayfalar_romen: ön sayfalar Romen rakamıyla, Giriş'ten itibaren 1 ise true
- baslik_numaralandirma: başlıklar ondalık numaralanıyorsa (1., 1.1.) true
- bolum_buyuk_harf: ana bölüm başlıkları büyük harfle ise true
- bolum_yeni_sayfa: her ana bölüm yeni sayfadan başlıyorsa true
- bolum_hizasi: "center" | "left"
- sola_yasli_bolumler: bölümler ortalanırken sola yaslanan ana başlıklar (ör. ["Giriş", "Sonuç", "Kaynakça"])
- numarasiz_bolumler: numaralandırılmayan ana başlıklar (ör. ["Giriş", "Sonuç"])
- alt_baslik_girintisi: {"duzey": 2|3|4, "cm": sayı} — duzey, girintinin başladığı başlık düzeyi (birinci derece alt başlık = 2)
- ozet_en_cok_kelime, ozet_en_az_kelime, anahtar_kelime_en_az, anahtar_kelime_en_cok: sayı
- en_az_sayfa, en_cok_sayfa: tezin sayfa sınırı (sayı)
- atif_stili: ${ATIF_STILLERI.map((y) => `"${y}"`).join(" | ")} — yalnızca metin bu sistemi ADIYLA söylüyorsa; yalnızca dipnot yöntemini anlatıyorsa "dipnot". İki yöntemi birden serbest bırakıyorsa yazma.
- zorunlu_bolumler: tezin zorunlu ana bölümleri, metindeki adlarıyla (ör. ["Özet", "Giriş", "Sonuç", "Kaynakça"]); alintisi bölümlerin sayıldığı yer.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma (kod bloğu ya da \`\`\` kullanma). Geçerli JSON yaz: alıntıdaki çift tırnağı \\" olarak kaçışla, alıntıya satır sonu koyma.
{"kurallar":{"kenar_ust_cm":{"deger":3,"alinti":"Üst boşluk (top) : 3 cm"}}}`;

/*
  Kılavuzlar uzun (DEÜ SBE 30 sayfa, bazıları 80); biçim kuralları birkaç
  sayfada. Bütçe aşılırsa yalnızca biçim sözcüğü geçen satırlar ve
  çevreleri gönderiliyor — sırası korunarak. Alıntı denetimi TAM metne
  karşı yapıldığı için seçme doğruluğu etkilemiyor, yalnızca kapsamı.
*/
const BICIM_SOZCUKLERI =
  /punto|pt\b|cm\b|satır|aralı|kenar|boşluk|yazı tipi|karakter|girinti|yasla|hizal|başlık|numara|sayfa|özet|abstract|kelime|dipnot|atıf|kaynak|apa|chicago|harvard|ieee|vancouver|mla|romen|bölüm|kağıt|kâğıt|a4|margin|font|spacing|indent|justif|heading|page|footnote|citation|words?\b/iu;

export function kilavuzMetni(metin: string, butce = KILAVUZ_METIN_BUTCESI): { kaynak: string; kirpildi: boolean } {
  const temiz = metin.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (temiz.length <= butce) return { kaynak: temiz, kirpildi: false };
  const satirlar = temiz.split("\n");
  const sec = new Set<number>();
  satirlar.forEach((s, i) => {
    if (BICIM_SOZCUKLERI.test(s)) for (let j = Math.max(0, i - 1); j <= Math.min(satirlar.length - 1, i + 1); j++) sec.add(j);
  });
  let kaynak = "";
  let onceki = -2;
  for (const i of [...sec].sort((a, b) => a - b)) {
    const ek = `${i !== onceki + 1 ? "\n…\n" : "\n"}${satirlar[i]}`;
    if (kaynak.length + ek.length > butce) break;
    kaynak += ek;
    onceki = i;
  }
  return { kaynak: kaynak.trim(), kirpildi: true };
}

export function kilavuzIstemi(metin: string): { mesajlar: Mesaj[]; kaynak: string; kirpildi: boolean } {
  const { kaynak, kirpildi } = kilavuzMetni(metin);
  return {
    mesajlar: [
      { rol: "sistem", metin: KILAVUZ_ISTEMI },
      { rol: "kullanici", metin: `KILAVUZ METNİ:\n${kaynak}` },
    ],
    kaynak,
    kirpildi,
  };
}

/* Karşılaştırma için: Türkçe küçük harf, tek boşluk, düz tırnak, satır sonu tirelemesi yok. */
const duzle = (s: string) =>
  s
    .normalize("NFC")
    .replace(/­/g, "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑–—―]/g, "-")
    .replace(/-[ \t]*\r?\n[ \t]*/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .trim();

export type KuralKaniti = { alan: string; alinti: string };
export type KilavuzOkumasi = {
  /** lib/guideline-scan.ts suggestedRules ile aynı anahtarlar (normalizeGuidelineEditorSettings okur) */
  kurallar: Record<string, unknown>;
  zorunluBolumler: string[];
  atifStili: string | null;
  enAzSayfa: number | null;
  enCokSayfa: number | null;
  kanitlar: KuralKaniti[];
};

export type KilavuzRed = { neden: "bos" | "alinti" | "uydurma_sayi"; ayrinti: string[] };

const sayi = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const aralik = (n: number | null, en: number, ec: number) => (n !== null && n >= en && n <= ec ? n : null);

/**
 * Model yanıtını doğrulayıp kural kümesine çevirir. Hiç kural yoksa,
 * bir alıntı metinde geçmiyorsa ya da bir sayı alıntısında yoksa ret.
 * Aralık dışı değer (üst 29,7 cm) ret değil, yok sayılır: alıntı doğru,
 * okuma yanlış (kâğıt ölçüsü) — kalıpla okumadaki elemenin aynısı.
 */
export function kilavuzOkumasiniCozumle(ham: string, kilavuzMetniTam: string): KilavuzOkumasi | KilavuzRed {
  const girdiler = kuralGirdileri(jsonOku(ham) ?? jsonOnar(ham));
  if (!girdiler.length) return { neden: "bos", ayrinti: [] };

  const tam = duzle(kilavuzMetniTam);
  const alintisizlar: string[] = [];
  const uydurmalar: string[] = [];
  const kanitlar: KuralKaniti[] = [];
  const deger: Record<string, unknown> = {};

  for (const [alan, kayit] of girdiler) {
    const alinti = String(kayit?.alinti ?? "").replace(/\s+/g, " ").trim();
    const d = kayit?.deger;
    if (d === undefined || d === null || d === "") continue;
    if (alinti.length < 6 || alinti.length > 400 || !tam.includes(duzle(alinti))) {
      alintisizlar.push(alan);
      continue;
    }
    /* Kuraldaki her sayı kendi alıntısında geçmeli ("1,5" → 1.5; okumaların hepsi, lib/ai/sayi-denetimi.ts). */
    const alintidaki = new Set(sayiOkumalari(alinti).flat());
    /*
      Yalnızca OKUNAN sayılar denetlenir: alt başlık girintisinin düzeyi (3)
      metinde yazmaz, "birinci dereceden sonraki" sözünden türetilir; kâğıt
      adındaki "a4" bir ölçü değil.
    */
    const sayilar = typeof d === "number" ? [d] : alan === "alt_baslik_girintisi" ? [(d as { cm?: unknown }).cm] : [];
    const eksik = sayilar
      .map((n) => String(n ?? ""))
      .filter((n) => !sayiOkumalari(n).some((o) => o.some((x) => alintidaki.has(x))));
    if (eksik.length) {
      uydurmalar.push(`${alan}: ${eksik.join(", ")}`);
      continue;
    }
    deger[alan] = d;
    kanitlar.push({ alan, alinti });
  }
  if (alintisizlar.length) return { neden: "alinti", ayrinti: alintisizlar };
  if (uydurmalar.length) return { neden: "uydurma_sayi", ayrinti: uydurmalar };

  /* Bölüm adları kılavuz metninde geçmeli (alıntının dışında da sayılabilirler). */
  const adlar = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map((a) => String(a ?? "").replace(/\s+/g, " ").trim())
      .filter((a) => a.length >= 2 && a.length <= 80);
  const metindeYok = [...adlar(deger.zorunlu_bolumler), ...adlar(deger.sola_yasli_bolumler), ...adlar(deger.numarasiz_bolumler)].filter(
    (a) => !tam.includes(duzle(a)),
  );
  if (metindeYok.length) return { neden: "alinti", ayrinti: metindeYok.map((a) => `bölüm: ${a}`) };

  const k: Record<string, unknown> = {};
  const kenar = ["ust", "alt", "sol", "sag"].map((y) => aralik(sayi(deger[`kenar_${y}_cm`]), 0.5, 8));
  if (kenar.every((x) => x !== null)) k.margins_cm = { top: kenar[0], bottom: kenar[1], left: kenar[2], right: kenar[3] };
  if (typeof deger.yazi_tipi === "string" && YAZI_TIPLERI.includes(deger.yazi_tipi)) k.font_family = deger.yazi_tipi;
  const punto = aralik(sayi(deger.punto), 8, 24);
  if (punto !== null) k.font_size_pt = punto;
  const satir = aralik(sayi(deger.satir_araligi), 1, 3);
  if (satir !== null) k.line_spacing = satir;
  const girinti = aralik(sayi(deger.paragraf_girintisi_cm), 0.3, 3);
  if (girinti !== null) k.paragraph_indent_cm = girinti;
  const once = aralik(sayi(deger.paragraf_once_nk), 0, 36);
  const sonra = aralik(sayi(deger.paragraf_sonra_nk), 0, 36);
  if (once !== null && sonra !== null) k.paragraph_spacing_pt = { beforePt: once, afterPt: sonra };
  if (typeof deger.iki_yana_yasla === "boolean") k.justify = deger.iki_yana_yasla;
  const dipnot = aralik(sayi(deger.dipnot_punto), 6, 14);
  if (dipnot !== null) k.footnote_size_pt = dipnot;
  if (deger.kagit === "a4" || deger.kagit === "letter") k.page_size = deger.kagit;
  if (typeof deger.sayfa_numarasi_yeri === "string" && SAYFA_NUMARASI.includes(deger.sayfa_numarasi_yeri)) {
    k.page_number_position = deger.sayfa_numarasi_yeri;
    k.show_page_numbers = true;
  }
  if (deger.on_sayfalar_romen === true) k.front_matter_roman = true;
  for (const [alan, anahtar] of [
    ["baslik_numaralandirma", "heading_numbering"],
    ["bolum_buyuk_harf", "chapter_uppercase"],
    ["bolum_yeni_sayfa", "chapter_new_page"],
  ] as const) {
    if (typeof deger[alan] === "boolean") k[anahtar] = deger[alan];
  }
  if (deger.bolum_hizasi === "center" || deger.bolum_hizasi === "left") {
    k.chapter_align = deger.bolum_hizasi;
    const sola = adlar(deger.sola_yasli_bolumler);
    if (deger.bolum_hizasi === "center" && sola.length) k.chapter_left_sections = sola.slice(0, 12);
  }
  const numarasiz = adlar(deger.numarasiz_bolumler);
  if (numarasiz.length) k.unnumbered_sections = numarasiz.slice(0, 12);
  const alt = deger.alt_baslik_girintisi as { duzey?: unknown; cm?: unknown } | undefined;
  const altDuzey = sayi(alt?.duzey);
  const altCm = aralik(sayi(alt?.cm), 0.3, 3);
  if ((altDuzey === 2 || altDuzey === 3 || altDuzey === 4) && altCm !== null) k.subheading_indent = { fromLevel: altDuzey, cm: altCm };
  const tam_ = (v: unknown, en: number, ec: number) => {
    const n = sayi(v);
    return n !== null && Number.isInteger(n) && n >= en && n <= ec ? n : null;
  };
  const ozetEc = tam_(deger.ozet_en_cok_kelime, 20, 2000);
  const ozetEa = tam_(deger.ozet_en_az_kelime, 20, 2000);
  const akEa = tam_(deger.anahtar_kelime_en_az, 1, 20);
  const akEc = tam_(deger.anahtar_kelime_en_cok, 1, 20);
  if (ozetEc !== null) k.abstract_max_words = ozetEc;
  if (ozetEa !== null && (ozetEc === null || ozetEa <= ozetEc)) k.abstract_min_words = ozetEa;
  if (akEc !== null) k.keywords_max = akEc;
  if (akEa !== null && (akEc === null || akEa <= akEc)) k.keywords_min = akEa;

  const enAz = tam_(deger.en_az_sayfa, 1, 2000);
  const enCok = tam_(deger.en_cok_sayfa, 1, 2000);
  const atif = typeof deger.atif_stili === "string" && ATIF_STILLERI.includes(deger.atif_stili) ? deger.atif_stili : null;

  return {
    kurallar: k,
    zorunluBolumler: adlar(deger.zorunlu_bolumler).slice(0, 30),
    atifStili: atif,
    enAzSayfa: enAz,
    enCokSayfa: enCok !== null && (enAz === null || enAz <= enCok) ? enCok : null,
    kanitlar,
  };
}

/*
  YANITIN BİÇİMİ ESNEK OKUNUR (02.11.2026). Canlıdaki ilk iki okuma "boş"
  diye reddedildi: model kuralları istenen {"kurallar": {alan: {deger,
  alinti}}} sarmalında döndürmedi. Bilinen alan adlarıyla gelen üç biçim
  kabul ediliyor — sarmalsız nesne, sarmal içinde liste ({alan, deger,
  alinti}) ve istenen biçim. Doğrulama (alıntı, sayı, bölüm adı)
  değişmedi; yalnızca kabın biçimi gevşek.
*/
type Girdi = [string, { deger?: unknown; alinti?: unknown }];
const BILINEN_ALANLAR = new Set([
  "kenar_ust_cm", "kenar_alt_cm", "kenar_sol_cm", "kenar_sag_cm", "yazi_tipi", "punto", "satir_araligi",
  "paragraf_girintisi_cm", "paragraf_once_nk", "paragraf_sonra_nk", "iki_yana_yasla", "dipnot_punto", "kagit",
  "sayfa_numarasi_yeri", "on_sayfalar_romen", "baslik_numaralandirma", "bolum_buyuk_harf", "bolum_yeni_sayfa",
  "bolum_hizasi", "sola_yasli_bolumler", "numarasiz_bolumler", "alt_baslik_girintisi", "ozet_en_cok_kelime",
  "ozet_en_az_kelime", "anahtar_kelime_en_az", "anahtar_kelime_en_cok", "en_az_sayfa", "en_cok_sayfa",
  "atif_stili", "zorunlu_bolumler",
]);

export function kuralGirdileri(veri: unknown): Girdi[] {
  if (!veri || typeof veri !== "object") return [];
  const kok = veri as Record<string, unknown>;
  const kap = kok.kurallar ?? kok.rules ?? kok;
  /* Türkçe istemde model anahtarı Türkçe harfle de yazabiliyor ("değer", "alıntı"). */
  const kayit = (v: unknown): { deger?: unknown; alinti?: unknown } | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const deger = o.deger ?? o["değer"] ?? o.value;
    const alinti = o.alinti ?? o["alıntı"] ?? o.quote;
    /* Alıntısız girdi okunmaz (ret değil): kesik yanıtın yarım kuralı böyle kalıyor. Alıntısı YANLIŞ olan ret. */
    if (deger === undefined || typeof alinti !== "string" || !alinti.trim()) return null;
    return { deger, alinti };
  };
  if (Array.isArray(kap)) {
    return kap.flatMap((v): Girdi[] => {
      const alan = (v as { alan?: unknown })?.alan;
      const k = kayit(v);
      return typeof alan === "string" && BILINEN_ALANLAR.has(alan) && k ? [[alan, k]] : [];
    });
  }
  if (kap && typeof kap === "object") {
    return Object.entries(kap as Record<string, unknown>).flatMap(([alan, v]): Girdi[] => {
      const k = kayit(v);
      return BILINEN_ALANLAR.has(alan) && k ? [[alan, k]] : [];
    });
  }
  return [];
}

/*
  KUSURLU JSON'U ONARMA (02.11.2026). Canlıdaki okuma doğru biçimde geldi
  ama JSON.parse düştü: alıntılar kılavuzdan birebir kopyalanıyor ve
  kılavuz cümleleri düz tırnak ("Giriş" ve "Sonuç" başlıkları) ya da satır
  sonu taşıyabiliyor; model bunları kaçışlamadan yazınca yanıtın TAMAMI
  "boş" sayıldı. Burada yalnızca sözdizimi onarılıyor — dizgi içindeki
  ham satır sonu ve kapatmayan tırnak kaçışlanıyor, sondaki virgül
  siliniyor, ```json çiti atılıyor. İçerik değişmiyor; doğrulama aynen
  (alıntı metinde, sayı alıntıda).

  Bir dizgi içindeki tırnak, ardından (boşluktan sonra) , : } ] gelmiyorsa
  dizgiyi kapatmıyor sayılır: "Örnek: "Yazarın Soyadı"" → içteki iki tırnak
  metnin parçası.
*/
export function jsonOnar(ham: string): unknown {
  const govde = ham.replace(/```(?:json)?/gi, "");
  const bas = govde.indexOf("{");
  if (bas === -1) return null;
  /* Son "}"te KESİLMİYOR: kesik yanıtta son "}" yarım kuralın önünde, son tam kuralın "},"si dışarıda kalırdı. */
  const k = govde.slice(bas);
  let cikti = "";
  let dizgide = false;
  for (let i = 0; i < k.length; i++) {
    const c = k[i];
    if (!dizgide) {
      if (c === '"') dizgide = true;
      cikti += c;
      continue;
    }
    if (c === "\\") {
      cikti += c + (k[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (c === "\n" || c === "\r") {
      cikti += " ";
      continue;
    }
    if (c === '"') {
      const sonraki = k.slice(i + 1).match(/^\s*(.)/)?.[1];
      if (sonraki === undefined || ",:}]".includes(sonraki)) {
        dizgide = false;
        cikti += c;
      } else {
        cikti += '\\"';
      }
      continue;
    }
    cikti += c;
  }
  const dene = (metin: string) => {
    try {
      return JSON.parse(metin.replace(/,\s*([}\]])/g, "$1")) as unknown;
    } catch {
      return null;
    }
  };
  const tam = dene(cikti.slice(0, cikti.lastIndexOf("}") + 1));
  if (tam) return tam;
  /*
    KESİK YANIT (canlıda 02.11.2026: 2071 karakterde "sola_yasli_bolumler"
    ortasında bitti). Son tamamlanmış kuralın ardından kesilip kaplar
    kapatılır; sondan başa her "}," denenir. Yarım kalan kural yok sayılır
    (alıntısız girdi okunmaz, kuralGirdileri) — eksik kural kalıpla
    okunandan gelir, uydurma riski doğmaz.
  */
  const govdeOnarilmis = cikti.replace(/\s+$/, "");
  for (let i = govdeOnarilmis.lastIndexOf("},"); i > 0; i = govdeOnarilmis.lastIndexOf("},", i - 1)) {
    const kurtarilan = dene(`${govdeOnarilmis.slice(0, i + 1)}}}`);
    if (kurtarilan) return kurtarilan;
  }
  return null;
}

/** Okuma mı ret mi. */
export const redMi = (s: KilavuzOkumasi | KilavuzRed): s is KilavuzRed => "neden" in s;

/*
  BİRLEŞTİRME: yapay zekânın alıntıyla doğrulanmış okuması önce, kalıpla
  okuma yedek. Model bir kuralı okumadıysa (alan yok) kalıbınki kalır;
  okuduysa onunki. Farklı okudukları alanlar söylenir: öğrenci onay
  ekranında görür, sessiz bir seçim yapılmaz.
*/
export function kurallariBirlestir(
  kalip: Record<string, unknown>,
  yz: Record<string, unknown>,
): { kurallar: Record<string, unknown>; farklar: string[] } {
  const farklar = Object.keys(yz).filter(
    (anahtar) => anahtar in kalip && JSON.stringify(kalip[anahtar]) !== JSON.stringify(yz[anahtar]),
  );
  return { kurallar: { ...kalip, ...yz }, farklar };
}

/* Onay ekranında alanın adı (kanıt listesi). */
export const ALAN_ADI: Record<string, { tr: string; en: string }> = {
  kenar_ust_cm: { tr: "Üst kenar", en: "Top margin" },
  kenar_alt_cm: { tr: "Alt kenar", en: "Bottom margin" },
  kenar_sol_cm: { tr: "Sol kenar", en: "Left margin" },
  kenar_sag_cm: { tr: "Sağ kenar", en: "Right margin" },
  yazi_tipi: { tr: "Yazı tipi", en: "Font" },
  punto: { tr: "Punto", en: "Font size" },
  satir_araligi: { tr: "Satır aralığı", en: "Line spacing" },
  paragraf_girintisi_cm: { tr: "Paragraf girintisi", en: "Paragraph indent" },
  paragraf_once_nk: { tr: "Paragraf öncesi", en: "Space before" },
  paragraf_sonra_nk: { tr: "Paragraf sonrası", en: "Space after" },
  iki_yana_yasla: { tr: "İki yana yaslama", en: "Justification" },
  dipnot_punto: { tr: "Dipnot puntosu", en: "Footnote size" },
  kagit: { tr: "Kâğıt", en: "Paper" },
  sayfa_numarasi_yeri: { tr: "Sayfa numarası", en: "Page numbers" },
  on_sayfalar_romen: { tr: "Ön sayfa numaraları", en: "Front matter numbering" },
  baslik_numaralandirma: { tr: "Başlık numaraları", en: "Heading numbers" },
  bolum_buyuk_harf: { tr: "Büyük harfli bölüm başlığı", en: "Capitalised chapter headings" },
  bolum_yeni_sayfa: { tr: "Bölüm yeni sayfadan", en: "Chapters on a new page" },
  bolum_hizasi: { tr: "Bölüm başlığı hizası", en: "Chapter heading alignment" },
  sola_yasli_bolumler: { tr: "Sola yaslı ana başlıklar", en: "Left-aligned main headings" },
  numarasiz_bolumler: { tr: "Numarasız ana başlıklar", en: "Unnumbered main headings" },
  alt_baslik_girintisi: { tr: "Alt başlık girintisi", en: "Subheading indent" },
  ozet_en_cok_kelime: { tr: "Özet sınırı", en: "Abstract limit" },
  ozet_en_az_kelime: { tr: "Özet alt sınırı", en: "Abstract minimum" },
  anahtar_kelime_en_az: { tr: "Anahtar kelime (en az)", en: "Keywords (min)" },
  anahtar_kelime_en_cok: { tr: "Anahtar kelime (en çok)", en: "Keywords (max)" },
  en_az_sayfa: { tr: "En az sayfa", en: "Minimum pages" },
  en_cok_sayfa: { tr: "En çok sayfa", en: "Maximum pages" },
  atif_stili: { tr: "Kaynakça sistemi", en: "Citation style" },
  zorunlu_bolumler: { tr: "Zorunlu bölümler", en: "Required sections" },
};

/*
  Yapay zekânın bulduğu kural için kalıbın "bulunamadı" uyarısı artık yanlış:
  "Gövde metninin satır aralığı açıkça bulunamadı" derken kural ekranda
  1,5 olarak duruyorsa öğrenci hangisine inanacağını bilemez. Metinler
  lib/guideline-scan.ts'tekilerle BİREBİR aynı (testi bunu sınıyor).
*/
const COZULEN_UYARILAR: [string, (o: KilavuzOkumasi) => boolean][] = [
  ["Tüm kenar boşlukları açıkça bulunamadı.", (o) => "margins_cm" in o.kurallar],
  ["Yazı tipi açıkça bulunamadı.", (o) => "font_family" in o.kurallar],
  ["Gövde metninin yazı boyutu açıkça bulunamadı.", (o) => "font_size_pt" in o.kurallar],
  ["Gövde metninin satır aralığı açıkça bulunamadı.", (o) => "line_spacing" in o.kurallar],
  ["Paragraf girintisi ölçüsü bulunamadı; 1,25 cm varsayıldı.", (o) => "paragraph_indent_cm" in o.kurallar],
  ["Yeterli sayıda zorunlu bölüm tespit edilemedi.", (o) => o.zorunluBolumler.length >= 4],
  ["Kaynakça sistemi açıkça bulunamadı.", (o) => o.atifStili !== null],
];

export function cozulenUyarilariAyikla(uyarilar: string[], okuma: KilavuzOkumasi): string[] {
  return uyarilar.filter((u) => {
    const eslesen = COZULEN_UYARILAR.find(([metin]) => metin === u);
    if (eslesen) return !eslesen[1](okuma);
    // Atıf yöntemi uyarısı ("… sistemi siz seçin"): yapay zekâ stili okuduysa gereksiz.
    if (u.startsWith("Kılavuz bir kaynakça sistemi adı vermiyor")) return okuma.atifStili === null;
    return true;
  });
}
