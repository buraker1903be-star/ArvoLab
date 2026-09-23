/*
  Kullanıcıya gösterilecek kredi özeti. Saf modül; testi
  tests/unit/kredi-ozeti.test.ts.

  NEDEN VAR: kredi ArvoLab'da harcanıyor, ArvoOS'ta satılıyor — ama
  ArvoLab hiçbir yerde "ne kadar kaldı" demiyordu. Kullanıcı durumu
  yalnızca iki anda öğreniyordu: %80'de çalışmanın ortasında bir uyarıyla,
  ya da hak bitince asistan durduğunda. İkisi de iş üstünde, ikisi de geç.

  Kart YALNIZCA anlamlı olduğunda çiziliyor. Sayıyı üretemediğimiz her
  durumda hiç çizilmiyor — "0 kredi" yazmak, hakkı olmayanla ölçümü
  okunamayanı aynı göstermek olurdu (lib/urun-kullanimi.ts ile aynı ilke).
*/

import { krediye } from "./kredi-karari";

/** ai_kredi_durumum() satırı. */
export interface KrediSatiri {
  kullanilan_karakter: number;
  limit_kredi: number | null;
  aylik_kalan: number;
  ek_bakiye: number;
  bildirildi: boolean;
  ic_ekip: boolean;
}

export type KrediOzeti =
  | { goster: false }
  | {
      goster: true;
      aylikLimit: number;
      aylikKalan: number;
      /** Satın alınmış, ay sonunda yanmayan kredi. */
      ekBakiye: number;
      /** Şu an harcanabilecek toplam. */
      toplam: number;
      kullanilanKredi: number;
      /** Aylık hakkın yüzde kaçı kullanıldı. */
      oran: number;
      /** Hak bitmiş: kart uyarı tonunda çizilir. */
      tukendi: boolean;
    };

const GIZLI: KrediOzeti = { goster: false };

export function krediOzeti(satir: KrediSatiri | null | undefined): KrediOzeti {
  // Okunamadı: uydurma bir sayı göstermektense hiç göstermiyoruz.
  if (!satir) return GIZLI;
  // İç ekip hiçbir koşulda engellenmiyor; onlara kota göstermek yanıltır.
  if (satir.ic_ekip) return GIZLI;
  /*
    Hak bildirilmemişse gösterilecek bir sayı yok: kapı da açık
    (lib/ai/kredi-karari.ts). Bireysel abonede ve ArvoOS'un kurumu hiç
    yansıtmadığı durumda böyle oluyor.
  */
  if (!satir.bildirildi || satir.limit_kredi === null) return GIZLI;

  const aylikLimit = Math.max(0, Math.round(Number(satir.limit_kredi)));
  const aylikKalan = Math.max(0, Number(satir.aylik_kalan ?? 0));
  const ekBakiye = Math.max(0, Number(satir.ek_bakiye ?? 0));
  const kullanilanKredi = krediye(Number(satir.kullanilan_karakter ?? 0));

  return {
    goster: true,
    aylikLimit,
    aylikKalan,
    ekBakiye,
    toplam: aylikKalan + ekBakiye,
    kullanilanKredi,
    // Limit 0 ise oran hesaplanamaz; "hak yok" zaten %100 doluluktur.
    oran: aylikLimit > 0 ? Math.min(100, Math.round((kullanilanKredi / aylikLimit) * 100)) : 100,
    tukendi: aylikKalan + ekBakiye <= 0,
  };
}
