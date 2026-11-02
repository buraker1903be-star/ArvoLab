import type { InTextCitation } from "@/lib/apa7";

/*
  DİPNOTLU ATIF (klasik yöntem, 02.11.2026; stil: lib/atif/stiller.ts "dipnot").

  Bu stilde atıf metinde değil dipnottadır: "M. Çınar Atay, Tarih İçinde
  İzmir, …, 1978, s. 51." ya da kısa biçim "Atay, s. 55.". Kaynakça ile
  çapraz kontrol (lib/apa7.ts crossCheck) bu notlardan çıkarılan yazar
  anahtarlarıyla yapılır; kısa biçimde yıl olmadığı için eşleşme yalnızca
  yazara bakar.

  YANLIŞ ALARMA KARŞI: dipnot yalnızca atıf taşımaz, açıklama da taşır
  ("Bu konuda farklı görüşler için bkz. …"), yazarsız kaynak başlıkla
  başlar ("Avrupa’da Dil Öğrenimi, Avrupa Dergisi, …"). Bu yüzden yalnızca
  kısa ve ad gibi görünen yazar bölümü (1–3 sözcük, büyük harfle) "kesin
  atıf" sayılır ve kaynakçada karşılığı yoksa raporlanır; ötekiler yalnızca
  EŞLEŞMEDE kullanılır (anlatı atfı gibi: crossCheck karşılıksız
  saymıyor). Kaynağı atıfsız göstermek, atfı uydurma göstermekten
  zararsızdır — öğrenci listede kendi kaynağını tanır.

  Saf modül; testi tests/unit/dipnot-atif.test.ts.
*/

const anahtar = (deger: string) =>
  deger.toLocaleLowerCase("tr-TR").replace(/[.,;:]+$/, "").replace(/\s+/g, " ").trim();

/* Atıfa benzer mi: sayfa ("s. 45", "ss. 50-55", "p. 5") ya da yıl. */
const ATIF_IZI = /(?:^|[\s,(])(?:s{1,2}|pp?)\.\s*\d|(?:^|[\s,(])(?:1[5-9]|20)\d{2}(?=[\s,.;)]|$)/u;
/* "Bkz.", "Ayrıntılı bilgi için bkz.", "Krş.", "See" — gösterilen kaynak ardından gelir. */
const GONDERME = /^.*?(?<![\p{L}])(?:bkz|bakınız|krş|karşılaştırınız|see|cf)(?![\p{L}])\.?:?\s*/iu;
/* "ve diğerleri", "vd.", "et al." ve ikinci yazar ("Ergin Nomer ve Cemal Şanlı"). */
const ILK_YAZARDAN_SONRA = /\s+(?:ve|and|&)\s+.*$|\s+(?:vd\.?|et\s+al\.?)$/iu;
/* Ad gibi görünen kısa yazar: "Atay", "E. Yıldırım", "M. Çınar Atay", "TÜSİAD". */
const AD_GIBI = /^(?:[\p{Lu}][\p{L}'’\-]*\.?)(?:\s+[\p{Lu}][\p{L}'’\-]*\.?){0,2}$/u;

/** Bir dipnot metninden atıflar (birden çok olabilir: "… s. 40’dan aktaran Mehmet Altan, …"). */
function nottakiAtiflar(not: string, konum: number): InTextCitation[] {
  const temiz = not.trim().replace(/^\d{1,3}[.)]?\s+/, "");
  const atiflar: InTextCitation[] = [];
  for (const ham of temiz.split(/\baktaran\s+|;\s+/iu)) {
    const parca = ham.replace(GONDERME, "").trim();
    const virgul = parca.indexOf(",");
    if (virgul <= 0 || !ATIF_IZI.test(parca)) continue;
    const yazarBolumu = parca.slice(0, virgul).trim();
    // Tırnakla başlayan bölüm yazar değil başlıktır (yazarsız kaynak).
    if (/^[“"'‘]/.test(yazarBolumu)) continue;
    const ilkYazar = yazarBolumu.replace(ILK_YAZARDAN_SONRA, "").trim();
    if (!ilkYazar || ilkYazar.length > 80) continue;
    const yil = parca.match(/(?:^|[\s,(])((?:1[5-9]|20)\d{2})(?=[\s,.;)]|$)/u)?.[1] ?? null;
    atiflar.push({
      raw: parca.slice(0, 160),
      authorKey: anahtar(ilkYazar),
      year: yil,
      position: konum,
      kind: AD_GIBI.test(ilkYazar) ? "parenthetical" : "narrative",
    });
  }
  return atiflar;
}

/** Dipnot metinlerinden çapraz kontrolün atıf listesi (sıra dipnot sırası). */
export function dipnotAtiflari(notlar: string[]): InTextCitation[] {
  return notlar.flatMap((not, sira) => nottakiAtiflar(not, sira));
}

/*
  Yapıştırılan metinde (Atıf Kontrolü ekranı) dipnotlar ayrı değil; Word'den
  kopyalanan metinde sayfa altı notlar "1 M. Çınar Atay, …" diye satır
  başında numarayla geliyor. Yalnızca numarayla başlayan satırlar not
  sayılır: gövde cümlesini dipnot sanmak, "Ankara, 2020 yılında" gibi
  ifadelerden uydurma atıf üretirdi.
*/
export function metindekiDipnotlar(metin: string): string[] {
  return metin
    .split(/\n+/)
    .map((satir) => satir.trim())
    .filter((satir) => /^\d{1,3}[.)]?\s+\S/.test(satir));
}

/*
  Aynı kaynağa daha önce dipnotla atıf yapılmış mı? Kılavuz ilk atıfta tam
  bilgi, sonrakilerde kısa biçim istiyor. Kaynağın başlığı (ilk 40
  karakter) önceki bir dipnotta geçiyorsa ilk atıf yapılmıştır.
*/
export function oncedenAtifYapildi(baslik: string, oncekiNotlar: string[]): boolean {
  const aranan = anahtar(baslik).slice(0, 40);
  if (aranan.length < 4) return false;
  return oncekiNotlar.some((not) => anahtar(not).includes(aranan));
}
