/*
  AI kredi kapısının kararı. Saf modül; testi tests/unit/kredi-karari.test.ts.

  Ölçüm ve limit veritabanından geliyor (ai_kredi_durumum); karar burada,
  çünkü eşikler ve metinler ürün kararı ve tek yerde durmalı.

  İKİ EŞİK:
    %80 — uyarı. Kullanıcı işin ortasında kesilmesin, önceden görsün.
    %100 — durdurma.

  Tek eşikle (yalnızca durdurma) kullanıcı hiçbir uyarı almadan çalışmanın
  ortasında duvara çarpıyor; kurum da haberi ilk kez şikâyetle alıyor.

  KAPIYI YALNIZCA NET BİR "HAYIR" KAPATIR (AGENTS.md). Bilgisizlik
  kapatmaz: limit bildirilmemişse, kurum yoksa ya da ölçüm okunamadıysa
  kimse engellenmez.
*/

/** 1 kredi = 1.000 karakter (istem + yanıt). ArvoOS'taki tanımla aynı. */
export const KREDI_KARAKTERI = 1000;

/** Bu oranın üstü "bitmek üzere"; limite değmeden haber verilir. */
export const UYARI_ORANI = 80;

export interface KrediDurumu {
  /** Bu ay tüketilen karakter. */
  kullanilanKarakter: number;
  /** ArvoOS'un bildirdiği aylık kredi hakkı; null ise hiç bildirilmemiş. */
  limitKredi: number | null;
  /** Aylık haktan kalan. */
  aylikKalan: number;
  /** Satın alınmış, yanmayan kredi. */
  ekBakiye: number;
  /** ArvoOS bu kurumu bir kez bile yansıttı mı. */
  bildirildi: boolean;
  /** İç ekip hiçbir koşulda engellenmez. */
  icEkip: boolean;
}

export interface KrediKarari {
  /** Aylık kalan + satın alınmış bakiye. */
  kalanKredi?: number;
  /** Doluysa asistan çalışmaz ve bu metin kullanıcıya gösterilir. */
  engel: string | null;
  /** Doluysa çalışma sürer ama kullanıcıya uyarı gösterilir. */
  uyari: string | null;
  /** Yüzde; hesaplanamıyorsa null. */
  oran: number | null;
  kullanilanKredi: number;
}

const sayi = (deger: number) => new Intl.NumberFormat("tr-TR").format(deger);

/** Karakteri krediye çevirir; başlanan dilim tam sayılır. */
export const krediye = (karakter: number) => Math.ceil(Math.max(0, karakter) / KREDI_KARAKTERI);

export function krediKarari(durum: KrediDurumu): KrediKarari {
  const kullanilanKredi = krediye(durum.kullanilanKarakter);
  const bos: KrediKarari = { engel: null, uyari: null, oran: null, kullanilanKredi };

  // İç ekip: ürünü denerken kendi kotamıza takılmak, ürünü denememek demek.
  if (durum.icEkip) return bos;
  // Kurumu olmayan kullanıcının kurum kotasıyla işi yok.
  if (durum.limitKredi === null || !durum.bildirildi) return bos;

  const limit = Math.max(0, Math.round(durum.limitKredi));
  /*
    Limit 0 NET BİR CEVAP: "AI hakkı yok". null ile karıştırılmamalı —
    biri "hak tanımlanmadı", diğeri "hak yok". İkisini aynı saymak ya
    hakkı olmayanı çalıştırır ya da hiç bildirilmemiş kurumu durdurur.
  */
  if (limit === 0) {
    return { ...bos, oran: 100, engel: "Bu kurumun AI kredisi tanımlı değil. Kurum yöneticinizden paket yükseltmesi isteyin." };
  }

  const oran = Math.min(100, Math.round((kullanilanKredi / limit) * 100));
  const kalan = Math.max(0, durum.aylikKalan) + Math.max(0, durum.ekBakiye);

  /*
    Karar KALANA bakıyor, tüketime değil. Satın alınan kredi aylık hakkın
    üstüne biniyor: yalnızca "tüketim > limit" deseydik, ek kredi almış
    müşteri parasını ödediği halde kapıda durdurulurdu.
  */
  if (kalan <= 0) {
    return {
      ...bos,
      oran,
      engel: "Kurumunuzun AI kredisi bitti. Aylık hak ayın başında yenilenir; "
        + "beklemek istemiyorsanız kurum yöneticiniz ArvoOS panelinden ek kredi yükleyebilir.",
    };
  }

  /*
    Uyarı yalnızca AYLIK hakkın oranına bakıyor: satın alınmış bakiyesi
    olan müşteriye "krediniz bitmek üzere" demek yanlış olurdu, çünkü
    bitmiyor — parayla aldığı kısma geçiyor.
  */
  if (durum.ekBakiye <= 0 && oran >= UYARI_ORANI) {
    return {
      ...bos,
      oran,
      uyari: `Kurumunuzun AI kredisinin %${oran}'i kullanıldı (${sayi(kullanilanKredi)}/${sayi(limit)}). `
        + "Hak dolduğunda asistan durur; ek kredi yükleyerek devam edebilirsiniz.",
    };
  }

  return { ...bos, oran };
}
