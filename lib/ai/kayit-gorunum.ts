/*
  Asistan kayıtlarının etiketleri ve tipleri.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyada yalnızca async
  fonksiyon dışa aktarılabilir; sabit ve tipler oraya konunca derleme kırılır.
*/

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

export const YETENEK_ETIKETI: Record<YetenekAdi, string> = {
  analiz: "Analiz denetimi",
  kaynakca: "Kaynakça",
  literatur: "Literatür",
  belge: "Belge geri bildirimi",
  kanit: "İddia–kanıt uyumu",
  makale: "Makale bölüm denetimi",
  uak: "ÜAK tablosu okuma",
};

export const RED_ETIKETI: Record<string, string> = {
  uydurma_sayi: "uydurma sayı",
  kunye: "künye izi",
  bos: "boş/çözümlenemedi",
  alinti: "metinde olmayan alıntı",
};

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
