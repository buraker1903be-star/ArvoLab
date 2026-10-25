/*
  SAYININ YAZILIŞI KILAVUZDAN GELİR (25.10.2026).

  İstatistik çıktısının tipografisi koda sabitlenmişti
  (lib/stats-interpreter): baştaki sıfır siliniyor ("0,021" → ".021")
  ve ondalık ayırıcı noktaya çevriliyordu. İkisi de APA kuralı, ama
  bu kurallar ÜNİVERSİTEDEN ÜNİVERSİTEYE DEĞİŞİYOR — Türkiye'deki tez
  kılavuzlarının çoğu ondalık ayırıcı olarak virgül ve baştaki sıfırı
  zorunlu tutuyor.

  Bedeli somuttu: kılavuzu "0,021" diyen öğrenci araçtan ".021"
  alıyor, üstelik araç bunu doğru biçim diye sunuyordu. Atıf sistemi
  zaten kılavuzdan geliyordu (thesis_guidelines.citation_style); sayı
  biçimi de aynı yolu izliyor.

  ÜÇ KADEMELİ KARAR, her kademenin gerekçesi var:
    1. Kılavuz açıkça söylüyorsa o uygulanır.
    2. Söylemiyorsa atıf sisteminin kendi geleneği uygulanır.
    3. Atıf sistemi de bilinmiyorsa APA geleneği — ama çağıran bunu
       KULLANICIYA SÖYLEMELİ. Sessizce varsayılana düşmek, kodun eski
       hâlinin yaptığı şeyin aynısı olurdu.

  Saf modül; testi tests/unit/sayi-bicimi.test.ts.
*/

export type OndalikAyirici = "comma" | "period";

export type SayiBicimi = {
  ayirici: OndalikAyirici;
  /** Birden küçük değerlerde baştaki sıfır yazılır mı: 0,021 ↔ ,021 */
  bastakiSifir: boolean;
};

/** Kılavuzun söyledikleri; ikisi de NULL olabilir (kılavuz susuyor). */
export type KilavuzSayiKurali = {
  ayirici?: OndalikAyirici | null;
  bastakiSifir?: boolean | null;
};

/*
  ATIF SİSTEMLERİNİN GELENEĞİ.

  Yalnızca APA baştaki sıfırı ATIYOR ve bunu açıkça yazıyor: ±1 ile
  sınırlı değerlerde (p, r, β) sıfır yazılmaz. Chicago, MLA, IEEE ve
  Vancouver için böyle bir kural yok; İngilizce yazımın olağan hâli
  sıfırı yazmak ve ondalık ayırıcı olarak nokta kullanmaktır.

  Burada "Türkçe tez → virgül" VARSAYILMIYOR. Dil ile kılavuz aynı şey
  değil: Türkçe yazılmış bir tez APA isteyip nokta kullanabilir.
  Varsaymak, kılavuzu okumadan kural üretmek olurdu.
*/
const GELENEK: Record<string, SayiBicimi> = {
  apa7: { ayirici: "period", bastakiSifir: false },
  chicago: { ayirici: "period", bastakiSifir: true },
  mla: { ayirici: "period", bastakiSifir: true },
  ieee: { ayirici: "period", bastakiSifir: true },
  vancouver: { ayirici: "period", bastakiSifir: true },
};

/** Atıf sistemi bilinmiyorsa düşülen biçim. Çağıran bunu kullanıcıya söyler. */
export const VARSAYILAN_BICIM: SayiBicimi = GELENEK.apa7;

export type BicimKaynagi = "kilavuz" | "atif-sistemi" | "varsayilan";

export type BicimKarari = SayiBicimi & {
  /** Hangi kademeden geldi: ekranda "neden böyle yazıldı" sorusunun cevabı. */
  kaynak: BicimKaynagi;
};

/**
 * Kılavuz kuralı + atıf sisteminden sayı biçimi.
 *
 * Kılavuz alanları birbirinden BAĞIMSIZ: bir kılavuz yalnızca ondalık
 * ayırıcıyı söyleyip baştaki sıfır hakkında susabilir. O yüzden ikisi
 * ayrı ayrı çözülür; biri doluysa kaynak "kilavuz" sayılır.
 */
export function sayiBicimi(
  kural: KilavuzSayiKurali | null | undefined,
  atifSistemi: string | null | undefined,
): BicimKarari {
  const gelenek = (atifSistemi && GELENEK[atifSistemi]) || null;
  const taban = gelenek ?? VARSAYILAN_BICIM;

  const ayirici = kural?.ayirici ?? taban.ayirici;
  const bastakiSifir = kural?.bastakiSifir ?? taban.bastakiSifir;

  const kilavuzSoyledi = kural?.ayirici != null || kural?.bastakiSifir != null;
  const kaynak: BicimKaynagi = kilavuzSoyledi ? "kilavuz" : gelenek ? "atif-sistemi" : "varsayilan";

  return { ayirici, bastakiSifir, kaynak };
}

/*
  YAZILMIŞ BİR SAYIYI BİÇİME ÇEVİRİR.

  Girdi kullanıcının YAZDIĞI metin: "0.021", "0,021", ".021", "2.45".
  Rakamlara dokunulmuyor — yalnızca ayırıcı ve baştaki sıfır
  düzenleniyor. Sayıya çevirip yeniden yazmak, yazılan ondalık
  basamak sayısını değiştirirdi ("p < .050" → "p < .05") ve bu,
  kaynağında olmayan bir kesinlik uydurmak olurdu.
*/
export function sayiMetniBicimle(ham: string, bicim: SayiBicimi, sinirliDeger = false): string {
  const kirpik = ham.trim();
  const eksi = kirpik.startsWith("-");
  let govde = eksi ? kirpik.slice(1) : kirpik;

  /* Önce tek bir iç gösterime indiriliyor: nokta. */
  govde = govde.replace(",", ".");

  /*
    BAŞTAKİ SIFIR KURALI YALNIZCA ±1 İLE SINIRLI DEĞERLERE uygulanır
    (p, r, β). "0.5 kg" gibi bir ölçümden sıfırı atmak yanlış olurdu;
    APA'nın kuralı da yalnızca sınırlı değerler için.
  */
  if (sinirliDeger) {
    if (bicim.bastakiSifir) {
      if (govde.startsWith(".")) govde = `0${govde}`;
    } else {
      govde = govde.replace(/^0(?=\.)/, "");
    }
  }

  if (bicim.ayirici === "comma") govde = govde.replace(".", ",");
  return (eksi ? "-" : "") + govde;
}

/** Sayıyı verilen ondalık basamakla, biçime uygun yazar. */
export function sayiYaz(deger: number, basamak: number, bicim: SayiBicimi, sinirliDeger = false): string {
  if (!Number.isFinite(deger)) return "—";
  return sayiMetniBicimle(deger.toFixed(basamak), bicim, sinirliDeger);
}

/*
  FORM ALANLARINDAN KILAVUZ KURALI.

  İki alan da ÜÇ DURUMLU: "söylenmedi" ayrı bir değer, varsayılan
  değil. Boş bırakılan alan `null` olur ve kod atıf sisteminin
  geleneğine düşer. İki durumlu bir onay kutusu kullanılsaydı
  (işaretli/işaretsiz) "kılavuz sıfırı yazdırmıyor" ile "kılavuz bu
  konuda bir şey demiyor" aynı şeye inerdi — ilki bir kural, ikincisi
  bilgi yokluğu.

  Tanınmayan değer de `null`: formdan beklenmeyen bir şey gelirse
  uydurma kural yazmaktansa "bilinmiyor" demek doğru.
*/
export function formdanSayiKurali(ayiriciHam: unknown, sifirHam: unknown): KilavuzSayiKurali {
  const ayirici = ayiriciHam === "comma" || ayiriciHam === "period" ? ayiriciHam : null;
  const bastakiSifir = sifirHam === "yazilir" ? true : sifirHam === "yazilmaz" ? false : null;
  return { ayirici, bastakiSifir };
}
