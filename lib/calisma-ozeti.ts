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
};

export type CalismaOzeti = {
  calisma: CalismaKaydi;
  musvedde: { kelime: number; guncellendi: string } | null;
  literatur: { toplam: number; okunan: number; kullanilan: number };
  kaynakca: { id: string; skor: number | null; tarih: string } | null;
  belgeSayisi: number;
  danismanlikSayisi: number;
  /** Bu çalışmaya bağlı asistan denetimleri (migration 20260924100006). */
  asistan: { toplam: number; sonTarih: string | null };
};

export type Adim = {
  anahtar: string;
  baslik: string;
  aciklama: string;
  href: string;
  tamam: boolean;
};

/**
 * Çalışmanın bağlı birimlerine bakarak sıradaki adımları çıkarır.
 * Tamamlananlar da listede kalır: kullanıcı neyi yaptığını da görsün.
 */
export function siradakiAdimlar(ozet: CalismaOzeti): Adim[] {
  const { calisma, musvedde, literatur, kaynakca, belgeSayisi } = ozet;
  const yazimVar = (musvedde?.kelime ?? 0) > 0;

  return [
    {
      anahtar: "literatur",
      baslik: "Literatür topla",
      aciklama: literatur.toplam
        ? `${literatur.toplam} kaynak kayıtlı, ${literatur.okunan} okundu, ${literatur.kullanilan} kullanıldı.`
        : "Bu çalışmaya bağlı kaynak yok. Tarama asistanı arama stratejisi kurabilir.",
      href: "/dashboard/literature",
      tamam: literatur.toplam > 0,
    },
    {
      anahtar: "yazim",
      baslik: "Metni yaz",
      aciklama: yazimVar
        ? `${musvedde?.kelime.toLocaleString("tr-TR")} kelime yazıldı.`
        : "Müsvedde henüz boş. Editörde yazmaya başlayın.",
      href: `/dashboard/editor/${calisma.id}/write`,
      tamam: yazimVar,
    },
    {
      anahtar: "kaynakca",
      baslik: "Kaynakçayı denetle",
      aciklama: kaynakca
        ? `Son denetim: APA uyum ${kaynakca.skor ?? "—"}/100.`
        : literatur.kullanilan > 0 || yazimVar
          ? "Kaynakça ve atıf tutarlılığı henüz denetlenmedi."
          : "Metin ve kaynaklar hazır olunca denetleyin.",
      href: "/dashboard/citations",
      tamam: Boolean(kaynakca),
    },
    {
      anahtar: "belge",
      baslik: "Belgeyi kontrol ettir",
      aciklama: belgeSayisi
        ? `${belgeSayisi} belge yüklendi.`
        : "Tamamlanan bölümleri yükleyip biçim ve yapı kontrolü yaptırın.",
      href: "/dashboard/documents",
      tamam: belgeSayisi > 0,
    },
  ];
}

/** Bağlı birimlere göre kaba bir ilerleme yüzdesi (kullanıcının girdiği progress'ten ayrı). */
export function birimIlerlemesi(adimlar: Adim[]): number {
  if (!adimlar.length) return 0;
  return Math.round((adimlar.filter((adim) => adim.tamam).length / adimlar.length) * 100);
}
