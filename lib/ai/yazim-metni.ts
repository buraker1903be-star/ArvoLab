/*
  Yazım asistanının istemci tarafında da gereken parçası (panel:
  app/dashboard/editor/[id]/write/yazim-paneli.tsx). Ayrı dosyada, çünkü
  lib/ai/yazim-asistani.ts istem metnini ve doğrulama kodunu taşıyor;
  onları tarayıcı paketine sokmanın sebebi yok.
*/
export type SohbetMesaji = { rol: "kullanici" | "asistan"; metin: string };

/** Eklenebilir metin → paragraflar (boş satırla ayrılmış). */
export function paragraflara(metin: string): string[] {
  return metin
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/*
  ANA HAT (03.11.2026). Model satır satır yazar: "# Başlık", "## Alt",
  "- not". Başa yazılmış numaralar ("1.", "2.1") atılır: editör kendisi
  numaralıyor, elle numara çift numara olur. Başlıksız not ve dört
  düzeyden derin başlık düşer; yapı bozuksa boş liste döner ve panel ham
  metni gösterir (öğrenci yine kopyalayabilir).
*/
export type AnaHatSatiri = { duzey: 1 | 2 | 3; baslik: string; notlar: string[] };

export function anaHattiCozumle(metin: string): AnaHatSatiri[] {
  const sonuc: AnaHatSatiri[] = [];
  for (const ham of metin.split(/\r?\n/)) {
    const satir = ham.trim();
    const baslik = /^(#{1,3})\s+(.+)$/.exec(satir);
    if (baslik) {
      const ad = baslik[2].replace(/^(?:\d+\.)*\d+\.?\s+/, "").replace(/[*_`]+/g, "").trim();
      if (ad) sonuc.push({ duzey: baslik[1].length as 1 | 2 | 3, baslik: ad.slice(0, 160), notlar: [] });
      continue;
    }
    const not = /^[-*•]\s+(.+)$/.exec(satir);
    if (not && sonuc.length) sonuc[sonuc.length - 1].notlar.push(not[1].trim().slice(0, 400));
  }
  return sonuc.slice(0, 80);
}

/*
  SATIR İÇİ ÖNERİ (03.11.2026). Model bazen öncesini tekrarlıyor ("…işsizlik
  arasındaki ilişki" yazılmışken öneri "arasındaki ilişki zayıflamıştır."
  ile başlıyor): çakışan baş atılır. Öncesi boşlukla bitmiyorsa araya
  boşluk konur (öneri noktalamayla başlıyorsa konmaz): öneri yazma
  DURDUĞUNDA istenir, yani imleç neredeyse her zaman tam bir sözcüğün
  ardındadır. Satır sonu ve fazla boşluk tek boşluğa iner: öneri tek
  paragrafın devamıdır.
*/
export const ONERI_EN_UZUN = 400;

export function oneriTemizle(oneri: string, oncesi: string): string {
  let o = oneri.replace(/\s+/g, " ").trim();
  if (!o) return "";
  const son = oncesi.slice(-200);
  for (let n = Math.min(son.length, o.length); n >= 8; n--) {
    if (son.endsWith(o.slice(0, n))) {
      o = o.slice(n).trimStart();
      break;
    }
  }
  if (!o) return "";
  const bosluk = oncesi === "" || /\s$/.test(oncesi) || /^[.,;:!?)\]]/.test(o) ? "" : " ";
  return (bosluk + o).slice(0, ONERI_EN_UZUN);
}

/*
  KISALTMA UYARILARI (20.11.2026). Sözcük örtüşme oranı anlamın korunduğunu
  KANITLAMAZ (kurum sahibinin kararı): yüksek örtüşmeli bir kısaltma tek
  bir "değil"i düşürüp anlamı tersine çevirebilir. Bu yüzden oran
  hesaplanmıyor; bunun yerine somut ve denetlenebilir kayıplar aranır ve
  kısa bir uyarı olarak gösterilir. Karar öğrencinindir: uyarı eklemeyi
  engellemez. Sayı ve atıf UYDURMASI zaten sunucuda düşürülüyor; burada
  aranan, seçimde OLAN bir şeyin kısaltmada KAYBOLMASI.
*/
export type KisaltmaUyarisi = "kisalmadi" | "olumsuzluk" | "atif" | "sayi";

const OLUMSUZLUK = /\b(değil\p{L}*|yok\p{L}*|hiç|asla|ne\s+de|not|no|never|without|neither|nor|cannot|n't)\b/giu;
const SAYI = /\d+(?:[.,]\d+)?/g;
const ATIF = /\(([^()]*\d{4}[a-z]?[^()]*)\)|\b(\p{Lu}\p{L}+)\s+\((\d{4}[a-z]?)\)/gu;

const say = (metin: string, desen: RegExp) => (metin.match(desen) ?? []).length;
const yillar = (metin: string) => new Set([...metin.matchAll(ATIF)].flatMap((e) => (e[0].match(/\d{4}[a-z]?/g) ?? [])));

export function kisaltmaUyarilari(secim: string, kisaltma: string): KisaltmaUyarisi[] {
  const u: KisaltmaUyarisi[] = [];
  const a = secim.trim();
  const b = kisaltma.trim();
  if (!a || !b) return u;
  if (b.length >= a.length * 0.95) u.push("kisalmadi");
  if (say(a, OLUMSUZLUK) !== say(b, OLUMSUZLUK)) u.push("olumsuzluk");
  const atifYillari = yillar(b);
  if ([...yillar(a)].some((y) => !atifYillari.has(y))) u.push("atif");
  const kalanSayilar = new Set(b.match(SAYI) ?? []);
  if ((a.match(SAYI) ?? []).some((n) => !kalanSayilar.has(n))) u.push("sayi");
  return u;
}
