/*
  Asistan kayıtlarının etiketleri ve tipleri.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyada yalnızca async
  fonksiyon dışa aktarılabilir; sabit ve tipler oraya konunca derleme kırılır.
*/

import type { Dil, Metin } from "@/lib/dil";
import type { UserRole } from "@/lib/project-labels";

/*
  Asistan Kayıtları sayfasını görebilen roller: YALNIZCA İÇ EKİP
  (26.10.2026, kurum sahibinin kararı). Eskiden Kontrolör ve Akademik
  Yönetici de görüyordu; sayfanın işi model karşılaştırması ve ince ayar
  verisi — kurum personelinin bu ekranda yapacağı bir iş yok, ekranda ise
  öğrencilerin modele giden ham metni duruyor.

  RLS bilerek DARALTILMADI (20260924100028): gözetim rolleri kendi
  kurumlarının kayıtlarını okumaya devam ediyor, çünkü personelin Çalışma
  özeti son asistan çalışmasını oradan gösteriyor (calisma-merkezi.ts).
  Bu küme sayfanın, menünün ve sayfanın sunucu işlemlerinin kapısı.
*/
export const KAYIT_ROLLERI: UserRole[] = ["system_admin", "founder"];

export type YetenekAdi = "analiz" | "kaynakca" | "literatur" | "belge" | "kanit" | "makale" | "uak";

/*
  İki dilli kaynak *_METIN; eski Türkçe haritalar ondan türetiliyor (tipi
  değişmedi, çağıranlar dizgi okuyor).
*/
export const YETENEK_ETIKETI_METIN: Record<YetenekAdi, Metin> = {
  analiz: { tr: "Analiz denetimi", en: "Analysis check" },
  kaynakca: { tr: "Kaynakça", en: "Reference list" },
  literatur: { tr: "Literatür", en: "Literature" },
  belge: { tr: "Belge geri bildirimi", en: "Document feedback" },
  kanit: { tr: "İddia–kanıt uyumu", en: "Claim–evidence match" },
  makale: { tr: "Makale bölüm denetimi", en: "Article section check" },
  uak: { tr: "ÜAK tablosu okuma", en: "ÜAK table reading" },
};

export const YETENEK_ETIKETI = Object.fromEntries(
  Object.entries(YETENEK_ETIKETI_METIN).map(([anahtar, metin]) => [anahtar, metin.tr]),
) as Record<YetenekAdi, string>;

export const yetenekEtiketi = (yetenek: YetenekAdi, dil: Dil = "tr") => YETENEK_ETIKETI_METIN[yetenek][dil];

export const RED_ETIKETI_METIN: Record<string, Metin> = {
  uydurma_sayi: { tr: "uydurma sayı", en: "fabricated number" },
  kunye: { tr: "künye izi", en: "citation trace" },
  bos: { tr: "boş/çözümlenemedi", en: "empty/unparseable" },
  alinti: { tr: "metinde olmayan alıntı", en: "quote not in text" },
};

export const RED_ETIKETI: Record<string, string> = Object.fromEntries(
  Object.entries(RED_ETIKETI_METIN).map(([anahtar, metin]) => [anahtar, metin.tr]),
);

/** Ret sebebinin etiketi; bilinmeyen sebep olduğu gibi döner. */
export const redEtiketi = (sebep: string, dil: Dil = "tr") => RED_ETIKETI_METIN[sebep]?.[dil] ?? sebep;

export type AsistanKayitSatiri = {
  id: string;
  created_at: string;
  capability: YetenekAdi;
  status: "completed" | "rejected" | "failed";
  reject_reason: string | null;
  model: string | null;
  rating: string | null;
  duration_ms: number | null;
  prompt_chars: number | null;
  output_chars: number | null;
  context: string | null;
  output: string | null;
};

export type ModelOzeti = {
  model: string;
  toplam: number;
  tamamlanan: number;
  reddedilen: number;
  basarisiz: number;
  faydali: number;
  kismen: number;
  faydasiz: number;
  puanlanan: number;
  ortSure: number;
  toplamKarakter: number;
};
