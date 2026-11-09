/*
  YAZIM ASİSTANI (03.11.2026, kurum sahibinin kararı: "paragrafı sohbette
  yazarız, ekleme konusunu kullanıcıya bırakırız").

  ArvoLab'ın ilk değişmezi "asistan denetler, yazmaz" idi. Kurum sahibi
  ürünü Jenni AI'ın karşısına koymak için bunu değiştirdi: asistan artık
  YAZABİLİR, ama yalnızca sohbet panelinde. Belgeye hiçbir şey kendiliğinden
  girmez; "Metne ekle" her zaman kullanıcının eylemidir.

  Değişmeyenler — bunlar Jenni'nin zayıf olduğu yer, ArvoLab'ın satış
  noktası:
    1. UYDURMA KAYNAK YOK. Üretilen metindeki her atıf, öğrencinin
       Literatür kütüphanesindeki bir kaynağa (yazar + yıl) eşleşmek
       zorunda; eşleşmeyen tek bir atıf varsa cevabın tamamı düşer.
       Kaynakça satırı (künye) hiç üretilmez: künyeyi kütüphane yazar.
    2. UYDURMA SAYI YOK. Metindeki her sayı bağlamda (öğrencinin metni,
       isteği, kütüphane) geçmek zorunda (lib/ai/sayi-denetimi.ts).
       "Örneklem 250 kişiden oluşmaktadır" cümlesini model uyduramaz.
  Kısmen doğru bir metin, kullanıcının hangi parçanın uydurulduğunu
  ayıklayamayacağı en tehlikeli çıktıdır; bu yüzden düzeltme değil RET.

  Saf modül: istem, çözümleme ve doğrulama; kayıt ve yetki eylemde
  (app/actions/ai-yazim.ts). Testi tests/unit/yazim-asistani.test.ts.
*/

import type { Dil } from "@/lib/dil";
import type { Mesaj } from "./saglayici";
import { jsonOku } from "./bulgu";
import { uydurmaSayilar } from "./sayi-denetimi";
import { crossCheck, extractInTextCitations, type ParsedReference } from "@/lib/apa7";
import { splitAuthors } from "@/lib/citation-format";
export { paragraflara } from "./yazim-metni";

export type YazimGorevi = "serbest" | "devam" | "paragraf" | "akademik" | "kisalt" | "genislet" | "anahat" | "tamamla";

export type KutuphaneKaydi = {
  yazarlar: string | null;
  yil: string | null;
  baslik: string;
  yayin?: string | null;
  not?: string | null;
};

export type { SohbetMesaji } from "./yazim-metni";
import type { SohbetMesaji } from "./yazim-metni";

export type YazimGirdisi = {
  /** Çalışmanın özeti (başlık, tür, yöntem, atıf stili): calismaBaglami */
  calisma?: string | null;
  /** Belgenin dili: üretilen metin bu dilde */
  belgeDili: Dil;
  /** Atıf stilinin adı ("APA 7"); metin içi atıf biçimi buna göre */
  atifStili: string;
  /** İmlecin bulunduğu bölümün başlığı */
  bolum?: string | null;
  /** İmleçten önceki metin (son kısmı) */
  oncesi?: string | null;
  /** Seçili metin (akademikleştir, kısalt, genişlet için) */
  secim?: string | null;
  kutuphane: KutuphaneKaydi[];
  gecmis: SohbetMesaji[];
  istek: string;
  gorev: YazimGorevi;
  /** Kılavuzun zorunlu bölümleri (ana hat görevinde iskeletin omurgası). */
  zorunluBolumler?: string[];
  /** Çalışmanın atıf stili numaralı mı (IEEE, Vancouver, CSL k/p/s); istem numara yazdırmaz (C2-1). */
  numaraliStil?: boolean;
  /*
    Makale profili (Makale Aşama 2, 05.11.2026; lib/ai/calisma-baglami.ts →
    makaleProfiliMetni). İki parça, çünkü sayı denetimi bağlamdaki sayıları
    "izinli" sayıyor:
      baglam      → istemde ve denetim kaynağında (soru, tür, tasarım…)
      yalnizIstem → YALNIZCA istemde (kelime/özet sınırları, dergi notu,
                    adres). Sınırlar denetim kaynağına girseydi "250" gibi
                    bir sınır, uydurulmuş "250 katılımcı"yı geçirirdi.
  */
  makale?: { baglam: string; yalnizIstem: string } | null;
};

export const SINIR = {
  oncesi: 4_000,
  secim: 6_000,
  istek: 1_500,
  gecmisMesaj: 8,
  gecmisKarakter: 1_500,
  kutuphane: 60,
};

const GOREV_ACIKLAMASI: Record<YazimGorevi, string> = {
  serbest: "Kullanıcının isteğini yerine getir.",
  devam: "Belgedeki metni kaldığı yerden, aynı üslupla BİR paragraf olarak sürdür.",
  paragraf: "İmlecin bulunduğu bölüm için kullanıcının isteği doğrultusunda BİR paragraf yaz.",
  akademik: "Seçili metni anlamını değiştirmeden akademik üsluba çevir.",
  kisalt: "Seçili metni anlamını koruyarak kısalt.",
  genislet: "Seçili metni anlamını değiştirmeden, mevcut bilgilerle derinleştirerek genişlet; yeni olgu ekleme.",
  /*
    Ana hat (03.11.2026): başlık iskeleti. Kılavuzun zorunlu bölümleri
    omurga; alt başlıklar konudan. Numara yazdırılmıyor — editör
    numaralıyor, elle numara çift numara olur ve sayı denetimine takılır.
  */
  anahat:
    "Çalışma için bir ANA HAT (başlık iskeleti) çıkar. 'metin' alanında her satır ya bir başlık ('# ' ana bölüm, '## ' alt başlık, '### ' üçüncü düzey) ya da hemen üstündeki başlığın altına ne yazılacağını anlatan TEK cümlelik bir not ('- ' ile başlar) olsun. Kılavuzun zorunlu bölümleri verildiyse ana bölümler onlar olmalı ve aynı adla yazılmalı. Başlıklara numara yazma. Not cümleleri öğrenciye yöneliktir ('Bu bölümde … açıklanır.'); bulgu, sayı ya da atıf içermez.",
  /*
    Satır içi tamamlama (03.11.2026, Jenni'nin imza özelliği): editörde
    gri öneri, kabul Tab ile kullanıcının. Kısa tutulur: uzun öneri hem
    pahalı hem okunmadan kabul edilir.
  */
  tamamla:
    "İmleçten önceki metni kaldığı yerden sürdür: cümle yarımsa önce onu tamamla, toplamda EN ÇOK iki cümle yaz. 'metin' alanına YALNIZCA eklenecek devamı yaz (öncesini tekrarlama); 'yanit' alanını boş bırak. Bağlam yeterli değilse 'metin' alanını boş bırak.",
};

export const YAZIM_ISTEMI = `Sen ArvoLab'ın akademik yazım asistanısın. Türkiye'deki üniversitelerde tez ve makale yazan öğrencilere yazarken yardım ediyorsun.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"yanit": "<kullanıcıya kısa açıklama ya da soru, en çok 2 cümle>", "metin": "<belgeye eklenebilecek metin; yoksa boş dize>"}

KESİN KURALLAR:
1. KAYNAK UYDURMA. Metinde YALNIZCA aşağıdaki "KÜTÜPHANE" listesindeki kaynaklara atıf yapabilirsin; atıf biçimi çalışmanın atıf stiline uygun olmalı (APA'da "Yazar (Yıl)" ya da "(Yazar, Yıl)"). Listede olmayan hiçbir yazara, yıla, kuruma, çalışmaya atıf yapma; "araştırmalar göstermiştir" gibi sahipsiz genellemeleri de kaynağa bağlamadan yazma. Uygun kaynak yoksa atıfsız yaz ve "yanit" alanında hangi iddianın kaynak gerektirdiğini söyle.
2. KAYNAKÇA SATIRI YAZMA. "Soyad, A. (2020). Başlık…" biçiminde künye üretme; kaynakçayı ArvoLab kütüphaneden kendisi oluşturur.
3. SAYI UYDURMA. Metindeki her sayı (yüzde, örneklem, yıl, katsayı, p değeri) aşağıdaki bağlamda (öğrencinin metni, isteği, kütüphane) birebir geçmeli. Bağlamda olmayan bir veri gerekiyorsa "[…]" yer tutucusu bırak ve "yanit" alanında öğrenciden iste.
4. Öğrencinin bulgularını, verisini ya da yöntemini değiştirme ve yorumunu abartma; bağlamda yazanın ötesine geçme.
5. Metni, belgenin dilinde ve çalışmanın akademik üslubunda yaz: edilgen ya da birinci çoğul şahıs, ölçülü, gereksiz süssüz. Başlık, madde işareti ya da Markdown kullanma; paragraflar arasında boş satır bırak.
6. Kullanıcı yalnızca bir şey soruyorsa (metin istemiyorsa) "metin" alanını boş bırak.
7. GÖREV satırı 5. kuraldan farklı bir biçim tarif ediyorsa (ana hat) o biçimi kullan.
8. KAYNAKLARIN TAM METNİNİ GÖRMÜYORSUN. Kütüphanede yalnızca künye ve öğrencinin notu var; PDF'lerin içeriği sana verilmiyor. Bir kaynağı okuduğunu, içinde ne yazdığını ya da sayfa numarasını iddia etme; notta yazanın ötesine geçme.
9. MAKALE PROFİLİ ve DERGİ bilgileri (varsa) öğrencinin kendi beyanıdır, doğrulanmamıştır. Derginin güncel resmî kuralı olduğunu, metnin dergiye uygun olduğunu ya da kabul edileceğini söyleme.`;

const kirp = (metin: string | null | undefined, n: number) => {
  const m = (metin ?? "").trim();
  return m.length > n ? `…${m.slice(m.length - n)}` : m;
};
const bastanKirp = (metin: string | null | undefined, n: number) => {
  const m = (metin ?? "").trim();
  return m.length > n ? `${m.slice(0, n)}…` : m;
};

/** Kütüphane satırı: modelin atıfta kullanacağı yazar ve yıl, ayırt edici başlık. */
export function kutuphaneSatiri(k: KutuphaneKaydi, sira: number): string {
  const yazarlar = splitAuthors(k.yazarlar).map((y) => y.split(",")[0].trim()).filter(Boolean);
  const yazar =
    yazarlar.length > 2 ? `${yazarlar[0]} vd.` : yazarlar.length === 2 ? `${yazarlar[0]} ve ${yazarlar[1]}` : (yazarlar[0] ?? "Yazarsız");
  return `${sira}. ${yazar} (${k.yil ?? "t.y."}) — ${bastanKirp(k.baslik, 160)}${k.yayin ? `, ${bastanKirp(k.yayin, 80)}` : ""}${k.not ? ` | Not: ${bastanKirp(k.not, 300)}` : ""}`;
}

export function yazimIstemi(g: YazimGirdisi): { mesajlar: Mesaj[]; kaynak: string } {
  const kutuphane = g.kutuphane.slice(0, SINIR.kutuphane).map((k, i) => kutuphaneSatiri(k, i + 1));
  const baglam = [
    g.calisma ? `ÇALIŞMA:\n${bastanKirp(g.calisma, 1_500)}` : "",
    g.makale?.baglam ? bastanKirp(g.makale.baglam, 3_000) : "",
    `BELGENİN DİLİ: ${g.belgeDili === "en" ? "İngilizce (metni İngilizce yaz; atıfta 've' yerine 'and', 'vd.' yerine 'et al.')" : "Türkçe"}`,
    `ATIF STİLİ: ${g.atifStili}`,
    /* C2-1: numaralı stilde model numara yazmaz; sunucu yine de her numaralı atfı düşürür (yalnızca isteme güvenilmez). */
    g.numaraliStil
      ? "ATIF BİÇİMİ: Bu çalışma numaralı atıf stili kullanıyor. Metne atıf numarası ([1], (1) ya da üst simge) YAZMA; numaraları öğrenci Atıf aracıyla ekler. Bir kaynağa değinmen gerekiyorsa yazarın soyadını ve yılını cümle içinde an (ör. \"Phillips (1958)\")."
      : "",
    `KÜTÜPHANE (atıf yapılabilecek TEK kaynaklar):\n${kutuphane.length ? kutuphane.join("\n") : "(boş — hiçbir atıf yapma)"}`,
    g.bolum ? `İMLECİN BULUNDUĞU BÖLÜM: ${bastanKirp(g.bolum, 200)}` : "",
    g.oncesi ? `BELGEDE İMLEÇTEN ÖNCEKİ METİN:\n${kirp(g.oncesi, SINIR.oncesi)}` : "",
    g.secim ? `SEÇİLİ METİN:\n${bastanKirp(g.secim, SINIR.secim)}` : "",
    g.zorunluBolumler?.length ? `KILAVUZUN ZORUNLU BÖLÜMLERİ: ${g.zorunluBolumler.slice(0, 30).map((b) => bastanKirp(b, 80)).join(" | ")}` : "",
    `GÖREV: ${GOREV_ACIKLAMASI[g.gorev]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const gecmis: Mesaj[] = g.gecmis.slice(-SINIR.gecmisMesaj).map((m) => ({
    rol: m.rol === "kullanici" ? "kullanici" : "sistem",
    metin: m.rol === "kullanici" ? bastanKirp(m.metin, SINIR.gecmisKarakter) : `ÖNCEKİ CEVABIN: ${bastanKirp(m.metin, SINIR.gecmisKarakter)}`,
  }));
  const istek = bastanKirp(g.istek, SINIR.istek) || GOREV_ACIKLAMASI[g.gorev];
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: YAZIM_ISTEMI },
    { rol: "sistem", metin: baglam },
    /* Denetim kaynağının (aşağıda "kaynak") DIŞINDA: bkz. YazimGirdisi.makale. */
    ...(g.makale?.yalnizIstem ? [{ rol: "sistem" as const, metin: bastanKirp(g.makale.yalnizIstem, 4_500) }] : []),
    ...gecmis,
    { rol: "kullanici", metin: istek },
  ];
  return { mesajlar, kaynak: `${baglam}\n\nİSTEK: ${istek}` };
}

/*
  SAYI DENETİMİNİN İZİNLİ BAĞLAMI (C2-2, V4.3). İki güven düzeyi:
    - sunucunun kendi okuduğu: çalışma, kütüphane (RLS altında) — "kaynak"
      ve kütüphane satırları;
    - kullanıcının verdiği: istek, seçim, imleçten önceki metin ve
      kullanıcının KENDİ önceki mesajları. Öğrenci kendi verisinin yazarı;
      yazdığı sayıyı kullanmak uydurma değil. Ama bu metinler hiçbir
      kaynağı geçerli YAPMAZ: atıf yalnızca sunucudan okunan kütüphaneyle
      eşleşir (yazimDenetle'nin `kutuphane` girdisi).
  İstemcinin "asistan" rolüyle gönderdiği önceki cevaplar BAĞLAMA GİRMEZ:
  ESKİDEN girerdi ve sahte bir "asistan" mesajı gönderen istemci uydurma
  sayıyı denetimden geçirebiliyordu. Gerçek önceki cevabın sayıları zaten
  o sırada bağlamdan geldi; kullanıcı aynı veriyi yeniden verirse geçer.
*/
export function sayiBaglami(g: {
  kaynak: string;
  istek: string;
  secim: string | null;
  oncesi: string | null;
  gecmis: SohbetMesaji[];
  kutuphane: KutuphaneKaydi[];
}): string[] {
  const kullaniciGecmisi = g.gecmis.filter((m) => m.rol === "kullanici").map((m) => m.metin);
  return [g.kaynak, g.istek, g.secim ?? "", g.oncesi ?? "", ...kullaniciGecmisi, ...g.kutuphane.map((k, i) => kutuphaneSatiri(k, i + 1))];
}

/** Modelin cevabı: kullanıcıya açıklama ve eklenebilir metin. */
export function yazimCozumle(ham: string): { yanit: string; metin: string } | null {
  const veri = jsonOku(ham) as { yanit?: unknown; metin?: unknown } | null;
  if (!veri || typeof veri !== "object") return null;
  const yanit = typeof veri.yanit === "string" ? veri.yanit.trim().slice(0, 600) : "";
  const metin = typeof veri.metin === "string" ? veri.metin.replace(/\r\n/g, "\n").trim().slice(0, 8_000) : "";
  if (!yanit && !metin) return null;
  return { yanit, metin };
}

/*
  Kaynakça satırı: "Soyad, A. (2020)" ya da "Soyad, A. B., & Soyad, C.
  (2020)". Metin içi atıf ("Soyad (2020)", "(Soyad, 2020)") bunlardan
  değildir; o ayrıca kütüphaneyle eşleştirilir.
*/
const KUNYE_SATIRI = /\p{Lu}[\p{L}'’-]*\p{Ll},\s*(?:\p{Lu}\.\s*-?\s*){1,3}(?:,?\s*(?:&|ve|and)\s*\p{Lu}[\p{L}'’-]*,\s*(?:\p{Lu}\.\s*){1,3})*\(\d{4}[a-z]?\)/u;
const DOI = /10\.\d{4,9}\/[^\s"<>]+/u;

export type YazimDenetimi =
  | { gecti: true }
  /* numarali: doğrulanamayan numaralı atıf (C2-1). Kayıtta neden yine "kunye": veritabanı kısıtı yeni değer almıyor, migration bu dilimin dışında. */
  | { gecti: false; neden: "kunye"; ayrinti: string[]; numarali?: true }
  | { gecti: false; neden: "uydurma_sayi"; ayrinti: string[] };

/*
  NUMARALI ATIF (C2-1, V4.3). IEEE, Vancouver ve CSL'in numaralı stillerinde
  metin içi atıf bir numara ("[3]", "(3)", "³"). ESKİDEN bu atıflar hiç
  denetlenmiyordu: çıkarıcı APA'ya düşüyor, "[7]" okunmuyordu; sayı
  denetimi de yakalamıyordu, çünkü istemdeki kütüphane listesi "1. …"
  diye numaralı ve küçük sayılar bağlamda zaten var. Modelin numarası
  öğrencinin kaynakçasındaki sırayla ilgisiz: hangi kaynağı gösterdiği
  DOĞRULANAMAZ, bu yüzden cevap düşer (numara üretme ya da kaynakla
  eşleştirme yok — öğrenci numarayı Atıf aracıyla kendisi ekler).

  Kalıp stilin kendi metin içi kalıbı (lib/atif/stiller.ts). Atıf
  SAYILMAYANLAR, yanlış alarm cevabı haksız yere düşürmesin diye:
    - matematik ve indis: parantezin önünde bir-iki karakterlik tanımlayıcı
      ("x[2]", "f(3)", "a_i[1]"); önünde üç ve daha çok harf varsa atıftır
      ("eğrisi[2]");
    - dört haneli sayı: yıl ("(2025)"), atıf numarası değil;
    - liste numarası: satır başında ya da ":", ";", "," sonrasında tek
      numara ve ardından madde metni ("(1) veri toplama");
    - rakam içermeyen köşeli parantez ("[…]", "[sic]", "[bkz. Ek A]"):
      kalıp zaten yakalamıyor.
  Üst simge stillerinde kalıbın kendi bakışı R², χ² gibi simgeleri ayırıyor.
*/
export function numaraliAtiflar(metin: string, kalip: RegExp): string[] {
  const genel = new RegExp(kalip.source, kalip.flags.includes("g") ? kalip.flags : `${kalip.flags}g`);
  const bulunan: string[] = [];
  for (const m of metin.matchAll(genel)) {
    const bas = m.index ?? 0;
    const tam = m[0];
    const parantezli = tam.startsWith("[") || tam.startsWith("(");
    const rakamlar = (m[1] ?? tam).match(/\d+/g) ?? [];
    if (rakamlar.some((r) => r.length > 3)) continue;
    if (parantezli) {
      const sol = metin.slice(0, bas);
      const tanimlayici = /([\p{L}\p{N}_]+)$/u.exec(sol)?.[1] ?? "";
      if (tanimlayici && !/^\p{L}{3,}$/u.test(tanimlayici)) continue;
      const oncekiIsaret = sol.replace(/[ \t]+$/, "").slice(-1);
      const sonrasi = metin.slice(bas + tam.length);
      if (rakamlar.length === 1 && (oncekiIsaret === "" || oncekiIsaret === "\n" || ":;,".includes(oncekiIsaret)) && /^[ \t]+\p{L}/u.test(sonrasi)) continue;
    }
    bulunan.push(tam);
  }
  return bulunan;
}

/**
 * Üretilen metnin denetimi: atıflar kütüphanede mi, künye satırı var mı,
 * sayılar bağlamda mı. `stil`: metin içi atıf ayrıştırma biçimi.
 */
export function yazimDenetle(
  metin: string,
  kutuphane: KutuphaneKaydi[],
  baglamMetinleri: string[],
  stil: "apa7" | "chicago" | "mla" = "apa7",
  /** Numaralı stilin metin içi atıf kalıbı; yazar-tarih stillerinde null (C2-1). */
  numaraKalibi: RegExp | null = null,
): YazimDenetimi {
  if (!metin.trim()) return { gecti: true };
  const satir = KUNYE_SATIRI.exec(metin) ?? DOI.exec(metin);
  if (satir) return { gecti: false, neden: "kunye", ayrinti: [satir[0]] };
  if (numaraKalibi) {
    const numarali = numaraliAtiflar(metin, numaraKalibi);
    if (numarali.length) return { gecti: false, neden: "kunye", ayrinti: numarali, numarali: true };
  }

  const kaynaklar: ParsedReference[] = kutuphane.map((k) => ({
    raw: `${k.yazarlar ?? ""} (${k.yil ?? ""})`,
    authors: splitAuthors(k.yazarlar),
    year: k.yil,
    title: k.baslik,
    issues: [],
  }));
  /*
    Anlatı atfı da ("Yılmaz (2020)") kütüphanede olmak zorunda: çapraz
    kontrol yalnızca parantez içini "karşılıksız" raporluyor, burada her
    atıf parantez içi gibi sınanıyor.
  */
  const atiflar = extractInTextCitations(metin, { style: stil }).map((a) => ({ ...a, kind: "parenthetical" as const }));
  const { citationsWithoutReference } = crossCheck(atiflar, kaynaklar, { yilaBak: stil !== "mla" });
  if (citationsWithoutReference.length) return { gecti: false, neden: "kunye", ayrinti: citationsWithoutReference.map((a) => a.raw) };

  const uydurma = uydurmaSayilar(metin, baglamMetinleri.join("\n"));
  if (uydurma.length) return { gecti: false, neden: "uydurma_sayi", ayrinti: uydurma };
  return { gecti: true };
}
