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

import { YEREL, type Dil, type Metin } from "@/lib/dil";

/** 1 kredi = 1.000 karakter (istem + yanıt). ArvoOS'taki tanımla aynı. */
export const KREDI_KARAKTERI = 1000;

/** Bu oranın üstü "bitmek üzere"; limite değmeden haber verilir. */
export const UYARI_ORANI = 80;

/*
  Kredi ArvoLab'da harcanıyor ama ArvoOS'ta satılıyor. Mesajlar önce
  yalnızca "ArvoOS panelinden yükleyebilirsiniz" diyordu: doğru ama
  eksik — kullanıcı asistanın ortasında durdurulduğunda nereye
  gideceğini aramak zorunda kalıyordu. Adres, gidilecek SAYFANIN kendisi.

  Bağlantı değil düz metin, çünkü bu metinler hata kutusunda ve bildirim
  şeridinde düz metin olarak gösteriliyor; bağlantıya çevirmek üç ayrı
  yanıt tipini ve onları çizen bileşenleri değiştirmeyi gerektirirdi.
*/
export const KREDI_SATIN_ALMA_ADRESI = "https://app.arvo-os.com/panel/billing";

/*
  Bireysel abone krediyi ArvoLab'ın içinden alıyor (Abonelik ve kredi
  sayfası; ödeme ArvoOS'ta). Kurum yöneticisinin ArvoOS paneli onun için
  anlamsız: girebileceği bir panel yok.
*/
export const BIREYSEL_KREDI_SAYFASI = "/dashboard/abonelik";

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
  /** Kurumsuz müşteri: hak ve bakiye kişinin kendisinin (migration 20261026181929). */
  bireysel?: boolean;
}

export interface KrediKarari {
  /** Doluysa asistan çalışmaz ve bu metin kullanıcıya gösterilir. */
  engel: string | null;
  /** Doluysa çalışma sürer ama kullanıcıya uyarı gösterilir. */
  uyari: string | null;
  /** Yüzde; hesaplanamıyorsa null. */
  oran: number | null;
  kullanilanKredi: number;
}

const sayi = (deger: number, dil: Dil = "tr") => new Intl.NumberFormat(YEREL[dil]).format(deger);

/** Karakteri krediye çevirir; başlanan dilim tam sayılır. */
export const krediye = (karakter: number) => Math.ceil(Math.max(0, karakter) / KREDI_KARAKTERI);

export function krediKarari(durum: KrediDurumu, dil: Dil = "tr"): KrediKarari {
  const t = (metin: Metin) => metin[dil];
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
    return {
      ...bos,
      oran: 100,
      engel: durum.bireysel
        ? t({
            tr: "Aboneliğinizde AI kredisi tanımlı değil. Abonelik ve kredi sayfasından kredi alabilirsiniz: ",
            en: "Your subscription has no AI credits. You can buy credits on the Subscription and credits page: ",
          }) + BIREYSEL_KREDI_SAYFASI
        : t({
            tr: "Bu kurumun AI kredisi tanımlı değil. Kurum yöneticinizden paket yükseltmesi isteyin.",
            en: "This institution has no AI credits. Ask your institution administrator to upgrade the plan.",
          }),
    };
  }

  const oran = Math.min(100, Math.round((kullanilanKredi / limit) * 100));
  const kalan = Math.max(0, durum.aylikKalan) + Math.max(0, durum.ekBakiye);

  /*
    Karar KALANA bakıyor, tüketime değil. Satın alınan kredi aylık hakkın
    üstüne biniyor: yalnızca "tüketim > limit" deseydik, ek kredi almış
    müşteri parasını ödediği halde kapıda durdurulurdu.
  */
  if (kalan <= 0) {
    if (durum.bireysel) {
      return {
        ...bos,
        oran,
        engel: t({
          tr: "AI krediniz bitti. Aylık hakkınız ayın başında yenilenir; "
            + "beklemek istemiyorsanız Abonelik ve kredi sayfasından ek kredi alabilirsiniz: ",
          en: "You're out of AI credits. Your monthly allowance renews at the start of the month; "
            + "if you don't want to wait, you can buy extra credits on the Subscription and credits page: ",
        }) + BIREYSEL_KREDI_SAYFASI,
      };
    }
    return {
      ...bos,
      oran,
      engel: t({
        tr: "Kurumunuzun AI kredisi bitti. Aylık hak ayın başında yenilenir; "
          + "beklemek istemiyorsanız kurum yöneticiniz ArvoOS panelinden ek kredi satın alabilir: ",
        en: "Your institution is out of AI credits. The monthly allowance renews at the start of the month; "
          + "if you don't want to wait, your institution administrator can buy extra credits in the ArvoOS panel: ",
      }) + KREDI_SATIN_ALMA_ADRESI,
    };
  }

  /*
    Uyarı yalnızca AYLIK hakkın oranına bakıyor: satın alınmış bakiyesi
    olan müşteriye "krediniz bitmek üzere" demek yanlış olurdu, çünkü
    bitmiyor — parayla aldığı kısma geçiyor.
  */
  if (durum.ekBakiye <= 0 && oran >= UYARI_ORANI) {
    if (durum.bireysel) {
      return {
        ...bos,
        oran,
        uyari: t({
          tr: `Aylık AI kredinizin %${oran}'i kullanıldı (${sayi(kullanilanKredi)}/${sayi(limit)}). `
            + "Hak dolduğunda asistan durur; Abonelik ve kredi sayfasından ek kredi alabilirsiniz: ",
          en: `${oran}% of your monthly AI credits have been used (${sayi(kullanilanKredi, "en")}/${sayi(limit, "en")}). `
            + "The assistant stops when the allowance runs out; you can buy extra credits on the Subscription and credits page: ",
        }) + BIREYSEL_KREDI_SAYFASI,
      };
    }
    return {
      ...bos,
      oran,
      uyari: t({
        tr: `Kurumunuzun AI kredisinin %${oran}'i kullanıldı (${sayi(kullanilanKredi)}/${sayi(limit)}). `
          + "Hak dolduğunda asistan durur; kurum yöneticiniz ek kredi satın alarak sürdürebilir: ",
        en: `${oran}% of your institution's AI credits have been used (${sayi(kullanilanKredi, "en")}/${sayi(limit, "en")}). `
          + "The assistant stops when the allowance runs out; your institution administrator can buy extra credits to continue: ",
      }) + KREDI_SATIN_ALMA_ADRESI,
    };
  }

  return { ...bos, oran };
}
