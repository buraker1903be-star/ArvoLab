import { headingMatchesSection } from "@/lib/section-match";

/*
  KAYNAKÇA BÖLÜMÜNÜN SINIRI VE "BU SATIR KÜNYE Mİ" KARARI — TEK YERDE
  (03.11.2026, kurum sahibinin örnek tezle yaptığı karşılaştırma).

  Eskiden iki rapor kaynakçayı iki ayrı kuralla okuyordu:
    - Sunucudaki kontrol (app/actions/manuscript.ts) düz metinde "Kaynakça"
      sözcüğünün İLK geçtiği satırdan BELGE SONUNA kadar her şeyi künye
      sayıyordu. Örnek tezde bu satır İçindekiler listesindeydi: tezin
      bütün gövdesi 367 "künye" oldu, APA puanı 0'a düştü. İçindekiler
      silinince de Ek 1'in CSV satırları ve Ek 2'nin Python kodu künye
      sayıldı; her biri "metinde atıf yok" uyarısı aldı.
    - Yapı denetimi (lib/structure-check.ts) bölümü doğru kesiyordu ama
      ekleri yalnızca aynı ya da üst düzeyde başlıklarsa ayırıyordu.

  Kurallar:
    1. Kaynakça bölümü bir BAŞLIKTIR (liste maddesi değil: İçindekiler'deki
       "Kaynakça" satırı bölüm değildir).
    2. Bölüm, kendisiyle aynı ya da daha üst düzeydeki ilk başlıkta biter.
       Ek başlığı ("Ek 1.", "EK-2", "Ekler", "Appendix A") düzeyinden
       bağımsız olarak bölümü bitirir: ek, kaynakçanın alt bölümü olamaz.
    3. Künye adayı yazar/kurum + yıl taşır (kunyeAdayiMi). Taşımayan satır
       künye sayılmaz ve RAPORLANMAZ — bir CSV satırına "yıl yok" demek
       öğrenciye bir şey öğretmez.

  Saf modül; testi tests/unit/kaynakca-bolumu.test.ts.
*/

export interface Dugum {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Dugum[];
}

export const KAYNAKCA_ADLARI = ["Kaynakça", "Kaynaklar", "References", "Bibliography", "Bibliyografya", "Reference List", "Works Cited"];

/*
  Liste bölümleri: içerikleri gövde metni DEĞİLDİR. "Tablolar Listesi"
  satırındaki "Tablo 1. …" metinde anılma sayılıyordu; örnek tezde 12
  tablonun hiçbiri "metinde anılmıyor" uyarısı almadı, oysa 11'i
  anılmıyordu. Kısaltmalar bölümü ayrıca sözlük olarak okunur
  (lib/kisaltmalar.ts).
*/
export const LISTE_BOLUMLERI = [
  "İçindekiler",
  "İçindekiler Tablosu",
  "Tablolar Listesi",
  "Şekiller Listesi",
  "Çizelgeler Listesi",
  "Grafikler Listesi",
  "Resimler Listesi",
  "Kısaltmalar",
  "Kısaltmalar Listesi",
  "Simgeler ve Kısaltmalar",
  "Simgeler ve Kısaltmalar Listesi",
  "Contents",
  "Table of Contents",
  "List of Tables",
  "List of Figures",
  "Abbreviations",
  "List of Abbreviations",
];
export const KISALTMA_BOLUMLERI = ["Kısaltmalar", "Kısaltmalar Listesi", "Simgeler ve Kısaltmalar", "Simgeler ve Kısaltmalar Listesi", "Abbreviations", "List of Abbreviations"];

/*
  Ek başlığı: "Ekler", "EKLER", "Appendices" tek başına; ya da "Ek 1.",
  "EK-2", "Ek A", "Appendix B". "Ekonomi", "Ekinci" ve "Ek ve tablolar"
  ek başlığı DEĞİL: "Ek"ten sonraki numara/harfin ardından harf gelemez.
*/
const EK_BASLIGI = /^(?:ekler|appendices)$|^(?:ek|appendix)\s*[-–.:]?\s*(?:\d+|[a-zçğıöşü])(?![\p{L}])/iu;
export const ekBasligiMi = (metin: string): boolean => EK_BASLIGI.test(metin.trim());

const metinAl = (d: Dugum): string => (d.type === "text" ? (d.text ?? "") : (d.content ?? []).map(metinAl).join(""));
const duzey = (d: Dugum) => Number(d.attrs?.level) || 1;

export interface Aralik {
  /** Başlığın sırası (üst düzey düğüm) */
  bas: number;
  /** Bölümün bittiği sıra (dahil değil) */
  bit: number;
}

/** Başlığın bölümü: aynı ya da üst düzeydeki ilk başlığa kadar (kaynakçada ek başlığına kadar). */
function bolumAraligi(bloklar: Dugum[], bas: number, ekteBiter: boolean): Aralik {
  const ust = duzey(bloklar[bas]);
  for (let i = bas + 1; i < bloklar.length; i++) {
    const b = bloklar[i];
    if (b.type !== "heading") continue;
    if (duzey(b) <= ust || (ekteBiter && ekBasligiMi(metinAl(b)))) return { bas, bit: i };
  }
  return { bas, bit: bloklar.length };
}

export interface BelgeBolumleri {
  kaynakca: Aralik | null;
  /** İçindekiler, listeler, kısaltmalar: gövde metni değil */
  listeler: (Aralik & { ad: string })[];
  kisaltmalar: Aralik | null;
}

export function belgeBolumleri(bloklar: Dugum[]): BelgeBolumleri {
  let kaynakca: Aralik | null = null;
  let kisaltmalar: Aralik | null = null;
  const listeler: (Aralik & { ad: string })[] = [];
  bloklar.forEach((b, i) => {
    if (b.type !== "heading") return;
    const metin = metinAl(b).trim();
    if (!kaynakca && KAYNAKCA_ADLARI.some((ad) => headingMatchesSection(metin, ad))) kaynakca = bolumAraligi(bloklar, i, true);
    if (LISTE_BOLUMLERI.some((ad) => headingMatchesSection(metin, ad))) {
      const aralik = bolumAraligi(bloklar, i, false);
      listeler.push({ ...aralik, ad: metin });
      if (!kisaltmalar && KISALTMA_BOLUMLERI.some((ad) => headingMatchesSection(metin, ad))) kisaltmalar = aralik;
    }
  });
  return { kaynakca, listeler, kisaltmalar };
}

export const aralikta = (a: Aralik | null, i: number) => a !== null && i > a.bas && i < a.bit;

/*
  KÜNYE ADAYI: en az iki harfli bir sözcük ve yazar/kurum + yıl deseni.
  Yıl biçimleri: "(2022)", "(2026a)", "(t.y.)", "(n.d.)" (APA ve
  yazar-tarih); "2020." (Chicago, IEEE); "2020;" (Vancouver). Ya da yıl
  hiç yoksa bile "Soyad, A." ile başlayan bir yazar — yılı unutulmuş
  gerçek bir künye sessizce kaybolmasın, "yıl yok" hatası alsın.

  Elenenler: CSV satırları ("2000,39.03,6.5", "Yil,ENF,ISS"), kod
  ("import numpy as np", "# Birim kök"), ek başlıkları ve açıklamaları.
*/
const YIL = String.raw`(?:1[5-9]\d{2}|20\d{2})[a-z]?`;
const PARANTEZLI_YIL = new RegExp(String.raw`\(\s*(?:${YIL}|t\.\s?y\.|n\.\s?d\.)\s*[,)]`, "iu");
const NOKTALI_YIL = new RegExp(String.raw`[\s,(]${YIL}[.;:]`, "u");
const YAZAR_BASI = /^\[?\d{0,3}[.\]]?\s*\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*,\s*\p{Lu}\./u;
const KOD_IZI = /^(?:#|\/\/|import\s|from\s\S+\simport|def\s|print\(|for\s|if\s|return\s)|[=]{1,2}\s*\S+\(|\bpd\.|\bnp\./u;

/** Yapıştırılmış kod satırı (Python, R): kısaltma tanımı ya da künye olamaz. */
export const kodSatiriMi = (satir: string): boolean => KOD_IZI.test(satir.trim());

export function kunyeAdayiMi(satir: string): boolean {
  const metin = satir.trim();
  if (metin.length < 10) return false;
  if (KOD_IZI.test(metin)) return false;
  if (!/\p{L}{2,}/u.test(metin)) return false;
  // Harf, yıldan ÖNCE gelmeli: "2000,39.03,6.5" ya da "2021 yılında…" künye değil.
  const bas = metin.slice(0, 220);
  const yil = PARANTEZLI_YIL.exec(bas) ?? NOKTALI_YIL.exec(bas);
  if (yil && /\p{L}{2,}/u.test(bas.slice(0, yil.index))) return true;
  return YAZAR_BASI.test(metin);
}

export interface KaynakcaGirdileri {
  girdiler: string[];
  /** Kaynakça liste (madde işareti/numara) olarak yazılmış */
  listede: boolean;
  /** Asılı girintisi olmayan paragraf sayısı (künye olanlar) */
  asiliEksik: number;
}

/**
 * Kaynakça bölümündeki künyeler: dolu paragraflar ve liste maddeleri.
 * Tablolar, görseller ve kod blokları hiç okunmaz; künye adayı olmayan
 * satırlar elenir (raporlanmaz).
 */
export function kaynakcaGirdileri(
  bloklar: Dugum[],
  aralik: Aralik | null,
  asiliGirintiVar: (attrs: Record<string, unknown> | undefined) => boolean = () => true,
): KaynakcaGirdileri {
  const sonuc: KaynakcaGirdileri = { girdiler: [], listede: false, asiliEksik: 0 };
  if (!aralik) return sonuc;
  const topla = (d: Dugum) => {
    if (d.type === "paragraph") {
      const metin = metinAl(d).trim();
      if (!kunyeAdayiMi(metin)) return;
      sonuc.girdiler.push(metin);
      if (!asiliGirintiVar(d.attrs)) sonuc.asiliEksik += 1;
      return;
    }
    if (d.type !== "bulletList" && d.type !== "orderedList") return;
    sonuc.listede = true;
    for (const madde of d.content ?? []) {
      const cocuklar = madde.content ?? [];
      const metin = cocuklar.filter((c) => c.type === "paragraph").map(metinAl).join(" ").trim();
      if (kunyeAdayiMi(metin)) sonuc.girdiler.push(metin);
      for (const c of cocuklar) if (c.type !== "paragraph") topla(c);
    }
  };
  for (let i = aralik.bas + 1; i < aralik.bit; i++) topla(bloklar[i]);
  return sonuc;
}

/*
  DÜZ METİN İÇİN AYNI KURAL (Belge Kontrol ve Atıf Kontrolü; ellerinde
  belge ağacı değil, Word/PDF'ten çıkarılmış düz metin var).

  "Kaynakça" başlığı ayrı bir satırdır. Birden çok varsa (İçindekiler'de
  de geçer) ardından künye gelen SONUNCUSU seçilir; hiçbirinin ardından
  künye gelmiyorsa sonuncusu. Bölüm ek başlığı satırında biter; ekler yine
  gövdedir (eklerde anılan kaynak da anılmıştır).
*/
const KAYNAKCA_SATIRI = /^\s*(KAYNAKÇA|KAYNAKLAR|REFERENCES|REFERENCE LIST|WORKS CITED|BIBLIOGRAPHY|BİBLİYOGRAFYA)\s*$/iu;

export function metniBol(tamMetin: string): { bodyText: string; referenceText: string } {
  const satirlar = tamMetin.split("\n");
  const adaylar = satirlar.map((s, i) => (KAYNAKCA_SATIRI.test(s) ? i : -1)).filter((i) => i >= 0);
  if (!adaylar.length) return { bodyText: tamMetin, referenceText: "" };
  const kunyeIzliyor = (i: number) =>
    satirlar.slice(i + 1).filter((s) => s.trim()).slice(0, 3).some((s) => kunyeAdayiMi(s));
  const bas = [...adaylar].reverse().find(kunyeIzliyor) ?? adaylar[adaylar.length - 1];
  let bit = satirlar.length;
  for (let i = bas + 1; i < satirlar.length; i++) {
    const s = satirlar[i].trim();
    if (s.length <= 120 && ekBasligiMi(s)) {
      bit = i;
      break;
    }
  }
  return {
    bodyText: [...satirlar.slice(0, bas), ...satirlar.slice(bit)].join("\n"),
    referenceText: satirlar.slice(bas + 1, bit).join("\n"),
  };
}
