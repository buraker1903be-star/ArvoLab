"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDocumentFeedback } from "@/lib/ai-feedback";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { kunyeIziMetinde } from "@/lib/ai/bulgu";

export interface AiFeedbackResponse {
  error?: string;
  feedback?: string;
  truncated?: boolean;
}

export async function requestAiFeedback(documentId: string): Promise<AiFeedbackResponse> {
  /*
    Ortak asistan kapısı (AGENTS.md: "Yeni yetenek lib/ai/erisim.ts
    kapısından geçer"). Belge geri bildirimi diğer üç yetenekten ayrı
    duruyordu: yalnızca oturum ve aboneliğe bakıyor, KREDİ kapısını ve
    KULLANICI başına saatlik hakkı hiç sormuyordu. Sonuç, kurumun yapay
    zeka kredisi bittikten sonra bile bu düğmenin model çağırmaya devam
    etmesiydi — üstelik saatlik hak da yanmadığı için sınırsızca.
  */
  const kapi = await asistanKapisi();
  if (!kapi.ok) return { error: kapi.hata };

  const supabase = await createClient();
  const { data: doc, error: docError } = await supabase
    .from("document_uploads")
    .select("extracted_text, project_id")
    .eq("id", documentId)
    .single();

  if (docError || !doc?.extracted_text) {
    return { error: "Bu belge için çıkarılmış metin bulunamadı. Önce belgeyi yükleyip analiz ettirin." };
  }

  // Hak yalnızca modele gidilecekse yanar (bkz. asistanHakkiVar).
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId);
  if (hakHatasi) return { error: hakHatasi };

  const basladi = Date.now();
  const ortak = {
    kullaniciId: kapi.kullaniciId,
    calismaId: (doc.project_id as string | null) ?? null,
    yetenek: "belge" as const,
    basladi,
  };

  try {
    const result = await getDocumentFeedback(doc.extracted_text);

    /*
      Künye izi. Bu yetenek "şu iddia kaynaksız" diyebiliyor; oradan
      "örneğin Yılmaz, A. (2019)" demeye bir adım var ve öğrenci onu
      olduğu gibi tezine yazar. Uydurma künye akademik çalışmada en ağır
      hatadır, bu yüzden cevabın tamamı düşürülüyor.

      Sayı denetimi bilerek YOK: bu yetenek sayısal bir VERİ değeri
      taşımıyor (analizdeki p değeri, kaynakçadaki cilt/sayfa gibi),
      çıktısı yapı ve retorik üzerine. Literatür taramasında olduğu gibi
      buraya sayı denetimi koymak yanlış alarm üretirdi ve yanlış alarm,
      kaçırılan uydurmadan sinsidir — kullanıcı doğru çalışan aracı
      kullanmayı bırakır.
    */
    if (kunyeIziMetinde(result.feedback)) {
      console.error("[ai] belge geri bildirimi künye içeriyor", { model: result.model });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "kunye", model: result.model, baglam: result.girdi, cikti: result.feedback });
      return { error: "Asistan kaynak künyesi ürettiği için geri bildirim gösterilmedi. Tekrar deneyebilirsiniz." };
    }

    /*
      Asistan kaydı (AGENTS.md: "Her asistan çalışması kaydedilir").
      ai_feedback_requests belge sayfasının kendi geçmişi; ai_assistant_runs
      ise ArvoLab'ın eğitim verisi ve model karşılaştırması. Bu yetenek
      ikincisine hiç yazmıyordu, yani "belge" yeteneği Asistan Kayıtları
      ekranında ve model karşılaştırmasında baştan beri görünmüyordu.
    */
    await asistanKaydet({ ...ortak, durum: "completed", model: result.model, baglam: result.girdi, cikti: result.feedback });

    /*
      Insert hatası okunmuyordu: tablo canlıda hiç oluşturulmamıştı ve geri
      bildirim geçmişi sessizce boş kalıyordu (migration 20260924100004).
      Kayıt tutulamasa da kullanıcı geri bildirimini görmeli, bu yüzden hata
      yalnızca log'a yazılır.
    */
    const { error: kayitHatasi } = await supabase.from("ai_feedback_requests").insert({
      document_id: documentId,
      requested_by: kapi.kullaniciId,
      feedback_text: result.feedback,
      model: result.model,
      status: "completed",
    });
    if (kayitHatasi) console.error("AI geri bildirimi kaydedilemedi:", kayitHatasi.message);

    revalidatePath("/dashboard/documents");
    return { feedback: result.feedback, truncated: result.truncated };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "AI geri bildirimi alınırken bir hata oluştu.";
    await asistanKaydet({ ...ortak, durum: "failed" });

    const { error: kayitHatasi } = await supabase.from("ai_feedback_requests").insert({
      document_id: documentId,
      requested_by: kapi.kullaniciId,
      status: "failed",
      error_message: message,
    });
    if (kayitHatasi) console.error("AI geri bildirimi hatası kaydedilemedi:", kayitHatasi.message);

    return { error: message };
  }
}

export interface AiFeedbackRecord {
  id: string;
  feedback_text: string | null;
  status: "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
}

/*
  Eskiden okuma hatasında da null dönüyordu: belgeler ekranı önceki
  değerlendirmeyi hiç göstermiyor, kullanıcı da yapay zekayı YENİDEN
  çalıştırıyordu. Yanlış bilginin faturası burada doğrudan para: her
  çalıştırma yeni bir asistan isteği.
*/
export async function getLatestFeedback(
  documentId: string
): Promise<{ kayit: AiFeedbackRecord | null; okunamadi: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_feedback_requests")
    .select("id, feedback_text, status, error_message, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { kayit: null, okunamadi: true };
  }
  return { kayit: data, okunamadi: false };
}
