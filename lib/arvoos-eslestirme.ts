/*
  ESKİ KAYITLARIN ARVOOS'LA EŞLEŞTİRİLMESİ — SAF MANTIK (25.11.2026).

  `tasarim/tek-deneyim/ENTEGRASYON-PLANI.md` G maddesi (karar K8) ve uygulama
  sırasındaki L0 işi: ArvoLab'daki ESKİ kurum bağları, atamalar ve personel
  rolleri ArvoOS'un bildirdiğiyle karşılaştırılır, sonuç kayıt kayıt
  raporlanır. Dönüştürme YOK: bu modül hüküm verir, uygulamaz. Plandaki
  kural aynen duruyor — "doğrulanmamış kayıt otomatik dönüştürülmez".

  NEDEN RAPOR, NEDEN OTOMATİK DEĞİL. Bugün ArvoLab'da bir profilin kuruma
  bağı iki yoldan gelmiş olabilir: ArvoOS üye listesiyle
  (`arvoos_uyeligini_bagla`) ya da elle. İkisini ayıran bir sütun henüz yok
  (`profiles.kurum_bagi_kaynagi` L1'in konusu), yani bugünkü bağların
  hepsine "eski" demek gerekiyor. Bir bağı kaldırmak kişinin kurum
  lisansından gelen erişimini kapatır; bunu bir betiğin kendi başına
  yapması, yanlış eşleşmede insanı ürün dışında bırakmak olurdu.

  KANIT YOKLUĞU OLUMSUZ HÜKÜM DEĞİLDİR. ArvoOS tarafı bir kurum için hiç
  satır bildirmiyorsa hüküm "ölçülemedi"dir, "doğrulanamadı" değil: üye
  listesi kurum lisansı kapanınca SİLİNİYOR (`arvoos_members`,
  20260924100011), yani boş liste "bu kişi üye değil" demez, "elimizde veri
  yok" der. Aynı kural ürünün erişim kapısında da böyle
  (`lib/license-decision.ts`): kapıyı yalnızca net bir "hayır" kapatır.
  Geçici bir arızayı "doğrulanamadı" diye yazmak, insan o raporu onaylarken
  var olan bir bağı kaldırmasına yol açar.

  Saf modül; testi tests/unit/arvoos-eslestirme.test.ts. Veritabanı okuması
  ve CSV yazımı çağıranda (scripts/arvoos-eslestirme-raporu.mjs).
*/

import { ADMIN_ROLES, STAFF_ROLES, type UserRole } from "./project-labels";

/** ArvoOS tarafının bir üyelik satırı. */
export type ArvoosKaydi = {
  /**
   * ArvoOS `auth.users.id`. Kalıcı bağın anahtarı bu (K6), ama ArvoLab'a
   * yansıtılan üye listesinde YOK: orada yalnızca e-posta var. Anlık
   * görüntü dosyası verilmediyse null kalır ve rapor bunu söyler.
   */
  arvoosUserId: string | null;
  /** Küçük harfe indirgenmiş e-posta. */
  eposta: string;
  kurum: string;
};

/** ArvoLab tarafının bir profili. */
export type ArvolabProfili = {
  id: string;
  /** `profiles.organization_id`; null ise bağ yok, kapsam dışı. */
  kurum: string | null;
  /** `auth.users.email`; küçük harfe indirgenmiş. */
  eposta: string | null;
  /** `auth.users.email_confirmed_at` dolu mu. */
  epostaOnayli: boolean;
  rol: UserRole;
};

export type BagHukmu = "dogrulanabilir" | "dogrulanamadi" | "olculemedi" | "kapsamda_degil";

export type BagSebebi =
  /** Kurumdaki tek etkin üyelikle e-posta birebir eşleşti. */
  | "eslesti"
  /** Profilin kurumu için ArvoOS tarafı hiç satır bildirmedi. */
  | "arvoos_verisi_yok"
  /** E-posta ArvoOS'un bildirdiği hiçbir kurumda yok. */
  | "arvoos_listesinde_yok"
  /** E-posta ArvoOS'ta var, ama profilin bağlı olduğu kurumda değil. */
  | "kurum_uyusmuyor"
  /** Aynı kurumda aynı e-postayla birden çok ArvoOS kimliği. */
  | "birden_cok_aday"
  /** Hesabın e-postası onaylı değil; K6 ilk eşleşmeyi onaylı e-postaya bağlıyor. */
  | "eposta_onaysiz"
  /** Hesapta e-posta yok. */
  | "eposta_yok"
  /** Bağ yok (kurum boş). */
  | "bag_yok"
  /** İç ekip; kurum bağı ArvoOS üyeliğinden gelmiyor. */
  | "ic_ekip";

export type BagSatiri = {
  profil: string;
  kurum: string | null;
  rol: UserRole;
  hukum: BagHukmu;
  sebep: BagSebebi;
  /** Eşleşen ArvoOS kimliği; yansıma listesiyle çalışıldığında null. */
  arvoosUserId: string | null;
  /**
   * Aynı e-posta ArvoOS'ta BAŞKA bir kurumda da etkin. Hüküm bundan
   * olumsuza dönmüyor — bağın gösterdiği kurumda eşleşme var, bu doğru
   * bilgidir — ama bağı kalıcı kimliğe taşıyacak kişinin görmesi gerekiyor.
   */
  baskaKurumdaDa: boolean;
};

/** İki tarafta da aynı yazımı kullanmak için: küçük harf + kenar boşlukları. */
export const epostaAnahtari = (eposta: string | null | undefined): string =>
  (eposta ?? "").trim().toLocaleLowerCase("en-US");

/*
  İç ekip kapsam dışı. `system_admin` ve `founder` bir müşteri kurumunun
  personeli değil; bağları ArvoOS üyeliğinden gelmiyor ve ArvoOS listesinde
  aranmamalı. Aranırsa hepsi "listede yok" çıkar ve rapor, kaldırılmaması
  gereken bağları kaldırılacaklar arasında gösterir.
*/
const icEkip = (rol: UserRole): boolean => ADMIN_ROLES.includes(rol);

/**
 * Bir profilin kurum bağına hüküm verir.
 *
 * @param kapsananKurumlar ArvoOS tarafının VERİ BİLDİRDİĞİ kurumlar. Bu küme
 *   dışındaki bir kurum için hüküm "ölçülemedi": elimizde o kurumun üye
 *   listesi yok (lisans kapanmış ve liste silinmiş olabilir).
 */
export function kurumBagiHukmu(
  profil: ArvolabProfili,
  kayitlar: ArvoosKaydi[],
  kapsananKurumlar: ReadonlySet<string>,
): BagSatiri {
  const temel = { profil: profil.id, kurum: profil.kurum, rol: profil.rol, arvoosUserId: null, baskaKurumdaDa: false };
  if (!profil.kurum) return { ...temel, hukum: "kapsamda_degil", sebep: "bag_yok" };
  if (icEkip(profil.rol)) return { ...temel, hukum: "kapsamda_degil", sebep: "ic_ekip" };
  if (!kapsananKurumlar.has(profil.kurum)) return { ...temel, hukum: "olculemedi", sebep: "arvoos_verisi_yok" };

  const eposta = epostaAnahtari(profil.eposta);
  if (!eposta) return { ...temel, hukum: "dogrulanamadi", sebep: "eposta_yok" };
  /*
    Onaysız e-posta eşleşme sayılmaz (K6). Onaysız bir adresi kabul etmek,
    başkasının adresini yazan hesabın o kurumun haklarını almasına kapı
    açardı; bağın kalıcı anahtara taşınması tam bu noktada kuruluyor.
  */
  if (!profil.epostaOnayli) return { ...temel, hukum: "dogrulanamadi", sebep: "eposta_onaysiz" };

  const eslesenler = kayitlar.filter((k) => epostaAnahtari(k.eposta) === eposta);
  if (!eslesenler.length) return { ...temel, hukum: "dogrulanamadi", sebep: "arvoos_listesinde_yok" };

  const kurumdakiler = eslesenler.filter((k) => k.kurum === profil.kurum);
  const baskaKurumdaDa = eslesenler.some((k) => k.kurum !== profil.kurum);
  if (!kurumdakiler.length) return { ...temel, hukum: "dogrulanamadi", sebep: "kurum_uyusmuyor", baskaKurumdaDa };

  /*
    Aynı kurumda aynı e-postayla iki ArvoOS kimliği varsa bağın hangisine
    taşınacağı belirsiz; plan bunu açıkça "birden çok aday → bağ kurulmaz,
    raporlanır" diyor. Yansıma listesinde kimlik olmadığı için bu durum
    yalnızca anlık görüntüyle çalışırken görülebilir.
  */
  const kimlikler = new Set(kurumdakiler.map((k) => k.arvoosUserId).filter((k): k is string => !!k));
  if (kimlikler.size > 1) return { ...temel, hukum: "dogrulanamadi", sebep: "birden_cok_aday", baskaKurumdaDa };

  return {
    ...temel,
    hukum: "dogrulanabilir",
    sebep: "eslesti",
    arvoosUserId: [...kimlikler][0] ?? null,
    baskaKurumdaDa,
  };
}

/** Bütün profiller için hüküm; sıra girdinin sırası. */
export const bagRaporu = (
  profiller: ArvolabProfili[],
  kayitlar: ArvoosKaydi[],
  kapsananKurumlar: ReadonlySet<string>,
): BagSatiri[] => profiller.map((p) => kurumBagiHukmu(p, kayitlar, kapsananKurumlar));

/** ArvoOS tarafının veri bildirdiği kurumlar; hüküm kapsamı budur. */
export const kapsananKurumlar = (kayitlar: ArvoosKaydi[]): Set<string> => new Set(kayitlar.map((k) => k.kurum));

/* -------------------------------------------------------------------------- */

export type Atama = { proje: string; kurum: string | null; atanan: string };

export type AtamaOnerisi = {
  proje: string;
  kurum: string | null;
  atanan: string;
  /** Atanan kişinin kurum bağı hükmü; önerinin dayanağı o. */
  atananinBagi: BagHukmu | "profil_yok";
  /** Atanan kişinin eşleşen ArvoOS kimliği, biliniyorsa. */
  arvoosUserId: string | null;
};

/*
  ATAMALAR YALNIZCA ÖNERİ. `academic_projects.assignee_id` ArvoLab'ın kendi
  kavramı; ArvoOS'taki iş atamasıyla (`operation_workflow_assignees`) ortak
  bir kimliği YOK. İki tarafı eşleştirecek tek köprü kişinin kimliği, o da
  ancak kurum bağı doğrulanmışsa güvenilir. Bu yüzden satır bir hüküm değil
  öneri taşıyor ve dayanağını (atananın bağ hükmü) birlikte yazıyor:
  doğrulanmamış bir bağ üzerine kurulan iş yetkisi, yanlış kişiye başkasının
  çalışmasını açardı.
*/
export function atamaOnerileri(atamalar: Atama[], bagSatirlari: BagSatiri[]): AtamaOnerisi[] {
  const baglar = new Map(bagSatirlari.map((s) => [s.profil, s]));
  return atamalar.map((a) => {
    const bag = baglar.get(a.atanan);
    return {
      proje: a.proje,
      kurum: a.kurum,
      atanan: a.atanan,
      atananinBagi: bag?.hukum ?? "profil_yok",
      arvoosUserId: bag?.arvoosUserId ?? null,
    };
  });
}

/* -------------------------------------------------------------------------- */

export type RolOnerisi = {
  profil: string;
  kurum: string | null;
  rol: UserRole;
  oneri: "is_yetkisi" | "teknik_yetki" | "yok";
  /** Kişinin kurum bağı hükmü; önerinin dayanağı o. */
  bagi: BagHukmu | "profil_yok";
};

/*
  ROL → YETKİ ÖNERİSİ.

  Plan personel rollerini iki yeni kavrama bölüyor: iş yetkisi (D, ArvoOS'un
  iş atamasından gelir) ve teknik yetki (C, ayrıca ve dar verilir, K3).
  Bugünkü rollerden hangisinin hangisine karşılık geldiği bir ÖNERİ.

  DAYANAĞI BİRLİKTE YAZILIYOR (25.11.2026, incelemede çıktı). Eskiden bu
  fonksiyon yalnızca role bakıyordu ve `rol-onerileri.csv` dört sütun
  taşıyordu: bağı "doğrulanamadı" ya da "ölçülemedi" olan bir personel,
  kayıt kayıt onaylayan kişinin önüne bu bilgi OLMADAN düşüyordu. Atama
  önerisi dayanağını (`atananinBagi`) baştan taşıyordu; aynı gerekçe rol
  önerisi için de geçerli — doğrulanmamış bir bağ üzerine kurulan iş
  yetkisi, yanlış kişiye başkasının çalışmasını açar. Öneri, hüküm olumsuz
  diye düşmüyor (karar insanın), ama hüküm satırda görünüyor.

  KURUMU OLMAYAN PERSONELE İŞ YETKİSİ ÖNERİLMEZ. İş yetkisi ArvoOS'taki bir
  kurumun işinden gelir; `organization_id`'si NULL olan personel rollü bir
  hesap için "iş yetkisi" önerisi hangi kurumun işi olduğunu söylemez.
  Eskiden onlar da listede `is_yetkisi` ile duruyordu.

  Teknik yetki önerisi bugün için BOŞ ÇIKAR, bilerek: Asistan Kayıtları
  sayfasının kapısı `KAYIT_ROLLERI` ve o küme yalnızca `system_admin` ile
  `founder` (lib/ai/kayit-gorunum.ts). Yani bugün o sayfayı iç ekip dışında
  kimse açamıyor ve C geldiğinde taşınacak mevcut bir hak yok. İç ekibin
  kendi erişimi roldendir, teknik yetkiden türetilmez (K3). Bu satırı
  "önerilecek kimse yok" diye okumayın: kapı bugün başka bir role açılırsa
  bu fonksiyon da onunla birlikte değişmeli.
*/
export function rolOnerileri(profiller: ArvolabProfili[], bagSatirlari: BagSatiri[]): RolOnerisi[] {
  const baglar = new Map(bagSatirlari.map((s) => [s.profil, s]));
  return profiller
    .filter((p) => !icEkip(p.rol) && STAFF_ROLES.includes(p.rol))
    .map((p) => ({
      profil: p.id,
      kurum: p.kurum,
      rol: p.rol,
      oneri: p.kurum ? ("is_yetkisi" as const) : ("yok" as const),
      bagi: baglar.get(p.id)?.hukum ?? "profil_yok",
    }));
}

/* -------------------------------------------------------------------------- */

export type Ozet = Record<BagHukmu, number> & { toplam: number; sebepler: Record<string, number>; baskaKurumdaDa: number };

export function bagOzeti(satirlar: BagSatiri[]): Ozet {
  const ozet: Ozet = {
    toplam: satirlar.length,
    dogrulanabilir: 0,
    dogrulanamadi: 0,
    olculemedi: 0,
    kapsamda_degil: 0,
    baskaKurumdaDa: 0,
    sebepler: {},
  };
  for (const s of satirlar) {
    ozet[s.hukum] += 1;
    ozet.sebepler[s.sebep] = (ozet.sebepler[s.sebep] ?? 0) + 1;
    if (s.baskaKurumdaDa) ozet.baskaKurumdaDa += 1;
  }
  return ozet;
}

/* -------------------------------------------------------------------------- */

/*
  CSV. Alan ayracı virgül, kaçış RFC 4180: çift tırnak ikileniyor ve virgül,
  tırnak ya da satır sonu taşıyan alan tırnaklanıyor. Elle birleştirmek
  yerine burada durması, raporu okuyan aracın (hesap tablosu) satırı
  bölmesini önlüyor — e-posta ve ad alanlarında virgül görülebiliyor.

  Baştaki `=`, `+`, `-`, `@` karakterleri tek tırnakla önceleniyor: hesap
  tablosu bunları FORMÜL olarak çalıştırıyor ve rapor, onaylayan kişinin
  makinesinde çalışan bir satıra dönüşebiliyor.
*/
export function csvAlani(deger: unknown): string {
  if (deger === null || deger === undefined) return "";
  let metin = typeof deger === "boolean" ? (deger ? "evet" : "hayır") : String(deger);
  if (/^[=+\-@\t\r]/.test(metin)) metin = `'${metin}`;
  return /[",\r\n]/.test(metin) ? `"${metin.split('"').join('""')}"` : metin;
}

export function csv(basliklar: string[], satirlar: Record<string, unknown>[]): string {
  const govde = satirlar.map((s) => basliklar.map((b) => csvAlani(s[b])).join(","));
  return [basliklar.join(","), ...govde].join("\n") + "\n";
}
