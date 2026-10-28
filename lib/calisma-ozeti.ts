/*
  Çalışma merkezinin tipleri ve "sırada ne var" mantığı.

  Saf modül: testi tests/unit/calisma-ozeti.test.ts. Bilerek "use server"
  DEĞİL (AGENTS.md) — böyle bir dosyada yalnızca async fonksiyon dışa
  aktarılabilir.

  Adımların sırası akademik iş akışını izler: önce literatür toplanır,
  okunur ve kullanılır; yazım onunla birlikte yürür; kaynakça denetimi
  ancak yazılmış bir metin ve toplanmış kaynak varken anlamlıdır. Amaç
  kullanıcıyı yönlendirmek değil, BİRİMLERİ BİRBİRİNE BAĞLAMAK: her adım
  ilgili sayfaya götürür.
*/

import { YEREL, type Dil, type Metin } from "@/lib/dil";
import type { Tutarsizlik } from "@/lib/calisma-tutarlilik";
import type { SubmissionChecklist } from "@/lib/submission-checklist";
import type { AppliedGuideline } from "@/lib/guideline-rules";

/*
  "Çalışma okunamadı" işareti. BURADA, çünkü app/actions/calisma-merkezi.ts
  bir "use server" dosyası ve orada yalnızca async fonksiyon export
  edilebilir (AGENTS.md: "use server dosyasındaki her export dışarıdan
  çağrılabilir bir uç noktaya dönüşür; yardımcılar ve tipler böyle
  dosyalarda durmaz"). Sabiti oraya koymak derlemeyi düşürüyordu.

  Ayrımın kendisi şart: okunamayan çalışma için notFound() çizmek
  kullanıcıya tezinin olmadığını söylemekti.
*/
export const CALISMA_OKUNAMADI = "okunamadi" as const;

export type CalismaKaydi = {
  id: string;
  title: string;
  project_type: string;
  status: string;
  progress: number;
  university: string | null;
  institute: string | null;
  department: string | null;
  citation_style: string;
  research_method: string | null;
  due_date: string | null;
  priority: string;
  assignee_name: string | null;
  updated_at: string;
  guideline_id: string | null;
  /** Kılavuzun örnek atıfı (lib/atif/tyk.ts); girilmemişse null. */
  ornek_atif: string | null;
};

export type CalismaOzeti = {
  calisma: CalismaKaydi;
  /** Teslim hazırlığı; müsvedde yoksa null (lib/manuscript-readiness.ts). */
  hazirlik: SubmissionChecklist | null;
  /** Editörde UYGULANAN kılavuz (katalog ya da öğrencinin yüklediği); yoksa null. */
  uygulanan: AppliedGuideline | null;
  musvedde: { kelime: number; guncellendi: string } | null;
  literatur: { toplam: number; okunan: number; kullanilan: number };
  kaynakca: { id: string; skor: number | null; tarih: string } | null;
  belgeSayisi: number;
  danismanlikSayisi: number;
  /** Bu çalışmaya bağlı asistan denetimleri (migration 20260924100006). */
  asistan: { toplam: number; sonTarih: string | null; sonBulgular: AsistanBulgusu[] };
  /** Müsvedde ile literatür listesi arasındaki tutarsızlıklar. */
  tutarsizliklar: Tutarsizlik[];
  /** Kurum adıyla eşleşen tez yazım kılavuzu; yoksa null. */
  kilavuz: {
    id: string;
    baslik: string | null;
    surum: string | null;
    kurum: string | null;
    enstitu: string | null;
    atifStili: string | null;
  } | null;
  /** Kılavuz araması başarısız; "kılavuz yok" DEMEK DEĞİL. */
  kilavuzOkunamadi: boolean;
};

export type AsistanBulgusu = { tur: string; baslik: string; aciklama: string };

export type Adim = {
  anahtar: string;
  baslik: string;
  aciklama: string;
  /*
    Adımın son hareket zamanı (ISO). BİÇİMLENDİRİLMEDEN dönüyor: bu
    modül saf kalmalı ve testleri yerel ayardan etkilenmemeli; tarihi
    ekran biçimlendiriyor.
  */
  zaman?: string | null;
  href: string;
  tamam: boolean;
};

/*
  ÇALIŞMANIN BİRİMLERİ — TEK LİSTE.

  Bu liste iki yerde ayrı ayrı yazılıydı ve ÇOKTAN AYRIŞMIŞTI: merkezin
  adım listesi dört birim sayıyordu (literatür, yazım, kaynakça, belge),
  birim sayfalarının üstündeki bağlam şeridi ise beş (artı analiz).
  Merkezdeki adımları takip eden kullanıcıya analizden hiç söz
  edilmiyordu. ArvoLab'ın kendi kabuk listesinde (lib/os/uygulamalar.ts)
  yazdığımız gerekçenin aynısı: liste ikiye ayrılırsa biri güncellenir,
  öteki unutulur.

  `adimMi`: merkezin "Bu çalışmanın birimleri" listesinde TAMAMLANMA
  işaretiyle çıkıyor mu. Analiz çıkmıyor, çünkü bu çalışmaya bağlı bir
  analizin yapılıp yapılmadığını söyleyen bir veri bugün yok — asistan
  sayacı bütün yetenekleri (kaynakça, literatür, belge) birlikte
  topluyor. Hiç dolmayacak bir onay kutusu koymak ya da başka bir şeyin
  sayısıyla doldurmak, kullanıcının yapmadığı işi yapılmış göstermek
  olurdu. Birim şeritte duruyor: gidilebiliyor, "tamamlandı"
  denmiyor.
*/
export type BirimAnahtari = "literatur" | "yazim" | "kaynakca" | "belge" | "analiz";

export type Birim = {
  anahtar: BirimAnahtari;
  /** Bağlam şeridindeki kısa ad. */
  etiket: string;
  /** Merkezdeki adım başlığı; yalnızca adım olan birimlerde. */
  adimBasligi?: string;
  adimMi: boolean;
};

export const BIRIMLER: Birim[] = [
  { anahtar: "literatur", etiket: "Literatür", adimBasligi: "Literatür topla", adimMi: true },
  { anahtar: "yazim", etiket: "Yazım", adimBasligi: "Metni yaz", adimMi: true },
  { anahtar: "kaynakca", etiket: "Kaynakça", adimBasligi: "Kaynakçayı denetle", adimMi: true },
  { anahtar: "belge", etiket: "Belge", adimBasligi: "Belgeyi kontrol ettir", adimMi: true },
  { anahtar: "analiz", etiket: "Analiz", adimMi: false },
];

/*
  BIRIMLER'in iki dilli ikizi. BIRIMLER'in tipi değişmedi (çağıranlar
  `etiket`i dizgi olarak okuyor); Türkçe değerler BIRIMLER ile birebir
  aynı olmalı — testi bunu sabitliyor.
*/
export const BIRIM_METINLERI: Record<BirimAnahtari, { etiket: Metin; adimBasligi?: Metin }> = {
  literatur: { etiket: { tr: "Literatür", en: "Literature" }, adimBasligi: { tr: "Literatür topla", en: "Gather literature" } },
  yazim: { etiket: { tr: "Yazım", en: "Writing" }, adimBasligi: { tr: "Metni yaz", en: "Write the text" } },
  kaynakca: { etiket: { tr: "Kaynakça", en: "References" }, adimBasligi: { tr: "Kaynakçayı denetle", en: "Check the reference list" } },
  belge: { etiket: { tr: "Belge", en: "Document" }, adimBasligi: { tr: "Belgeyi kontrol ettir", en: "Have the document checked" } },
  analiz: { etiket: { tr: "Analiz", en: "Analysis" } },
};

/** Birimin bağlam şeridindeki kısa adı, istenen dilde. */
export function birimEtiketi(anahtar: BirimAnahtari, dil: Dil = "tr"): string {
  return BIRIM_METINLERI[anahtar].etiket[dil];
}

/*
  Birimin adresi. Yazım çalışmanın KENDİ adresinde, ötekiler bağlamı
  sorgu değişkeniyle taşıyor; bu fark da tek yerde dursun.
*/
export function birimYolu(anahtar: BirimAnahtari, calismaId: string): string {
  if (anahtar === "yazim") return `/dashboard/editor/${calismaId}/write`;
  const yollar: Record<Exclude<BirimAnahtari, "yazim">, string> = {
    literatur: "/dashboard/literature",
    kaynakca: "/dashboard/citations",
    belge: "/dashboard/documents",
    analiz: "/dashboard/analysis",
  };
  return `${yollar[anahtar]}?calisma=${calismaId}`;
}

/**
 * Çalışmanın bağlı birimlerine bakarak sıradaki adımları çıkarır.
 * Tamamlananlar da listede kalır: kullanıcı neyi yaptığını da görsün.
 */
/*
  Adımların GERÇEKTEN ihtiyaç duyduğu alanlar. Tam CalismaOzeti
  istenseydi ana sayfa adımları çizebilmek için çalışma merkezinin
  bütün sorgularını (danışmanlık, asistan, kılavuz, tutarsızlık)
  tekrarlamak zorunda kalırdı — ya da ikinci bir adım listesi yazılırdı,
  ki bu dosyanın başındaki notun anlattığı hata tam olarak odur.

  CalismaOzeti bu daraltmayı zaten karşılıyor; merkez tarafında hiçbir
  şey değişmiyor.
*/
export type AdimGirdisi = Pick<CalismaOzeti, "calisma" | "musvedde" | "literatur" | "kaynakca" | "belgeSayisi">;

export function siradakiAdimlar(ozet: AdimGirdisi, dil: Dil = "tr"): Adim[] {
  const { calisma, musvedde, literatur, kaynakca, belgeSayisi } = ozet;
  const yazimVar = (musvedde?.kelime ?? 0) > 0;
  const t = (metin: Metin) => metin[dil];

  /*
    Her adımın yalnızca DEĞİŞEN yanı burada; başlık ve sıra BIRIMLER'den
    geliyor. Eskiden adımlar burada dizi olarak elle yazılıyordu ve
    bağlam şeridindeki liste ayrı bir dosyadaydı — ikisi ayrışmıştı.
  */
  const durum: Record<string, Pick<Adim, "aciklama" | "tamam" | "zaman">> = {
    literatur: {
      aciklama: literatur.toplam
        ? t({
            tr: `${literatur.toplam} kaynak kayıtlı, ${literatur.okunan} okundu, ${literatur.kullanilan} kullanıldı.`,
            en: `${literatur.toplam} ${literatur.toplam === 1 ? "source" : "sources"} saved, ${literatur.okunan} read, ${literatur.kullanilan} used.`,
          })
        : t({
            tr: "Bu çalışmaya bağlı kaynak yok. Tarama asistanı arama stratejisi kurabilir.",
            en: "No sources are linked to this work yet. The search assistant can build a search strategy.",
          }),
      tamam: literatur.toplam > 0,
      zaman: null,
    },
    yazim: {
      aciklama: yazimVar
        ? t({
            tr: `${musvedde?.kelime.toLocaleString("tr-TR")} kelime yazıldı.`,
            en: `${musvedde?.kelime.toLocaleString(YEREL.en)} ${musvedde?.kelime === 1 ? "word" : "words"} written.`,
          })
        : t({ tr: "Müsvedde henüz boş. Editörde yazmaya başlayın.", en: "The draft is still empty. Start writing in the editor." }),
      tamam: yazimVar,
      zaman: yazimVar ? musvedde?.guncellendi : null,
    },
    kaynakca: {
      /*
        "APA uyum" YAZMIYOR: puan çalışmanın KENDİ atıf stiline göre
        hesaplanıyor ve o stil üniversiteden üniversiteye değişiyor
        (IEEE, Vancouver, Chicago…). Sabit bir stil adı yazmak, IEEE
        kullanan bir tezde yanlış bilgi vermekti.
      */
      aciklama: kaynakca
        ? t({
            tr: `Son denetim: kaynakça uyumu ${kaynakca.skor ?? "—"}/100.`,
            en: `Last check: reference list compliance ${kaynakca.skor ?? "—"}/100.`,
          })
        : literatur.kullanilan > 0 || yazimVar
          ? t({ tr: "Kaynakça ve atıf tutarlılığı henüz denetlenmedi.", en: "Reference list and citation consistency have not been checked yet." })
          : t({ tr: "Metin ve kaynaklar hazır olunca denetleyin.", en: "Run the check once the text and sources are ready." }),
      tamam: Boolean(kaynakca),
      zaman: kaynakca?.tarih ?? null,
    },
    belge: {
      aciklama: belgeSayisi
        ? t({ tr: `${belgeSayisi} belge yüklendi.`, en: `${belgeSayisi} ${belgeSayisi === 1 ? "document" : "documents"} uploaded.` })
        : t({
            tr: "Tamamlanan bölümleri yükleyip biçim ve yapı kontrolü yaptırın.",
            en: "Upload finished chapters to have their formatting and structure checked.",
          }),
      tamam: belgeSayisi > 0,
      zaman: null,
    },
  };

  return BIRIMLER.filter((birim) => birim.adimMi).map((birim) => ({
    anahtar: birim.anahtar,
    baslik: t(BIRIM_METINLERI[birim.anahtar].adimBasligi ?? BIRIM_METINLERI[birim.anahtar].etiket),
    href: birimYolu(birim.anahtar, calisma.id),
    ...durum[birim.anahtar],
  }));
}

/** Bağlı birimlere göre kaba bir ilerleme yüzdesi (kullanıcının girdiği progress'ten ayrı). */
export function birimIlerlemesi(adimlar: Adim[]): number {
  if (!adimlar.length) return 0;
  return Math.round((adimlar.filter((adim) => adim.tamam).length / adimlar.length) * 100);
}

/**
 * Çalışmanın atıf stili ile kılavuzun istediği stil çelişiyor mu?
 * Ekosistemin asıl işi bu: iki birim ayrı ayrı doğru ama birlikte yanlışsa
 * bunu kimse fark etmiyordu.
 */
export function atifStiliCelisiyorMu(ozet: CalismaOzeti): boolean {
  const kilavuzStili = ozet.kilavuz?.atifStili;
  return Boolean(kilavuzStili && kilavuzStili !== ozet.calisma.citation_style);
}
