/*
  Asistan kayıtlarının etiketleri ve tipleri.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyada yalnızca async
  fonksiyon dışa aktarılabilir; sabit ve tipler oraya konunca derleme kırılır.
*/

import type { UserRole } from "@/lib/project-labels";

/** Kayıtları görebilen roller; RLS politikasıyla aynı küme (20260924100005). */
export const KAYIT_ROLLERI: UserRole[] = ["controller", "academic_manager", "system_admin", "founder"];

export type YetenekAdi = "analiz" | "kaynakca" | "literatur" | "belge";

export const YETENEK_ETIKETI: Record<YetenekAdi, string> = {
  analiz: "Analiz denetimi",
  kaynakca: "Kaynakça",
  literatur: "Literatür",
  belge: "Belge geri bildirimi",
};

export const RED_ETIKETI: Record<string, string> = {
  uydurma_sayi: "uydurma sayı",
  kunye: "künye izi",
  bos: "boş/çözümlenemedi",
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
