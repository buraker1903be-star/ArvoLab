/*
  Analiz türlerinin tek listesi.

  Etiketler eskiden yalnızca data-analyzer.tsx içindeki bir sabitteydi;
  kaydedilen sonuçların geçmişi de aynı adları yazmak zorunda olduğu için
  liste buraya alındı. İki yerde ayrı ayrı tutulsaydı, yeni bir test
  eklendiğinde geçmiş ekranı ham anahtarı ("chisquare") gösterirdi.
*/

export const ANALIZ_ETIKETLERI = {
  descriptives: "Betimsel İstatistikler",
  ttest: "Bağımsız Örneklem t-Testi",
  anova: "Tek Yönlü ANOVA",
  correlation: "Pearson Korelasyonu",
  chisquare: "Ki-Kare Bağımsızlık Testi",
  reliability: "Güvenilirlik Analizi (Cronbach Alpha)",
} as const;

export type AnalizTuru = keyof typeof ANALIZ_ETIKETLERI;

export const ANALIZ_TURLERI = Object.keys(ANALIZ_ETIKETLERI) as AnalizTuru[];

export function analizTuruMu(deger: string): deger is AnalizTuru {
  return deger in ANALIZ_ETIKETLERI;
}

/*
  Tanınmayan tür ham haliyle döner. "Bilinmeyen analiz" yazmak, eski bir
  kaydın hangi testten geldiğini kullanıcıdan gizlemek olurdu; anahtarın
  kendisi hiç yoktan iyidir.
*/
export function analizEtiketi(tur: string): string {
  return analizTuruMu(tur) ? ANALIZ_ETIKETLERI[tur] : tur;
}

export interface AnalizSecimi {
  varA?: string;
  varB?: string;
  groupVar?: string;
  maddeSayisi?: number;
}

const EN_UZUN_BASLIK = 300;

/*
  Kaydedilen sonucun başlığı: hangi testin HANGİ DEĞİŞKENLERLE
  çalıştırıldığı. Yalnızca test adı yazılsaydı ("Pearson Korelasyonu")
  üç ayrı korelasyon geçmişte birbirinin aynısı görünürdü.

  Değişken seçilmemişse uydurulmuyor: eksik parçalar atlanıyor ve geriye
  yalnızca testin adı kalıyor.
*/
export function analizBasligi(tur: string, secim: AnalizSecimi): string {
  const a = secim.varA?.trim();
  const b = secim.varB?.trim();
  const grup = secim.groupVar?.trim();

  const govde =
    tur === "descriptives"
      ? "tüm sayısal değişkenler"
      : tur === "ttest" || tur === "anova"
        ? [a, grup].filter(Boolean).join(" ~ ")
        : tur === "correlation"
          ? [a, b].filter(Boolean).join(" — ")
          : tur === "chisquare"
            ? [a, b].filter(Boolean).join(" × ")
            : tur === "reliability" && secim.maddeSayisi
              ? `${secim.maddeSayisi} madde`
              : "";

  const tam = govde ? `${analizEtiketi(tur)}: ${govde}` : analizEtiketi(tur);
  return tam.length > EN_UZUN_BASLIK ? `${tam.slice(0, EN_UZUN_BASLIK - 1)}…` : tam;
}
