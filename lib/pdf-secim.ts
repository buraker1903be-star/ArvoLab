import { ALINTI_EN_AZ, kanitMetniNormallestir } from "./kanit/alinti";

/*
  PDF'TEN SEÇİLEN PASAJ VE KAYNAK EŞLEŞMESİ (16.11.2026, Yazım Stüdyosu).
  Saf modül; testi tests/unit/pdf-secim.test.ts.

  1) SEÇİMİN DOĞRULANMASI. Görüntüleyici (tarayıcıda pdf.js'in metin
  katmanı) ile sunucunun metin çıkarımı (pdf-parse, aynı pdf.js sürümü)
  aynı karakterleri verir ama aralarındaki BOŞLUKLARI farklı kurabilir:
  satır sonu, iki sütun arası, tire ile bölünmüş kelime. Seçimi körü körüne
  kabul etmek, istemcinin gönderdiği herhangi bir metni "kaynaktan" diye
  asistana ve belgeye taşımak olurdu; birebir eşleşme istemek ise doğru
  seçimleri boşluk farkı yüzünden reddederdi.

  Kural: seçim, normalleştirilmiş (lib/kanit/alinti.ts) sayfa metninde önce
  birebir aranır; yoksa BOŞLUKLAR yok sayılarak (karakter sırası aynen
  korunur) aranır. Bulunursa dönen "kanonik" metin istemcinin seçimi DEĞİL,
  sunucunun kendi sayfa metninden kesilen parçadır: belgeye girecek alıntı
  ve asistana gidecek pasaj kaynağın kendi metni olur. Seçim sayfa sonunu
  aşabilir (bir sonraki sayfayla birlikte aranır). Bulunamazsa nedeniyle
  reddedilir — iki sütunlu sayfada sütunlar arası seçim ya da taranmış sayfa
  tipik nedenlerdir; kullanıcıya daha kısa, tek sütundan seçmesi söylenir.

  2) KAYNAK EŞLEŞMESİ. kaynak_pdfleri satırı Literatür kütüphanesine
  (literature_sources) yabancı anahtarla BAĞLI DEĞİL: satır, belgenin
  kaynakça girdisinin metninden (künye anahtarı) doğuyor. Güvenilir tek bağ
  DOI: iki tarafta da aynı DOI varsa ve tek kayıt eşleşiyorsa "kesin".
  Başlık benzerliği yalnızca ADAY gösterir, asla kendiliğinden seçmez:
  benzer başlıklı iki farklı çalışma (aynı yazarın iki makalesi, bir tez
  ve onun makalesi) yanlış kaynağa atıf demek. Belirsizlik kullanıcıya
  söylenir; atıf ancak onun açık seçimiyle eklenir.
*/

export const SECIM_EN_KISA = ALINTI_EN_AZ;
export const SECIM_EN_UZUN = 2_000;

export type PdfSayfasi = { num: number; text: string };

export type SecimSonucu =
  | { gecti: true; sayfa: number; kanonik: string; tur: "birebir" | "bosluk"; sonrakiSayfaya?: true }
  | { gecti: false; neden: "kisa" | "uzun" | "sayfa_yok" | "metinde_yok" };

/* Boşluksuz biçim ve her karakterin normalleştirilmiş metindeki yeri. */
function bosluksuz(metin: string): { s: string; yer: number[] } {
  let s = "";
  const yer: number[] = [];
  for (let i = 0; i < metin.length; i++) {
    if (metin[i] !== " ") {
      s += metin[i];
      yer.push(i);
    }
  }
  return { s, yer };
}

function metindeBul(secim: string, metin: string): { kanonik: string; tur: "birebir" | "bosluk" } | null {
  if (metin.includes(secim)) return { kanonik: secim, tur: "birebir" };
  const a = bosluksuz(secim).s;
  const m = bosluksuz(metin);
  if (!a) return null;
  const i = m.s.indexOf(a);
  if (i < 0) return null;
  // Eşleşen ilk ve son karakterin normalleştirilmiş metindeki yerleri arası: kaynağın kendi boşluklarıyla.
  return { kanonik: metin.slice(m.yer[i], m.yer[i + a.length - 1] + 1), tur: "bosluk" };
}

/**
 * Seçilen metin, bildirilen PDF sayfasında (gerekirse sonraki sayfayla birlikte) geçiyor mu?
 * Sayfa numarası pdf.js'in 1 tabanlı sayfa sırasıdır (PDF sayfası; basılı sayfa değil).
 */
export function secimiDogrula(secimHam: string, sayfalar: PdfSayfasi[], sayfaNo: number): SecimSonucu {
  const secim = kanitMetniNormallestir(secimHam ?? "");
  if (secim.length < SECIM_EN_KISA) return { gecti: false, neden: "kisa" };
  if (secim.length > SECIM_EN_UZUN) return { gecti: false, neden: "uzun" };
  const sayfa = sayfalar.find((s) => s.num === sayfaNo);
  if (!sayfa) return { gecti: false, neden: "sayfa_yok" };
  const bu = kanitMetniNormallestir(sayfa.text);
  const tek = metindeBul(secim, bu);
  if (tek) return { gecti: true, sayfa: sayfaNo, ...tek };
  const sonraki = sayfalar.find((s) => s.num === sayfaNo + 1);
  if (sonraki) {
    const ikili = metindeBul(secim, kanitMetniNormallestir(`${sayfa.text} ${sonraki.text}`));
    if (ikili) return { gecti: true, sayfa: sayfaNo, ...ikili, sonrakiSayfaya: true };
  }
  return { gecti: false, neden: "metinde_yok" };
}

/* ---------- DOI ---------- */

/** "https://doi.org/10.1000/ABC.", "doi:10.1000/abc" → "10.1000/abc"; DOI yoksa null. */
export function doiNormallestir(ham: string | null | undefined): string | null {
  const m = String(ham ?? "").match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  if (!m) return null;
  let doi = m[0];
  try {
    doi = decodeURIComponent(doi);
  } catch {
    /* Bozuk yüzde kaçışı ("%zz"): ham hâli kullanılır; fırlatmak atıf akışını düşürürdü. */
  }
  /*
    Sondaki noktalama cümleye aittir; kapanış parantezi ise yalnızca EŞİ
    YOKSA atılır: 10.1016/S0140-6736(20)30183-5 ya da …(b) gibi DOI'lerde
    parantez DOI'nin parçası. İlk sürüm her kapanış parantezini atıyordu ve
    böyle bir DOI kütüphanedeki kaydıyla hiç eşleşmezdi (birim testi).
  */
  const ESI: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const say = (k: string) => doi.split(k).length - 1;
  for (;;) {
    const son = doi.at(-1) ?? "";
    if (".,;:".includes(son) && son) doi = doi.slice(0, -1);
    else if (ESI[son] && say(ESI[son]) < say(son)) doi = doi.slice(0, -1);
    else break;
  }
  return doi.toLowerCase();
}

/* ---------- Kaynak eşleşmesi ---------- */

export type KutuphaneKaydi = { id: string; title: string; doi_or_url: string | null; project_id: string | null };

export type KaynakEslesmesi =
  | { tur: "kesin"; kaynakId: string; neden: "doi" | "bag" }
  | { tur: "belirsiz"; neden: "doi_coklu" | "doi_yok" | "doi_eslesmedi"; adaylar: string[] }
  | { tur: "yok"; neden: "doi_yok" | "doi_eslesmedi" };

const baslikAnahtari = (s: string) =>
  s
    .replace(/I/g, "ı")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Başlık ADAYI: biri ötekini içeriyor (en az 12 karakterlik anlamlı başlıkla). Asla kendiliğinden seçilmez. */
function baslikAdayiMi(pdfBaslik: string, kayitBaslik: string): boolean {
  const a = baslikAnahtari(pdfBaslik);
  const b = baslikAnahtari(kayitBaslik);
  if (a.length < 12 || b.length < 12) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * PDF satırının Literatür kütüphanesindeki karşılığı. Çalışmanın kendi kayıtları önce;
 * DOI tek kayıtla eşleşirse kesin, birden çoksa belirsiz; DOI yoksa ya da eşleşmezse
 * yalnızca başlık adayları (belirsiz) ya da hiç (yok).
 */
export function kaynakEslesmesi(
  pdf: { doi: string | null; baslik: string; kaynakId?: string | null },
  kayitlar: KutuphaneKaydi[],
  projectId: string,
): KaynakEslesmesi {
  /* Kullanıcının kurduğu açık bağ (K2-A) her tahminden önce gelir; bağlı kayıt kütüphanede yoksa (silinmiş) tahmine düşülür. */
  if (pdf.kaynakId && kayitlar.some((k) => k.id === pdf.kaynakId)) return { tur: "kesin", kaynakId: pdf.kaynakId, neden: "bag" };
  const pdfDoi = doiNormallestir(pdf.doi);
  const sirali = [...kayitlar].sort((x, y) => Number(y.project_id === projectId) - Number(x.project_id === projectId));
  if (pdfDoi) {
    const doiEs = sirali.filter((k) => doiNormallestir(k.doi_or_url) === pdfDoi);
    const buCalisma = doiEs.filter((k) => k.project_id === projectId);
    const havuz = buCalisma.length ? buCalisma : doiEs;
    if (havuz.length === 1) return { tur: "kesin", kaynakId: havuz[0].id, neden: "doi" };
    if (havuz.length > 1) return { tur: "belirsiz", neden: "doi_coklu", adaylar: havuz.map((k) => k.id) };
  }
  const neden = pdfDoi ? "doi_eslesmedi" : "doi_yok";
  const adaylar = sirali.filter((k) => baslikAdayiMi(pdf.baslik, k.title)).map((k) => k.id).slice(0, 5);
  return adaylar.length ? { tur: "belirsiz", neden, adaylar } : { tur: "yok", neden };
}

/*
  Seçimle asistana gidecek sayfalar: seçimin sayfası ve iki komşusu (bağlam:
  önceki sayfanın son paragrafı, sonraki sayfanın başı). Seçim sonraki sayfaya
  taşıyorsa o sayfanın komşusu da eklenir. İlk sürüm +2'yi her zaman
  ekliyordu; tek sayfalık seçimde gereksiz bir sayfa daha modele gidiyordu
  (tarayıcı kabulü S9, istem kaydında "1,2,3").
*/
export function secimSayfalari(sayfalar: PdfSayfasi[], sayfa: number, sonrakiSayfaya: boolean): PdfSayfasi[] {
  const son = sayfa + (sonrakiSayfaya ? 2 : 1);
  return sayfalar.filter((p) => p.num >= sayfa - 1 && p.num <= son);
}
