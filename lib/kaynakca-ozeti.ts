/*
  KAYNAKÇA DENETİMİNİN ÖZETİ: kapsam + açık sorunlar (20.11.2026).

  Eskiden ekranın başında "APA 7 uyum 100/100" yazıyordu. Puan
  (lib/apa7.ts computeComplianceScore) biçim UYARILARINI bilerek dışarıda
  bırakıyor; yazar biçimi uyarısı olan bir kaynakçada da 100 çıkıyor ve
  öğrenci bunu "kaynakçam APA'ya uygun" diye okuyordu. Denetim bir genel
  uygunluk onayı veremez: kılavuzun kuralları, künyenin doğruluğu ve
  denetlenmeyen alanlar dışarıda kalıyor.

  Artık ekran şunu söyler: NE kontrol edildi (kaç künye, hangi denetimler,
  dizinde kaçına bakıldı) ve kaç AÇIK SORUN var. Puan veritabanında kalıyor
  (geçmiş kayıtlar, migration yok), ama "uyum" diye gösterilmiyor.

  TOPLAM ile KATEGORİLER TEK YERDEN (23.11.2026). Kaynaklar sayfasındaki
  kart kategori satırlarını kendisi yazıyordu ve listede BİÇİM satırları
  hiç yoktu: yalnızca biçim bulgusu olan bir denetimde üstte "2 açık
  sorun", altta dört kategorinin dördü de "Yok" görünüyordu. Artık
  kategoriler de burada üretiliyor ve toplam, kategorilerin toplamıdır —
  ikisi ayrışamaz.

  ÖLÇÜLMEYEN KATEGORİ "YOK" DEĞİLDİR. Metinden atıf çıkarılamadıysa
  çapraz kontrol yapılmamıştır; dizine hiç bakılmadıysa "bulunamayan"
  sayısı bir hüküm değildir; kılavuz atıf kuralları eski kayıtlarda hiç
  yok. Bunları sıfırla göstermek, yapılmamış bir denetimi temiz rapor
  gibi sunuyordu.
*/

export type KategoriAnahtari =
  | "bicimHatali"
  | "bicimUyarili"
  | "atifsizKaynak"
  | "karsiliksizAtif"
  | "bulunamayan"
  | "kilavuzAtifi"
  | "ulasilamayan";

export interface OzetKategorisi {
  anahtar: KategoriAnahtari;
  sayi: number;
  /** Bu denetimde ÖLÇÜLDÜ mü? Ölçülmediyse sayı bir hüküm değildir. */
  olculdu: boolean;
  /** Açık sorun toplamına katılıyor mu? */
  toplamaKatilir: boolean;
}

export interface OzetGirdisi {
  references: { issues?: { severity: string }[] }[];
  crossCheck: {
    referencesWithoutCitation: unknown[];
    citationsWithoutReference: unknown[];
  };
  verificationSummary?: { notFound: number; unreachable?: number; verified?: number; possible?: number } | null;
  dogrulananSayisi?: number | null;
  /**
   * Metinden çıkarılan atıflar. VERİLMEZSE (eski çağıranlar, editör)
   * çapraz kontrol ölçülmüş sayılır; boş dizi "atıf çıkarılamadı"
   * demektir ve çapraz kontrol ölçülmemiş sayılır.
   */
  citations?: unknown[] | null;
  /** Kılavuz atıf kuralları bulguları; null/verilmemiş = ölçülmedi. */
  tyk?: unknown[] | null;
}

export interface KaynakcaOzeti {
  kunye: number;
  /** En az bir biçim HATASI olan künye sayısı */
  bicimHatali: number;
  /** Hatası olmayıp en az bir biçim UYARISI olan künye sayısı */
  bicimUyarili: number;
  atifsizKaynak: number;
  karsiliksizAtif: number;
  bulunamayan: number;
  ulasilamayan: number;
  kilavuzAtifi: number;
  /** Dizinde bakılan künye sayısı; bilinmiyorsa null */
  dizindeBakilan: number | null;
  atifOlculdu: boolean;
  dizinOlculdu: boolean;
  kilavuzOlculdu: boolean;
  /** Toplam = toplama katılan ve ÖLÇÜLEN kategorilerin toplamı. */
  acikSorun: number;
  kategoriler: OzetKategorisi[];
  ton: "success" | "warning" | "danger";
}

/*
  EKRANDAKİ SIRA ve VURGU (23.11.2026 tasarım turu). Kart önce
  İNCELENMESİ GEREKENLERİ gösteriyor; temiz ve denetlenmemiş
  kategoriler "Tüm kontroller" altında kalıyor. Sıralama ağırlığa
  göre: düzeltilmesi zorunlu olanlar (biçim hatası, karşılıksız atıf)
  başta, geçici arıza (dizine ulaşılamayan) en sonda.
*/
const AGIRLIK: Record<KategoriAnahtari, number> = {
  bicimHatali: 0,
  karsiliksizAtif: 1,
  bicimUyarili: 2,
  atifsizKaynak: 3,
  bulunamayan: 4,
  kilavuzAtifi: 5,
  ulasilamayan: 6,
};

/** Bulgusu olan kategoriler: ağırlığa göre sıralı. */
export function dikkatKategorileri(o: KaynakcaOzeti): OzetKategorisi[] {
  return o.kategoriler.filter((k) => k.olculdu && k.sayi > 0).sort((a, b) => AGIRLIK[a.anahtar] - AGIRLIK[b.anahtar]);
}

/** Temiz ve denetlenmemiş kategoriler: "Tüm kontroller" altında. */
export function otekiKategoriler(o: KaynakcaOzeti): OzetKategorisi[] {
  return o.kategoriler.filter((k) => !(k.olculdu && k.sayi > 0)).sort((a, b) => AGIRLIK[a.anahtar] - AGIRLIK[b.anahtar]);
}

export interface OzetVurgusu {
  /** tek: tek tür bulgu var; coklu: birden çok; temiz: bulgu yok. */
  tur: "tek" | "coklu" | "temiz";
  /** tek ise o kategori. */
  anahtar: KategoriAnahtari | null;
  /** tek ise kategorinin sayısı, coklu ise açık sorun toplamı. */
  sayi: number;
  /** coklu ise kategori dağılımı (şeritte tek yerde yazılıyor). */
  dagilim: OzetKategorisi[];
}

/**
 * Şeritte ÖNE ÇIKAN ifade. Tek tür bulgu varsa türün kendisi yazılıyor
 * ("2 biçim uyarısı"): "2 açık sorun" kullanıcıyı neyin sorun olduğunu
 * aramaya gönderiyordu. Birden çok tür varsa toplam ve dağılım aynı
 * şeritte; ayrı bir özet satırında TEKRARLANMIYOR.
 */
export function ozetVurgusu(o: KaynakcaOzeti): OzetVurgusu {
  const dikkat = dikkatKategorileri(o);
  const sayilan = dikkat.filter((k) => k.toplamaKatilir);
  if (!dikkat.length) return { tur: "temiz", anahtar: null, sayi: 0, dagilim: [] };
  if (dikkat.length === 1) return { tur: "tek", anahtar: dikkat[0].anahtar, sayi: dikkat[0].sayi, dagilim: [] };
  return { tur: "coklu", anahtar: null, sayi: o.acikSorun, dagilim: sayilan };
}

export function kaynakcaOzeti(g: OzetGirdisi): KaynakcaOzeti {
  const kunye = g.references.length;
  const hatali = g.references.filter((r) => r.issues?.some((i) => i.severity === "error")).length;
  const uyarili = g.references.filter(
    (r) => !r.issues?.some((i) => i.severity === "error") && r.issues?.some((i) => i.severity === "warning"),
  ).length;
  const atifsiz = g.crossCheck.referencesWithoutCitation.length;
  const karsiliksiz = g.crossCheck.citationsWithoutReference.length;
  const bulunamayan = g.verificationSummary?.notFound ?? 0;
  const ulasilamayan = g.verificationSummary?.unreachable ?? 0;
  const kilavuz = g.tyk?.length ?? 0;

  /* Biçim her künyede çalışır; künye yoksa ölçülecek bir şey de yok. */
  const bicimOlculdu = kunye > 0;
  /* citations verilmediyse eski çağırandır: ölçüldü sayılır. */
  const atifOlculdu = g.citations === undefined ? true : (g.citations?.length ?? 0) > 0;
  /*
    Dizin ÖLÇÜLDÜ mü? Künye künye liste (academicVerification) en
    güvenilir ölçü, ama eski kayıtlarda o liste olmadan yalnızca özet
    sayıları duruyor. Özette bir hüküm varsa (doğrulandı + olası +
    bulunamadı) denetim yapılmıştır; ayrıntı yoksa ekran kategori ve
    adet satırına düşer, "denetlenmedi" demez.
  */
  const dizinHukmu =
    (g.verificationSummary?.verified ?? 0) + (g.verificationSummary?.possible ?? 0) + (g.verificationSummary?.notFound ?? 0);
  const dizinOlculdu = (g.dogrulananSayisi ?? 0) > 0 || dizinHukmu > 0;
  const kilavuzOlculdu = Array.isArray(g.tyk);

  const kategoriler: OzetKategorisi[] = [
    { anahtar: "bicimHatali", sayi: hatali, olculdu: bicimOlculdu, toplamaKatilir: true },
    { anahtar: "bicimUyarili", sayi: uyarili, olculdu: bicimOlculdu, toplamaKatilir: true },
    { anahtar: "karsiliksizAtif", sayi: karsiliksiz, olculdu: atifOlculdu, toplamaKatilir: true },
    { anahtar: "atifsizKaynak", sayi: atifsiz, olculdu: atifOlculdu, toplamaKatilir: true },
    { anahtar: "bulunamayan", sayi: bulunamayan, olculdu: dizinOlculdu, toplamaKatilir: true },
    { anahtar: "kilavuzAtifi", sayi: kilavuz, olculdu: kilavuzOlculdu, toplamaKatilir: true },
    /* Dizine ULAŞILAMAYAN geçici bir arızadır, hüküm değil: toplama
       katılmaz ama gizlenmez (12.11.2026). */
    { anahtar: "ulasilamayan", sayi: ulasilamayan, olculdu: dizinOlculdu, toplamaKatilir: false },
  ];
  const acikSorun = kategoriler
    .filter((k) => k.toplamaKatilir && k.olculdu)
    .reduce((toplam, k) => toplam + k.sayi, 0);
  const ton = hatali + karsiliksiz > 0 ? "danger" : acikSorun + ulasilamayan > 0 ? "warning" : "success";
  return {
    kunye,
    bicimHatali: hatali,
    bicimUyarili: uyarili,
    atifsizKaynak: atifsiz,
    karsiliksizAtif: karsiliksiz,
    bulunamayan,
    ulasilamayan,
    kilavuzAtifi: kilavuz,
    dizindeBakilan: g.dogrulananSayisi ?? null,
    atifOlculdu,
    dizinOlculdu,
    kilavuzOlculdu,
    acikSorun,
    kategoriler,
    ton,
  };
}
