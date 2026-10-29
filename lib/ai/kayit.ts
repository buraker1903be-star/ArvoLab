/*
  Asistan çalışmalarının kaydı (migration 20260924100005).

  Neden asıl değerli şey bu: model değişebilir, sağlayıcı değişebilir, ama
  ArvoLab'ın kendi modelini eğitecek olan gerçek akademik girdiler, asistanın
  çıktıları ve kullanıcının "bu işime yaradı mı" yanıtıdır. Bu tablo
  birikmeden ince ayar konuşulamaz.

  Kayıt akışı hiçbir koşulda düşürmez: kullanıcı cevabını almalı, kayıt
  tutulamıyorsa yalnızca log'a düşer. Eskiden ai_feedback_requests'te insert
  hatası hiç okunmuyordu ve tablo canlıda olmadığı için geçmiş sessizce boş
  kalıyordu (migration 20260924100004).

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyadaki her export
  dışarıdan çağrılabilir bir uç noktaya dönüşür.
*/

import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { aiKurulumu } from "./saglayici";

export type Yetenek = "analiz" | "kaynakca" | "literatur" | "belge" | "kanit" | "makale" | "uak";
export type RedNedeni = "uydurma_sayi" | "kunye" | "bos" | "alinti";

export type AsistanKaydi = {
  kullaniciId: string;
  /** Bağlı akademik çalışma; yoksa null (migration 20260924100006). */
  calismaId?: string | null;
  yetenek: Yetenek;
  durum: "completed" | "rejected" | "failed";
  redNedeni?: RedNedeni;
  model?: string;
  baglam?: string;
  cikti?: string;
  bulgular?: unknown;
  basladi: number;
};

/** Sunucu adresinden yalnızca ana makine adı; sır ya da yol içermez. */
function sunucuAdi() {
  try {
    return new URL(aiKurulumu().tabanUrl).host;
  } catch {
    return null;
  }
}

/** Kaydı yazar, kimliğini döner. Başarısız olursa null — akış sürer. */
/*
  Satır service_role ile yazılır, oturum istemcisiyle DEĞİL
  (20261029133812). Tarayıcıya açık INSERT, kullanıcının sahte bir
  "completed" satırla kurumun bütün kredisini sıfırlamasına izin
  veriyordu: kredi tetikleyicisi prompt_chars'a güveniyor. Çağıranlar
  kullaniciId'yi doğrulanmış oturumdan (asistanKapisi) veriyor; bu
  fonksiyon tarayıcıdan çağrılamaz ("use server" değil).
*/
export async function asistanKaydet(kayit: AsistanKaydi): Promise<string | null> {
  try {
    const supabase = adminIstemcisiVarsa();
    if (!supabase) {
      console.error("[ai] çalışma kaydı yazılamadı: Supabase sunucu anahtarı eksik.");
      return null;
    }
    const { data, error } = await supabase
      .from("ai_assistant_runs")
      .insert({
        user_id: kayit.kullaniciId,
        project_id: kayit.calismaId ?? null,
        capability: kayit.yetenek,
        status: kayit.durum,
        reject_reason: kayit.redNedeni ?? null,
        model: kayit.model ?? aiKurulumu().model,
        provider: sunucuAdi(),
        context: kayit.baglam ?? null,
        output: kayit.cikti ?? null,
        findings: kayit.bulgular ?? null,
        prompt_chars: kayit.baglam?.length ?? null,
        output_chars: kayit.cikti?.length ?? null,
        duration_ms: Date.now() - kayit.basladi,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ai] çalışma kaydı yazılamadı:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (hata) {
    console.error("[ai] çalışma kaydı yazılamadı:", hata instanceof Error ? hata.message : hata);
    return null;
  }
}
