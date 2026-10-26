/*
  PERSONEL ÇALIŞMALARI: ÜSTTEKİ SAYAÇLAR (26.10.2026, kurum sahibinin
  isteği: personel Çalışmalarım düzeni "panel kalitesinde").

  Her sayaç bir FİLTREDİR ve sayısı o filtrenin listesinin uzunluğudur:
  aynı applyProjectFilters çağrısı. Ayrı bir sayım yazılsaydı "3 onay
  bekliyor" deyip tıklanınca 5 çalışma açılabilirdi — ana sayfanın
  dikkat kartlarında yaşanan hatanın aynısı
  (tests/unit/attention-filtre-tutarliligi.test.ts).

  Arama ve sıralama sayaçlara taşınmaz: sayaç "kurumun bütününde kaç
  tane" sorusunu yanıtlıyor; arama kutusuna yazılan bir kelime
  sayıları değiştirseydi öğrenci listesi daraltıldığında "onay bekleyen
  yok" gibi okunurdu. Tıklanınca da arama sıfırlanır.

  Saf modül; testi tests/unit/personel-sayaclari.test.ts.
*/
import {
  applyProjectFilters,
  DEFAULT_PROJECT_FILTERS,
  filtreAdresi,
  type ProjectFilterInput,
  type ProjectFilters,
} from "@/lib/project-filters";

export type PersonelSayaci = {
  anahtar: string;
  etiket: string;
  sayi: number;
  href: string;
  /** Sıfırdan büyükse dikkat çeken ton */
  ton: "warning" | "danger" | "info" | "neutral";
  /** Şu anki filtre bu sayaç mı */
  secili: boolean;
};

const TANIMLAR: { anahtar: string; etiket: string; filtre: Partial<ProjectFilters>; ton: PersonelSayaci["ton"] }[] = [
  { anahtar: "aktif", etiket: "Aktif çalışma", filtre: { status: "aktif" }, ton: "neutral" },
  { anahtar: "onay", etiket: "Onay bekliyor", filtre: { approval: "bekliyor" }, ton: "warning" },
  { anahtar: "atanmamis", etiket: "Sorumlu yok", filtre: { assignee: "atanmamis" }, ton: "warning" },
  { anahtar: "gecikmis", etiket: "Teslimi geçmiş", filtre: { status: "gecikmis" }, ton: "danger" },
  { anahtar: "yaklasan", etiket: "7 gün içinde teslim", filtre: { status: "yaklasan" }, ton: "info" },
  { anahtar: "yorum", etiket: "Açık yorumlu", filtre: { comments: "acik" }, ton: "info" },
];

export function personelSayaclari<T extends ProjectFilterInput>(
  calismalar: T[],
  simdikiFiltre: ProjectFilters,
  baglam: Parameters<typeof applyProjectFilters<T>>[2],
): PersonelSayaci[] {
  return TANIMLAR.map((t) => {
    const filtre: ProjectFilters = { ...DEFAULT_PROJECT_FILTERS, ...t.filtre };
    const secili = (Object.keys(DEFAULT_PROJECT_FILTERS) as (keyof ProjectFilters)[]).every(
      (k) => k === "sort" || k === "q" || simdikiFiltre[k] === filtre[k],
    );
    return {
      anahtar: t.anahtar,
      etiket: t.etiket,
      sayi: applyProjectFilters(calismalar, filtre, { ...baglam, canFilterAssignee: true }).length,
      // Seçili sayaca yeniden basınca filtre kalkar.
      href: secili ? "/dashboard/editor" : filtreAdresi(filtre),
      ton: t.ton,
      secili,
    };
  });
}
