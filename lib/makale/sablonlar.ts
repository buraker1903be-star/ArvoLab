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

export const STANDART_UYARISI =
  "Kontrol listesinin doldurulmuş olması çalışmanın yöntemsel olarak geçerli olduğunu göstermez; standardın güncel sürümünü kendi sayfasından kontrol edin.";

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
