import { splitAuthors } from "@/lib/citation-format";
import type { AtifTuru } from "@/lib/atif/stiller";

/*
  KAYNAĞIN METİNDE ATFI VAR MI — TEK KURAL (Signature OS 4.3.5, B5 + B8).
  Saf modül; testi tests/unit/atif-eslesmesi.test.ts.

  Editördeki "Kullanılmayı bekleyen kaynaklar" kartı
  (lib/bekleyen-kaynaklar.ts) ve Kaynaklar sayfasının "metinde atıf"
  bilgisi (lib/kaynak-kutuphanesi.ts) aynı soruyu iki ayrı kodla
  soruyordu ve stili de ayrı sınıflandırıyordu:

  ESKİ HATA 1 (B5): editör yalnızca IEEE ve Vancouver'ı numaralı sayıyor,
  dipnotlu stili ve numaralı CSL stillerini yazar-tarih sanıyordu. Dipnot
  metni editörün gövde metnine girmediği için dipnotlu bir tezde atfı
  dipnotta olan HER kaynak "atıf bekliyor" çıkıyordu; kütüphane aynı
  tezde doğru olarak "metinden okunamıyor" diyordu.

  ESKİ HATA 2 (B8): ilk yazarın "soyadı" biçimlendirmenin surname()'iyle
  alınıyordu: virgülsüz yazarda son sözcük. "TÜİK." noktasıyla aranıyor
  ("(TÜİK, 2026a)" bulunmuyordu), "Türkiye İstatistik Kurumu" yalnızca
  "Kurumu" diye aranıyor (her "kurumu" sözcüğü atıf sayılıyordu). Aynı
  yılın a/b ekleri de ayrılmıyordu: metinde yalnızca 2026a varken 2026b
  de "metinde" görünüyordu.

  Kural:
  - Stil sınıflandırması stilTanimi(...).tur'dan gelir (çağıran verir);
    CSL stilleri dahil.
  - yazar-tarih / yazar-sayfa: GÖVDE metninde (kaynakça hariç) ilk
    yazarın adayı ve yıl birlikte geçiyorsa "metinde".
  - dipnot: dipnot metinlerinde (ve gövdede) aynı ölçüt. Dipnot metni
    verilmediyse "okunamaz" — yanlış "bekliyor" üretilmez.
  - numara: "[1]" kaynağa metinden bağlanamaz → "okunamaz".
  - Yazarsız kaynak ya da okunamayan metin → "okunamaz".
  - Kişi yazar ("Soyad, A."): virgülden önceki soyad. Kurum yazar
    (virgülsüz): adın TAMAMI; parantezdeki kısaltma da aday ("Türkiye
    Cumhuriyet Merkez Bankası (TCMB)" → iki aday). Baştaki/sondaki
    noktalama atılır. Eşleşme sözcük sınırıyla, Türkçe küçük harfle.
  - Yılın harf eki varsa ("2026b") metinde ekiyle aranır.
*/

export type AtifDurumu = "metinde" | "bekliyor" | "okunamaz";
export type EslesecekKaynak = { id: string; authors: string | null; year: string | null };

const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");
const kirp = (s: string) => s.replace(/^[\s.,;:()[\]"'“”‘’-]+|[\s.,;:()[\]"'“”‘’-]+$/g, "");
const kacis = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Türkçe harfler \w değil: sözcük sınırı harf/rakam olmayan karakterle elle kurulur.
const HARF = "0-9A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛûÉéÀ-ÿ";
const sozcukOlarak = (aday: string) => new RegExp(`(^|[^${HARF}])${kacis(aday)}(?=$|[^${HARF}])`, "u");

/** İlk yazar için metinde aranacak adlar. */
export function yazarAdaylari(authors: string | null): string[] {
  const ilk = splitAuthors(authors)[0]?.trim();
  if (!ilk) return [];
  if (ilk.includes(",")) {
    const soyad = kirp(ilk.split(",")[0]);
    return soyad ? [kucuk(soyad)] : [];
  }
  const adaylar = new Set<string>();
  const kisaltma = /\(([^)]+)\)/.exec(ilk)?.[1];
  if (kisaltma && kirp(kisaltma)) adaylar.add(kucuk(kirp(kisaltma)));
  const ad = kirp(ilk.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " "));
  if (ad) adaylar.add(kucuk(ad));
  return [...adaylar];
}

/** Künyedeki yıl: "2009" ya da harf ekli "2026b"; yoksa null. */
export function yilAnahtari(year: string | null): string | null {
  const m = /(\d{4})\s*([a-z])?\b/i.exec(year ?? "");
  return m ? kucuk(`${m[1]}${m[2] ?? ""}`) : null;
}

/** Tek kaynak, küçük harfe çevrilmiş metinde. null: aranacak ad yok. */
export function metindeGeciyorMu(kaynak: Pick<EslesecekKaynak, "authors" | "year">, kucukMetin: string): boolean | null {
  const adaylar = yazarAdaylari(kaynak.authors);
  if (!adaylar.length) return null;
  if (!adaylar.some((a) => sozcukOlarak(a).test(kucukMetin))) return false;
  const yil = yilAnahtari(kaynak.year);
  if (!yil) return true;
  // Ekli yıl ekiyle; eksiz yıl tek başına sözcük olarak ("2009", "2009a" değil… ama "2009," olur).
  return /[a-z]$/.test(yil) ? sozcukOlarak(yil).test(kucukMetin) : new RegExp(`(^|[^0-9])${yil}(?![0-9])`).test(kucukMetin);
}

export function atifDurumlari(
  kaynaklar: EslesecekKaynak[],
  girdi: {
    atifTuru: AtifTuru;
    /** Kaynakça bölümü HARİÇ gövde; null: okunamadı. */
    govdeMetni: string | null;
    /** Dipnot metinleri; verilmediyse (undefined) dipnotlu stilde okunamaz sayılır. */
    dipnotlar?: string[] | null;
  },
): Record<string, AtifDurumu> {
  const sonuc: Record<string, AtifDurumu> = {};
  let metin: string | null = null;
  if (girdi.govdeMetni !== null && (girdi.atifTuru === "yazar-tarih" || girdi.atifTuru === "yazar-sayfa")) metin = girdi.govdeMetni;
  else if (girdi.govdeMetni !== null && girdi.atifTuru === "dipnot" && Array.isArray(girdi.dipnotlar)) metin = `${girdi.dipnotlar.join("\n")}\n${girdi.govdeMetni}`;
  const kucukMetin = metin?.trim() ? kucuk(metin) : null;
  for (const k of kaynaklar) {
    const v = kucukMetin === null ? null : metindeGeciyorMu(k, kucukMetin);
    sonuc[k.id] = v === null ? "okunamaz" : v ? "metinde" : "bekliyor";
  }
  return sonuc;
}
