/*
  ETİK KURUL YÖNERGESİNDEN BELGE LİSTESİ (02.11.2026). Saf modül; testi
  tests/unit/etik-belgeler.test.ts.

  Liste SÖZLÜKLE çıkarılır, yapay zekâyla değil. Kurulların istediği
  belgeler sınırlı ve adları kalıplaşmış (başvuru formu, onam formu,
  ölçek izni…); sözlük yalnızca yönergede GEÇEN belgeyi listeye koyar ve
  geçtiği cümleyi kanıt olarak yanına yazar. Model bir yönergeyi okuyup
  "kurul şunu da istiyor" diyebilirdi — kurulun istemediği bir belgeyi
  hazırlatmak ya da istediğini atlamak, başvurunun geri dönmesi demek.
  Sözlükte olmayan bir belgeyi öğrenci ELLE ekler (kaynak: "elle").

  Eşleşme katlanmış metinde (lib/arama-katlama.ts): büyük/küçük harf ve
  ı/i farkı yok sayılır. Katlama uzunluğu koruduğu için alıntı özgün
  metinden aynı konumla kesilir.
*/
import type { Metin } from "@/lib/dil";
import { katla } from "@/lib/arama-katlama";

export type BelgeDurumu = "eksik" | "hazirlaniyor" | "hazir";
export type EtikBelge = {
  /** Sözlük anahtarı ya da elle eklenende "elle-<n>". */
  anahtar: string;
  ad: string;
  durum: BelgeDurumu;
  kaynak: "yonerge" | "elle";
  /** Yönergede geçtiği cümle (yalnızca kaynak "yonerge"). */
  alinti?: string | null;
};

export const BELGE_DURUMLARI: BelgeDurumu[] = ["eksik", "hazirlaniyor", "hazir"];
export const EN_COK_BELGE = 40;

type SozlukSatiri = { anahtar: string; ad: Metin; ifadeler: string[] };

/*
  İfadeler katlanmış biçimde eşlenir; yazarken doğal Türkçe yazılabilir,
  derlenirken katlanıyor. Kısa ve çok anlamlı sözcükler (yalnızca "form",
  "izin", "beyan") bilerek yok: her yönergede geçer ve listeyi şişirir.
*/
const SOZLUK: SozlukSatiri[] = [
  { anahtar: "basvuru_formu", ad: { tr: "Başvuru formu", en: "Application form" }, ifadeler: ["başvuru formu", "başvuru dilekçesi", "application form"] },
  { anahtar: "arastirma_protokolu", ad: { tr: "Araştırma protokolü / planı", en: "Research protocol / plan" }, ifadeler: ["araştırma protokolü", "araştırma planı", "araştırma önerisi", "araştırma projesi özeti", "research protocol", "research proposal", "study protocol"] },
  { anahtar: "onam_formu", ad: { tr: "Bilgilendirilmiş onam formu", en: "Informed consent form" }, ifadeler: ["onam formu", "bilgilendirilmiş onam", "gönüllü olur formu", "aydınlatılmış onam", "informed consent"] },
  { anahtar: "veli_onami", ad: { tr: "Veli / ebeveyn onam formu", en: "Parental consent form" }, ifadeler: ["veli onam", "veli izin", "ebeveyn onam", "parental consent"] },
  { anahtar: "veri_toplama_araclari", ad: { tr: "Veri toplama araçları (anket, ölçek, görüşme formu)", en: "Data collection instruments (survey, scale, interview guide)" }, ifadeler: ["veri toplama araç", "anket formu", "görüşme formu", "görüşme soruları", "questionnaire", "interview guide", "data collection instrument", "survey instrument"] },
  { anahtar: "olcek_izni", ad: { tr: "Ölçek kullanım izni", en: "Permission to use the scale" }, ifadeler: ["ölçek kullanım izni", "ölçeğin kullanım izni", "ölçek izni", "ölçek sahibinden", "permission to use the scale", "permission to use the instrument"] },
  { anahtar: "kurum_izni", ad: { tr: "Kurum izni (uygulama yapılacak yer)", en: "Institutional / site permission" }, ifadeler: ["kurum izni", "kurum izin", "uygulama izni", "izin yazısı", "institutional permission", "site permission", "letter of permission"] },
  { anahtar: "ozgecmis", ad: { tr: "Araştırmacı özgeçmişleri", en: "Researchers' CVs" }, ifadeler: ["özgeçmiş", "curriculum vitae"] },
  { anahtar: "taahhutname", ad: { tr: "Taahhütname / sorumlu araştırmacı beyanı", en: "Declaration / undertaking" }, ifadeler: ["taahhütname", "sorumlu araştırmacı beyanı", "araştırmacı beyanı", "undertaking", "declaration of the researcher"] },
  { anahtar: "danisman_onayi", ad: { tr: "Danışman onayı / imzası", en: "Supervisor approval / signature" }, ifadeler: ["danışman onayı", "danışmanın onayı", "danışman imzası", "tez danışmanı onayı", "supervisor approval", "supervisor's approval", "supervisor signature"] },
  { anahtar: "butce", ad: { tr: "Bütçe / destek belgesi", en: "Budget / funding document" }, ifadeler: ["bütçe", "budget"] },
  { anahtar: "kaynakca", ad: { tr: "Kaynakça", en: "References" }, ifadeler: ["kaynakça", "kaynaklar listesi"] },
];

const SOZLUK_KATLI = SOZLUK.map((s) => ({ ...s, katli: s.ifadeler.map(katla) }));

export const sozlukAdi = (anahtar: string): Metin | null => SOZLUK.find((s) => s.anahtar === anahtar)?.ad ?? null;

/* Alıntı: eşleşmenin geçtiği cümle, en fazla ~220 karakter. */
function cumle(metin: string, konum: number, uzunluk: number): string {
  const once = metin.lastIndexOf(".", konum);
  const sonra = metin.indexOf(".", konum + uzunluk);
  let bas = once === -1 ? 0 : once + 1;
  let son = sonra === -1 ? metin.length : sonra + 1;
  if (son - bas > 220) {
    bas = Math.max(bas, konum - 90);
    son = Math.min(son, konum + uzunluk + 110);
  }
  return metin.slice(bas, son).replace(/\s+/g, " ").trim();
}

/** Yönergede geçen belgeler, sözlük sırasıyla; her biri ilk geçtiği cümleyle. */
export function yonergedenBelgeler(metin: string): { anahtar: string; ad: Metin; alinti: string }[] {
  const katli = katla(metin);
  const bulunan: { anahtar: string; ad: Metin; alinti: string }[] = [];
  for (const satir of SOZLUK_KATLI) {
    let ilk = -1;
    let uzunluk = 0;
    for (const ifade of satir.katli) {
      const konum = katli.indexOf(ifade);
      if (konum !== -1 && (ilk === -1 || konum < ilk)) {
        ilk = konum;
        uzunluk = ifade.length;
      }
    }
    if (ilk !== -1) bulunan.push({ anahtar: satir.anahtar, ad: satir.ad, alinti: cumle(metin, ilk, uzunluk) });
  }
  return bulunan;
}

/*
  Yeni tarama mevcut listeye KATILIR, onu silmez: öğrencinin işaretlediği
  durumlar ve elle eklediği satırlar korunur. Önceki yönergeden gelip yenisinde
  geçmeyen satır silinmez — öğrenci belgeyi hazırlamış olabilir; yalnızca
  yeni yönergede geçenlerin alıntısı güncellenir.
*/
export function belgeleriBirlestir(
  mevcut: EtikBelge[],
  bulunan: { anahtar: string; ad: Metin; alinti: string }[],
  dil: "tr" | "en",
): EtikBelge[] {
  const sonuc = mevcut.map((b) => ({ ...b }));
  for (const yeni of bulunan) {
    const var_ = sonuc.find((b) => b.anahtar === yeni.anahtar);
    if (var_) {
      var_.alinti = yeni.alinti;
      var_.kaynak = "yonerge";
    } else {
      sonuc.push({ anahtar: yeni.anahtar, ad: yeni.ad[dil], durum: "eksik", kaynak: "yonerge", alinti: yeni.alinti });
    }
  }
  return sonuc.slice(0, EN_COK_BELGE);
}

/** İstemciden gelen listeyi temizler; biçimi bozuk satır sessizce düşer, sınırlar uygulanır. */
export function belgeListesiniTemizle(ham: unknown): EtikBelge[] {
  if (!Array.isArray(ham)) return [];
  const sonuc: EtikBelge[] = [];
  const goruldu = new Set<string>();
  for (const satir of ham.slice(0, EN_COK_BELGE)) {
    if (!satir || typeof satir !== "object") continue;
    const s = satir as Record<string, unknown>;
    const anahtar = String(s.anahtar ?? "").slice(0, 60);
    const ad = String(s.ad ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const durum = BELGE_DURUMLARI.includes(s.durum as BelgeDurumu) ? (s.durum as BelgeDurumu) : "eksik";
    const kaynak = s.kaynak === "yonerge" ? "yonerge" : "elle";
    if (!/^[a-z0-9_-]{1,60}$/.test(anahtar) || !ad || goruldu.has(anahtar)) continue;
    goruldu.add(anahtar);
    sonuc.push({ anahtar, ad, durum, kaynak, alinti: kaynak === "yonerge" && typeof s.alinti === "string" ? s.alinti.slice(0, 400) : null });
  }
  return sonuc;
}
