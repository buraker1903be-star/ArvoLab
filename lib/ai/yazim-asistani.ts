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

export type YazimGorevi = "serbest" | "devam" | "paragraf" | "akademik" | "kisalt" | "genislet";

export type KutuphaneKaydi = {
  yazarlar: string | null;
  yil: string | null;
  baslik: string;
  yayin?: string | null;
  not?: string | null;
};

export type SohbetMesaji = { rol: "kullanici" | "asistan"; metin: string };

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
6. Kullanıcı yalnızca bir şey soruyorsa (metin istemiyorsa) "metin" alanını boş bırak.`;

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
    `BELGENİN DİLİ: ${g.belgeDili === "en" ? "İngilizce (metni İngilizce yaz; atıfta 've' yerine 'and', 'vd.' yerine 'et al.')" : "Türkçe"}`,
    `ATIF STİLİ: ${g.atifStili}`,
    `KÜTÜPHANE (atıf yapılabilecek TEK kaynaklar):\n${kutuphane.length ? kutuphane.join("\n") : "(boş — hiçbir atıf yapma)"}`,
    g.bolum ? `İMLECİN BULUNDUĞU BÖLÜM: ${bastanKirp(g.bolum, 200)}` : "",
    g.oncesi ? `BELGEDE İMLEÇTEN ÖNCEKİ METİN:\n${kirp(g.oncesi, SINIR.oncesi)}` : "",
    g.secim ? `SEÇİLİ METİN:\n${bastanKirp(g.secim, SINIR.secim)}` : "",
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
    ...gecmis,
    { rol: "kullanici", metin: istek },
  ];
  return { mesajlar, kaynak: `${baglam}\n\nİSTEK: ${istek}` };
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
  | { gecti: false; neden: "kunye"; ayrinti: string[] }
  | { gecti: false; neden: "uydurma_sayi"; ayrinti: string[] };

/**
 * Üretilen metnin denetimi: atıflar kütüphanede mi, künye satırı var mı,
 * sayılar bağlamda mı. `stil`: metin içi atıf ayrıştırma biçimi.
 */
export function yazimDenetle(
  metin: string,
  kutuphane: KutuphaneKaydi[],
  baglamMetinleri: string[],
  stil: "apa7" | "chicago" | "mla" = "apa7",
): YazimDenetimi {
  if (!metin.trim()) return { gecti: true };
  const satir = KUNYE_SATIRI.exec(metin) ?? DOI.exec(metin);
  if (satir) return { gecti: false, neden: "kunye", ayrinti: [satir[0]] };

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

/** Eklenebilir metin → paragraflar (boş satırla ayrılmış). */
export function paragraflara(metin: string): string[] {
  return metin
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
