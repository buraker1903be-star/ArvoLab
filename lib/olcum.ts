/*
  Ürün ölçümü — oran hesabı.

  Neden dış bir analitik aracı YOK: ölçülecek her şey zaten kendi
  veritabanımızda duruyor. Üçüncü bir servise kullanıcı davranışı göndermek
  KVKK tarafında ayrı bir açık rıza meselesi açardı ve bize bu tablolardan
  daha doğru bir cevap vermezdi.

  Neden SAYIM burada değil: satırları PostgREST'ten çekip uygulamada saymak
  bin kullanıcıda sessizce kırılıyordu (varsayılan satır sınırı). Sayım
  public.olcum_ozeti()'nde, veritabanında (20260924100030). Burada kalan tek
  iş oran: ürünün en kolay sessizce yanlışlanan yeri paydaya kimin girdiği.

  Testi tests/unit/olcum.test.ts.
*/

/** public.olcum_ozeti()'nin döndürdüğü ham sayılar. */
export interface OlcumSayilari {
  kayit: number;
  denemeBaslatan: number;
  odemeyeGecen: number;
  suAnErisimi: number;
  denemedeBirakan: number;
  yenilemeyen: number;
  calismaAcan: number;
  yazan: number;
  asistanKullanan: number;
  geriBildirimSayisi: number;
  geriBildirimOrtalamasi: number | null;
}

export const BOS_SAYILAR: OlcumSayilari = {
  kayit: 0,
  denemeBaslatan: 0,
  odemeyeGecen: 0,
  suAnErisimi: 0,
  denemedeBirakan: 0,
  yenilemeyen: 0,
  calismaAcan: 0,
  yazan: 0,
  asistanKullanan: 0,
  geriBildirimSayisi: 0,
  geriBildirimOrtalamasi: null,
};

/**
 * Yüzde. Payda sıfırken "%0" DEĞİL, yok: ölçülecek kimse olmaması ile
 * kimsenin dönüşmemesi aynı şey değil ve ikisini karıştırmak var olmayan
 * bir sorunu var gösterir.
 */
export function oran(pay: number, payda: number): number | null {
  if (!Number.isFinite(payda) || payda <= 0) return null;
  return Math.round((pay / payda) * 100);
}

/** Gelen jsonb'yi tipli sayılara çevirir; eksik/bozuk alan sıfır sayılır. */
export function sayilariOku(ham: unknown): OlcumSayilari {
  if (!ham || typeof ham !== "object") return BOS_SAYILAR;
  const kayit = ham as Record<string, unknown>;
  const sayi = (ad: keyof OlcumSayilari) => {
    // Postgres'in count()'u bigint; PostgREST bunu bazen metin olarak taşır.
    const deger = Number(kayit[ad]);
    return Number.isFinite(deger) ? deger : 0;
  };
  const ortalama = Number(kayit.geriBildirimOrtalamasi);
  return {
    kayit: sayi("kayit"),
    denemeBaslatan: sayi("denemeBaslatan"),
    odemeyeGecen: sayi("odemeyeGecen"),
    suAnErisimi: sayi("suAnErisimi"),
    denemedeBirakan: sayi("denemedeBirakan"),
    yenilemeyen: sayi("yenilemeyen"),
    calismaAcan: sayi("calismaAcan"),
    yazan: sayi("yazan"),
    asistanKullanan: sayi("asistanKullanan"),
    geriBildirimSayisi: sayi("geriBildirimSayisi"),
    // null ile 0 ayrı: "hiç puan yok" ile "ortalama sıfır" aynı şey değil.
    geriBildirimOrtalamasi:
      kayit.geriBildirimOrtalamasi === null || kayit.geriBildirimOrtalamasi === undefined || !Number.isFinite(ortalama)
        ? null
        : ortalama,
  };
}

export interface AktivasyonAdimi {
  etiket: string;
  kisi: number;
  yuzde: number | null;
}

/**
 * Aktivasyon adımları. Payda HER zaman kayıtlı bireysel kullanıcı sayısı:
 * "çalışma açanların kaçı yazdı" biçiminde kendi içine daralan bir zincir,
 * insanların nerede bıraktığını gizler.
 */
export function aktivasyonAdimlari(sayilar: OlcumSayilari): AktivasyonAdimi[] {
  const payda = sayilar.kayit;
  return [
    { etiket: "Çalışma açtı", kisi: sayilar.calismaAcan, yuzde: oran(sayilar.calismaAcan, payda) },
    { etiket: "En az 500 kelime yazdı", kisi: sayilar.yazan, yuzde: oran(sayilar.yazan, payda) },
    { etiket: "Asistanı kullandı", kisi: sayilar.asistanKullanan, yuzde: oran(sayilar.asistanKullanan, payda) },
  ];
}

/** Denemeyi başlatanların ödemeye geçen oranı. Payda kayıt DEĞİL: denemeyi
 *  hiç başlatmamış kişi dönüşüm hunisinin o adımında yoktur. */
export const donusumYuzdesi = (sayilar: OlcumSayilari): number | null =>
  oran(sayilar.odemeyeGecen, sayilar.denemeBaslatan);
