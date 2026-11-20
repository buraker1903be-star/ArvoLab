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
*/

export interface OzetGirdisi {
  references: { issues?: { severity: string }[] }[];
  crossCheck: {
    referencesWithoutCitation: unknown[];
    citationsWithoutReference: unknown[];
  };
  verificationSummary?: { notFound: number; unreachable?: number } | null;
  dogrulananSayisi?: number | null;
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
  /** Dizinde bakılan künye sayısı; bilinmiyorsa null */
  dizindeBakilan: number | null;
  acikSorun: number;
  ton: "success" | "warning" | "danger";
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
  const acikSorun = hatali + uyarili + atifsiz + karsiliksiz + bulunamayan;
  const ton = hatali + karsiliksiz > 0 ? "danger" : acikSorun + ulasilamayan > 0 ? "warning" : "success";
  return {
    kunye,
    bicimHatali: hatali,
    bicimUyarili: uyarili,
    atifsizKaynak: atifsiz,
    karsiliksizAtif: karsiliksiz,
    bulunamayan,
    ulasilamayan,
    dizindeBakilan: g.dogrulananSayisi ?? null,
    acikSorun,
    ton,
  };
}
