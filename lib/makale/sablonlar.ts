/*
  Makale türleri, bölüm planları, raporlama standartları ve yönteme göre
  denetim listeleri.

  TEK BİR ZORUNLU YAPI YOK. Şablon bir başlangıç planıdır: hedef derginin
  talimatı farklı bir düzen istiyorsa dergi kazanır. Bu yüzden gönderim
  kontrolü eksik bölümü "eksik" değil "planda var, metinde yok" diye
  söyler (lib/makale/gonderim-kontrolu.ts).

  Raporlama standartları yalnızca ADIYLA anılıyor, maddeleri burada
  yazılmıyor: maddeler sürümden sürüme değişiyor ve eskimiş bir kopya
  güncelinden zararlıdır. Kullanıcı standardın kendi sayfasına
  (EQUATOR Network) yönlendiriliyor. Kontrol listesinin doldurulmuş
  olması çalışmanın yöntemsel olarak geçerli olduğunu göstermez; bu not
  her yerde birlikte gösteriliyor.

  Saf modül; testi tests/unit/makale-sablonlar.test.ts.
*/

import { normalizeHeading } from "@/lib/section-match";
import type { Dil, Metin } from "@/lib/dil";

export type MakaleTuru =
  | "ozgun"
  | "sistematik_derleme"
  | "kapsam_derlemesi"
  | "anlatisal_derleme"
  | "meta_analiz"
  | "vaka"
  | "yontem"
  | "teknik";

export type BolumTuru =
  | "ozet"
  | "giris"
  | "literatur"
  | "yontem"
  | "model"
  | "vaka"
  | "bulgular"
  | "tartisma"
  | "sonuc"
  | "kaynakca";

export const BOLUM_ADI: Record<BolumTuru, { tr: string; en: string; esAnlamlar: string[] }> = {
  ozet: { tr: "Özet", en: "Abstract", esAnlamlar: ["Öz", "Summary"] },
  giris: { tr: "Giriş", en: "Introduction", esAnlamlar: ["Background", "Arka Plan"] },
  literatur: { tr: "Literatür", en: "Literature Review", esAnlamlar: ["Kuramsal Çerçeve", "Theoretical Framework", "Alanyazın", "İlgili Araştırmalar"] },
  yontem: { tr: "Yöntem", en: "Methods", esAnlamlar: ["Method", "Methodology", "Materials and Methods", "Gereç ve Yöntem", "Materyal ve Yöntem", "Yöntem ve Gereçler"] },
  model: { tr: "Model ve Yöntem", en: "Model and Methods", esAnlamlar: ["Sayısal Model", "Numerical Model", "Simülasyon", "Simulation Setup", "Deneysel Düzenek", "Experimental Setup"] },
  vaka: { tr: "Olgu Sunumu", en: "Case Presentation", esAnlamlar: ["Vaka", "Case Report", "Olgu"] },
  bulgular: { tr: "Bulgular", en: "Results", esAnlamlar: ["Findings", "Sonuçlar ve Bulgular"] },
  tartisma: { tr: "Tartışma", en: "Discussion", esAnlamlar: ["Tartışma ve Yorum"] },
  sonuc: { tr: "Sonuç", en: "Conclusion", esAnlamlar: ["Conclusions", "Sonuç ve Öneriler", "Sonuçlar"] },
  kaynakca: { tr: "Kaynakça", en: "References", esAnlamlar: ["Kaynaklar", "Bibliography"] },
};

export type Standart = { ad: string; kapsam: string };

export type TurTanimi = {
  etiket: string;
  aciklama: string;
  bolumler: BolumTuru[];
  standartlar: Standart[];
  notlar: string[];
};

export const EQUATOR_ADRESI = "https://www.equator-network.org/";

export const STANDART_UYARISI_METIN: Metin = {
  tr: "Kontrol listesinin doldurulmuş olması çalışmanın yöntemsel olarak geçerli olduğunu göstermez; standardın güncel sürümünü kendi sayfasından kontrol edin.",
  en: "A completed checklist does not show that the study is methodologically sound; check the current version of the standard on its own website.",
};

export const STANDART_UYARISI = STANDART_UYARISI_METIN.tr;

export const MAKALE_TURLERI: Record<MakaleTuru, TurTanimi> = {
  ozgun: {
    etiket: "Özgün araştırma makalesi",
    aciklama: "Yeni veriye dayanan çalışma; çoğu dergi IMRaD düzeni bekler.",
    bolumler: ["ozet", "giris", "yontem", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [
      { ad: "CONSORT", kapsam: "Randomize kontrollü deneyler" },
      { ad: "STROBE", kapsam: "Gözlemsel çalışmalar (kohort, vaka-kontrol, kesitsel)" },
      { ad: "SRQR / COREQ", kapsam: "Nitel araştırmalar" },
      { ad: "STARD", kapsam: "Tanısal doğruluk çalışmaları" },
    ],
    notlar: ["Bulgular bölümü yalnızca gerçek analiz çıktılarına dayanmalı.", "Tartışma bulguların ötesine geçen genellemelerden kaçınmalı."],
  },
  sistematik_derleme: {
    etiket: "Sistematik derleme",
    aciklama: "Önceden tanımlı bir protokolle, belgelenmiş arama ve seçim süreciyle yapılan derleme.",
    bolumler: ["ozet", "giris", "yontem", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [{ ad: "PRISMA 2020", kapsam: "Sistematik derlemelerin raporlanması" }],
    notlar: [
      "Arama yapılan veri tabanları, tam arama dizeleri ve arama tarihleri raporlanmalı.",
      "Dahil etme/dışlama ölçütleri ve seçim akışı (PRISMA akış şeması) belgelenmeli.",
      "Sağlık alanında protokolün önceden kaydı (ör. PROSPERO) beklenebilir.",
    ],
  },
  kapsam_derlemesi: {
    etiket: "Kapsam derlemesi",
    aciklama: "Bir alandaki kanıtın kapsamını ve boşluklarını haritalayan derleme.",
    bolumler: ["ozet", "giris", "yontem", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [{ ad: "PRISMA-ScR", kapsam: "Kapsam derlemelerinin raporlanması" }],
    notlar: ["Kapsam derlemesi genellikle kanıt kalitesini değerlendirmez; amacı haritalamaktır — sonuçlar buna göre sınırlandırılmalı."],
  },
  anlatisal_derleme: {
    etiket: "Anlatısal derleme",
    aciklama: "Belirli bir konuda literatürün yorumlayıcı sentezi.",
    bolumler: ["ozet", "giris", "literatur", "tartisma", "sonuc", "kaynakca"],
    standartlar: [{ ad: "SANRA", kapsam: "Anlatısal derlemelerin niteliğini değerlendirme ölçeği" }],
    notlar: ["Sistematik bir tarama yapılmadıysa derleme sistematik ya da kapsamlı olarak tanıtılmamalı."],
  },
  meta_analiz: {
    etiket: "Meta-analiz",
    aciklama: "Birden çok çalışmanın sonuçlarının istatistiksel olarak birleştirilmesi.",
    bolumler: ["ozet", "giris", "yontem", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [
      { ad: "PRISMA 2020", kapsam: "Sistematik derleme ve meta-analizlerin raporlanması" },
      { ad: "MOOSE", kapsam: "Gözlemsel çalışmaların meta-analizi" },
    ],
    notlar: ["Heterojenlik, yayın yanlılığı ve kullanılan model (sabit/rastgele etkiler) gerekçelendirilmeli."],
  },
  vaka: {
    etiket: "Vaka çalışması / olgu sunumu",
    aciklama: "Tek bir olgunun ya da vakanın ayrıntılı incelenmesi.",
    bolumler: ["ozet", "giris", "vaka", "tartisma", "sonuc", "kaynakca"],
    standartlar: [{ ad: "CARE", kapsam: "Olgu sunumlarının raporlanması" }],
    notlar: ["Tek vakadan genelleme yapılmamalı; aydınlatılmış onam ve etik bilgisi belirtilmeli."],
  },
  yontem: {
    etiket: "Yöntem makalesi",
    aciklama: "Yeni ya da geliştirilmiş bir yöntemin, aracın veya protokolün tanıtımı.",
    bolumler: ["ozet", "giris", "yontem", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [],
    notlar: ["Yöntemin mevcut yaklaşımlarla karşılaştırması ve sınırlılıkları açıkça yazılmalı."],
  },
  teknik: {
    etiket: "Teknik / mühendislik makalesi",
    aciklama: "Model, simülasyon, deney ya da tasarım sonuçlarını sunan çalışma.",
    bolumler: ["ozet", "giris", "model", "bulgular", "tartisma", "sonuc", "kaynakca"],
    standartlar: [],
    notlar: ["Sayısal sonuçlar doğrulama (verification) ve geçerleme (validation) bilgisiyle birlikte sunulmalı."],
  },
};

export const MAKALE_TURU_SIRASI = Object.keys(MAKALE_TURLERI) as MakaleTuru[];

/*
  Türlerin İngilizce metni (28.10.2026). MAKALE_TURLERI Türkçe kalıyor,
  çünkü asistanın istemi onu okuyor (lib/ai/makale-denetimi.ts) ve
  asistan istemleri Türkçe kalır. Bölüm planı ve standart adları dile
  bağlı değil; yalnızca etiket, açıklama, standart kapsamı ve notlar
  çevriliyor. Kapsam dizisi standartlar dizisiyle AYNI SIRADA.
*/
const TUR_INGILIZCE: Record<MakaleTuru, { etiket: string; aciklama: string; kapsamlar: string[]; notlar: string[] }> = {
  ozgun: {
    etiket: "Original research article",
    aciklama: "A study based on new data; most journals expect the IMRaD structure.",
    kapsamlar: [
      "Randomized controlled trials",
      "Observational studies (cohort, case-control, cross-sectional)",
      "Qualitative research",
      "Diagnostic accuracy studies",
    ],
    notlar: ["The Results section must rest only on actual analysis output.", "The Discussion should avoid generalizations that go beyond the findings."],
  },
  sistematik_derleme: {
    etiket: "Systematic review",
    aciklama: "A review conducted with a predefined protocol and a documented search and selection process.",
    kapsamlar: ["Reporting of systematic reviews"],
    notlar: [
      "Report the databases searched, the full search strings and the search dates.",
      "Document the inclusion/exclusion criteria and the selection flow (PRISMA flow diagram).",
      "In health sciences, prior registration of the protocol (e.g., PROSPERO) may be expected.",
    ],
  },
  kapsam_derlemesi: {
    etiket: "Scoping review",
    aciklama: "A review that maps the extent of the evidence in a field and its gaps.",
    kapsamlar: ["Reporting of scoping reviews"],
    notlar: ["A scoping review usually does not appraise the quality of evidence; its aim is mapping, and the conclusions should be limited accordingly."],
  },
  anlatisal_derleme: {
    etiket: "Narrative review",
    aciklama: "An interpretive synthesis of the literature on a specific topic.",
    kapsamlar: ["Scale for assessing the quality of narrative reviews"],
    notlar: ["If no systematic search was conducted, do not present the review as systematic or comprehensive."],
  },
  meta_analiz: {
    etiket: "Meta-analysis",
    aciklama: "Statistical pooling of the results of multiple studies.",
    kapsamlar: ["Reporting of systematic reviews and meta-analyses", "Meta-analysis of observational studies"],
    notlar: ["Justify the handling of heterogeneity, publication bias and the model used (fixed/random effects)."],
  },
  vaka: {
    etiket: "Case study / case report",
    aciklama: "A detailed examination of a single case.",
    kapsamlar: ["Reporting of case reports"],
    notlar: ["Do not generalize from a single case; state informed consent and ethics information."],
  },
  yontem: {
    etiket: "Methods article",
    aciklama: "Introduces a new or improved method, tool or protocol.",
    kapsamlar: [],
    notlar: ["State clearly how the method compares with existing approaches and what its limitations are."],
  },
  teknik: {
    etiket: "Technical / engineering article",
    aciklama: "A study presenting the results of a model, simulation, experiment or design.",
    kapsamlar: [],
    notlar: ["Present numerical results together with verification and validation information."],
  },
};

/** Makale türünün arayüzde gösterilecek tanımı, istenen dilde. */
export function makaleTuruTanimi(tur: MakaleTuru, dil: Dil = "tr"): TurTanimi {
  const tanim = MAKALE_TURLERI[tur];
  if (dil === "tr") return tanim;
  const en = TUR_INGILIZCE[tur];
  return {
    etiket: en.etiket,
    aciklama: en.aciklama,
    bolumler: tanim.bolumler,
    standartlar: tanim.standartlar.map((s, i) => ({ ad: s.ad, kapsam: en.kapsamlar[i] ?? s.kapsam })),
    notlar: en.notlar,
  };
}

/** Standart uyarısı, istenen dilde. */
export function standartUyarisi(dil: Dil = "tr"): string {
  return STANDART_UYARISI_METIN[dil];
}

export function makaleTuruMu(deger: unknown): deger is MakaleTuru {
  return typeof deger === "string" && Object.hasOwn(MAKALE_TURLERI, deger);
}

/*
  Yönteme göre denetim listesi (nicel, nitel, mühendislik). Asistanın
  makale bölüm denetimine bu liste verilir ve ekranda da aynı liste
  görünür: kullanıcı asistanın neye baktığını bilir.
*/
export type YontemAilesi = "nicel" | "nitel" | "karma" | "derleme" | "muhendislik";

export const YONTEM_DENETIMLERI: Record<YontemAilesi, { etiket: string; maddeler: string[] }> = {
  nicel: {
    etiket: "Nicel araştırma",
    maddeler: [
      "Araştırma sorusu ile analiz yönteminin uyumu",
      "Değişkenlerin tanımı ve ölçüm düzeyleri",
      "Örneklem büyüklüğü ve güç analizi gerekçesi",
      "Test varsayımlarının sınanması",
      "Eksik verinin nasıl ele alındığı",
      "Etki büyüklüğü ve güven aralıklarının raporlanması",
      "Sonuçların istatistiksel anlamlılığın ötesine geçmeden yorumlanması",
    ],
  },
  nitel: {
    etiket: "Nitel araştırma",
    maddeler: [
      "Araştırma sorusunun nitel yaklaşıma uygunluğu",
      "Veri toplama yaklaşımı ve katılımcı seçimi",
      "Kod kitabı ve kodlama–tema ilişkisi",
      "Alıntıların bağlamıyla verilmesi",
      "Alternatif yorumların ele alınması",
      "Araştırmacı konumu ve refleksivite",
      "Veri ile yorumun ayrılması, bulguların izlenebilirliği",
    ],
  },
  karma: {
    etiket: "Karma yöntem",
    maddeler: [
      "Nicel ve nitel bileşenlerin hangi soruya hizmet ettiği",
      "Bütünleştirme noktası ve yöntemi",
      "Her bileşenin kendi niteliğine göre raporlanması",
    ],
  },
  derleme: {
    etiket: "Derleme",
    maddeler: [
      "Arama stratejisinin, veri tabanlarının ve tarihlerin raporlanması",
      "Dahil etme ve dışlama ölçütleri",
      "Çalışmaların seçimi ve veri çıkarımı",
      "Taranmayan kaynaklar ve kapsamın sınırları",
    ],
  },
  muhendislik: {
    etiket: "Mühendislik / simülasyon",
    maddeler: [
      "Model varsayımları",
      "Geometri ve malzeme bilgileri",
      "Sınır koşulları",
      "Ağ (mesh) kalitesi ve yakınsama çalışması",
      "Çözücü ayarları",
      "Birimler ve fiziksel boyut tutarlılığı",
      "Sonuçların fiziksel tutarlılığı",
      "Doğrulama ve geçerleme; simülasyon ile deneysel sonuçların karşılaştırılması",
    ],
  },
};

/*
  Denetim listesinin İngilizcesi (28.10.2026). YONTEM_DENETIMLERI Türkçe
  kalıyor: asistanın istemine o gidiyor. Ekrandaki liste ile asistanın
  baktığı liste aynı maddeler, yalnızca dili farklı — madde sırası
  birebir korunmalı.
*/
const YONTEM_DENETIMLERI_EN: Record<YontemAilesi, { etiket: string; maddeler: string[] }> = {
  nicel: {
    etiket: "Quantitative research",
    maddeler: [
      "Fit between the research question and the analysis method",
      "Definition of variables and their levels of measurement",
      "Justification of sample size and power analysis",
      "Testing of statistical assumptions",
      "How missing data were handled",
      "Reporting of effect sizes and confidence intervals",
      "Interpreting results without going beyond statistical significance",
    ],
  },
  nitel: {
    etiket: "Qualitative research",
    maddeler: [
      "Suitability of the research question for a qualitative approach",
      "Data collection approach and participant selection",
      "Codebook and the relationship between codes and themes",
      "Quotations given with their context",
      "Consideration of alternative interpretations",
      "Researcher positionality and reflexivity",
      "Separation of data from interpretation; traceability of findings",
    ],
  },
  karma: {
    etiket: "Mixed methods",
    maddeler: [
      "Which question each quantitative and qualitative component serves",
      "Point and method of integration",
      "Reporting each component according to its own standards",
    ],
  },
  derleme: {
    etiket: "Review",
    maddeler: [
      "Reporting of the search strategy, databases and dates",
      "Inclusion and exclusion criteria",
      "Study selection and data extraction",
      "Sources not searched and the limits of the scope",
    ],
  },
  muhendislik: {
    etiket: "Engineering / simulation",
    maddeler: [
      "Model assumptions",
      "Geometry and material properties",
      "Boundary conditions",
      "Mesh quality and convergence study",
      "Solver settings",
      "Consistency of units and physical dimensions",
      "Physical consistency of the results",
      "Verification and validation; comparison of simulation and experimental results",
    ],
  },
};

/** Yöntem ailesinin ekranda gösterilen denetim listesi, istenen dilde. */
export function yontemDenetimi(aile: YontemAilesi, dil: Dil = "tr"): { etiket: string; maddeler: string[] } {
  return dil === "en" ? YONTEM_DENETIMLERI_EN[aile] : YONTEM_DENETIMLERI[aile];
}

/** Çalışmanın research_method alanı ve makale türünden denetim ailesi. */
export function yontemAilesi(arastirmaYontemi: string | null | undefined, tur?: MakaleTuru | null): YontemAilesi | null {
  if (tur === "teknik") return "muhendislik";
  if (tur === "sistematik_derleme" || tur === "kapsam_derlemesi" || tur === "anlatisal_derleme" || tur === "meta_analiz")
    return "derleme";
  switch (arastirmaYontemi) {
    case "quantitative":
      return "nicel";
    case "qualitative":
      return "nitel";
    case "mixed":
      return "karma";
    case "review":
      return "derleme";
    default:
      return null;
  }
}

/** Başlıktan bölüm türü: "2. Yöntem", "MATERIALS AND METHODS", "Gereç ve Yöntem". */
export function bolumTuru(baslik: string): BolumTuru | null {
  const aranan = normalizeHeading(baslik);
  if (!aranan) return null;
  for (const [tur, ad] of Object.entries(BOLUM_ADI) as [BolumTuru, (typeof BOLUM_ADI)[BolumTuru]][]) {
    if ([ad.tr, ad.en, ...ad.esAnlamlar].some((secenek) => normalizeHeading(secenek) === aranan)) return tur;
  }
  return null;
}

export function bolumAdi(tur: BolumTuru, dil: "tr" | "en" | "diger"): string {
  return dil === "en" ? BOLUM_ADI[tur].en : BOLUM_ADI[tur].tr;
}
