/*
  Kılavuz metninden atıf sisteminin seçilmesi.

  Eskiden şöyleydi: metinde "apa 7" geçiyorsa APA, geçmiyorsa "vancouver"
  aranıyor, o da yoksa "chicago", sonra "ieee" — ilk eşleşen kazanıyordu.
  İki ağır sorunu vardı:

  1. TEK BİR GEÇİŞ yetiyordu. Türkçe tez kılavuzlarının çoğunda "APA,
     Chicago, MLA gibi yaygın sistemlerden biri" türünden bir cümle ya da
     karşılaştırmalı örnek kaynakça bölümü bulunur. Kılavuz baştan sona APA
     anlatsa bile, tek bir "Chicago" geçişi sistemi Chicago yapıyordu.
     Canlıda 18 kılavuzun 5'inde Chicago algılanmıştı.
  2. Düz "APA" hiç eşleşmiyordu; yalnızca "APA 7"/"APA7". APA 6 ya da
     sürümsüz APA yazan kılavuzlar, metinde geçen başka bir sistemin adına
     düşüyordu.

  Sonuç, YANLIŞ ama kendinden emin bir çıkarımdı. Onaylanan atıf sistemi
  öğrencinin editörüne, belge kontrolüne ve Word çıktısına iniyor; yanlış
  sistem, hiç sistem olmamasından kötüdür — kullanıcı aracın doğru
  çalıştığını sanır.

  Yeni ölçüt SAYIMA ve BASKINLIĞA dayanır: bir sistem hem yeterince çok
  geçmeli hem de ikinciyi açık ara geçmeli. Aksi hâlde null döner ve
  yönetici elle seçer — "bilmiyorum" demek, yanlış bilmekten iyidir.

  Saf modül; testi tests/unit/atif-sistemi.test.ts.
*/

/** Veritabanının kabul ettiği değerler (thesis_guidelines.citation_style). */
export type AtifSistemi = "apa7" | "vancouver" | "chicago" | "ieee" | "mla";

/** Metinde hangi sistemin kaç kez geçtiği; karar verilemediğinde de üretilir. */
export type AtifGecisi = { sistem: AtifSistemi; etiket: string; sayim: number };

export type AtifSecimi = {
  sistem: AtifSistemi;
  /** Panelde gösterilen ad. */
  etiket: string;
  sayim: number;
  /** İkinci sıradaki sistemin geçiş sayısı; kararın ne kadar net olduğunu gösterir. */
  ikinciSayim: number;
  uyarilar: string[];
};

// MLA 23.09.2026'dan beri saklanabiliyor (migration: mla stili); eskiden
// yalnızca yarışmaya katılıp kazandığında null'a düşüyordu.
const DESENLER: { sistem: AtifSistemi; etiket: string; desen: RegExp }[] = [
  { sistem: "apa7", etiket: "APA 7", desen: /\bapa\b/gi },
  { sistem: "vancouver", etiket: "Vancouver", desen: /\bvancouver\b/gi },
  { sistem: "chicago", etiket: "Chicago", desen: /\bchicago\b/gi },
  { sistem: "ieee", etiket: "IEEE", desen: /\bieee\b/gi },
  { sistem: "mla", etiket: "MLA 9", desen: /\bmla\b/gi },
];

/** En az bu kadar geçmeyen bir ad, kılavuzun sistemi sayılmaz. */
const EN_AZ_GECIS = 3;
/** Kazanan, ikinciyi en az bu katsayıyla geçmeli. */
const BASKINLIK = 2;

const say = (metin: string, desen: RegExp) => metin.match(desen)?.length ?? 0;

/**
 * Kılavuz metninden atıf sistemini seçer; net bir kazanan yoksa null.
 *
 * null dönmesi bir başarısızlık değil, dürüst bir cevaptır: yönetici
 * sistemi elle seçer ve kılavuz "tek adım onay" kuyruğuna girmez.
 */
/*
  Hangi sistemin kaç kez geçtiği — KARAR VERİLEMESE DE.

  Seçim null döndüğünde ekran yalnızca "atıf sistemi bulunamadı" diyordu ve
  sayımlar atılıyordu. Oysa yöneticinin vereceği karar tam olarak bu veriye
  dayanıyor: metinde APA iki kez geçip başka hiçbir ad geçmiyorsa karar bir
  bakışlık; hiçbiri geçmiyorsa belgeyi açması gerekir. İkisi aynı ekranda
  aynı görünüyordu.
*/
export function atifGecisleri(metin: string): AtifGecisi[] {
  return DESENLER.map(({ sistem, etiket, desen }) => ({ sistem, etiket, sayim: say(metin, desen) }))
    .filter((kayit) => kayit.sayim > 0)
    .sort((a, b) => b.sayim - a.sayim);
}

export function atifSistemiSec(metin: string): AtifSecimi | null {
  const sayimlar = atifGecisleri(metin);

  const kazanan = sayimlar[0];
  if (!kazanan || kazanan.sayim < EN_AZ_GECIS) return null;

  const ikinciSayim = sayimlar[1]?.sayim ?? 0;
  if (ikinciSayim > 0 && kazanan.sayim < ikinciSayim * BASKINLIK) return null;

  const uyarilar: string[] = [];
  if (ikinciSayim > 0) {
    uyarilar.push(
      `Metinde ${sayimlar[1].etiket} adı da ${ikinciSayim} kez geçiyor; örnek ya da karşılaştırma olabilir.`,
    );
  }
  /*
    Sistem "apa7" olarak saklanıyor ama kılavuz eski bir baskıyı işaret
    ediyor olabilir; sessizce APA 7 saymak kullanıcıyı yanıltırdı.
  */
  if (kazanan.sistem === "apa7" && /\bapa\s*-?\s*[1-6]\b/i.test(metin) && !/\bapa\s*-?\s*7\b/i.test(metin)) {
    uyarilar.push("Kılavuz APA'nın 7'den eski bir baskısını işaret ediyor olabilir; sürümü doğrulayın.");
  }

  return { sistem: kazanan.sistem, etiket: kazanan.etiket, sayim: kazanan.sayim, ikinciSayim, uyarilar };
}
