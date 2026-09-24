/*
  Ürün ölçümü — saf hesap.

  Neden dış bir analitik aracı YOK: ölçülecek her şey zaten kendi
  veritabanımızda duruyor (kayıt tarihi, abonelik durumu, çalışma, metin,
  asistan kaydı). Üçüncü bir servise kullanıcı davranışı göndermek KVKK
  tarafında ayrı bir açık rıza meselesi açardı ve bize bu tablolardan daha
  doğru bir cevap vermezdi. Burada yalnızca elimizdeki satırlar sayılıyor.

  Neden lib/: sayfa Supabase'e gidip satırları getiriyor, karar burada
  veriliyor; oran hesabı ürünün en kolay sessizce yanlışlanan yeri
  (paydaya kimin girdiği). Testi tests/unit/olcum.test.ts.
*/

/** Bir kullanıcının ölçüme giren asgari kimliği. */
export interface OlcumKullanici {
  id: string;
  created_at: string;
}

export interface OlcumAbonelik {
  user_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface Huni {
  kayit: number;
  denemeBaslatan: number;
  odemeyeGecen: number;
  suAnErisimi: number;
  /** Denemeyi başlatanların yüzde kaçı ödemeye geçti (yüzde, tam sayı) */
  donusumYuzdesi: number | null;
}

/*
  "Ödemeye geçen" = deneme dışında bir dönem sonu taşıyan abone. ArvoOS
  ödeme onaylanınca dönemi bir ay uzatıyor (arvo_activate_subscriber_period);
  ödenmemiş bir abonede current_period_end, trial_ends_at'ten ileri gitmez.
  Bu yüzden ölçüt "durumu active" değil — durum alanı ArvoOS'un kelimesi ve
  zamanla değişebilir, tarih karşılaştırması değişmez.
*/
export function odemeYapmis(abonelik: OlcumAbonelik): boolean {
  if (!abonelik.current_period_end) return false;
  if (!abonelik.trial_ends_at) return true;
  return new Date(abonelik.current_period_end).getTime() > new Date(abonelik.trial_ends_at).getTime();
}

export function erisimiAcik(abonelik: OlcumAbonelik, simdi = new Date()): boolean {
  const son = abonelik.current_period_end ?? abonelik.trial_ends_at;
  return !!son && new Date(son).getTime() > simdi.getTime();
}

export function huniHesapla(
  kullanicilar: OlcumKullanici[],
  abonelikler: OlcumAbonelik[],
  simdi = new Date(),
): Huni {
  const denemeBaslatan = abonelikler.length;
  const odemeyeGecen = abonelikler.filter(odemeYapmis).length;
  return {
    kayit: kullanicilar.length,
    denemeBaslatan,
    odemeyeGecen,
    suAnErisimi: abonelikler.filter((a) => erisimiAcik(a, simdi)).length,
    // Payda sıfırken "%0" yazmak yanıltıcı olurdu: ölçülecek şey yok demek
    // ile dönüşüm olmadı demek aynı şey değil.
    donusumYuzdesi: denemeBaslatan === 0 ? null : Math.round((odemeyeGecen / denemeBaslatan) * 100),
  };
}

export interface AktivasyonAdimi {
  etiket: string;
  kisi: number;
  yuzde: number | null;
}

/**
 * Aktivasyon: kayıt olanların kaçı ürünü gerçekten kullandı.
 * Paydada HER kayıtlı bireysel kullanıcı var — "çalışma açanların kaçı yazdı"
 * gibi kendi içine daralan bir zincir, bırakma noktasını gizler.
 */
export function aktivasyonHesapla(
  kullanicilar: OlcumKullanici[],
  adimlar: { etiket: string; kimlikler: Iterable<string> }[],
): AktivasyonAdimi[] {
  const kayitli = new Set(kullanicilar.map((k) => k.id));
  const payda = kayitli.size;
  return adimlar.map(({ etiket, kimlikler }) => {
    // Kurum üyesi de aynı tabloları kullanıyor; sayıma yalnızca bireysel
    // kayıtlar girsin diye kesişim alınıyor.
    let kisi = 0;
    const gorulen = new Set<string>();
    for (const id of kimlikler) {
      if (kayitli.has(id) && !gorulen.has(id)) {
        gorulen.add(id);
        kisi += 1;
      }
    }
    return { etiket, kisi, yuzde: payda === 0 ? null : Math.round((kisi / payda) * 100) };
  });
}

export interface KayipOzeti {
  /** Denemesi bitmiş, hiç ödeme yapmamış */
  denemedeBirakan: number;
  /** Ödemiş ama dönemi bitmiş, yenilememiş */
  yenilemeyen: number;
}

export function kayipHesapla(abonelikler: OlcumAbonelik[], simdi = new Date()): KayipOzeti {
  let denemedeBirakan = 0;
  let yenilemeyen = 0;
  for (const abonelik of abonelikler) {
    if (erisimiAcik(abonelik, simdi)) continue;
    if (odemeYapmis(abonelik)) yenilemeyen += 1;
    // Erişimi kapalı ve hiç ödememiş: denemesi bittiğinde bırakmış.
    // trial_ends_at hiç yazılmamışsa deneme başlamamış demektir, sayılmaz.
    else if (abonelik.trial_ends_at) denemedeBirakan += 1;
  }
  return { denemedeBirakan, yenilemeyen };
}

/** Ortalama puan (1-5). Puanlanmamış cevaplar paydaya girmez. */
export function ortalamaPuan(puanlar: (number | null)[]): number | null {
  const gecerli = puanlar.filter((p): p is number => typeof p === "number");
  if (gecerli.length === 0) return null;
  return Math.round((gecerli.reduce((t, p) => t + p, 0) / gecerli.length) * 10) / 10;
}
