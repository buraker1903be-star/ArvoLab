/*
  ANALİZ MERKEZİ'NİN VERİ OKUMASI (28.10.2026). Saf modül; testi
  tests/unit/veri-okuma.test.ts.

  Eskiden dosya doğrudan SheetJS'e veriliyordu. Türkçe Excel'in "CSV
  (noktalı virgülle ayrılmış)" kaydı üç yerden birden bozuluyordu, ve
  HİÇBİRİ hata vermiyordu:
    - "3,5" 35, "4,25" 425 okunuyordu (virgül ondalık değil binlik
      sayıldı) — Likert ortalamaları on-yüz kat büyük, t/F/r onlarla.
    - "1.250" 1,25 okunuyordu (nokta binlik değil ondalık sayıldı).
    - Windows-1254 kodlu dosyada "Şehir" "ehir", "İzmir" "Ýzmir" oldu.
  Ayrıca yalnızca boşluk içeren hücre Number(" ") = 0 olduğu için GERÇEK
  bir 0 sayılıyordu: hücreyi boşlukla "silen" kullanıcının ortalaması
  sessizce düşüyordu.

  Karar DOSYA başına veriliyor, hücre başına değil: "1.250" tek başına
  belirsiz (bin iki yüz elli mi, bir virgül yirmi beş mi), ama aynı
  dosyanın ayırıcısı ve öteki hücreleri bunu söylüyor. Kullanıcıya hangi
  kararın verildiği yazılıyor (`notlar`): sessiz bir tahmin, sessiz bir
  yanlıştan farksızdır.
*/

import type { Dil } from "@/lib/dil";

export type Hucre = string | number | boolean | null;
export type Satir = Record<string, Hucre>;
export type OndalikAyirici = "virgul" | "nokta";

/* ---------- Metin kodlaması ---------- */

/**
 * UTF-8 olarak çözülemeyen (geçersiz bayt dizisi içeren) dosya Windows-1254
 * sayılır: Türkçe Windows'ta Excel'in "CSV" kaydı bu kodlamayla yazılır.
 */
export function metniCoz(bayt: Uint8Array): { metin: string; kodlama: "utf-8" | "windows-1254" } {
  try {
    const metin = new TextDecoder("utf-8", { fatal: true }).decode(bayt);
    return { metin: metin.replace(/^﻿/, ""), kodlama: "utf-8" };
  } catch {
    return { metin: new TextDecoder("windows-1254").decode(bayt), kodlama: "windows-1254" };
  }
}

/* ---------- CSV ---------- */

/**
 * Tırnak dışındaki ayırıcı sayısına göre: ilk satırlarda en tutarlı olan.
 * Başlıkta hiçbir ayırıcı yoksa dosya TEK SÜTUNDUR ve "" döner (bölünmez).
 * Eskiden varsayılan "," dönüyordu: tek sütunlu Türkçe dosyada "3,5"
 * iki alana bölünüyor, ikinci alan atılıyor ve 3,5 sessizce 3 oluyordu —
 * ortalama ve bütün test istatistikleri yanlış, hiçbir uyarı yok.
 */
export function ayiriciBul(metin: string): ";" | "," | "\t" | "" {
  const satirlar = metin.split(/\r?\n/).filter((s) => s.trim()).slice(0, 20);
  let enIyi: ";" | "," | "\t" | "" = "";
  let enIyiPuan = -1;
  for (const ayirici of [";", "\t", ","] as const) {
    const sayilar = satirlar.map((s) => alanlaraBol(s, ayirici).length - 1);
    if (!sayilar.length || sayilar[0] === 0) continue;
    /* Bütün satırlarda aynı sayıda ayırıcı: gerçek ayırıcının izi. */
    const tutarli = sayilar.filter((n) => n === sayilar[0]).length;
    const puan = tutarli * 100 + sayilar[0];
    if (puan > enIyiPuan) {
      enIyiPuan = puan;
      enIyi = ayirici;
    }
  }
  return enIyi;
}

function alanlaraBol(satir: string, ayirici: string): string[] {
  return csvCoz(satir, ayirici)[0] ?? [];
}

/** RFC 4180: tırnaklı alan, alan içinde ayırıcı ve satır sonu, "" kaçışı. */
export function csvCoz(metin: string, ayirici: string): string[][] {
  const satirlar: string[][] = [];
  let satir: string[] = [];
  let alan = "";
  let tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"') {
        if (metin[i + 1] === '"') {
          alan += '"';
          i++;
        } else tirnak = false;
      } else alan += c;
    } else if (c === '"' && alan === "") tirnak = true;
    else if (c === ayirici) {
      satir.push(alan);
      alan = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && metin[i + 1] === "\n") i++;
      satir.push(alan);
      satirlar.push(satir);
      satir = [];
      alan = "";
    } else alan += c;
  }
  if (alan !== "" || satir.length) {
    satir.push(alan);
    satirlar.push(satir);
  }
  return satirlar.filter((s) => s.some((a) => a.trim() !== ""));
}

/* ---------- Sayı ---------- */

const VIRGUL_ONDALIK = /^-?\d+,\d+$/;
const NOKTA_ONDALIK = /^-?\d+\.\d+$/;
const BINLIK_NOKTALI = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * Hücre metinlerinden ondalık ayırıcıyı çıkarır. Noktalı virgül ayırıcı
 * Türkçe Excel'in imzası (virgül ondalık olduğu için ayırıcı olamıyor);
 * virgül ayırıcıda ondalık zorunlu olarak nokta. Sekmede hücrelere bakılır.
 */
export function ondalikBul(hucreler: string[], ayirici: string | null): OndalikAyirici {
  if (ayirici === ";") return "virgul";
  if (ayirici === ",") return "nokta";
  let virgul = 0;
  let nokta = 0;
  for (const h of hucreler) {
    const t = h.trim();
    if (VIRGUL_ONDALIK.test(t)) virgul++;
    /* "1.250" belirsiz; yalnızca üç haneli olmayan kesir noktayı kanıtlar. */
    else if (NOKTA_ONDALIK.test(t) && !BINLIK_NOKTALI.test(t)) nokta++;
  }
  return virgul > nokta ? "virgul" : "nokta";
}

/**
 * Tek hücrenin değeri. Sayıya benzemeyen metin olduğu gibi kalır; yalnızca
 * boşluktan oluşan hücre BOŞTUR (null), 0 değil.
 */
export function hucreDegeri(ham: Hucre, ondalik: OndalikAyirici): Hucre {
  if (typeof ham !== "string") return ham;
  const t = ham.trim();
  if (t === "") return null;
  let sayi: string | null = null;
  if (ondalik === "virgul") {
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) sayi = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d+(,\d+)?$/.test(t)) sayi = t.replace(",", ".");
    else if (/^-?,\d+$/.test(t)) sayi = t.replace(",", "0.");
    /* Aynı dosyada noktayla yazılmış "1.5": üç haneli kesir değilse binlik olamaz. */
    else if (NOKTA_ONDALIK.test(t) && !BINLIK_NOKTALI.test(t)) sayi = t;
  } else {
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) sayi = t.replace(/,/g, "");
    else if (/^-?\d+(\.\d+)?$/.test(t)) sayi = t;
    else if (/^-?\.\d+$/.test(t)) sayi = t.replace(".", "0.");
  }
  if (sayi === null) return t;
  const n = Number(sayi);
  return Number.isFinite(n) ? n : t;
}

/* ---------- Tablo ---------- */

export interface OkunanVeri {
  sutunlar: string[];
  satirlar: Satir[];
  /** Kullanıcıya gösterilecek kararlar ("ondalık virgül olarak okundu"…). */
  notlar: string[];
  /** Yalnızca metin dosyasında: R/Python betiği dosyayı AYNI kararlarla okusun (lib/analiz-betik.ts). */
  metinBicimi?: MetinBicimi;
}

export type MetinBicimi = { ayirici: ";" | "," | "\t" | ""; ondalik: OndalikAyirici; kodlama: "utf-8" | "windows-1254" };

/** Başlık satırı + gövde → satır nesneleri. Boş/tekrarlanan başlıklar adlandırılır. */
export function tabloKur(
  basliklar: string[],
  govde: Hucre[][],
  ondalik: OndalikAyirici,
  dil: Dil = "tr",
): { sutunlar: string[]; satirlar: Satir[]; fazlaAlanliSatir: number } {
  const kullanilan = new Map<string, number>();
  const sutunlar = basliklar.map((b, i) => {
    const ad = String(b ?? "").trim() || `${dil === "en" ? "Column" : "Sütun"} ${i + 1}`;
    const kez = kullanilan.get(ad) ?? 0;
    kullanilan.set(ad, kez + 1);
    return kez ? `${ad} (${kez + 1})` : ad;
  });
  const satirlar = govde
    .map((hucreler) => Object.fromEntries(sutunlar.map((s, i) => [s, hucreDegeri(hucreler[i] ?? null, ondalik)])) as Satir)
    .filter((satir) => Object.values(satir).some((v) => v !== null));
  /* Başlıktan fazla alanı olan satırın fazlası atılıyor; sessiz kalmasın. */
  const fazlaAlanliSatir = govde.filter((h) => h.slice(sutunlar.length).some((v) => v !== null && String(v).trim() !== "")).length;
  return { sutunlar, satirlar, fazlaAlanliSatir };
}

/** CSV/TSV metni: kodlama, ayırıcı ve ondalık kararlarıyla. */
export function csvOku(bayt: Uint8Array, dil: Dil = "tr"): OkunanVeri {
  const en = dil === "en";
  const { metin, kodlama } = metniCoz(bayt);
  const ayirici = ayiriciBul(metin);
  const ham = csvCoz(metin, ayirici);
  const [basliklar = [], ...govde] = ham;
  const ondalik = ondalikBul(govde.flat(), ayirici || null);
  const { sutunlar, satirlar, fazlaAlanliSatir } = tabloKur(basliklar, govde, ondalik, dil);
  const notlar: string[] = [];
  if (fazlaAlanliSatir) {
    notlar.push(
      en
        ? `${fazlaAlanliSatir} row(s) have more fields than the header; the extra fields were ignored. Check the separator and quoting.`
        : `${fazlaAlanliSatir} satırda başlıktan fazla alan var; fazla alanlar alınmadı. Ayırıcıyı ve tırnakları kontrol edin.`,
    );
  }
  if (kodlama === "windows-1254") {
    notlar.push(en ? "The file was read with Turkish Windows encoding (Windows-1254)." : "Dosya Türkçe Windows kodlamasıyla (Windows-1254) okundu.");
  }
  if (ondalik === "virgul") {
    notlar.push(
      en
        ? "The comma was read as the decimal separator (3,5 → 3.5; 1.250 → 1250)."
        : "Ondalık ayırıcı virgül olarak okundu (3,5 → 3.5; 1.250 → 1250).",
    );
  }
  return { sutunlar, satirlar, notlar, metinBicimi: { ayirici, ondalik, kodlama } };
}

/**
 * Excel'den gelen satırlar: sayı hücreleri zaten sayı. Metin olarak
 * saklanmış sayılar ("3,5" metin biçimli hücrede) ve boşluk hücreleri
 * aynı kurallardan geçer; ondalık, metin hücrelerinin kendisinden çıkarılır.
 */
export function excelSatirlariniDuzelt(sutunlar: string[], satirlar: Record<string, unknown>[], dil: Dil = "tr"): OkunanVeri {
  const metinler = satirlar.flatMap((s) => sutunlar.map((c) => s[c]).filter((v): v is string => typeof v === "string"));
  const ondalik = ondalikBul(metinler, null);
  const govde = satirlar.map((s) => sutunlar.map((c) => (s[c] ?? null) as Hucre));
  // Excel satırları zaten başlığa göre anahtarlı: fazla alan oluşamaz.
  const { sutunlar: tabloSutunlari, satirlar: tabloSatirlari } = tabloKur(sutunlar, govde, ondalik, dil);
  const tablo = { sutunlar: tabloSutunlari, satirlar: tabloSatirlari };
  const notlar = ondalik === "virgul" && metinler.some((m) => VIRGUL_ONDALIK.test(m.trim()))
    ? [
        dil === "en"
          ? "In numbers stored as text, the comma was read as the decimal separator."
          : "Metin olarak saklanmış sayılarda ondalık ayırıcı virgül olarak okundu.",
      ]
    : [];
  return { ...tablo, notlar };
}

/**
 * Grup değişkeni olabilecek sayısal sütunlar: 2–10 farklı TAM SAYI değer
 * (Cinsiyet 1/2, Sınıf 1/2/3). SPSS'ten gelen veride gruplar hep böyle
 * kodlanıyor; eskiden bu sütunlar yalnızca "sayısal" sayıldığı için
 * t-testi, ANOVA, ki-kare gibi analizlerin grup listesi boş kalıyordu.
 */
export function kodluGrupSutunlari(sutunlar: string[], satirlar: Satir[]): string[] {
  return sutunlar.filter((s) => {
    const degerler = new Set<number>();
    for (const satir of satirlar) {
      const v = satir[s];
      if (v === null || v === "") continue;
      if (typeof v !== "number" || !Number.isInteger(v)) return false;
      degerler.add(v);
      if (degerler.size > 10) return false;
    }
    return degerler.size >= 2;
  });
}
